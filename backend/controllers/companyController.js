const Company = require('../../database/models/Company');
const User = require('../../database/models/User');
const asyncHandler = require('express-async-handler');

// @desc    Get company details
// @route   GET /api/company/:id
// @access  Private
const getCompany = asyncHandler(async (req, res) => {
    // Make sure user belongs to the company they are querying
    if (req.user.companyId.toString() !== req.params.id) {
        res.status(403);
        throw new Error('Not authorized to access this company data');
    }

    const company = await Company.findById(req.params.id).populate('adminId', 'name email');

    if (!company) {
        res.status(404);
        throw new Error('Company not found');
    }

    res.status(200).json({ success: true, data: company });
});

module.exports = {
    getCompany
};
