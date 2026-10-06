const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { db } = require('../db/database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'showcase-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// GET all showcase projects
router.get('/', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM gallery ORDER BY featured DESC, id DESC').all();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE showcase project
router.post('/', upload.fields([{ name: 'after_image', maxCount: 1 }, { name: 'before_image', maxCount: 1 }]), (req, res) => {
  try {
    const { title, bike_model, category, description, featured } = req.body;
    if (!title || !bike_model) {
      return res.status(400).json({ error: 'Title and bike model are required' });
    }

    let after_image = req.files && req.files.after_image ? `uploads/${req.files.after_image[0].filename}` : 'assets/hero.jpg';
    let before_image = req.files && req.files.before_image ? `uploads/${req.files.before_image[0].filename}` : null;

    const result = db.prepare(`
      INSERT INTO gallery (title, bike_model, category, before_image, after_image, description, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      bike_model,
      category || 'Custom Bike Painting',
      before_image,
      after_image,
      description || '',
      featured ? 1 : 0
    );

    res.status(201).json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: 'Showcase project published'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIKE showcase item
router.post('/:id/like', (req, res) => {
  try {
    db.prepare('UPDATE gallery SET likes_count = likes_count + 1 WHERE id = ?').run(req.params.id);
    const item = db.prepare('SELECT likes_count FROM gallery WHERE id = ?').get(req.params.id);
    res.json({ success: true, likes: item ? item.likes_count : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE showcase item
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, message: 'Project removed from showcase' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
