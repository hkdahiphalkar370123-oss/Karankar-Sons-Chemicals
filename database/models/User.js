const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
    phone: { type: String },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    pincode: { type: String, default: '' },
    warranty: {
        type: String,
        enum: ['No Warranty', '1 Year', '2 Years', '3 Years', '5 Years', '10 Years'],
        default: 'No Warranty'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
