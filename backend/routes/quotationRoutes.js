const express = require('express');
const {
    getQuotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    convertQuotationToOrder
} = require('../controllers/quotationController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect, authorize('admin'));

router.route('/')
    .get(getQuotations)
    .post(createQuotation);

router.route('/:id')
    .put(updateQuotation)
    .delete(deleteQuotation);

router.route('/:id/convert')
    .post(convertQuotationToOrder);

module.exports = router;
