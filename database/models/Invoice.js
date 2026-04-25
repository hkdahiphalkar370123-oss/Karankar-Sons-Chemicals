const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyName: { type: String, required: true },
    companyAddress: { type: String, required: true },
    customerDetails: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    items: [invoiceLineSchema],
    labourCharges: { type: Number, default: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    invoiceDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
