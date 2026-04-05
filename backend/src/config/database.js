'use strict';

require('dotenv').config();

// ---------------------------------------------------------------------------
// Dummy SQL type descriptors — used by routes for .input(name, type, value).
// In production the real mssql module overrides this export after connecting.
// In test mode these are ignored by MockRequest anyway.
// ---------------------------------------------------------------------------
const sql = {
  Int: 'Int',
  BigInt: 'BigInt',
  Float: 'Float',
  Bit: 'Bit',
  DateTime2: 'DateTime2',
  Date: 'Date',
  MAX: 'MAX',
  NVarChar: (n) => `NVarChar(${n})`,
  VarChar: (n) => `VarChar(${n})`,
  Decimal: (p, s) => `Decimal(${p},${s})`,
};

let _pool = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function getPool() {
  if (_pool) return _pool;

  if (process.env.NODE_ENV === 'test') {
    _pool = _createMockPool();
    return _pool;
  }

  const mssql = require('mssql');
  // Copy real type helpers so routes always import from this module
  Object.assign(sql, mssql);

  const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    database: process.env.DB_NAME || 'CoffeeToGo',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };

  _pool = new mssql.ConnectionPool(config);
  await _pool.connect();
  await _initMssqlSchema(_pool);
  return _pool;
}

async function closePool() {
  if (!_pool) return;
  if (process.env.NODE_ENV === 'test') {
    if (_pool._db) _pool._db.close();
  } else {
    await _pool.close();
  }
  _pool = null;
}

// ---------------------------------------------------------------------------
// MSSQL production schema (idempotent — uses IF OBJECT_ID checks)
// ---------------------------------------------------------------------------
async function _initMssqlSchema(pool) {
  const statements = [
    `IF OBJECT_ID(N'dbo.users', N'U') IS NULL
     CREATE TABLE users (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       name            NVARCHAR(255)  NOT NULL,
       email           NVARCHAR(255)  NOT NULL UNIQUE,
       phone           NVARCHAR(50),
       password        NVARCHAR(255)  NOT NULL,
       role            NVARCHAR(20)   NOT NULL
                       CHECK(role IN ('customer','shop_owner','delivery','admin')),
       created_at      DATETIME2      DEFAULT GETDATE()
     )`,

    `IF OBJECT_ID(N'dbo.refresh_tokens', N'U') IS NULL
     CREATE TABLE refresh_tokens (
       id          INT IDENTITY(1,1) PRIMARY KEY,
       user_id     INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       token       NVARCHAR(512) NOT NULL UNIQUE,
       expires_at  DATETIME2     NOT NULL,
       created_at  DATETIME2     DEFAULT GETDATE()
     )`,

    `IF OBJECT_ID(N'dbo.shops', N'U') IS NULL
     CREATE TABLE shops (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       owner_id        INT            NOT NULL REFERENCES users(id),
       name            NVARCHAR(255)  NOT NULL,
       description     NVARCHAR(MAX),
       address         NVARCHAR(500)  NOT NULL,
       phone           NVARCHAR(50),
       image_url       NVARCHAR(500),
       commission_rate FLOAT          NOT NULL DEFAULT 0.1,
       is_open         BIT            NOT NULL DEFAULT 1,
       created_at      DATETIME2      DEFAULT GETDATE()
     )`,

    `IF OBJECT_ID(N'dbo.products', N'U') IS NULL
     CREATE TABLE products (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       shop_id         INT            NOT NULL REFERENCES shops(id),
       name            NVARCHAR(255)  NOT NULL,
       description     NVARCHAR(MAX),
       price           FLOAT          NOT NULL,
       category        NVARCHAR(100),
       image_url       NVARCHAR(500),
       is_available    BIT            NOT NULL DEFAULT 1,
       created_at      DATETIME2      DEFAULT GETDATE()
     )`,

    `IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
     CREATE TABLE orders (
       id                INT IDENTITY(1,1) PRIMARY KEY,
       customer_id       INT            NOT NULL REFERENCES users(id),
       shop_id           INT            NOT NULL REFERENCES shops(id),
       delivery_id       INT            REFERENCES users(id),
       status            NVARCHAR(20)   NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending','confirmed','preparing','ready','delivering','delivered','cancelled')),
       delivery_address  NVARCHAR(500)  NOT NULL,
       delivery_fee      FLOAT          NOT NULL DEFAULT 0,
       subtotal          FLOAT          NOT NULL DEFAULT 0,
       commission_amount FLOAT          NOT NULL DEFAULT 0,
       total             FLOAT          NOT NULL DEFAULT 0,
       notes             NVARCHAR(MAX),
       created_at        DATETIME2      DEFAULT GETDATE(),
       updated_at        DATETIME2      DEFAULT GETDATE()
     )`,

    `IF OBJECT_ID(N'dbo.order_items', N'U') IS NULL
     CREATE TABLE order_items (
       id          INT IDENTITY(1,1) PRIMARY KEY,
       order_id    INT   NOT NULL REFERENCES orders(id),
       product_id  INT   NOT NULL REFERENCES products(id),
       quantity    INT   NOT NULL DEFAULT 1,
       unit_price  FLOAT NOT NULL,
       subtotal    FLOAT NOT NULL
     )`,

    `IF OBJECT_ID(N'dbo.commissions', N'U') IS NULL
     CREATE TABLE commissions (
       id         INT IDENTITY(1,1) PRIMARY KEY,
       order_id   INT           NOT NULL UNIQUE REFERENCES orders(id),
       shop_id    INT           NOT NULL REFERENCES shops(id),
       amount     FLOAT         NOT NULL,
       rate       FLOAT         NOT NULL,
       status     NVARCHAR(10)  NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','paid')),
       created_at DATETIME2     DEFAULT GETDATE()
     )`,
  ];

  for (const stmt of statements) {
    await pool.request().batch(stmt);
  }
}

