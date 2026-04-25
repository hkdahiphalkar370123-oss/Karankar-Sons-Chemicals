const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    
    // Razorpay Payment Details
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String, sparse: true },
    
    // Payment Information
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
        type: String,
        enum: ['Created', 'Pending', 'Authorized', 'Captured', 'Refunded', 'Failed', 'Cancelled'],
        default: 'Created'
    },
    
    // Payment Method
    method: { type: String, default: 'online' }, // online, cash, cheque, etc.
    
    // Customer Details
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerName: { type: String, required: true },
    
    // Failure Details
    failureReason: { type: String, default: '' },
    failureCode: { type: String, default: '' },
    failureDescription: { type: String, default: '' },
    
    // Retry Information
    retryCount: { type: Number, default: 0, min: 0 },
    maxRetries: { type: Number, default: 3 },
    lastRetryAt: { type: Date, default: null },
    
    // Additional Details
    notes: { type: String, default: '' },
    receiptId: { type: String, default: '' },
    checkoutSnapshot: {
        shippingDetails: {
            fullName: { type: String, default: '' },
            address: { type: String, default: '' },
            phone: { type: String, default: '' },
            city: { type: String, default: '' },
            pincode: { type: String, default: '' }
        },
        serviceRequest: {
            required: { type: Boolean, default: false },
            projectType: { type: String, default: 'Repair Work' },
            workType: { type: String, default: 'General Work' },
            expectedEndDate: { type: Date, default: null },
            notes: { type: String, default: '' }
        },
        items: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
                productName: { type: String, required: true },
                quantity: { type: Number, required: true, min: 1 },
                unitPrice: { type: Number, required: true, min: 0 },
                lineTotal: { type: Number, required: true, min: 0 }
            }
        ],
        totalAmount: { type: Number, default: 0 }
    },
    
    // Transaction Timestamps
    initiatedAt: { type: Date, default: Date.now },
    authorizedAt: { type: Date, default: null },
    capturedAt: { type: Date, default: null }
    
}, { timestamps: true });

// Index for payment status queries
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
