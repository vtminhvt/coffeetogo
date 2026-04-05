const express = require('express');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const DELIVERY_FEE = 15000; // VND

// POST /api/orders — create order (customer)
router.post('/', authenticate, authorize('customer'), (req, res) => {
  const { shop_id, items, delivery_address, notes } = req.body;
  if (!shop_id || !items || !items.length || !delivery_address) {
    return res.status(400).json({ error: 'shop_id, items and delivery_address are required' });
  }
  const db = getDb();
  const shop = db.prepare('SELECT * FROM shops WHERE id = ? AND is_open = 1').get(shop_id);
  if (!shop) return res.status(404).json({ error: 'Shop not found or closed' });

  // Validate items and compute totals
  let subtotal = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ? AND is_available = 1').get(item.product_id, shop_id);
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

  const insertOrder = db.transaction(() => {
    const orderResult = db.prepare(`
      INSERT INTO orders (customer_id, shop_id, delivery_address, delivery_fee, subtotal, commission_amount, total, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, shop_id, delivery_address, DELIVERY_FEE, subtotal, commission_amount, total, notes || null);
    const orderId = orderResult.lastInsertRowid;

    for (const { product, qty, lineTotal } of resolvedItems) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, product.id, qty, product.price, lineTotal);
    }

    // Create commission record
    db.prepare(`
      INSERT INTO commissions (order_id, shop_id, amount, rate)
      VALUES (?, ?, ?, ?)
    `).run(orderId, shop_id, commission_amount, shop.commission_rate);

    return orderId;
  });

  const orderId = insertOrder();
  res.status(201).json({ id: orderId, status: 'pending', subtotal, delivery_fee: DELIVERY_FEE, commission_amount, total });
});

// GET /api/orders — list orders for current user
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  let orders;
  if (req.user.role === 'customer') {
    orders = db.prepare(`
      SELECT o.*, s.name AS shop_name, s.address AS shop_address
      FROM orders o JOIN shops s ON s.id = o.shop_id
      WHERE o.customer_id = ? ORDER BY o.created_at DESC
    `).all(req.user.id);
  } else if (req.user.role === 'shop_owner') {
    const myShops = db.prepare('SELECT id FROM shops WHERE owner_id = ?').all(req.user.id).map(s => s.id);
    if (!myShops.length) return res.json([]);
    orders = db.prepare(`
      SELECT o.*, s.name AS shop_name, u.name AS customer_name
      FROM orders o
      JOIN shops s ON s.id = o.shop_id
      JOIN users u ON u.id = o.customer_id
      WHERE o.shop_id IN (${myShops.map(() => '?').join(',')})
      ORDER BY o.created_at DESC
    `).all(...myShops);
  } else if (req.user.role === 'delivery') {
    orders = db.prepare(`
      SELECT o.*, s.name AS shop_name, s.address AS shop_address, u.name AS customer_name
      FROM orders o JOIN shops s ON s.id = o.shop_id JOIN users u ON u.id = o.customer_id
      WHERE o.status = 'ready' OR o.delivery_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);
  } else {
    // admin
    orders = db.prepare(`
      SELECT o.*, s.name AS shop_name, u.name AS customer_name
      FROM orders o JOIN shops s ON s.id = o.shop_id JOIN users u ON u.id = o.customer_id
      ORDER BY o.created_at DESC
    `).all();
  }
  res.json(orders);
});

// GET /api/orders/:id — order detail
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, s.name AS shop_name, s.address AS shop_address,
           u.name AS customer_name, u.phone AS customer_phone,
           d.name AS delivery_name, d.phone AS delivery_phone
    FROM orders o
    JOIN shops s ON s.id = o.shop_id
    JOIN users u ON u.id = o.customer_id
    LEFT JOIN users d ON d.id = o.delivery_id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Access control
  const uid = req.user.id;
  const role = req.user.role;
  if (role === 'customer' && order.customer_id !== uid) return res.status(403).json({ error: 'Forbidden' });
  if (role === 'delivery' && order.delivery_id !== uid && order.status !== 'ready') return res.status(403).json({ error: 'Forbidden' });
  if (role === 'shop_owner') {
    const shop = db.prepare('SELECT owner_id FROM shops WHERE id = ?').get(order.shop_id);
    if (!shop || shop.owner_id !== uid) return res.status(403).json({ error: 'Forbidden' });
  }

  const items = db.prepare(`
    SELECT oi.*, p.name AS product_name
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(req.params.id);
  res.json({ ...order, items });
});

// PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const role = req.user.role;
  const uid = req.user.id;

  const allowedTransitions = {
    shop_owner: {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing'],
      preparing: ['ready'],
    },
    delivery: {
      ready: ['delivering'],
      delivering: ['delivered'],
    },
    customer: {
      pending: ['cancelled'],
    },
    admin: {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing'],
      preparing: ['ready'],
      ready: ['delivering'],
      delivering: ['delivered'],
    },
  };

  const allowed = (allowedTransitions[role] || {})[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status} as ${role}` });
  }

  // Ownership checks
  if (role === 'shop_owner') {
    const shop = db.prepare('SELECT owner_id FROM shops WHERE id = ?').get(order.shop_id);
    if (!shop || shop.owner_id !== uid) return res.status(403).json({ error: 'Forbidden' });
  }
  if (role === 'delivery') {
    if (status === 'delivering') {
      db.prepare('UPDATE orders SET delivery_id = ? WHERE id = ?').run(uid, order.id);
    } else if (order.delivery_id !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  if (role === 'customer' && order.customer_id !== uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, order.id);

  // Mark commission paid when order delivered
  if (status === 'delivered') {
    db.prepare("UPDATE commissions SET status = 'paid' WHERE order_id = ?").run(order.id);
  }

  res.json({ id: order.id, status });
});

module.exports = router;
