// server.js — ShopEasy backend (Express + MongoDB Atlas)
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
let JWT_SECRET = process.env.JWT_SECRET || 'shopeasy_super_secret_key_123';
const MONGO_URI = process.env.MONGO_URI;

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use(cors());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Serve Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('WARNING: MONGO_URI environment variable missing!');
}

// Database Schemas & Models
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    sizes: [{ type: String }], // Array for sizes like ['S', 'M', 'L']
    price: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String }
}, { timestamps: true });


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

// Auto Seed Default Admin User
async function seedAdmin() {
  try {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (MONGO_URI) {
      await mongoose.connection.asPromise();
      const existingAdmin = await Admin.findOne({ username });
      if (!existingAdmin) {
        const hash = await bcrypt.hash(password, 10);
        await Admin.create({ username, password_hash: hash });
        console.log(`Default Admin created -> Username: ${username}, Password: ${password}`);
      } else {
        console.log(`Admin user '${username}' is ready.`);
      }
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
}
seedAdmin();

// Auth Middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized: No token provided' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
  try {
    const data = jwt.verify(parts[1], JWT_SECRET);
    req.admin = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- PUBLIC ROUTES ---
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date() }));

// Get Products
app.get('/api/products', async (req, res) => {
app.post('/api/products', async (req, res) => {
    try {
        const { name, category, sizes, price, image, description } = req.body;
        
        const newProduct = new Product({
            name,
            category,
            sizes,
            price,
            image,
            description
        });

        await newProduct.save();
        res.status(201).json({ message: 'Product successfully added!', product: newProduct });
    } catch (error) {
        res.status(500).json({ message: 'Error adding product', error: error.message });
    }
});
                              

// Submit Order
app.post('/api/orders', async (req, res) => {
  const { product, price, name, phone, address, method, txnid } = req.body;
  if (!name || !phone || !address) {
    return res.status(400).json({ error: 'Missing required customer information' });
  }
  try {
    const newOrder = await Order.create({
      product,
      price,
      customer_name: name,
      phone,
      address,
      payment_method: method || 'Cash on Delivery',
      txnid: txnid || ''
    });
    res.json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// --- ADMIN ROUTES ---

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login server error' });
  }
});

// Get Admin Orders
app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Add New Product (Admin)
app.post('/api/admin/products', authMiddleware, async (req, res) => {
  const { title, price, image, desc, varieties, category } = req.body;
  if (!title || !price) {
    return res.status(400).json({ error: 'Title and Price are required' });
  }
  try {
    const newProd = await Product.create({
      title,
      price,
      image: image || '',
      desc: desc || '',
      varieties: varieties || 'Default',
      category: category || 'all'
    });
    res.json({ success: true, product: newProd });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Fallback HTML route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ShopEasy backend running on port ${PORT}`);
});
