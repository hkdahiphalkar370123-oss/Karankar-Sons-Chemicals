const express = require('express');
const router = express.Router();
const {
    createRazorpayOrder,
    verifyPayment,
    handlePaymentFailure,
    getPaymentDetails,
    getOrderPaymentStatus,
    retryPayment,
    getPayments
} = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

// All routes require authentication
router.use(protect);

// Payment operations
router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyPayment);
router.post('/failure', handlePaymentFailure);
router.post('/retry/:orderId', retryPayment);

// Get payment information
router.get('/', getPayments);
router.get('/:paymentId', getPaymentDetails);
router.get('/order/:orderId', getOrderPaymentStatus);

module.exports = router;
