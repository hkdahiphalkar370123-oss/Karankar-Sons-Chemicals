const asyncHandler = require('express-async-handler');
const Order = require('../../database/models/Order');
const Site = require('../../database/models/Site');
const Estimate = require('../../database/models/Estimate');
const Service = require('../../database/models/Service');

const getAdminAnalytics = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const [orders, sites, quotations] = await Promise.all([
        Order.find({ companyId }).lean(),
        Site.find({ companyId }).lean(),
        Estimate.find({ companyId }).lean()
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const activeSites = sites.filter((site) => site.status !== 'Completed').length;
    const completedProjects = sites.filter((site) => site.status === 'Completed').length;
    const openQuotations = quotations.filter((quotation) => quotation.status !== 'Converted').length;

    const monthMap = new Map();
    orders.forEach((order) => {
        const key = new Date(order.createdAt).toISOString().slice(0, 7);
        if (!monthMap.has(key)) {
            monthMap.set(key, { month: key, revenue: 0, orders: 0 });
        }
        const data = monthMap.get(key);
        data.revenue += Number(order.totalAmount || 0);
        data.orders += 1;
    });

    const revenueTrend = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const siteProgress = {
        pending: sites.filter((site) => site.status === 'Pending').length,
        inProgress: sites.filter((site) => ['In Progress', 'Work 50% Complete', 'Final Stage'].includes(site.status)).length,
        completed: completedProjects
    };

    res.status(200).json({
        success: true,
        data: {
            totals: {
                totalOrders: orders.length,
                totalRevenue,
                activeSites,
                completedProjects,
                openQuotations
            },
            revenueTrend,
            siteProgress
        }
    });
});

const getUserAnalytics = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;

    const [orders, bookings, sites] = await Promise.all([
        Order.find({ companyId, user: req.user._id }),
        Service.find({ companyId, user: req.user._id }),
        Site.find({
            companyId,
            $or: [{ customerName: req.user.name }, { customerPhone: req.user.phone }]
        })
    ]);

    const totalSpent = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    res.status(200).json({
        success: true,
        data: {
            totalOrders: orders.length,
            activeBookings: bookings.filter((item) => item.status !== 'Completed' && item.status !== 'Cancelled').length,
            activeSites: sites.filter((site) => site.status !== 'Completed').length,
            pendingBookings: bookings.filter((item) => item.status === 'Pending').length,
            totalSpent
        }
    });
});

module.exports = {
    getAdminAnalytics,
    getUserAnalytics
};
