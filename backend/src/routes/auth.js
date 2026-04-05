const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPool, sql } = require('../config/database');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

const router = express.Router();

const REFRESH_EXPIRES_DAYS = 30;

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  const allowedRoles = ['customer', 'shop_owner', 'delivery'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const pool = await getPool();

    const existing = (await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT id FROM users WHERE email = @email')).recordset[0];
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const inserted = (await pool.request()
      .input('name', sql.NVarChar(255), name)
      .input('email', sql.NVarChar(255), email)
      .input('phone', sql.NVarChar(50), phone || null)
      .input('password', sql.NVarChar(255), hashed)
      .input('role', sql.NVarChar(20), role)
      .query('INSERT INTO users (name, email, phone, password, role) OUTPUT INSERTED.id VALUES (@name, @email, @phone, @password, @role)')
    ).recordset[0];

    const userId = inserted.id;
    const token = jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = await _createRefreshToken(pool, userId);

    res.status(201).json({ token, refreshToken, user: { id: userId, name, email, phone, role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const pool = await getPool();
    const user = (await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT * FROM users WHERE email = @email')).recordset[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = await _createRefreshToken(pool, user.id);

    res.json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh — exchange a refresh token for a new access token
// ---------------------------------------------------------------------------
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  try {
    const pool = await getPool();
    const row = (await pool.request()
      .input('token', sql.NVarChar(512), refreshToken)
      .query(`SELECT rt.*, u.email, u.role
              FROM refresh_tokens rt
              JOIN users u ON u.id = rt.user_id
              WHERE rt.token = @token`)).recordset[0];

    if (!row) return res.status(401).json({ error: 'Invalid refresh token' });

    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    if (expiresAt < now) {
      await pool.request()
        .input('token', sql.NVarChar(512), refreshToken)
        .query('DELETE FROM refresh_tokens WHERE token = @token');
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const newToken = jwt.sign({ id: row.user_id, email: row.email, role: row.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token: newToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout — revoke the supplied refresh token
// ---------------------------------------------------------------------------
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      const pool = await getPool();
      await pool.request()
        .input('token', sql.NVarChar(512), refreshToken)
        .input('uid', sql.Int, req.user.id)
        .query('DELETE FROM refresh_tokens WHERE token = @token AND user_id = @uid');
    } catch (err) {
      console.error(err);
    }
  }
  res.json({ message: 'Logged out' });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const user = (await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = @id')).recordset[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function _createRefreshToken(pool, userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '');

  await pool.request()
    .input('user_id', sql.Int, userId)
    .input('token', sql.NVarChar(512), token)
    .input('expires_at', sql.DateTime2, expiresAt)
    .query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (@user_id, @token, @expires_at)');

  return token;
}

module.exports = router;

