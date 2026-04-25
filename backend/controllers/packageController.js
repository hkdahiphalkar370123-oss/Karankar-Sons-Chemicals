const Package = require('../../database/models/Package');
const Company = require('../../database/models/Company');

// @desc    Get all packages for a company
// @route   GET /api/packages
// @access  Public
exports.getPackages = async (req, res, next) => {
    try {
        const companyId = req.company._id; // Assuming middleware sets this
        const packages = await Package.find({ companyId }).populate('productsIncluded');
        
        res.status(200).json({
            success: true,
            count: packages.length,
            data: packages
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single package
// @route   GET /api/packages/:id
// @access  Public
exports.getPackage = async (req, res, next) => {
    try {
        const pkg = await Package.findById(req.params.id).populate('productsIncluded');
        
        if (!pkg) {
            return res.status(404).json({ success: false, error: 'Package not found' });
        }

        res.status(200).json({
            success: true,
            data: pkg
        });
    } catch (error) {
        next(error);
    }
};
