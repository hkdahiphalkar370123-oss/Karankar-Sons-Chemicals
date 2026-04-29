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

// Indexes for performance optimization
productSchema.index({ category: 1 });
productSchema.index({ 
    productId: 'text',
    productName: 'text', 
    description: 'text', 
    category: 'text' 
}, { 
    weights: { productName: 10, productId: 8, category: 5, description: 1 },
    name: "ProductTextIndex"
});

module.exports = mongoose.model('Product', productSchema);
