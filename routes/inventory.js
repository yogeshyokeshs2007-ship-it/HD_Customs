const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET all inventory items
router.get('/', (req, res) => {
  try {
    const { category, search, low_stock } = req.query;
    let query = 'SELECT *, (quantity <= min_threshold) as is_low_stock FROM inventory WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (low_stock === 'true') {
      query += ' AND quantity <= min_threshold';
    }

    if (search) {
      query += ' AND (item_name LIKE ? OR item_code LIKE ? OR supplier LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY is_low_stock DESC, category ASC, item_name ASC';
    const items = db.prepare(query).all(...params);
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE new inventory item
router.post('/', (req, res) => {
  try {
    const { item_name, category, quantity, unit, min_threshold, unit_price, supplier } = req.body;
    if (!item_name || !category) {
      return res.status(400).json({ error: 'Item name and category required' });
    }

    const code = 'INV-' + category.substring(0, 3).toUpperCase() + '-' + Math.floor(10 + Math.random() * 90);

    const stmt = db.prepare(`
      INSERT INTO inventory (item_code, item_name, category, quantity, unit, min_threshold, unit_price, supplier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      code,
      item_name,
      category,
      parseFloat(quantity) || 0,
      unit || 'Liters',
      parseFloat(min_threshold) || 2,
      parseFloat(unit_price) || 0,
      supplier || 'Local Distributor'
    );

    res.status(201).json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: 'Inventory item added'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADJUST stock (+ or -)
router.post('/:id/adjust', (req, res) => {
  try {
    const { delta } = req.body;
    const change = parseFloat(delta);
    if (isNaN(change)) {
      return res.status(400).json({ error: 'Valid numeric delta required' });
    }

    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const newQty = Math.max(0, item.quantity + change);
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, item.id);

    res.json({
      success: true,
      new_quantity: newQty,
      is_low_stock: newQty <= item.min_threshold,
      message: `Stock updated to ${newQty} ${item.unit}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE inventory item
router.put('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { item_name, category, quantity, unit, min_threshold, unit_price, supplier } = req.body;

    db.prepare(`
      UPDATE inventory SET
        item_name = ?,
        category = ?,
        quantity = ?,
        unit = ?,
        min_threshold = ?,
        unit_price = ?,
        supplier = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      item_name || item.item_name,
      category || item.category,
      quantity !== undefined ? parseFloat(quantity) : item.quantity,
      unit || item.unit,
      min_threshold !== undefined ? parseFloat(min_threshold) : item.min_threshold,
      unit_price !== undefined ? parseFloat(unit_price) : item.unit_price,
      supplier !== undefined ? supplier : item.supplier,
      item.id
    );

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE item
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
