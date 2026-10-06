const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { db } = require('../db/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'job-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET all jobs
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM jobs WHERE 1=1';
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
    const jobs = db.prepare(query).all(...params);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Customer Track My Bike by tracking code or phone number
router.get('/track/:query', (req, res) => {
  try {
    const { query } = req.params;
    const cleanQuery = query.trim().toUpperCase();

    // Try finding by tracking code first, then by phone
    let job = db.prepare('SELECT * FROM jobs WHERE UPPER(tracking_code) = ?').get(cleanQuery);
    if (!job) {
      job = db.prepare('SELECT * FROM jobs WHERE customer_phone LIKE ? ORDER BY id DESC').get(`%${query.trim()}%`);
    }

    if (!job) {
      return res.status(404).json({ error: 'No motorcycle build found with this tracking ID or phone number' });
    }

    const timeline = db.prepare('SELECT * FROM job_timeline WHERE job_id = ? ORDER BY id ASC').all(job.id);

    res.json({
      success: true,
      job,
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single job with timeline
router.get('/:id', (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const timeline = db.prepare('SELECT * FROM job_timeline WHERE job_id = ? ORDER BY id ASC').all(job.id);
    res.json({ success: true, job, timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE new job
router.post('/', upload.fields([{ name: 'before_photo', maxCount: 1 }, { name: 'current_photo', maxCount: 1 }]), (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      bike_model,
      reg_number,
      service_type,
      color_finish,
      current_stage,
      stage_progress,
      total_amount,
      advance_paid,
      status,
      technician,
      start_date,
      estimated_delivery,
      notes
    } = req.body;

    if (!customer_name || !customer_phone || !bike_model) {
      return res.status(400).json({ error: 'Customer name, phone, and bike model are required' });
    }

    const total = parseFloat(total_amount) || 0;
    const advance = parseFloat(advance_paid) || 0;
    const balance = Math.max(0, total - advance);

    const year = new Date().getFullYear();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const tracking_code = `HDC-${year}-${randomNum}`;

    let before_photo = req.files && req.files.before_photo ? `uploads/${req.files.before_photo[0].filename}` : null;
    let current_photo = req.files && req.files.current_photo ? `uploads/${req.files.current_photo[0].filename}` : null;

    const stmt = db.prepare(`
      INSERT INTO jobs (
        tracking_code, customer_name, customer_phone, bike_model, reg_number,
        service_type, color_finish, current_stage, stage_progress, total_amount,
        advance_paid, balance_due, status, technician, start_date, estimated_delivery,
        notes, before_photo, current_photo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      tracking_code,
      customer_name,
      customer_phone,
      bike_model,
      reg_number || '',
      service_type || 'Custom Bike Painting',
      color_finish || 'Custom Finish',
      current_stage || 'Consultation & Intake',
      parseInt(stage_progress) || 15,
      total,
      advance,
      balance,
      status || 'In Progress',
      technician || 'Hemanth (Lead Artist)',
      start_date || new Date().toISOString().split('T')[0],
      estimated_delivery || '',
      notes || '',
      before_photo,
      current_photo
    );

    // Insert first timeline entry
    db.prepare(`
      INSERT INTO job_timeline (job_id, stage_name, title, notes, photo_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      result.lastInsertRowid,
      current_stage || 'Consultation & Intake',
      'Job Created & Checked In',
      `Bike received in studio. Initial advance: ₹${advance.toLocaleString('en-IN')}`,
      before_photo
    );

    res.status(201).json({
      success: true,
      id: Number(result.lastInsertRowid),
      tracking_code,
      message: 'Job created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE job
router.put('/:id', upload.fields([{ name: 'before_photo', maxCount: 1 }, { name: 'current_photo', maxCount: 1 }]), (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const {
      customer_name,
      customer_phone,
      bike_model,
      reg_number,
      service_type,
      color_finish,
      current_stage,
      stage_progress,
      total_amount,
      advance_paid,
      status,
      technician,
      start_date,
      estimated_delivery,
      completed_date,
      notes
    } = req.body;

    const total = total_amount !== undefined ? parseFloat(total_amount) : job.total_amount;
    const advance = advance_paid !== undefined ? parseFloat(advance_paid) : job.advance_paid;
    const balance = Math.max(0, total - advance);

    let before_photo = job.before_photo;
    let current_photo = job.current_photo;

    if (req.files && req.files.before_photo) {
      before_photo = `uploads/${req.files.before_photo[0].filename}`;
    }
    if (req.files && req.files.current_photo) {
      current_photo = `uploads/${req.files.current_photo[0].filename}`;
    }

    const stmt = db.prepare(`
      UPDATE jobs SET
        customer_name = ?,
        customer_phone = ?,
        bike_model = ?,
        reg_number = ?,
        service_type = ?,
        color_finish = ?,
        current_stage = ?,
        stage_progress = ?,
        total_amount = ?,
        advance_paid = ?,
        balance_due = ?,
        status = ?,
        technician = ?,
        start_date = ?,
        estimated_delivery = ?,
        completed_date = ?,
        notes = ?,
        before_photo = ?,
        current_photo = ?
      WHERE id = ?
    `);

    stmt.run(
      customer_name || job.customer_name,
      customer_phone || job.customer_phone,
      bike_model || job.bike_model,
      reg_number !== undefined ? reg_number : job.reg_number,
      service_type || job.service_type,
      color_finish || job.color_finish,
      current_stage || job.current_stage,
      stage_progress !== undefined ? parseInt(stage_progress) : job.stage_progress,
      total,
      advance,
      balance,
      status || job.status,
      technician || job.technician,
      start_date || job.start_date,
      estimated_delivery || job.estimated_delivery,
      completed_date !== undefined ? completed_date : job.completed_date,
      notes !== undefined ? notes : job.notes,
      before_photo,
      current_photo,
      job.id
    );

    // If stage changed, add automatic timeline entry
    if (current_stage && current_stage !== job.current_stage) {
      db.prepare(`
        INSERT INTO job_timeline (job_id, stage_name, title, notes, photo_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        job.id,
        current_stage,
        `Stage advanced to ${current_stage}`,
        `Progress updated to ${stage_progress || job.stage_progress}%`,
        current_photo
      );
    }

    res.json({ success: true, message: 'Job updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD timeline stage entry to a job
router.post('/:id/timeline', upload.single('photo'), (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const { stage_name, title, notes } = req.body;
    let photo_url = req.file ? `uploads/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO job_timeline (job_id, stage_name, title, notes, photo_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      job.id,
      stage_name || job.current_stage,
      title || 'Stage Update',
      notes || '',
      photo_url
    );

    // Update job current_photo if new photo provided
    if (photo_url) {
      db.prepare('UPDATE jobs SET current_photo = ? WHERE id = ?').run(photo_url, job.id);
    }

    res.status(201).json({ success: true, message: 'Timeline update recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE job
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
