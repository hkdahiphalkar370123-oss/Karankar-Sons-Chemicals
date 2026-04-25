const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    packageId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    productsIncluded: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    packagePrice: { type: Number, required: true },
    imageURL: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
