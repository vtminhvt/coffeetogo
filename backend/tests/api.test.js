// Set env FIRST, before any requires
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const { closeDb } = require('../src/config/database');

afterAll(() => closeDb());

describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth', () => {
  const customer = { name: 'Nguyen Van A', email: 'customer@test.com', password: 'pass1234', role: 'customer' };
  const owner = { name: 'Tran Thi B', email: 'owner@test.com', password: 'pass1234', role: 'shop_owner' };
  const delivery = { name: 'Le Van C', email: 'delivery@test.com', password: 'pass1234', role: 'delivery' };

  it('registers a customer', async () => {
    const res = await request(app).post('/api/auth/register').send(customer);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('customer');
  });

  it('registers a shop owner', async () => {
    const res = await request(app).post('/api/auth/register').send(owner);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('shop_owner');
  });

  it('registers a delivery person', async () => {
    const res = await request(app).post('/api/auth/register').send(delivery);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('delivery');
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(customer);
    expect(res.status).toBe(409);
  });

  it('logs in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: customer.email, password: customer.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: customer.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns user info', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email: customer.email, password: customer.password });
    const token = loginRes.body.token;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(customer.email);
  });
});

describe('Shops & Products', () => {
  let ownerToken, shopId, productId, customerToken;

  beforeAll(async () => {
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'owner@test.com', password: 'pass1234' });
    ownerToken = ownerLogin.body.token;
    const custLogin = await request(app).post('/api/auth/login').send({ email: 'customer@test.com', password: 'pass1234' });
    customerToken = custLogin.body.token;
  });

  it('creates a shop', async () => {
    const res = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Highlands Coffee', address: '123 Nguyen Hue, HCM', commission_rate: 0.1 });
    expect(res.status).toBe(201);
    shopId = res.body.id;
    expect(shopId).toBeTruthy();
  });

  it('customer cannot create a shop', async () => {
    const res = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Fake Shop', address: 'Somewhere' });
    expect(res.status).toBe(403);
  });

  it('lists shops', async () => {
    const res = await request(app).get('/api/shops');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('adds a product to shop', async () => {
    const res = await request(app)
      .post(`/api/shops/${shopId}/products`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Ca phe sua da', price: 35000, category: 'Coffee' });
    expect(res.status).toBe(201);
    productId = res.body.id;
  });

  it('gets shop detail with products', async () => {
    const res = await request(app).get(`/api/shops/${shopId}`);
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.products[0].name).toBe('Ca phe sua da');
  });
});

describe('Orders & Commission', () => {
  let customerToken, ownerToken, deliveryToken;
  let shopId, productId, orderId;

  beforeAll(async () => {
    const c = await request(app).post('/api/auth/login').send({ email: 'customer@test.com', password: 'pass1234' });
    customerToken = c.body.token;
    const o = await request(app).post('/api/auth/login').send({ email: 'owner@test.com', password: 'pass1234' });
    ownerToken = o.body.token;
    const d = await request(app).post('/api/auth/login').send({ email: 'delivery@test.com', password: 'pass1234' });
    deliveryToken = d.body.token;

    // Get the shop and product created in previous suite
    const shops = await request(app).get('/api/shops');
    shopId = shops.body[0].id;
    const shopDetail = await request(app).get(`/api/shops/${shopId}`);
    productId = shopDetail.body.products[0].id;
  });

  it('customer places an order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shop_id: shopId, items: [{ product_id: productId, quantity: 2 }], delivery_address: '456 Le Loi, HCM' });
    expect(res.status).toBe(201);
    orderId = res.body.id;
    expect(res.body.subtotal).toBe(70000); // 35000 * 2
    expect(res.body.commission_amount).toBe(7000); // 10%
    expect(res.body.total).toBe(85000); // subtotal + 15000 delivery fee
  });

  it('customer can see their orders', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('shop owner confirms order', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  it('shop owner moves order to preparing', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'preparing' });
    expect(res.status).toBe(200);
  });

  it('shop owner marks order ready', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ready' });
    expect(res.status).toBe(200);
  });

  it('delivery person accepts and starts delivery', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'delivering' });
    expect(res.status).toBe(200);
  });

  it('delivery person completes delivery', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
  });

  it('commission is marked paid after delivery', async () => {
    const res = await request(app).get('/api/commissions').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.commissions[0].status).toBe('paid');
    expect(res.body.summary.totalPaid).toBe(7000);
  });
});
