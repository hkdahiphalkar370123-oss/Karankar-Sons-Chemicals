const Report = require('../../database/models/Report');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

// @desc    Get all reports for the workspace
// @route   GET /api/reports
// @access  Private
const getReports = asyncHandler(async (req, res) => {
    const reports = await Report.find({ companyId: req.user.companyId }).populate('generatedBy', 'name email');
    res.status(200).json({ success: true, count: reports.length, data: reports });
});

// @desc    Generate a new report summary (mock logic for now)
// @route   POST /api/reports
// @access  Private/Admin
const createReport = asyncHandler(async (req, res) => {
    const { title, type, data } = req.body;

    const report = await Report.create({
        reportId: uuidv4(),
        companyId: req.user.companyId,
        generatedBy: req.user._id,
        title,
        type,
        data: data || {}, // Usually would be aggregated data based on type
        status: 'completed'
    });

    res.status(201).json({ success: true, data: report });
});

module.exports = {
    getReports,
    createReport
};
