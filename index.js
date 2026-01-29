const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const cron = require('node-cron');
const { sendVerificationEmail, generateOTP } = require('./emailService');

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name_here') {
  console.warn('⚠️  WARNING: Cloudinary credentials are not set or are invalid placeholders. Image uploads will fail.');
  console.warn('⚠️  Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.');
}

// Set default JWT_SECRET if not provided
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL ERROR: JWT_SECRET is not set in production environment!');
    process.exit(1);
  } else {
    console.warn('⚠️ WARNING: JWT_SECRET not set, using unsafe default for development only.');
    process.env.JWT_SECRET = 'dev-secret-key-do-not-use-in-production';
  }
}


const app = express();
const PORT = process.env.PORT || 5000;

/* ======================
   SECURITY MIDDLEWARE
====================== */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const hpp = require('hpp');

// Import custom middleware
const { adminOnly, authOnly, authenticateToken } = require('./middleware/rbac');
const {
  validateRegistration,
  validateLogin,
  validateProduct,
  validateCategory,
  validateOrder,
  validateId
} = require('./middleware/validators');

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "http:"], // Added blob: and http: for flexibility
      connectSrc: ["'self'", "https:", "http:"], // Allow connecting to other origins
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images to be loaded by other domains
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - Prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  skipSuccessfulRequests: true,
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// HTTP Parameter Pollution protection
app.use(hpp());

// Request logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined')); // Detailed logging in production
} else {
  app.use(morgan('dev')); // Concise logging in development
}

/* ======================
   MIDDLEWARE
====================== */
// CORS Configuration - Restrict to specific origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://store-b-frontend.vercel.app',
  'https://store-b-admin.vercel.app',
  'https://store-b-production.up.railway.app',
  'https://store-b-dashboard-production.up.railway.app',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow any localhost origin for development
    if (origin && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ======================
   DATABASE POOL
====================== */
const DB_CONFIG = {
  host: process.env.DB_HOST || 'mysql-73b2b04-mazenalfar01.h.aivencloud.com',
  port: Number(process.env.DB_PORT || 23199),
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  ssl: {
    rejectUnauthorized: false,
  },
};

let pool;

async function getDatabaseConnection() {
  console.log(`🔄 Attempting to connect to DB (${DB_CONFIG.host})...`);
  const dbPool = mysql.createPool(DB_CONFIG);
  try {
    const connection = await dbPool.getConnection();
    connection.release();
    console.log(`✅ Connected to DB: ${DB_CONFIG.database}`);
    return dbPool;
  } catch (err) {
    console.error(`❌ DB connection failed: ${err.message}`);
    throw err;
  }
}

/* ======================
   DATABASE INITIALIZATION
====================== */
async function initDatabase() {
  pool = await getDatabaseConnection();
  const connection = await pool.getConnection();
  try {
    // Create Products table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(255) NOT NULL,
        stock INT DEFAULT 0,
        image TEXT NOT NULL,
        discount INT DEFAULT 0,
        rating DECIMAL(2, 1) DEFAULT 4.5,
        isFeatured BOOLEAN DEFAULT false,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        image TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'customer') DEFAULT 'customer',
        phone VARCHAR(255),
        isVerified BOOLEAN DEFAULT FALSE,
        isBlocked BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Add isVerified column to existing Users table (if it doesn't exist)
    try {
      await connection.query('ALTER TABLE Users ADD COLUMN isVerified BOOLEAN DEFAULT FALSE AFTER phone');
      console.log('✅ Added isVerified column to Users table');
    } catch (e) {
      // Column might already exist
      if (!e.message.includes('Duplicate column')) {
        console.log('ℹ️  isVerified column already exists or other error:', e.message);
      }
    }

    // Add isBlocked column to existing Users table (if it doesn't exist)
    try {
      await connection.query('ALTER TABLE Users ADD COLUMN isBlocked BOOLEAN DEFAULT FALSE AFTER isVerified');
      console.log('✅ Added isBlocked column to Users table');
    } catch (e) {
      // Column might already exist
      if (!e.message.includes('Duplicate column')) {
        console.log('ℹ️  isBlocked column already exists or other error:', e.message);
      }
    }

    // Set existing users as verified (migration for existing users)
    try {
      await connection.query('UPDATE Users SET isVerified = TRUE WHERE isVerified IS NULL OR createdAt < NOW()');
      console.log('✅ Marked existing users as verified');
    } catch (e) {
      console.log('ℹ️  Could not update existing users:', e.message);
    }

    // Create EmailVerifications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS EmailVerifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(255) NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_expires (expiresAt)
      )
    `);

    // Create Orders table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customerName VARCHAR(255) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(255) DEFAULT 'Pending',
        items TEXT NOT NULL,
        shippingAddress TEXT,
        UserId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (UserId) REFERENCES Users(id) ON DELETE SET NULL
      )
    `);

    // Ensure shippingAddress column exists (if table was already created)
    try {
      await connection.query('ALTER TABLE Orders ADD COLUMN shippingAddress TEXT AFTER items');
    } catch (e) {
      // Column might already exist
    }

    console.log('✅ Database tables initialized');
  } finally {
    connection.release();
  }
}

