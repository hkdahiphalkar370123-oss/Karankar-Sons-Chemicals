const express = require('express');
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories
} = require('../controllers/productController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const upload = require('../config/multer');

const router = express.Router();

router.get('/', getProducts);
router.get('/categories/list', getCategories);
router.get('/:id', getProductById);

router.route('/')
    .post(protect, authorize('admin'), upload.single('productImage'), createProduct);

router.route('/:id')
    .put(protect, authorize('admin'), upload.single('productImage'), updateProduct)
    .delete(protect, authorize('admin'), deleteProduct);

module.exports = router;
