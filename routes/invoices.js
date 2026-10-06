const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET all invoices
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (status && status !== 'All') {
      query += ' AND payment_status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR bike_model LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY id DESC';
    const invoices = db.prepare(query).all(...params).map(inv => ({
      ...inv,
      items: JSON.parse(inv.items_json || '[]')
    }));

    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single invoice
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    invoice.items = JSON.parse(invoice.items_json || '[]');
    res.json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE new invoice
router.post('/', (req, res) => {
  try {
    const {
      job_id,
      customer_name,
      customer_phone,
      bike_model,
      items,
      discount,
      paid_amount,
      payment_method,
      notes
    } = req.body;

    if (!customer_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and valid item list required' });
    }

    const year = new Date().getFullYear();
    const countRow = db.prepare('SELECT count(*) as count FROM invoices').get();
    const nextSeq = String(countRow.count + 1).padStart(3, '0');
    const invoice_number = `INV-${year}-${nextSeq}`;

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.qty || 1) * parseFloat(item.rate || 0)), 0);
    const disc = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - disc);
    const paid = parseFloat(paid_amount) || 0;
    const balance = Math.max(0, total - paid);

    let payment_status = 'Unpaid';
    if (paid >= total && total > 0) {
      payment_status = 'Paid';
    } else if (paid > 0) {
      payment_status = 'Partial';
    }

    const stmt = db.prepare(`
      INSERT INTO invoices (
        invoice_number, job_id, customer_name, customer_phone, bike_model,
        items_json, subtotal, discount, tax_rate, total_amount, paid_amount,
        balance_due, payment_method, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      invoice_number,
      job_id ? parseInt(job_id) : null,
      customer_name,
      customer_phone || '',
      bike_model || 'Motorcycle',
      JSON.stringify(items),
      subtotal,
      disc,
      total,
      paid,
      balance,
      payment_method || 'UPI',
      payment_status,
      notes || ''
    );

    // If linked to a job, optionally synchronize job payments
    if (job_id) {
      db.prepare(`
        UPDATE jobs SET
          total_amount = ?,
          advance_paid = ?,
          balance_due = ?
        WHERE id = ?
      `).run(total, paid, balance, job_id);
    }

    res.status(201).json({
      success: true,
      id: Number(result.lastInsertRowid),
      invoice_number,
      total,
      balance,
      payment_status,
      message: 'Invoice created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE invoice payment
router.put('/:id', (req, res) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { paid_amount, payment_method, notes } = req.body;
    const paid = paid_amount !== undefined ? parseFloat(paid_amount) : inv.paid_amount;
    const balance = Math.max(0, inv.total_amount - paid);

    let payment_status = 'Unpaid';
    if (paid >= inv.total_amount && inv.total_amount > 0) {
      payment_status = 'Paid';
    } else if (paid > 0) {
      payment_status = 'Partial';
    }

    db.prepare(`
      UPDATE invoices SET
        paid_amount = ?,
        balance_due = ?,
        payment_method = ?,
        payment_status = ?,
        notes = ?
      WHERE id = ?
    `).run(
      paid,
      balance,
      payment_method || inv.payment_method,
      payment_status,
      notes !== undefined ? notes : inv.notes,
      inv.id
    );

    // Update job if linked
    if (inv.job_id) {
      db.prepare(`
        UPDATE jobs SET advance_paid = ?, balance_due = ? WHERE id = ?
      `).run(paid, balance, inv.job_id);
    }

    res.json({ success: true, message: 'Invoice updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE invoice
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
