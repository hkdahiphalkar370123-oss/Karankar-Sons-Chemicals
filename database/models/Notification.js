const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    notificationId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If null, means it's a global company notification
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info' },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
