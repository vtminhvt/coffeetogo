const express = require('express');
const { getPool, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const DELIVERY_FEE = 15000; // VND

// ---------------------------------------------------------------------------
// POST /api/orders — create order (customer)
// ---------------------------------------------------------------------------
router.post('/', authenticate, authorize('customer'), async (req, res) => {
  const { shop_id, items, delivery_address, notes } = req.body;
  if (!shop_id || !items || !items.length || !delivery_address) {
    return res.status(400).json({ error: 'shop_id, items and delivery_address are required' });
  }

  try {
    const pool = await getPool();

    const shop = (await pool.request()
      .input('shop_id', sql.Int, shop_id)
      .query('SELECT * FROM shops WHERE id = @shop_id AND is_open = 1')).recordset[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found or closed' });

    // Validate items and compute totals
    let subtotal = 0;
    const resolvedItems = [];
    for (const item of items) {
      const product = (await pool.request()
        .input('product_id', sql.Int, item.product_id)
        .input('shop_id', sql.Int, shop_id)
        .query('SELECT * FROM products WHERE id = @product_id AND shop_id = @shop_id AND is_available = 1')
      ).recordset[0];
      if (!product) {
        return res.status(400).json({ error: `Product ${item.product_id} not available` });
      }
      const qty = parseInt(item.quantity) || 1;
      const lineTotal = product.price * qty;
      subtotal += lineTotal;
      resolvedItems.push({ product, qty, lineTotal });
    }
    const commission_amount = +(subtotal * shop.commission_rate).toFixed(0);
    const total = subtotal + DELIVERY_FEE;

    // Use a transaction to insert order, items, and commission atomically
    const transaction = pool.transaction();
    await transaction.begin();
    let orderId;
    try {
      const orderInserted = (await transaction.request()
        .input('customer_id', sql.Int, req.user.id)
        .input('shop_id', sql.Int, shop_id)
        .input('delivery_address', sql.NVarChar(500), delivery_address)
        .input('delivery_fee', sql.Float, DELIVERY_FEE)
        .input('subtotal', sql.Float, subtotal)
        .input('commission_amount', sql.Float, commission_amount)
        .input('total', sql.Float, total)
        .input('notes', sql.NVarChar('max'), notes || null)
        .query(`
          INSERT INTO orders
            (customer_id, shop_id, delivery_address, delivery_fee, subtotal, commission_amount, total, notes)
          OUTPUT INSERTED.id
          VALUES (@customer_id, @shop_id, @delivery_address, @delivery_fee, @subtotal, @commission_amount, @total, @notes)
        `)).recordset[0];
      orderId = orderInserted.id;

      for (const { product, qty, lineTotal } of resolvedItems) {
        await transaction.request()
          .input('order_id', sql.Int, orderId)
          .input('product_id', sql.Int, product.id)
          .input('quantity', sql.Int, qty)
          .input('unit_price', sql.Float, product.price)
          .input('subtotal', sql.Float, lineTotal)
          .query(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
            VALUES (@order_id, @product_id, @quantity, @unit_price, @subtotal)
          `);
      }

      await transaction.request()
        .input('order_id', sql.Int, orderId)
        .input('shop_id', sql.Int, shop_id)
        .input('amount', sql.Float, commission_amount)
        .input('rate', sql.Float, shop.commission_rate)
        .query(`
          INSERT INTO commissions (order_id, shop_id, amount, rate)
          VALUES (@order_id, @shop_id, @amount, @rate)
        `);

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    // Notify connected clients of the new order
    const io = req.app.locals.io;
    if (io) io.to(`shop:${shop_id}`).emit('order:new', { orderId, shop_id });

    res.status(201).json({ id: orderId, status: 'pending', subtotal, delivery_fee: DELIVERY_FEE, commission_amount, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders — list orders for current user
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const role = req.user.role;
    let orders;

    if (role === 'customer') {
      orders = (await pool.request()
        .input('uid', sql.Int, req.user.id)
        .query(`
          SELECT o.*, s.name AS shop_name, s.address AS shop_address
          FROM orders o JOIN shops s ON s.id = o.shop_id
          WHERE o.customer_id = @uid ORDER BY o.created_at DESC
        `)).recordset;

    } else if (role === 'shop_owner') {
      const myShops = (await pool.request()
        .input('uid', sql.Int, req.user.id)
        .query('SELECT id FROM shops WHERE owner_id = @uid')).recordset.map(s => s.id);

      if (!myShops.length) return res.json([]);

      // Build named params for IN clause
      const paramNames = myShops.map((_, i) => `@sid${i}`).join(',');
      let req2 = pool.request();
      myShops.forEach((id, i) => req2.input(`sid${i}`, sql.Int, id));
      orders = (await req2.query(`
        SELECT o.*, s.name AS shop_name, u.name AS customer_name
        FROM orders o
        JOIN shops s ON s.id = o.shop_id
        JOIN users u ON u.id = o.customer_id
        WHERE o.shop_id IN (${paramNames})
        ORDER BY o.created_at DESC
      `)).recordset;

    } else if (role === 'delivery') {
      orders = (await pool.request()
        .input('uid', sql.Int, req.user.id)
        .query(`
          SELECT o.*, s.name AS shop_name, s.address AS shop_address, u.name AS customer_name
          FROM orders o JOIN shops s ON s.id = o.shop_id JOIN users u ON u.id = o.customer_id
          WHERE o.status = 'ready' OR o.delivery_id = @uid
          ORDER BY o.created_at DESC
        `)).recordset;

    } else {
      // admin
      orders = (await pool.request().query(`
        SELECT o.*, s.name AS shop_name, u.name AS customer_name
        FROM orders o JOIN shops s ON s.id = o.shop_id JOIN users u ON u.id = o.customer_id
        ORDER BY o.created_at DESC
      `)).recordset;
    }

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id — order detail
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const order = (await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT o.*, s.name AS shop_name, s.address AS shop_address,
               u.name AS customer_name, u.phone AS customer_phone,
               d.name AS delivery_name, d.phone AS delivery_phone
        FROM orders o
        JOIN shops s ON s.id = o.shop_id
        JOIN users u ON u.id = o.customer_id
        LEFT JOIN users d ON d.id = o.delivery_id
        WHERE o.id = @id
      `)).recordset[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const uid = req.user.id;
    const role = req.user.role;
    if (role === 'customer' && order.customer_id !== uid) return res.status(403).json({ error: 'Forbidden' });
    if (role === 'delivery' && order.delivery_id !== uid && order.status !== 'ready') return res.status(403).json({ error: 'Forbidden' });
    if (role === 'shop_owner') {
      const shop = (await pool.request()
        .input('id', sql.Int, order.shop_id)
        .query('SELECT owner_id FROM shops WHERE id = @id')).recordset[0];
      if (!shop || shop.owner_id !== uid) return res.status(403).json({ error: 'Forbidden' });
    }

    const items = (await pool.request()
      .input('order_id', sql.Int, req.params.id)
      .query(`
        SELECT oi.*, p.name AS product_name
        FROM order_items oi JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = @order_id
      `)).recordset;

    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/orders/:id/status — update order status
// ---------------------------------------------------------------------------
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;

  try {
    const pool = await getPool();
    const order = (await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM orders WHERE id = @id')).recordset[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const role = req.user.role;
    const uid = req.user.id;

    const allowedTransitions = {
      shop_owner: { pending: ['confirmed', 'cancelled'], confirmed: ['preparing'], preparing: ['ready'] },
      delivery:   { ready: ['delivering'], delivering: ['delivered'] },
      customer:   { pending: ['cancelled'] },
      admin:      { pending: ['confirmed', 'cancelled'], confirmed: ['preparing'], preparing: ['ready'], ready: ['delivering'], delivering: ['delivered'] },
    };

    const allowed = (allowedTransitions[role] || {})[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status} as ${role}` });
    }

    // Ownership checks
    if (role === 'shop_owner') {
      const shop = (await pool.request()
        .input('id', sql.Int, order.shop_id)
        .query('SELECT owner_id FROM shops WHERE id = @id')).recordset[0];
      if (!shop || shop.owner_id !== uid) return res.status(403).json({ error: 'Forbidden' });
    }
    if (role === 'delivery') {
      if (status === 'delivering') {
        await pool.request()
          .input('uid', sql.Int, uid)
          .input('id', sql.Int, order.id)
          .query('UPDATE orders SET delivery_id = @uid WHERE id = @id');
      } else if (order.delivery_id !== uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    if (role === 'customer' && order.customer_id !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.request()
      .input('status', sql.NVarChar(20), status)
      .input('id', sql.Int, order.id)
      .query('UPDATE orders SET status = @status, updated_at = CURRENT_TIMESTAMP WHERE id = @id');

    if (status === 'delivered') {
      await pool.request()
        .input('order_id', sql.Int, order.id)
        .query("UPDATE commissions SET status = 'paid' WHERE order_id = @order_id");
    }

    // Broadcast real-time status update
    const io = req.app.locals.io;
    if (io) {
      io.to(`order:${order.id}`).emit('order:status', { orderId: order.id, status });
      io.to(`shop:${order.shop_id}`).emit('order:status', { orderId: order.id, status });
    }

    res.json({ id: order.id, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

