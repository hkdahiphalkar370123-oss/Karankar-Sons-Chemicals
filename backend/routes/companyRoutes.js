const express = require('express');
const { getCompany } = require('../controllers/companyController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.get('/:id', protect, getCompany);

module.exports = router;
