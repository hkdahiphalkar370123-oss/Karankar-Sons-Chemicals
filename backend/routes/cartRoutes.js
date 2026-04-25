const express = require('express');
const router = express.Router();
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require('../controllers/cartController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
    .get(getCart);

router.route('/add')
    .post(addToCart);

router.route('/update')
    .put(updateCartItem);

router.route('/remove/:productId')
    .delete(removeFromCart);

router.route('/clear')
    .delete(clearCart);

module.exports = router;