/* ======================
   MULTER & CLOUDINARY
====================== */
// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to upload to Cloudinary
// Helper function to upload to Cloudinary with retry logic
async function uploadToCloudinary(fileBuffer, folder = 'categories') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        timeout: 60000 // 60 seconds timeout
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          if (error.http_code === 499 || error.message.includes('Timeout')) {
            console.log('⚠️ Upload timed out, but proceeding with error. Consider increasing timeout.');
          }
          reject(error);
        } else {
          console.log(`✅ Cloudinary upload successful: ${result.secure_url}`);
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
}

/* ======================
   HEALTH CHECK
====================== */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

/* ======================
   AUTH ROUTES
====================== */
app.post('/api/auth/register', authLimiter, validateRegistration, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const [existing] = await pool.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const hashed = await bcrypt.hash(password, 12); // Increased salt rounds for security

    // Insert user with isVerified = TRUE (no email verification required)
    await pool.query(
      'INSERT INTO Users (name, email, password, phone, isVerified) VALUES (?, ?, ?, ?, TRUE)',
      [name, email, hashed, phone]
    );

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      email: email
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

app.post('/api/auth/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: [{ path: 'email', msg: 'No account found with this email address' }]
      });
    }

    const user = users[0];

    // Check if user is blocked (Exclude admins from being blocked to prevent lockout)
    if (user.isBlocked && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Account Blocked',
        errors: [{ path: 'email', msg: 'Your account has been blocked by the administrator.' }]
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: [{ path: 'password', msg: 'Incorrect password' }]
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// Verification rate limiter - 5 attempts per 15 minutes
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many verification attempts, please try again later.'
  }
});

// Resend rate limiter - 3 requests per hour
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Too many resend requests, please try again later.'
  }
});

/* ======================
   EMAIL VERIFICATION
====================== */
app.post('/api/auth/verify-email', verificationLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    // Check if user exists
    const [users] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Get verification record
    const [verifications] = await pool.query(
      'SELECT * FROM EmailVerifications WHERE email = ? ORDER BY createdAt DESC LIMIT 1',
      [email]
    );

    if (verifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No verification code found. Please request a new one.'
      });
    }

    const verification = verifications[0];

    // Check if code has expired
    if (new Date() > new Date(verification.expiresAt)) {
      await pool.query('DELETE FROM EmailVerifications WHERE id = ?', [verification.id]);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
        expired: true
      });
    }

    // Verify the code
    const isValid = await bcrypt.compare(code, verification.code);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Mark user as verified
    await pool.query('UPDATE Users SET isVerified = TRUE WHERE email = ?', [email]);

    // Delete verification record
    await pool.query('DELETE FROM EmailVerifications WHERE email = ?', [email]);

    console.log(`✅ Email verified successfully for: ${email}`);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

