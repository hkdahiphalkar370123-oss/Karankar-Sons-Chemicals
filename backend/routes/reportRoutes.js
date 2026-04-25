const express = require('express');
const { getReports, createReport } = require('../controllers/reportController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getReports)
    .post(authorize('admin'), createReport);

module.exports = router;
