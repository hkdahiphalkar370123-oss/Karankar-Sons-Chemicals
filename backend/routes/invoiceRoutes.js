const express = require('express');
const {
    getInvoices,
    getInvoiceById,
    generateInvoiceFromOrder
} = require('../controllers/invoiceController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getInvoices);

router.route('/generate/:orderId')
    .post(authorize('admin'), generateInvoiceFromOrder);

router.route('/:id')
    .get(getInvoiceById);

module.exports = router;
