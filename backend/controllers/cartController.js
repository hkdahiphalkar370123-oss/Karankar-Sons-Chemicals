const Cart = require('../../database/models/Cart');
const Product = require('../../database/models/Product');

const findOrCreateCart = async (userId) => {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] });
    }
    return cart;
};

exports.getCart = async (req, res) => {
    try {
        const cart = await findOrCreateCart(req.user.id);
        await cart.populate('items.product');
        res.status(200).json({ success: true, data: cart });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const qty = Math.max(1, parseInt(quantity, 10) || 1);
        
        if (!productId) {
            return res.status(400).json({ success: false, error: 'Please provide productId' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        if (product.stockQuantity < qty) {
            return res.status(400).json({ success: false, error: 'Insufficient stock for selected product' });
        }

        const price = product.pricePerUnit * (1 - ((product.discountPercent || 0) / 100));

        let cart = await findOrCreateCart(req.user.id);

        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
        if (itemIndex > -1) {
            let productItem = cart.items[itemIndex];
            const requestedQty = productItem.quantity + qty;
            if (product.stockQuantity < requestedQty) {
                return res.status(400).json({ success: false, error: 'Stock limit reached for this product' });
            }
            productItem.quantity = requestedQty;
            productItem.price = price;
            cart.items[itemIndex] = productItem;
        } else {
            cart.items.push({ product: productId, quantity: qty, price });
        }
        
        cart.markModified('items');
        await cart.save();
        await cart.populate('items.product');
        res.status(200).json({ success: true, data: cart });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const qty = parseInt(quantity, 10);

        if (!productId || Number.isNaN(qty)) {
            return res.status(400).json({ success: false, error: 'Please provide productId and quantity' });
        }
        
        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
        if (itemIndex > -1) {
            let productItem = cart.items[itemIndex];
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, error: 'Product not found' });
            }

            if (qty > product.stockQuantity) {
                return res.status(400).json({ success: false, error: 'Insufficient stock for selected quantity' });
            }

            productItem.quantity = qty;
            productItem.price = product.pricePerUnit * (1 - ((product.discountPercent || 0) / 100));
            if (productItem.quantity <= 0) {
                cart.items.splice(itemIndex, 1);
            } else {
                cart.items[itemIndex] = productItem;
            }
            
            cart.markModified('items');
            await cart.save();
            await cart.populate('items.product');
            return res.status(200).json({ success: true, data: cart });
        } else {
            return res.status(404).json({ success: false, error: 'Item not found in cart' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }
        
        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
        if (itemIndex > -1) {
            cart.items.splice(itemIndex, 1);
            cart.markModified('items');
            await cart.save();
            await cart.populate('items.product');
            return res.status(200).json({ success: true, data: cart });
        } else {
            return res.status(404).json({ success: false, error: 'Item not found in cart' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.clearCart = async (req, res) => {
    try {
        const cart = await findOrCreateCart(req.user.id);
        cart.items = [];
        await cart.save();
        res.status(200).json({ success: true, data: cart });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
