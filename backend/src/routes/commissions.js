const express = require('express');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/commissions — admin sees all, shop_owner sees own
router.get('/', authenticate, authorize('admin', 'shop_owner'), (req, res) => {
  const db = getDb();
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`
      SELECT c.*, s.name AS shop_name, o.total AS order_total, o.created_at AS order_date
      FROM commissions c
      JOIN shops s ON s.id = c.shop_id
      JOIN orders o ON o.id = c.order_id
      ORDER BY c.created_at DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT c.*, s.name AS shop_name, o.total AS order_total, o.created_at AS order_date
      FROM commissions c
      JOIN shops s ON s.id = c.shop_id
      JOIN orders o ON o.id = c.order_id
      WHERE s.owner_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.id);
  }
  const totalPending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  res.json({ commissions: rows, summary: { totalPending, totalPaid, total: totalPending + totalPaid } });
});

// GET /api/commissions/summary — admin dashboard summary
router.get('/summary', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const totalOrders = db.prepare("SELECT COUNT(*) AS cnt FROM orders WHERE status != 'cancelled'").get().cnt;
  const deliveredOrders = db.prepare("SELECT COUNT(*) AS cnt FROM orders WHERE status = 'delivered'").get().cnt;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM commissions WHERE status = 'paid'").get().s;
  const pendingRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM commissions WHERE status = 'pending'").get().s;
  const activeShops = db.prepare("SELECT COUNT(*) AS cnt FROM shops WHERE is_open = 1").get().cnt;
  const totalUsers = db.prepare("SELECT COUNT(*) AS cnt FROM users").get().cnt;
  res.json({ totalOrders, deliveredOrders, totalRevenue, pendingRevenue, activeShops, totalUsers });
});

module.exports = router;
