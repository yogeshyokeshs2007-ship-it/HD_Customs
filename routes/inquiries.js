const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET all inquiries
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM inquiries WHERE 1=1';
    const params = [];

    if (status && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR bike_model LIKE ? OR tracking_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY id DESC';
    const inquiries = db.prepare(query).all(...params);
    res.json({ success: true, count: inquiries.length, inquiries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new inquiry from website or quote calculator
router.post('/', (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      bike_model,
      service_type,
      finish_type,
      requirements,
      estimated_budget
    } = req.body;

    if (!customer_name || !customer_phone) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const year = new Date().getFullYear();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const tracking_code = `INQ-${year}-${randomNum}`;

    const stmt = db.prepare(`
      INSERT INTO inquiries (
        tracking_code, customer_name, customer_phone, customer_email,
        bike_model, service_type, finish_type, requirements, estimated_budget, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', '')
    `);

    const result = stmt.run(
      tracking_code,
      customer_name,
      customer_phone,
      customer_email || '',
      bike_model || 'Unspecified Motorcycle',
      service_type || 'Custom Bike Painting',
      finish_type || 'Custom Finish',
      requirements || '',
      parseFloat(estimated_budget) || 0
    );

    res.status(201).json({
      success: true,
      id: Number(result.lastInsertRowid),
      tracking_code,
      message: 'Inquiry submitted successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE inquiry status or details
router.put('/:id', (req, res) => {
  try {
    const inq = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(req.params.id);
    if (!inq) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    const { status, notes, estimated_budget } = req.body;

    db.prepare(`
      UPDATE inquiries SET
        status = ?,
        notes = ?,
        estimated_budget = ?
      WHERE id = ?
    `).run(
      status || inq.status,
      notes !== undefined ? notes : inq.notes,
      estimated_budget !== undefined ? parseFloat(estimated_budget) : inq.estimated_budget,
      inq.id
    );

    res.json({ success: true, message: 'Inquiry updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONVERT inquiry to active Job
router.post('/:id/convert', (req, res) => {
  try {
    const inq = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(req.params.id);
    if (!inq) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    const year = new Date().getFullYear();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const tracking_code = `HDC-${year}-${randomNum}`;
    const total = parseFloat(req.body.total_amount || inq.estimated_budget) || 25000;
    const advance = parseFloat(req.body.advance_paid) || 0;
    const balance = Math.max(0, total - advance);

    const jobResult = db.prepare(`
      INSERT INTO jobs (
        tracking_code, customer_name, customer_phone, bike_model,
        service_type, color_finish, current_stage, stage_progress,
        total_amount, advance_paid, balance_due, status,
        start_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'Consultation & Intake', 10, ?, ?, ?, 'In Progress', ?, ?)
    `).run(
      tracking_code,
      inq.customer_name,
      inq.customer_phone,
      inq.bike_model,
      inq.service_type,
      inq.finish_type || 'Custom Finish',
      total,
      advance,
      balance,
      new Date().toISOString().split('T')[0],
      `Converted from inquiry ${inq.tracking_code}. Requirements: ${inq.requirements || 'N/A'}`
    );

    // Add first timeline record
    db.prepare(`
      INSERT INTO job_timeline (job_id, stage_name, title, notes)
      VALUES (?, 'Consultation & Intake', 'Converted from Website Inquiry', ?)
    `).run(jobResult.lastInsertRowid, `Inquiry ${inq.tracking_code} converted to active project.`);

    // Mark inquiry as Converted
    db.prepare("UPDATE inquiries SET status = 'Converted' WHERE id = ?").run(inq.id);

    res.status(201).json({
      success: true,
      jobId: Number(jobResult.lastInsertRowid),
      tracking_code,
      message: `Inquiry converted to active job #${tracking_code}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE inquiry
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    res.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
