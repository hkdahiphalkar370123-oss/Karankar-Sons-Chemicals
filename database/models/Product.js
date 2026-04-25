const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    imageURL: { type: String },
    pricePerUnit: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    stockQuantity: { type: Number, min: 0, default: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    quantityUnit: { type: String, enum: ['kg', 'litre', 'pack', 'bag', 'bucket'], required: true, default: 'litre' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
