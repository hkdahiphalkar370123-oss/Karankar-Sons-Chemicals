const Order = require('../../database/models/Order');
const Cart = require('../../database/models/Cart');
const Product = require('../../database/models/Product');
const Site = require('../../database/models/Site');
const { buildInvoiceFromOrder } = require('./invoiceController');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../config/emailService');
const { orderConfirmationEmail } = require('../config/emailTemplates');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { getSearchTerm } = require('../utils/queryParams');
const { emitEvent } = require('../utils/socket');

exports.getOrders = asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin'
        ? { companyId: req.user.companyId }
        : { user: req.user._id };
    const searchTerm = getSearchTerm(req).trim();

    if (searchTerm) {
        const searchConditions = [
            { orderId: { $regex: searchTerm, $options: 'i' } },
            { 'shippingDetails.fullName': { $regex: searchTerm, $options: 'i' } },
            { 'shippingDetails.phone': { $regex: searchTerm, $options: 'i' } },
            { 'payment.razorpayPaymentId': { $regex: searchTerm, $options: 'i' } },
            { 'payment.transactionId': { $regex: searchTerm, $options: 'i' } }
        ];

        const parsedDate = new Date(searchTerm);
        if (!Number.isNaN(parsedDate.getTime())) {
            const start = new Date(parsedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(parsedDate);
            end.setHours(23, 59, 59, 999);
            searchConditions.push({ createdAt: { $gte: start, $lte: end } });
        }

        filter.$and = [{ $or: searchConditions }];
    }

    // Check if pagination is requested
    const page = req.query.page;
    const limit = req.query.limit;

    if (page || limit) {
        // Pagination mode
        const { page: pageNum, limit: limitNum, skip } = getPaginationParams(req, 10, 100);
        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter)
            .populate('items.product')
            .populate('serviceSite', 'siteId customerName status projectType workType')
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        return res.status(200).json(buildPaginationResponse(orders, pageNum, limitNum, total));
    } else {
        // Legacy mode - return all orders
        const orders = await Order.find(filter)
            .populate('items.product')
            .populate('serviceSite', 'siteId customerName status projectType workType')
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: orders.length, data: orders });
    }
});

exports.getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('items.product')
        .populate('serviceSite', 'siteId customerName status projectType workType')
        .populate('user', 'name email phone');

    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = order.user && order.user._id.toString() === req.user._id.toString();
    const sameCompany = order.companyId && order.companyId.toString() === req.user.companyId.toString();

    if (!(isAdmin && sameCompany) && !isOwner) {
        return res.status(403).json({ success: false, error: 'Not authorized to access this order' });
    }

    res.status(200).json({ success: true, data: order });
});

exports.createOrder = asyncHandler(async (req, res) => {
    const { shippingDetails, serviceRequest } = req.body;
    const requiredFields = ['fullName', 'address', 'phone', 'city', 'pincode'];

    const missing = requiredFields.find((field) => !shippingDetails || !shippingDetails[field]);
    if (missing) {
        res.status(400);
        throw new Error(`Missing shipping field: ${missing}`);
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
        res.status(400);
        throw new Error('Cart is empty');
    }

    const items = [];
    let totalAmount = 0;

    for (const cartItem of cart.items) {
        const product = await Product.findById(cartItem.product._id);
        if (!product) {
            res.status(400);
            throw new Error('One or more products in cart are invalid');
        }
        if (product.stockQuantity < cartItem.quantity) {
            res.status(400);
            throw new Error(`Insufficient stock for ${product.productName}`);
        }

        const unitPrice = product.pricePerUnit * (1 - ((product.discountPercent || 0) / 100));
        const lineTotal = unitPrice * cartItem.quantity;
        totalAmount += lineTotal;

        items.push({
            product: product._id,
            productName: product.productName,
            quantity: cartItem.quantity,
            unitPrice,
            lineTotal
        });

        product.stockQuantity -= cartItem.quantity;
        await product.save();
    }

    const order = await Order.create({
        orderId: `ORD-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
        user: req.user._id,
        companyId: req.user.companyId,
        items,
        totalAmount,
        shippingDetails,
        serviceRequest: {
            required: Boolean(serviceRequest && serviceRequest.required),
            projectType: serviceRequest && serviceRequest.projectType ? serviceRequest.projectType : 'Repair Work',
            workType: serviceRequest && serviceRequest.workType ? serviceRequest.workType : 'General Work',
            expectedEndDate: serviceRequest && serviceRequest.expectedEndDate ? new Date(serviceRequest.expectedEndDate) : null,
            notes: serviceRequest && serviceRequest.notes ? serviceRequest.notes : ''
        },
        status: 'Pending'
    });

    if (serviceRequest && serviceRequest.required) {
        const site = await Site.create({
            siteId: `SITE-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
            companyId: req.user.companyId,
            customerName: shippingDetails.fullName,
            customerPhone: shippingDetails.phone,
            siteAddress: shippingDetails.address,
            projectType: serviceRequest.projectType || 'Repair Work',
            workType: serviceRequest.workType || 'General Work',
            assignedLabours: [],
            startDate: new Date(),
            expectedEndDate: serviceRequest.expectedEndDate ? new Date(serviceRequest.expectedEndDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'Pending',
            linkedOrderId: order._id,
            siteName: `${shippingDetails.fullName} Site`,
            location: shippingDetails.address,
            currentPhase: 'Pending',
            requiredLabours: 0,
            availableLabours: 0,
            priority: 'Medium'
        });

        order.serviceSite = site._id;
        await order.save();
    }

    cart.items = [];
    await cart.save();

    const populated = await Order.findById(order._id)
        .populate('items.product')
        .populate('serviceSite', 'siteId customerName status projectType workType')
        .populate('user', 'name email phone');

    await buildInvoiceFromOrder(populated);

    // Send order confirmation email
    try {
        const emailResult = await sendEmail(
            populated.user.email,
            `Order Confirmation #${populated.orderId}`,
            orderConfirmationEmail(
                populated.user.name,
                populated.orderId,
                populated.createdAt,
                populated.items,
                populated.totalAmount
            )
        );
        if (!emailResult.success) {
            console.log('Order confirmation email send failed:', emailResult.error);
        }
    } catch (emailError) {
        console.log('Error sending order confirmation email:', emailError.message);
    }

    res.status(201).json({ success: true, data: populated });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admin can update order status' });
    }

    const { status } = req.body;
    const normalizedStatus = status === 'Delivered' ? 'Completed' : status;
    if (!['Pending', 'Processing', 'Completed', 'Cancelled'].includes(normalizedStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.companyId.toString() !== req.user.companyId.toString()) {
        res.status(403);
        throw new Error('User not authorized to update this order');
    }

    order.status = status;
    await order.save();

    // Emit real-time order status update
    emitEvent('order-status-updated', {
        orderId: order.orderId,
        status: order.status
    }, `company_${order.companyId}`);

    // Trigger invoice generation for specific statuses
    if (status === 'Processing' || status === 'Completed') {
        const { buildInvoiceFromOrder } = require('./invoiceController');
        try {
            const populatedOrder = await Order.findById(order._id)
                .populate('items.product')
                .populate('user', 'name email phone address city pincode');
            await buildInvoiceFromOrder(populatedOrder);
        } catch (error) {
            console.error('Failed to auto-generate invoice on status update:', error.message);
        }
    }

    res.status(200).json({ success: true, data: order });
});

module.exports = {
    getOrderById: exports.getOrderById,
    getOrders: exports.getOrders,
    createOrder: exports.createOrder,
    updateOrderStatus: exports.updateOrderStatus
};
