const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { requestLogger } = require('./middlewares/logger');

// Register global Mongoose plugins before models are loaded
const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');
mongoose.plugin(tenantPlugin);

// Load environment variables
// Priority: .env.production > .env.local > .env
const envFile = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../.env.production')
  : path.join(__dirname, '../.env');
dotenv.config({ path: envFile });

// Verify critical environment variables
const hasMongoUri = Boolean(process.env.MONGODB_URI || process.env.MONGO_URI);
const requiredEnvs = ['JWT_SECRET'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
if (!hasMongoUri) {
    missingEnvs.unshift('MONGODB_URI/MONGO_URI');
}
if (missingEnvs.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missingEnvs.join(', ')}`);
  console.log(`Make sure to configure them in ${envFile}`);
}

// Print environment info
const isProduction = process.env.NODE_ENV === 'production';
console.log(`\n🔧 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`🔧 Node Environment: ${process.env.NODE_ENV}`);
console.log(`🔧 Config File: ${envFile}\n`);

const app = express();

// Security: CORS Configuration - Restrict to frontend domain only
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            process.env.FRONTEND_URL || 'http://localhost:3000'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600  // 1 hour
};

app.use(cors(corsOptions));

// Performance: Compression Middleware (gzip responses in production)
if (isProduction) {
    app.use(compression({
        threshold: 1000, // Only compress responses larger than 1KB
        level: 6 // Compression level (1-9)
    }));
    console.log('✅ Response compression enabled (production)');
}

// Security: Rate Limiting - Prevent API abuse
const isLocalRequest = (req) => {
    const ip = req.ip || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,  // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => !isProduction && isLocalRequest(req),
    standardHeaders: true,  // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false  // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,  // Stricter limit for auth endpoints
    skipSuccessfulRequests: false,
    skip: (req) => !isProduction && isLocalRequest(req),
    message: 'Too many login attempts, please try again later.'
});

// Apply rate limiter to all requests
app.use(limiter);

// Logging: Morgan HTTP request logger (conditional based on environment)
const morganFormat = isProduction 
  ? ':remote-addr - ":method :url" :status :res[content-length] - :response-time ms'
  : ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';
app.use(morgan(morganFormat));

// Custom request logger (only in development)
if (!isProduction) {
  app.use(requestLogger);
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the frontend FIRST (for public assets)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import existing routes and middlewares
const connectDB = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { seedDatabase } = require('../seedData');
const { initializeEmailService } = require('./config/emailService');
const backupService = require('./utils/backupService');
const { protect } = require('./middlewares/auth');
const { authorize } = require('./middlewares/rbac');
const { getAdminAnalytics } = require('./controllers/analyticsController');

// Route files
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const userRoutes = require('./routes/userRoutes');
const siteRoutes = require('./routes/siteRoutes');
const productRoutes = require('./routes/productRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const packageRoutes = require('./routes/packageRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Mount routes
app.use('/api/auth', authLimiter, authRoutes);  // Apply stricter rate limiter to auth endpoints
app.use('/api/company', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.get('/api/dashboard', protect, authorize('admin'), getAdminAnalytics);

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server Working' });
});

// Dashboard route mapping so modules render inside dashboard layouts.
app.get([
    '/home',
    '/products',
    '/contact',
    '/checkout',
    '/service-booking'
], (req, res) => {
    if (req.path === '/checkout') {
        res.sendFile(path.join(__dirname, '../frontend/checkout.html'));
        return;
    }

    if (req.path === '/service-booking') {
        res.sendFile(path.join(__dirname, '../frontend/service-booking.html'));
        return;
    }

    if (req.path === '/products') {
        res.sendFile(path.join(__dirname, '../frontend/products.html'));
        return;
    }

    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get(['/dashboard', '/orders', '/profile', '/cart', '/dashboard/bookings', '/dashboard/sites', '/dashboard/invoices'], (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/user-dashboard.html'));
});

// Block direct access to dashboard HTML files (force use of clean routes)
app.use(['/admin-dashboard.html', '/user-dashboard.html'], (req, res) => {
    res.redirect('/login.html');
});

// Admin Routes - Client-side JS handles actual authentication via localStorage
app.get(['/admin', '/admin/*path'], (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin-dashboard.html'));
});

// API 404 handler (before catch-all frontend route)
app.use('/api/', notFoundHandler);

// Main route for the frontend
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error Handling Middleware (must be last)
app.use(errorHandler);

const http = require('http');
const { initSocket } = require('./utils/socket');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

const startServer = async () => {
    await connectDB();

    // Initialize email service
    try {
        await initializeEmailService();
        console.log('✅ Email service initialized successfully');
    } catch (error) {
        console.log('⚠️  Email service initialization failed:', error.message);
        console.log('Continuing without email service...');
    }

    // Initialize backup system (if enabled in .env)
    try {
        const backupEnabled = (process.env.BACKUP_ENABLED || 'true').toLowerCase() === 'true';
        if (backupEnabled) {
            backupService.ensureBackupDir();
            backupService.scheduleBackups();
            
            // Run one backup on startup (optional)
            if (isProduction) {
                console.log('⏰ Running initial backup on startup...');
                await backupService.executeFullBackup();
            }
        }
    } catch (error) {
        console.warn('⚠️  Backup system initialization failed:', error.message);
    }

    // Database Seeding Logic
    const shouldSeed = (process.env.SEED_ON_STARTUP || 'true').toLowerCase() === 'true';
    const forceReset = (process.env.FORCE_SEED_RESET || 'false').toLowerCase() === 'true';
    
    if (shouldSeed) {
        console.log(`🌱 Database seeding initialized (Force Reset: ${forceReset})...`);
        const seedResult = await seedDatabase({ reset: forceReset });
        if (seedResult.skipped) {
            console.log('✓ Startup seed skipped: data already exists. (Set FORCE_SEED_RESET=true to overwrite)');
        } else {
            console.log(`✅ Seed complete: ${seedResult.users} users, ${seedResult.products} products, ${seedResult.sites} sites created.`);
        }
    }

    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ Server running on ${HOST}:${PORT}`);
        console.log(`📱 Open http://localhost:${PORT} to view the website`);
        console.log(`🔒 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
        console.log(`📡 Real-time Socket.io enabled`);
        console.log(`${'='.repeat(60)}\n`);
    });
};

startServer().catch((error) => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
});
