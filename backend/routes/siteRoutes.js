const express = require('express');
const {
    getSites,
    getMySiteProgress,
    createSite,
    getSiteById,
    updateSite,
    deleteSite
} = require('../controllers/siteController');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getSites)
    .post(authorize('admin'), createSite);

router.route('/progress/my')
    .get(authorize('user'), getMySiteProgress);

router.route('/:id')
    .get(getSiteById)
    .put(authorize('admin'), updateSite)
    .delete(authorize('admin'), deleteSite);

module.exports = router;
