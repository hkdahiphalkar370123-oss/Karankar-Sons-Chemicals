const mongoose = require('mongoose');
const { calculateEstimate, surfacePricing } = require('../../backend/config/estimatePricing');

const estimateSchema = new mongoose.Schema({
    quotationId: { type: String, required: true, unique: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    siteAddress: { type: String, required: true },
    projectType: { type: String, enum: ['Repair Work', 'New Construction'], required: true },
    workType: { type: String, required: true },
    area: { type: Number, default: 0, min: 0 },
    surfaceType: { type: String, enum: Object.keys(surfacePricing), default: '' },
    pricePerSqft: { type: Number, default: 0, min: 0 },
    baseAmount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    materialCost: { type: Number, default: 0, min: 0 },
    labourCost: { type: Number, default: 0, min: 0 },
    additionalCharges: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    totalEstimatedCost: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
    linkedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    status: { type: String, default: 'Draft', enum: ['Draft', 'Sent', 'Approved', 'Converted', 'Rejected'] }
}, { timestamps: true });

estimateSchema.pre('validate', function calcTotal() {
    const calculated = calculateEstimate(this.toObject ? this.toObject() : this);
    this.area = calculated.area;
    this.surfaceType = calculated.surfaceType;
    this.pricePerSqft = calculated.pricePerSqft;
    this.baseAmount = calculated.baseAmount;
    this.subtotal = calculated.subtotal ?? this.subtotal ?? 0;
    this.discountAmount = calculated.discountAmount ?? this.discountAmount ?? 0;
    this.gstAmount = calculated.gstAmount ?? this.gstAmount ?? 0;
    this.materialCost = calculated.materialCost;
    this.labourCost = calculated.labourCost;
    this.additionalCharges = calculated.additionalCharges;
    this.discount = calculated.discount;
    this.gst = calculated.gst;
    this.totalEstimatedCost = calculated.totalEstimatedCost;
    this.finalAmount = calculated.finalAmount;
});

module.exports = mongoose.model('Estimate', estimateSchema);