app.post('/api/auth/resend-verification', resendLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const [users] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Set expiration time (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete any existing verification codes for this email
    await pool.query('DELETE FROM EmailVerifications WHERE email = ?', [email]);

    // Store new verification code
    await pool.query(
      'INSERT INTO EmailVerifications (email, code, expiresAt) VALUES (?, ?, ?)',
      [email, hashedOTP, expiresAt]
    );

    // Send verification email
    try {
      await sendVerificationEmail(email, otp, user.name);
      console.log(`✅ Verification email resent to ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to resend verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent! Please check your email.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/* ======================
   PRODUCTS
====================== */
app.get('/api/products', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM Products');
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

app.get('/api/products/featured', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM Products WHERE isFeatured = true');
    res.json(products);
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

app.post('/api/products', adminOnly, upload.array('images', 10), validateProduct, async (req, res) => {
  try {
    console.log('📦 Received Product Creation Request');
    console.log('Files:', req.files ? req.files.length : '0');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const { title, description, price, category, stock, discount, rating, isFeatured } = req.body;

    let imageUrls = [];

    // Process uploaded files
    if (req.files && req.files.length > 0) {
      console.log(`☁️ Uploading ${req.files.length} images to Cloudinary...`);
      try {
        const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'products'));
        const results = await Promise.all(uploadPromises);
        imageUrls = results.map(r => r.secure_url);
        console.log('✅ All images uploaded successfully:', imageUrls);
      } catch (uploadError) {
        console.error('❌ One or more image uploads failed:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Image upload failed: ' + uploadError.message
        });
      }
    } else {
      // If no files uploaded, allow creation if it's not strictly required by business logic,
      // but schema is NOT NULL. So we must have something.
      console.warn('⚠️ No images uploaded for product.');
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    const imageJson = JSON.stringify(imageUrls);

    const [result] = await pool.query(
      `INSERT INTO Products (title, description, price, category, stock, image, discount, rating, isFeatured) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, price, category, stock || 0, imageJson, discount || 0, rating || 4.5, isFeatured === 'true' || isFeatured === true ? 1 : 0]
    );

    const [products] = await pool.query('SELECT * FROM Products WHERE id = ?', [result.insertId]);
    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   CATEGORIES
====================== */
app.get('/api/categories', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM Categories');
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

app.post('/api/categories', adminOnly, upload.single('image'), validateCategory, async (req, res) => {
  try {
    const { name, description } = req.body;

    console.log('📝 Creating category:', name);
    console.log('📎 File received:', req.file ? 'Yes' : 'No');

    if (!req.file) {
      console.warn('⚠️ Category creation failed: No image file provided');
      return res.status(400).json({
        success: false,
        message: 'Category image is required'
      });
    }

    // Upload to Cloudinary
    console.log('☁️ Uploading category image to Cloudinary...');
    let imageUrl;
    try {
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'categories');
      imageUrl = cloudinaryResult.secure_url;
      console.log('✅ Category image uploaded:', imageUrl);
    } catch (uploadError) {
      console.error('❌ Category image upload failed:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Image upload failed: ' + uploadError.message
      });
    }

    const [result] = await pool.query(
      'INSERT INTO Categories (name, description, image) VALUES (?, ?, ?)',
      [name, description, imageUrl]
    );

    const [categories] = await pool.query('SELECT * FROM Categories WHERE id = ?', [result.insertId]);
    console.log('✅ Category created:', categories[0]);

    res.json({
      success: true,
      data: categories[0]
    });
  } catch (error) {
    console.error('❌ Create category error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   ORDERS
====================== */
app.post('/api/orders', authOnly, validateOrder, async (req, res) => {
  try {
    const { customerName, total, status, items, shippingAddress } = req.body;
    const UserId = req.user.id; // Use authenticated user's ID

    console.log('📝 New Order Received:', {
      customer: customerName,
      total: total,
      hasItems: !!items,
      hasShipping: !!shippingAddress
    });

    if (shippingAddress) {
      console.log('📍 Shipping Address details:', JSON.stringify(shippingAddress, null, 2));
    }

    const [result] = await pool.query(
      'INSERT INTO Orders (customerName, total, status, items, UserId, shippingAddress) VALUES (?, ?, ?, ?, ?, ?)',
      [customerName, total, status || 'Pending', JSON.stringify(items), UserId, JSON.stringify(shippingAddress)]
    );

    const [orders] = await pool.query('SELECT * FROM Orders WHERE id = ?', [result.insertId]);
    res.json({
      success: true,
      data: orders[0]
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT o.*, u.email as userEmail, u.phone as userPhone, u.name as userName 
      FROM Orders o 
      LEFT JOIN Users u ON o.UserId = u.id
    `;
    let params = [];

    // Non-admin users can only see their own orders
    if (req.user.role !== 'admin') {
      query += ' WHERE o.UserId = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY o.createdAt DESC';

    const [orders] = await pool.query(query, params);
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

app.put('/api/orders/:id', authenticateToken, validateId, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    const user = req.user;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Fetch order to check ownership and current status
    const [orders] = await pool.query('SELECT * FROM Orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    const order = orders[0];

    // Authorization check
    if (user.role !== 'admin') {
      // Non-admins can ONLY cancel their own orders that are currently Pending
      if (order.UserId !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to update this order'
        });
      }
      if (status !== 'Cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Users can only cancel their orders'
        });
      }
      if (order.status !== 'Pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending orders can be cancelled'
        });
      }
    }

    await pool.query('UPDATE Orders SET status = ? WHERE id = ?', [status, orderId]);
    res.json({
      success: true,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   STATS
====================== */
app.get('/api/stats', adminOnly, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT COUNT(*) as count FROM Products');
    const [orders] = await pool.query('SELECT COUNT(*) as count, SUM(total) as revenue FROM Orders');
    const [users] = await pool.query("SELECT COUNT(*) as count FROM Users WHERE role = 'customer'");

    res.json({
      success: true,
      data: {
        products: products[0].count,
        orders: orders[0].count,
        revenue: orders[0].revenue || 0,
        customers: users[0].count,
        growth: { products: 0, orders: 0, revenue: 0, overall: 0 }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   PRODUCT UPDATE/DELETE
====================== */
app.put('/api/products/:id', adminOnly, validateId, upload.array('images', 10), async (req, res) => {
  try {
    const { title, description, price, category, stock, discount, rating, isFeatured } = req.body;
    let query = 'UPDATE Products SET title=?, description=?, price=?, category=?, stock=?, discount=?, rating=?, isFeatured=?';
    let params = [title, description, price, category, stock, discount, rating, isFeatured === 'true' || isFeatured === true ? 1 : 0];

    // Handle Image Updates
    // Strategy: If new images are uploaded, we replace the existing ones (simple approach).
    // Ideally, frontend should provide "existingImages" to keep.
    // For now, if files are provided, we update the image column.

    if (req.files && req.files.length > 0) {
      console.log(`☁️ Uploading ${req.files.length} new images to Cloudinary...`);
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'products'));
      const results = await Promise.all(uploadPromises);
      const imageUrls = results.map(r => r.secure_url);

      query += ', image=?';
      params.push(JSON.stringify(imageUrls));
    }

    query += ' WHERE id=?';
    params.push(req.params.id);

    await pool.query(query, params);
    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

app.delete('/api/products/:id', adminOnly, validateId, async (req, res) => {
  try {
    await pool.query('DELETE FROM Products WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   CATEGORY UPDATE/DELETE
====================== */
app.put('/api/categories/:id', adminOnly, validateId, upload.single('image'), validateCategory, async (req, res) => {
  try {
    const { name, description } = req.body;
    let query = 'UPDATE Categories SET name=?, description=?';
    let params = [name, description];

    console.log('📝 Updating category:', req.params.id);
    console.log('📎 New file received:', req.file ? 'Yes' : 'No');

    if (req.file) {
      console.log('☁️ Uploading to Cloudinary...');
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'categories');
      const imageUrl = cloudinaryResult.secure_url;

      query += ', image=?';
      params.push(imageUrl);
    }

    query += ' WHERE id=?';
    params.push(req.params.id);

    await pool.query(query, params);
    console.log('✅ Category updated');

    res.json({
      success: true,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('❌ Update category error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

app.delete('/api/categories/:id', adminOnly, validateId, async (req, res) => {
  try {
    await pool.query('DELETE FROM Categories WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   USERS MANAGEMENT
====================== */
app.get('/api/users', adminOnly, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, phone, isVerified, isBlocked, createdAt FROM Users ORDER BY createdAt DESC');
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

app.put('/api/users/:id/block', adminOnly, validateId, async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const userId = req.params.id;

    if (isBlocked === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isBlocked status is required'
      });
    }

    // Prevent blocking admins? Maybe, but for now let's allow it but warn or prevent self-block if I knew the current user ID here easily without extra query, 
    // but adminOnly middleware puts user in req.user.
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block your own account'
      });
    }

    await pool.query('UPDATE Users SET isBlocked = ? WHERE id = ?', [isBlocked, userId]);

    res.json({
      success: true,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

/* ======================
   START SERVER
====================== */
// Cleanup job for expired verification codes - runs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const [result] = await pool.query('DELETE FROM EmailVerifications WHERE expiresAt < NOW()');
    if (result.affectedRows > 0) {
      console.log(`🧹 Cleaned up ${result.affectedRows} expired verification codes`);
    }
  } catch (error) {
    console.error('❌ Cleanup job error:', error);
  }
});

initDatabase()
  .then(() => {
    console.log('✅ Database connected');
    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('❌ DB Error:', err);
    process.exit(1);
  });
