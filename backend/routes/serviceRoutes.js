const express = require('express');
const {
    getServices,
    createService,
    updateServiceStatus,
    assignServiceLabour,
    requestServiceFromOrder
} = require('../controllers/serviceController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getServices)
    .post(createService);

router.route('/:id/status')
    .put(authorize('admin'), updateServiceStatus);

router.route('/:id/assign')
    .put(authorize('admin'), assignServiceLabour);

router.post('/request-from-order/:orderId', requestServiceFromOrder);

module.exports = router;
