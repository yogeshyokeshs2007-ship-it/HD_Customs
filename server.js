const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure db and uploads directory exist
require('./db/database');

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Universal CORS: allow all origins including file://, localhost, custom ports
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from public folder
app.use(express.static(path.join(__dirname, 'public')));
// Also serve assets and uploads from root if accessed directly
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

// Healthcheck & Database status endpoint
app.get('/api/health', (req, res) => {
  const { db } = require('./db/database');
  const jobCount = db.prepare('SELECT count(*) as count FROM jobs').get().count;
  res.json({
    status: 'online',
    database: 'connected',
    database_file: process.env.DB_PATH || 'data/hd_customs.db',
    total_jobs: jobCount,
    timestamp: new Date().toISOString(),
    service: 'HD Customs Workshop Platform API',
    version: '2.0.0'
  });
});

// Explicit route fallbacks
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/track', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🏍️  HD CUSTOMS Platform & Backend Server Running!`);
  console.log(`📍  Customer Website: http://localhost:${PORT}`);
  console.log(`🛠️  Admin Dashboard:  http://localhost:${PORT}/dashboard.html`);
  console.log(`📡  API Endpoint:     http://localhost:${PORT}/api/health`);
  console.log(`🗄️  SQLite Database:  Connected (data/hd_customs.db)`);
  console.log('====================================================');
});
