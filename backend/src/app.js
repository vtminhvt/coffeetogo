require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shops');
const orderRoutes = require('./routes/orders');
const commissionRoutes = require('./routes/commissions');

const app = express();

app.use(cors());
app.use(express.json());

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/shops', apiLimiter, shopRoutes);
app.use('/api/orders', apiLimiter, orderRoutes);
app.use('/api/commissions', apiLimiter, commissionRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'CoffeeToGo API' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
