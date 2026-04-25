const express = require('express');
const path = require('path');

const app = express();
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const PORT = Number(process.env.FRONTEND_PORT || 3000);

// Middleware to check for JWT token from cookies or headers
// This is a client-side development server, so we redirect to login if no token
const checkAdminAuth = (req, res, next) => {
  const token = req.cookies?.token;
  const role = req.cookies?.user_role;
  
  if (req.path.startsWith('/admin')) {
    if (!token || role !== 'admin') {
      return res.redirect('/login.html');
    }
  }
  next();
};

// Block direct access to sensitive HTML files
app.use(['/admin-dashboard.html', '/user-dashboard.html'], (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(FRONTEND_DIR));

// Admin routes - Client-side JS handles actual authentication via localStorage
app.get(/^\/admin($|\/.*)/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'admin-dashboard.html'));
});

app.get([
  '/home',
  '/products',
  '/contact',
  '/checkout',
  '/service-booking'
], (req, res) => {
  if (req.path === '/checkout') {
    res.sendFile(path.join(FRONTEND_DIR, 'checkout.html'));
    return;
  }

  if (req.path === '/service-booking') {
    res.sendFile(path.join(FRONTEND_DIR, 'service-booking.html'));
    return;
  }

  if (req.path === '/products') {
    res.sendFile(path.join(FRONTEND_DIR, 'products.html'));
    return;
  }

  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.get(['/dashboard', '/orders', '/profile', '/cart', '/dashboard/bookings', '/dashboard/sites', '/dashboard/invoices'], (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'user-dashboard.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
});
