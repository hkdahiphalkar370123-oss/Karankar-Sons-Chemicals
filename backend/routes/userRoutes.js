const express = require('express');
const { getUsers, createUser, getMyProfile, updateMyProfile } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getUsers)
    .post(authorize('admin'), createUser);

router.route('/me')
    .get(getMyProfile)
    .put(updateMyProfile);

module.exports = router;
