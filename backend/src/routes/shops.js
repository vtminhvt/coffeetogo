const express = require('express');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/shops — list all open shops (public)
router.get('/', (req, res) => {
  const db = getDb();
  const shops = db.prepare(`
    SELECT s.id, s.name, s.description, s.address, s.phone, s.image_url, s.is_open,
           u.name AS owner_name
    FROM shops s
    JOIN users u ON u.id = s.owner_id
    ORDER BY s.created_at DESC
  `).all();
  res.json(shops);
});

// GET /api/shops/:id — shop detail with products
router.get('/:id', (req, res) => {
  const db = getDb();
  const shop = db.prepare(`
    SELECT s.*, u.name AS owner_name
    FROM shops s JOIN users u ON u.id = s.owner_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const products = db.prepare(
    'SELECT * FROM products WHERE shop_id = ? ORDER BY category, name'
  ).all(req.params.id);
  res.json({ ...shop, products });
});

// POST /api/shops — create shop (shop_owner only)
router.post('/', authenticate, authorize('shop_owner', 'admin'), (req, res) => {
  const { name, description, address, phone, image_url, commission_rate } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'name and address are required' });
  }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO shops (owner_id, name, description, address, phone, image_url, commission_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, name, description || null, address, phone || null, image_url || null, commission_rate ?? 0.1);
  res.status(201).json({ id: result.lastInsertRowid, name, address });
});

// PUT /api/shops/:id — update shop
router.put('/:id', authenticate, authorize('shop_owner', 'admin'), (req, res) => {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, description, address, phone, image_url, is_open } = req.body;
  db.prepare(`
    UPDATE shops SET name = COALESCE(?, name), description = COALESCE(?, description),
    address = COALESCE(?, address), phone = COALESCE(?, phone),
    image_url = COALESCE(?, image_url),
    is_open = COALESCE(?, is_open)
    WHERE id = ?
  `).run(name, description, address, phone, image_url, is_open != null ? (is_open ? 1 : 0) : null, req.params.id);
  res.json({ message: 'Shop updated' });
});

// POST /api/shops/:id/products — add product
router.post('/:id/products', authenticate, authorize('shop_owner', 'admin'), (req, res) => {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, description, price, category, image_url } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const result = db.prepare(`
    INSERT INTO products (shop_id, name, description, price, category, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name, description || null, price, category || null, image_url || null);
  res.status(201).json({ id: result.lastInsertRowid, name, price });
});

// PUT /api/shops/:shopId/products/:productId — update product
router.put('/:shopId/products/:productId', authenticate, authorize('shop_owner', 'admin'), (req, res) => {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, description, price, category, image_url, is_available } = req.body;
  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      category = COALESCE(?, category),
      image_url = COALESCE(?, image_url),
      is_available = COALESCE(?, is_available)
    WHERE id = ? AND shop_id = ?
  `).run(name, description, price, category, image_url, is_available != null ? (is_available ? 1 : 0) : null, req.params.productId, req.params.shopId);
  res.json({ message: 'Product updated' });
});

// DELETE /api/shops/:shopId/products/:productId — delete product
router.delete('/:shopId/products/:productId', authenticate, authorize('shop_owner', 'admin'), (req, res) => {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM products WHERE id = ? AND shop_id = ?').run(req.params.productId, req.params.shopId);
  res.json({ message: 'Product deleted' });
});

module.exports = router;
