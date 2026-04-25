const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    serviceId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    serviceName: { type: String, required: true },
    projectType: { type: String, enum: ['Repair Work', 'New Construction'], default: 'Repair Work' },
    siteAddress: { type: String, default: '' },
    preferredStartDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    assignedLabour: { type: String, default: null }, // Reference to labourId
    site: { type: String, required: true }, // Reference to siteId or siteName
    status: { type: String, enum: ['Pending', 'Approved', 'Assigned', 'In Progress', 'Completed'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
