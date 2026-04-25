const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, createOrder, updateOrderStatus } = require('../controllers/orderController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

router.use(protect);

router.route('/').get(getOrders).post(createOrder);
router.route('/:id').get(getOrderById);
router.route('/:id/status').put(authorize('admin'), updateOrderStatus);

module.exports = router;
