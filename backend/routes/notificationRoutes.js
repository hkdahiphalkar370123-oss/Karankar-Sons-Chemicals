const express = require('express');
const { getNotifications, createNotification } = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getNotifications)
    .post(authorize('admin'), createNotification);

module.exports = router;
