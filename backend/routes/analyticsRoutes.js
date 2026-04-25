const express = require('express');
const { getAdminAnalytics, getUserAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.get('/admin', authorize('admin'), getAdminAnalytics);
router.get('/user', authorize('user'), getUserAnalytics);

module.exports = router;
