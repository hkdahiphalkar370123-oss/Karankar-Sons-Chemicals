const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['site_status', 'labour_attendance', 'inventory', 'financial'], required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }, // Store generated report snapshot
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
