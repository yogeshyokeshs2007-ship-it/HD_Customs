const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, hashPassword } = require('../db/database');

// In-memory or session token store
const sessions = new Map();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const inputHash = hashPassword(password);
  if (user.password_hash !== inputHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create simple auth session token
  const token = crypto.randomBytes(32).toString('hex');
  const sessionData = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  sessions.set(token, sessionData);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  res.json({ success: true, user: session });
});

router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    sessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
