const Notification = require('../../database/models/Notification');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

// @desc    Get all notifications for the user's workspace
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
    // Only grab notifications for this company that are either global (userId null) or specifically for this user
    const query = {
        companyId: req.user.companyId,
        $or: [{ userId: null }, { userId: req.user._id }]
    };

    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: notifications.length, data: notifications });
});

// @desc    Create a system notification
// @route   POST /api/notifications
// @access  Private/Admin
const createNotification = asyncHandler(async (req, res) => {
    const { title, message, type, userId } = req.body;

    const notification = await Notification.create({
        notificationId: uuidv4(),
        companyId: req.user.companyId,
        userId: userId || null, // Global if not specified
        title,
        message,
        type
    });

    res.status(201).json({ success: true, data: notification });
});

module.exports = {
    getNotifications,
    createNotification
};
