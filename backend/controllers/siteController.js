const Site = require('../../database/models/Site');
const Order = require('../../database/models/Order');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { getSearchTerm } = require('../utils/queryParams');
const { emitEvent } = require('../utils/socket');

// @desc    Get all sites for the workspace
// @route   GET /api/sites?page=1&limit=10
// @access  Private
const getSites = asyncHandler(async (req, res) => {
    const filter = { companyId: req.user.companyId };
    const searchTerm = getSearchTerm(req).trim();

    if (searchTerm) {
        filter.$or = [
            { siteId: { $regex: searchTerm, $options: 'i' } },
            { siteName: { $regex: searchTerm, $options: 'i' } },
            { customerName: { $regex: searchTerm, $options: 'i' } },
            { location: { $regex: searchTerm, $options: 'i' } },
            { siteAddress: { $regex: searchTerm, $options: 'i' } },
            { warranty: { $regex: searchTerm, $options: 'i' } }
        ];
    }

    // Check if pagination is requested
    const page = req.query.page;
    const limit = req.query.limit;

    if (page || limit) {
        // Pagination mode
        const { page: pageNum, limit: limitNum, skip } = getPaginationParams(req, 10, 100);
        const total = await Site.countDocuments(filter);
        const sites = await Site.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        return res.status(200).json(buildPaginationResponse(sites, pageNum, limitNum, total));
    } else {
        // Legacy mode - return all sites
        const sites = await Site.find(filter)
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: sites.length, data: sites });
    }
});

const getMySiteProgress = asyncHandler(async (req, res) => {
    const userOrders = await Order.find({ user: req.user._id, companyId: req.user.companyId }).select('_id');
    const linkedOrderIds = userOrders.map((order) => order._id);

    const filter = {
        companyId: req.user.companyId,
        $or: [{ linkedOrderId: { $in: linkedOrderIds } }, { customerName: req.user.name }]
    };
    const searchTerm = getSearchTerm(req).trim();

    if (searchTerm) {
        filter.$and = [{
            $or: [
                { siteId: { $regex: searchTerm, $options: 'i' } },
                { siteName: { $regex: searchTerm, $options: 'i' } },
                { customerName: { $regex: searchTerm, $options: 'i' } },
                { location: { $regex: searchTerm, $options: 'i' } },
                { siteAddress: { $regex: searchTerm, $options: 'i' } },
                { warranty: { $regex: searchTerm, $options: 'i' } }
            ]
        }];
    }

    // Check if pagination is requested
    const page = req.query.page;
    const limit = req.query.limit;

    if (page || limit) {
        // Pagination mode
        const { page: pageNum, limit: limitNum, skip } = getPaginationParams(req, 10, 100);
        const total = await Site.countDocuments(filter);
        const sites = await Site.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        return res.status(200).json(buildPaginationResponse(sites, pageNum, limitNum, total));
    } else {
        // Legacy mode - return all sites
        const sites = await Site.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: sites.length, data: sites });
    }
});

// @desc    Add a new site
// @route   POST /api/sites
// @access  Private/Admin
const createSite = asyncHandler(async (req, res) => {
    const {
        siteId,
        customerName,
        customerPhone,
        siteAddress,
        projectType,
        workType,
        warranty,
        startDate,
        expectedEndDate,
        status,
        linkedOrderId
    } = req.body;

    if (!customerName || !customerPhone || !siteAddress || !projectType || !workType || !startDate || !expectedEndDate) {
        res.status(400);
        throw new Error('Missing required site fields');
    }

    const site = await Site.create({
        siteId: siteId || `SITE-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
        companyId: req.user.companyId,
        customerName,
        customerPhone,
        siteAddress,
        projectType,
        workType,
        warranty: warranty || 'No Warranty',
        startDate,
        expectedEndDate,
        status: status || 'Pending',
        linkedOrderId: linkedOrderId || null,
        siteName: `${customerName} Site`,
        location: siteAddress,
        currentPhase: status || 'Pending',
        priority: 'Medium'
    });

    const created = await Site.findById(site._id);
    res.status(201).json({ success: true, data: created });
});

// @desc    Get site details
// @route   GET /api/sites/:id
// @access  Private
const getSiteById = asyncHandler(async (req, res) => {
    const site = await Site.findById(req.params.id);

    if (!site) {
        res.status(404);
        throw new Error('Site not found');
    }

    if (site.companyId.toString() !== req.user.companyId.toString()) {
        res.status(403);
        throw new Error('User not authorized to access this site');
    }

    res.status(200).json({ success: true, data: site });
});

// @desc    Update a site
// @route   PUT /api/sites/:id
// @access  Private/Admin
const updateSite = asyncHandler(async (req, res) => {
    let site = await Site.findById(req.params.id);

    if (!site) {
        res.status(404);
        throw new Error('Site not found');
    }

    if (site.companyId.toString() !== req.user.companyId.toString()) {
        res.status(403);
        throw new Error('User not authorized to update this site');
    }

    const allowed = [
        'customerName',
        'customerPhone',
        'siteAddress',
        'projectType',
        'workType',
        'warranty',
        'startDate',
        'expectedEndDate',
        'status'
    ];
    const updates = {};
    allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    if (updates.customerName) {
        updates.siteName = `${updates.customerName} Site`;
    }
    if (updates.siteAddress) {
        updates.location = updates.siteAddress;
    }
    if (updates.status) {
        updates.currentPhase = updates.status;
    }

    site = await Site.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true
    });

    // Emit real-time site status update
    emitEvent('site-status-updated', {
        siteId: site.siteId,
        status: site.status
    }, `company_${site.companyId}`);

    res.status(200).json({ success: true, data: site });
});

// @desc    Delete a site
// @route   DELETE /api/sites/:id
// @access  Private/Admin
const deleteSite = asyncHandler(async (req, res) => {
    const site = await Site.findById(req.params.id);

    if (!site) {
        res.status(404);
        throw new Error('Site not found');
    }

    if (site.companyId.toString() !== req.user.companyId.toString()) {
        res.status(403);
        throw new Error('User not authorized to delete this site');
    }

    await Site.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, data: { id: req.params.id } });
});

module.exports = {
    getSites,
    getMySiteProgress,
    createSite,
    getSiteById,
    updateSite,
    deleteSite,
};
