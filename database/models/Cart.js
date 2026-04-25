const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    },
    price: {
        type: Number,
        required: true
    }
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [cartItemSchema],
    totalAmount: {
        type: Number,
        required: true,
        default: 0
    }
}, { timestamps: true });

// Pre-save hook to calculate totalAmount
cartSchema.pre('save', function() {
    this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
});

module.exports = mongoose.model('Cart', cartSchema);
