// server.js — ShopEasy backend (Express + SQLite)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this';
const DB_FILE = process.env.DB_FILE || './shopeasy.db';

// Initialize DB
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Create tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    price TEXT,
    image TEXT,
    desc TEXT,
    varieties TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    price TEXT,
    customer_name TEXT,
    phone TEXT,
    address TEXT,
    payment_method TEXT,
    txnid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Seed admin from env (only if ADMIN_PASSWORD provided and user not exists)
(async () => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (password) {
    const row = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (!row) {
      const hash = await bcrypt.hash(password, 10);
      db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
      console.log('Admin user seeded:', username);
    } else {
      console.log('Admin already exists:', username);
    }
  } else {
    console.log('No ADMIN_PASSWORD in env — skip seeding admin');
  }
})();

// Helpers
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized' });
  const token = parts[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.admin = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Serve frontend at root
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/orders',
  body('product').notEmpty(),
  body('price').notEmpty(),
  body('name').notEmpty(),
  body('phone').notEmpty(),
  body('address').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { product, price, name, phone, address, method, txnid } = req.body;
    const stmt = db.prepare(`INSERT INTO orders (product, price, customer_name, phone, address, payment_method, txnid) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(product, price, name, phone, address, method || '', txnid || '');
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, order });
  }
);

app.post('/api/admin/login',
  body('username').notEmpty(),
  body('password').notEmpty(),
  async (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken({ id: admin.id, username: admin.username });
    res.json({ token });
  }
);

// Protected admin routes
app.get('/api/admin/orders', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/admin/products', authMiddleware,
  body('title').notEmpty(),
  body('price').notEmpty(),
  (req, res) => {
    const { title, price, image, desc, varieties, category } = req.body;
    const info = db.prepare(`INSERT INTO products (title, price, image, desc, varieties, category) VALUES (?, ?, ?, ?, ?, ?)`).run(title, price, image||'', desc||'', varieties||'', category||'');
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, product: prod });
  }
);

app.listen(PORT, () => {
  console.log(`ShopEasy backend running on http://localhost:${PORT}`);
});
