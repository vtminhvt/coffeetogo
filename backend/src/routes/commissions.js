const express = require('express');
const { getPool, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/commissions — admin sees all, shop_owner sees own
router.get('/', authenticate, authorize('admin', 'shop_owner'), async (req, res) => {
  try {
    const pool = await getPool();
    let rows;

    if (req.user.role === 'admin') {
      rows = (await pool.request().query(`
        SELECT c.*, s.name AS shop_name, o.total AS order_total, o.created_at AS order_date
        FROM commissions c
        JOIN shops s ON s.id = c.shop_id
        JOIN orders o ON o.id = c.order_id
        ORDER BY c.created_at DESC
      `)).recordset;
    } else {
      rows = (await pool.request()
        .input('uid', sql.Int, req.user.id)
        .query(`
          SELECT c.*, s.name AS shop_name, o.total AS order_total, o.created_at AS order_date
          FROM commissions c
          JOIN shops s ON s.id = c.shop_id
          JOIN orders o ON o.id = c.order_id
          WHERE s.owner_id = @uid
          ORDER BY c.created_at DESC
        `)).recordset;
    }

    const totalPending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
    const totalPaid = rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
    res.json({ commissions: rows, summary: { totalPending, totalPaid, total: totalPending + totalPaid } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/commissions/summary — admin dashboard summary
router.get('/summary', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = await getPool();

    const [totalOrders, deliveredOrders, totalRevenue, pendingRevenue, activeShops, totalUsers] =
      await Promise.all([
        pool.request().query("SELECT COUNT(*) AS cnt FROM orders WHERE status != 'cancelled'"),
        pool.request().query("SELECT COUNT(*) AS cnt FROM orders WHERE status = 'delivered'"),
        pool.request().query("SELECT COALESCE(SUM(amount),0) AS s FROM commissions WHERE status = 'paid'"),
        pool.request().query("SELECT COALESCE(SUM(amount),0) AS s FROM commissions WHERE status = 'pending'"),
        pool.request().query('SELECT COUNT(*) AS cnt FROM shops WHERE is_open = 1'),
        pool.request().query('SELECT COUNT(*) AS cnt FROM users'),
      ]);

    res.json({
      totalOrders: totalOrders.recordset[0].cnt,
      deliveredOrders: deliveredOrders.recordset[0].cnt,
      totalRevenue: totalRevenue.recordset[0].s,
      pendingRevenue: pendingRevenue.recordset[0].s,
      activeShops: activeShops.recordset[0].cnt,
      totalUsers: totalUsers.recordset[0].cnt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

