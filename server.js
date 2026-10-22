// server.js — ShopEasy backend (Express + MongoDB)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const app = express();

// CONFIG / ENV
const PORT = process.env.PORT || 4000;
let JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI; // MongoDB connection string
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set.');
    process.exit(1);
  } else {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
}

// Security & Middlewares
app.use(helmet());
app.use(express.json({ limit: '64kb' }));

if (CLIENT_ORIGIN === '*' || CLIENT_ORIGIN === '') {
  app.use(cors());
} else {
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB Connection
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('WARNING: MONGO_URI is not set in environment variables!');
}

// Database Schemas & Models
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true }
});

const productSchema = new mongoose.Schema({
  title: String,
  price: String,
  image: String,
  desc: String,
  varieties: String,
  category: String,
  created_at: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  product: String,
  price: String,
  customer_name: String,
  phone: String,
  address: String,
  payment_method: String,
  txnid: String,
  created_at: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

// Seed Admin
(async () => {
  try {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    if (password && MONGO_URI) {
      await mongoose.connection.asPromise();
      const existingAdmin = await Admin.findOne({ username });
      if (!existingAdmin) {
        const hash = await bcrypt.hash(password, 10);
        await Admin.create({ username, password_hash: hash });
        console.log('Admin user seeded:', username);
      } else {
        console.log('Admin already exists:', username);
      }
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
})();

// Helpers
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const data = jwt.verify(parts[1], JWT_SECRET);
    req.admin = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Routes
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ created_at: -1 });
    // Transform _id to id for frontend compatibility
    const formatted = products.map(p => ({
      id: p._id,
      title: p.title,
      price: p.price,
      image: p.image,
      desc: p.desc,
      varieties: p.varieties,
      category: p.category
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
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
    try {
      const newOrder = await Order.create({
        product,
        price,
        customer_name: name,
        phone,
        address,
        payment_method: method || '',
        txnid: txnid || ''
      });
      res.json({ success: true, order: newOrder });
    } catch (err) {
      res.status(500).json({ error: 'Failed to place order' });
    }
  }
);

app.post('/api/admin/login',
  body('username').notEmpty(),
  body('password').notEmpty(),
  async (req, res) => {
    const { username, password } = req.body;
    try {
      const admin = await Admin.findOne({ username });
      if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, admin.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = generateToken({ id: admin._id, username: admin.username });
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: 'Login server error' });
    }
  }
);

app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/admin/products', authMiddleware,
  body('title').notEmpty(),
  body('price').notEmpty(),
  async (req, res) => {
    const { title, price, image, desc, varieties, category } = req.body;
    try {
      const newProd = await Product.create({
        title,
        price,
        image: image || '',
        desc: desc || '',
        varieties: varieties || '',
        category: category || ''
      });
      res.json({ success: true, product: newProd });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add product' });
    }
  }
);

app.listen(PORT, () => {
  console.log(`ShopEasy backend running on port ${PORT}`);
});
