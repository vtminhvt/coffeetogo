const express = require('express');
const { getPool, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/shops — list all open shops (public)
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const shops = (await pool.request().query(`
      SELECT s.id, s.name, s.description, s.address, s.phone, s.image_url, s.is_open,
             u.name AS owner_name
      FROM shops s
      JOIN users u ON u.id = s.owner_id
      ORDER BY s.created_at DESC
    `)).recordset;
    res.json(shops);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shops/:id — shop detail with products
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const shop = (await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT s.*, u.name AS owner_name
        FROM shops s JOIN users u ON u.id = s.owner_id
        WHERE s.id = @id
      `)).recordset[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const products = (await pool.request()
      .input('shop_id', sql.Int, req.params.id)
      .query('SELECT * FROM products WHERE shop_id = @shop_id ORDER BY category, name')).recordset;

    res.json({ ...shop, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shops — create shop (shop_owner only)
router.post('/', authenticate, authorize('shop_owner', 'admin'), async (req, res) => {
  const { name, description, address, phone, image_url, commission_rate } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'name and address are required' });
  }

  try {
    const pool = await getPool();
    const inserted = (await pool.request()
      .input('owner_id', sql.Int, req.user.id)
      .input('name', sql.NVarChar(255), name)
      .input('description', sql.NVarChar('max'), description || null)
      .input('address', sql.NVarChar(500), address)
      .input('phone', sql.NVarChar(50), phone || null)
      .input('image_url', sql.NVarChar(500), image_url || null)
      .input('commission_rate', sql.Float, commission_rate ?? 0.1)
      .query(`
        INSERT INTO shops (owner_id, name, description, address, phone, image_url, commission_rate)
        OUTPUT INSERTED.id
        VALUES (@owner_id, @name, @description, @address, @phone, @image_url, @commission_rate)
      `)).recordset[0];

    res.status(201).json({ id: inserted.id, name, address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/shops/:id — update shop
router.put('/:id', authenticate, authorize('shop_owner', 'admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const shop = (await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM shops WHERE id = @id')).recordset[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, description, address, phone, image_url, is_open } = req.body;
    await pool.request()
      .input('name', sql.NVarChar(255), name ?? null)
      .input('description', sql.NVarChar('max'), description ?? null)
      .input('address', sql.NVarChar(500), address ?? null)
      .input('phone', sql.NVarChar(50), phone ?? null)
      .input('image_url', sql.NVarChar(500), image_url ?? null)
      .input('is_open', sql.Bit, is_open != null ? (is_open ? 1 : 0) : null)
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE shops SET
          name        = COALESCE(@name, name),
          description = COALESCE(@description, description),
          address     = COALESCE(@address, address),
          phone       = COALESCE(@phone, phone),
          image_url   = COALESCE(@image_url, image_url),
          is_open     = COALESCE(@is_open, is_open)
        WHERE id = @id
      `);

    res.json({ message: 'Shop updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shops/:id/products — add product
router.post('/:id/products', authenticate, authorize('shop_owner', 'admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const shop = (await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM shops WHERE id = @id')).recordset[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, description, price, category, image_url } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const inserted = (await pool.request()
      .input('shop_id', sql.Int, req.params.id)
      .input('name', sql.NVarChar(255), name)
      .input('description', sql.NVarChar('max'), description || null)
      .input('price', sql.Float, price)
      .input('category', sql.NVarChar(100), category || null)
      .input('image_url', sql.NVarChar(500), image_url || null)
      .query(`
        INSERT INTO products (shop_id, name, description, price, category, image_url)
        OUTPUT INSERTED.id
        VALUES (@shop_id, @name, @description, @price, @category, @image_url)
      `)).recordset[0];

    res.status(201).json({ id: inserted.id, name, price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/shops/:shopId/products/:productId — update product
router.put('/:shopId/products/:productId', authenticate, authorize('shop_owner', 'admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const shop = (await pool.request()
      .input('id', sql.Int, req.params.shopId)
      .query('SELECT * FROM shops WHERE id = @id')).recordset[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, description, price, category, image_url, is_available } = req.body;
    await pool.request()
      .input('name', sql.NVarChar(255), name ?? null)
      .input('description', sql.NVarChar('max'), description ?? null)
      .input('price', sql.Float, price ?? null)
      .input('category', sql.NVarChar(100), category ?? null)
      .input('image_url', sql.NVarChar(500), image_url ?? null)
      .input('is_available', sql.Bit, is_available != null ? (is_available ? 1 : 0) : null)
      .input('productId', sql.Int, req.params.productId)
      .input('shopId', sql.Int, req.params.shopId)
      .query(`
        UPDATE products SET
          name         = COALESCE(@name, name),
          description  = COALESCE(@description, description),
          price        = COALESCE(@price, price),
          category     = COALESCE(@category, category),
          image_url    = COALESCE(@image_url, image_url),
          is_available = COALESCE(@is_available, is_available)
        WHERE id = @productId AND shop_id = @shopId
      `);

    res.json({ message: 'Product updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/shops/:shopId/products/:productId — delete product
router.delete('/:shopId/products/:productId', authenticate, authorize('shop_owner', 'admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const shop = (await pool.request()
      .input('id', sql.Int, req.params.shopId)
      .query('SELECT * FROM shops WHERE id = @id')).recordset[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (req.user.role !== 'admin' && shop.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.request()
      .input('productId', sql.Int, req.params.productId)
      .input('shopId', sql.Int, req.params.shopId)
      .query('DELETE FROM products WHERE id = @productId AND shop_id = @shopId');

    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

