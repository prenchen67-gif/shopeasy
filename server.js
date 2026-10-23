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
    customerName: { type: String, required: true },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    size: { type: String }, // কাস্টমারের সিলেক্ট করা সাইজ রাখার জন্য
    address: { type: String, required: true },
    txnId: { type: String, required: true },
    phone: { type: String, required: true },
    status: { type: String, default: 'Pending' }
}, { timestamps: true });

// Safe Model Compilation (Prevents Overwrite Error)
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

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

// --- PUBLIC & DASHBOARD ROUTES ---
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date() }));

// 1. Get All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
});

// 2. Add New Product (Dashboard API)
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

// 3. Get All Orders (For Dashboard Table)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
});

// 4. Submit Order (From Website)
app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, productName, price, address, txnId, phone } = req.body;
        
        if (!customerName || !phone || !address || !productName) {
            return res.status(400).json({ error: 'Missing required customer information' });
        }

        const newOrder = new Order({
            customerName,
            productName,
            price,
            address,
            txnId: txnId || '',
            phone,
            status: 'Pending'
        });

        await newOrder.save();
        res.json({ success: true, order: newOrder });
    } catch (err) {
        res.status(500).json({ error: 'Failed to place order', details: err.message });
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

// Get Admin Orders (Protected)
app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Fallback HTML route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ShopEasy backend running on port ${PORT}`);
});
                        
