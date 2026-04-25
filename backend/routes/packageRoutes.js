const express = require('express');
const { getPackages, getPackage } = require('../controllers/packageController');
const { protect } = require('../middlewares/auth'); // if we want to protect some routes

const router = express.Router();

// Public routes for fetching packages (we simulate this by hardcoding the companyId in middleware if needed, but normally it's fetched via subdomain/headers)
router.get('/', async (req, res, next) => {
    // For demo purposes, fetch the first company as default
    const Company = require('../../database/models/Company');
    let company = await Company.findOne();
    if(company){
        req.company = company;
    }
    next();
}, getPackages);

router.get('/:id', getPackage);

module.exports = router;
