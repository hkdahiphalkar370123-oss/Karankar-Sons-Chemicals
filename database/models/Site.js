const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
    siteId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    siteAddress: { type: String, required: true, trim: true },
    projectType: { type: String, enum: ['Repair Work', 'New Construction'], required: true },
    workType: { type: String, required: true, trim: true },
    warranty: {
        type: String,
        enum: ['No Warranty', '1 Year', '2 Years', '3 Years', '5 Years', '10 Years'],
        default: 'No Warranty'
    },
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    linkedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    siteName: { type: String, required: true },
    location: { type: String, required: true },
    currentPhase: { type: String, required: true },
    requiredLabours: { type: Number, default: 0 },
    availableLabours: { type: Number, default: 0 },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Work 50% Complete', 'Final Stage', 'Completed', 'New', 'On Hold'],
        default: 'Pending'
    }
}, { timestamps: true });

siteSchema.pre('validate', function normalizeSiteData() {
    if (!this.siteName && this.customerName) {
        this.siteName = `${this.customerName} Site`;
    }
    if (!this.location && this.siteAddress) {
        this.location = this.siteAddress;
    }
    if (!this.currentPhase) {
        this.currentPhase = this.status || 'Pending';
    }
    if (!this.priority) {
        this.priority = 'Medium';
    }
});

module.exports = mongoose.model('Site', siteSchema);
