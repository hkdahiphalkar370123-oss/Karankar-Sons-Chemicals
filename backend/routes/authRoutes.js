const express = require('express');
const { register, registerAdmin, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.post('/register', register);
router.post('/register-admin', protect, authorize('admin'), registerAdmin);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
