const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const shippingSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, required: true }
}, { _id: false });

const serviceRequestSchema = new mongoose.Schema({
    required: { type: Boolean, default: false },
    projectType: { type: String, enum: ['Repair Work', 'New Construction'], default: 'Repair Work' },
    workType: { type: String, default: 'General Work' },
    expectedEndDate: { type: Date, default: null },
    notes: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    shippingDetails: shippingSchema,
    serviceRequest: { type: serviceRequestSchema, default: () => ({ required: false }) },
    serviceSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
    
    // Payment Information
    payment: {
        paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
        status: {
            type: String,
            enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
            default: 'Pending'
        },
        method: { type: String, default: 'online' },
        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        transactionId: { type: String, default: null },
        paidAt: { type: Date, default: null }
    },
    
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Completed', 'Cancelled'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