// ---------------------------------------------------------------------------
// Test-mode SQLite-backed MockPool
// ---------------------------------------------------------------------------
function _createMockPool() {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  _initSQLiteSchema(db);

  const pool = {
    _db: db,
    request() { return new _MockRequest(db); },
    transaction() { return new _MockTransaction(db); },
  };
  return pool;
}

function _initSQLiteSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      phone      TEXT,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('customer','shop_owner','delivery','admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shops (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id        INTEGER NOT NULL REFERENCES users(id),
      name            TEXT NOT NULL,
      description     TEXT,
      address         TEXT NOT NULL,
      phone           TEXT,
      image_url       TEXT,
      commission_rate REAL NOT NULL DEFAULT 0.1,
      is_open         INTEGER NOT NULL DEFAULT 1,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id      INTEGER NOT NULL REFERENCES shops(id),
      name         TEXT NOT NULL,
      description  TEXT,
      price        REAL NOT NULL,
      category     TEXT,
      image_url    TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id       INTEGER NOT NULL REFERENCES users(id),
      shop_id           INTEGER NOT NULL REFERENCES shops(id),
      delivery_id       INTEGER REFERENCES users(id),
      status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','confirmed','preparing','ready','delivering','delivered','cancelled')),
      delivery_address  TEXT NOT NULL,
      delivery_fee      REAL NOT NULL DEFAULT 0,
      subtotal          REAL NOT NULL DEFAULT 0,
      commission_amount REAL NOT NULL DEFAULT 0,
      total             REAL NOT NULL DEFAULT 0,
      notes             TEXT,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity   INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal   REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL UNIQUE REFERENCES orders(id),
      shop_id    INTEGER NOT NULL REFERENCES shops(id),
      amount     REAL NOT NULL,
      rate       REAL NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ---------------------------------------------------------------------------
// MockRequest — mimics mssql's Request chainable API over better-sqlite3
// ---------------------------------------------------------------------------
class _MockRequest {
  constructor(db) {
    this._db = db;
    this._params = {};
  }

  /**
   * Supports both:
   *   .input(name, type, value)  — MSSQL style (type ignored in mock)
   *   .input(name, value)        — shorthand
   */
  input(name, typeOrValue, value) {
    this._params[name] = value !== undefined ? value : typeOrValue;
    return this;
  }

  async query(sqlText) {
    return this._run(sqlText);
  }

  async batch(sqlText) {
    return this._run(sqlText);
  }

  _run(sqlText) {
    // Handle MSSQL OUTPUT INSERTED.<col> clause
    const outputMatch = sqlText.match(/\bOUTPUT\s+INSERTED\.(\w+)\b/i);
    let cleanSql = sqlText;
    let outputCol = null;

    if (outputMatch) {
      outputCol = outputMatch[1];
      cleanSql = sqlText.replace(/\bOUTPUT\s+INSERTED\.\w+\b/i, '').replace(/\s+/g, ' ').trim();
    }

    const trimmed = cleanSql.trim().toUpperCase();

    if (outputCol) {
      const result = this._db.prepare(cleanSql).run(this._params);
      const id = result.lastInsertRowid;
      return {
        recordset: [{ [outputCol]: id }],
        recordsets: [[{ [outputCol]: id }]],
        rowsAffected: [result.changes],
      };
    }

    if (trimmed.startsWith('SELECT')) {
      const rows = this._db.prepare(cleanSql).all(this._params);
      return {
        recordset: rows,
        recordsets: [rows],
        rowsAffected: [],
      };
    }

    const result = this._db.prepare(cleanSql).run(this._params);
    return {
      recordset: [],
      recordsets: [],
      rowsAffected: [result.changes],
    };
  }
}

// ---------------------------------------------------------------------------
// MockTransaction — wraps SQLite BEGIN/COMMIT/ROLLBACK
// ---------------------------------------------------------------------------
class _MockTransaction {
  constructor(db) {
    this._db = db;
    this._begun = false;
  }

  async begin() {
    this._db.prepare('BEGIN').run();
    this._begun = true;
  }

  async commit() {
    this._db.prepare('COMMIT').run();
    this._begun = false;
  }

  async rollback() {
    if (this._begun) {
      this._db.prepare('ROLLBACK').run();
      this._begun = false;
    }
  }

  request() {
    return new _MockRequest(this._db);
  }
}

module.exports = { getPool, closePool, sql };

