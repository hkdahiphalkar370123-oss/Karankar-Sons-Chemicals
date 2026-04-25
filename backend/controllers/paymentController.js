const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

const Cart = require('../../database/models/Cart');
const Order = require('../../database/models/Order');
const Payment = require('../../database/models/Payment');
const Product = require('../../database/models/Product');
const Site = require('../../database/models/Site');

const { buildInvoiceFromOrder } = require('./invoiceController');
const { authLogger } = require('../middlewares/logger');
const { sendEmail } = require('../config/emailService');
const {
    orderConfirmationEmail,
    paymentConfirmationEmail,
    invoiceEmail
} = require('../config/emailTemplates');

const { emitEvent } = require('../utils/socket');

const getRazorpayClient = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials are not configured');
    }

    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
};

const buildCheckoutSnapshot = async (userId, companyId) => {
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        throw new Error('Cart is empty');
    }

    const items = [];
    let totalAmount = 0;

    for (const cartItem of cart.items) {
        const product = cartItem.product;
        if (!product) {
            throw new Error('One or more products in the cart are invalid');
        }

        if (String(product.companyId) !== String(companyId)) {
            throw new Error(`Product ${product.productName} does not belong to the selected company`);
        }

        if (product.stockQuantity < cartItem.quantity) {
            throw new Error(`Insufficient stock for ${product.productName}`);
        }

        const discount = Number(product.discountPercent || 0);
        const basePrice = Number(product.pricePerUnit || 0);
        const unitPrice = Number((basePrice * (1 - discount / 100)).toFixed(2));
        const lineTotal = Number((unitPrice * cartItem.quantity).toFixed(2));

        totalAmount += lineTotal;

        items.push({
            product: product._id,
            productName: product.productName,
            quantity: cartItem.quantity,
            unitPrice,
            lineTotal
        });
    }

    return {
        cart,
        items,
        totalAmount: Number(totalAmount.toFixed(2))
    };
};

const buildOrderFromPayment = async (payment, session = null) => {
    const snapshot = payment.checkoutSnapshot || {};
    const shippingDetails = snapshot.shippingDetails || {};
    const serviceRequest = snapshot.serviceRequest || { required: false };
    const checkoutItems = Array.isArray(snapshot.items) ? snapshot.items : [];

    if (checkoutItems.length === 0) {
        throw new Error('Checkout snapshot is missing cart items');
    }

    const items = [];
    let computedTotal = 0;
    const stockUpdates = [];

    for (const snapshotItem of checkoutItems) {
        let productQuery = Product.findById(snapshotItem.product);
        if (session) productQuery = productQuery.session(session);
        const product = await productQuery;

        if (!product) {
            throw new Error(`Product not found for ${snapshotItem.productName}`);
        }

        if (product.stockQuantity < snapshotItem.quantity) {
            throw new Error(`Insufficient stock for ${product.productName}`);
        }

        const unitPrice = Number(snapshotItem.unitPrice || 0);
        const lineTotal = Number(snapshotItem.lineTotal || Number((unitPrice * snapshotItem.quantity).toFixed(2)));
        computedTotal += lineTotal;

        items.push({
            product: product._id,
            productName: product.productName,
            quantity: snapshotItem.quantity,
            unitPrice,
            lineTotal
        });

        stockUpdates.push({ product, quantity: snapshotItem.quantity });
    }

    const totalAmount = Number(computedTotal.toFixed(2));
    if (Math.abs(totalAmount - Number(payment.amount || 0)) > 0.01) {
        throw new Error('Payment amount does not match checkout total');
    }

    const orderPayload = {
        orderId: `ORD-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
        user: payment.user,
        companyId: payment.companyId,
        items,
        totalAmount,
        shippingDetails: {
            fullName: shippingDetails.fullName || payment.customerName,
            address: shippingDetails.address || '',
            phone: shippingDetails.phone || payment.customerPhone,
            city: shippingDetails.city || '',
            pincode: shippingDetails.pincode || ''
        },
        serviceRequest: {
            required: Boolean(serviceRequest.required),
            projectType: serviceRequest.projectType || 'Repair Work',
            workType: serviceRequest.workType || 'General Work',
            expectedEndDate: serviceRequest.expectedEndDate ? new Date(serviceRequest.expectedEndDate) : null,
            notes: serviceRequest.notes || ''
        },
        payment: {
            paymentId: payment._id,
            status: 'Completed',
            method: payment.method || 'online',
            razorpayOrderId: payment.razorpayOrderId,
            razorpayPaymentId: payment.razorpayPaymentId,
            transactionId: payment.razorpayPaymentId,
            paidAt: payment.capturedAt || new Date()
        },
        status: 'Processing'
    };
    
    // Mongoose transactions require arrays for create() options handling reliably
    const [order] = await Order.create([orderPayload], { session });

    for (const update of stockUpdates) {
        update.product.stockQuantity -= update.quantity;
        await update.product.save({ session });

        // Low stock alert check
        if (update.product.stockQuantity < (update.product.lowStockThreshold || 5)) {
            emitEvent('LOW_STOCK_ALERT', {
                productId: update.product.productId,
                productName: update.product.productName,
                currentStock: update.product.stockQuantity,
                threshold: update.product.lowStockThreshold || 5
            }, `company_${update.product.companyId}`);
        }
    }

    if (serviceRequest.required) {
        const sitePayload = {
            siteId: `SITE-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
            companyId: payment.companyId,
            customerName: shippingDetails.fullName || payment.customerName,
            customerPhone: shippingDetails.phone || payment.customerPhone,
            siteAddress: shippingDetails.address || '',
            projectType: serviceRequest.projectType || 'Repair Work',
            workType: serviceRequest.workType || 'General Work',
            assignedLabours: [],
            startDate: new Date(),
            expectedEndDate: serviceRequest.expectedEndDate ? new Date(serviceRequest.expectedEndDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'Pending',
            linkedOrderId: order._id,
            siteName: `${shippingDetails.fullName || payment.customerName} Site`,
            location: shippingDetails.address || '',
            currentPhase: 'Pending',
            requiredLabours: 0,
            availableLabours: 0,
            priority: 'Medium'
        };
        const [site] = await Site.create([sitePayload], { session });

        order.serviceSite = site._id;
        await order.save({ session });
    }

    let cartQuery = Cart.findOne({ user: payment.user });
    if (session) cartQuery = cartQuery.session(session);
    const cart = await cartQuery;
    
    if (cart) {
        cart.items = [];
        await cart.save({ session });
    }

    let finalOrderQuery = Order.findById(order._id)
        .populate('items.product')
        .populate('serviceSite', 'siteId customerName status projectType workType')
        .populate('user', 'name email phone');
        
    if (session) finalOrderQuery = finalOrderQuery.session(session);
    return finalOrderQuery;
};

const createOrRefreshRazorpayOrder = async (payment, retryReceiptSuffix = '') => {
    const razorpay = getRazorpayClient();
    const amountInPaise = Math.round(Number(payment.amount) * 100);
    const receipt = payment.receiptId || `PAY-${payment.paymentId}`;

    const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: payment.currency || 'INR',
        receipt: retryReceiptSuffix ? `${receipt}-${retryReceiptSuffix}` : receipt,
        payment_capture: 1,
        notes: {
            paymentId: payment._id.toString(),
            userId: payment.user.toString(),
            companyId: payment.companyId.toString(),
            totalAmount: String(payment.amount)
        }
    });

    payment.razorpayOrderId = razorpayOrder.id;
    payment.status = 'Created';
    payment.receiptId = razorpayOrder.receipt || receipt;
    payment.lastRetryAt = payment.lastRetryAt || null;
    await payment.save();

    return razorpayOrder;
};

const sendOrderAndInvoiceEmails = async (order, payment, invoice) => {
    try {
        await sendEmail(
            order.user.email,
            `Order Confirmation #${order.orderId}`,
            orderConfirmationEmail(
                order.user.name,
                order.orderId,
                order.createdAt,
                order.items,
                order.totalAmount
            )
        );
    } catch (emailError) {
        console.log('Error sending order confirmation email:', emailError.message);
    }

    try {
        await sendEmail(
            payment.customerEmail,
            'Payment Confirmation',
            paymentConfirmationEmail(
                payment.customerName,
                order.orderId,
                payment.amount,
                payment.paymentId,
                payment.razorpayPaymentId
            )
        );
    } catch (emailError) {
        console.log('Error sending payment confirmation email:', emailError.message);
    }

    try {
        await sendEmail(
            order.user.email,
            `Invoice #${invoice.invoiceNumber}`,
            invoiceEmail(
                order.user.name,
                order.orderId,
                invoice.invoiceNumber,
                invoice.totalCost,
                order.items,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            )
        );
    } catch (emailError) {
        console.log('Error sending invoice email:', emailError.message);
    }
};

// @desc    Create Razorpay order for payment
// @route   POST /api/payment/create-order
// @access  Private
exports.createRazorpayOrder = asyncHandler(async (req, res) => {
    const { shippingDetails, serviceRequest = {} } = req.body || {};
    const requiredFields = ['fullName', 'address', 'phone', 'city', 'pincode'];

    const missingField = requiredFields.find((field) => !shippingDetails || !shippingDetails[field]);
    if (missingField) {
        res.status(400);
        throw new Error(`Missing shipping field: ${missingField}`);
    }

    const { cart, items, totalAmount } = await buildCheckoutSnapshot(req.user._id, req.user.companyId);
    const razorpay = getRazorpayClient();

    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: `PAY-${req.user._id.toString().slice(-6).toUpperCase()}-${Date.now()}`,
        payment_capture: 1,
        notes: {
            userId: req.user._id.toString(),
            companyId: req.user.companyId.toString(),
            totalAmount: String(totalAmount),
            cartItemCount: String(items.length)
        }
    });

    const payment = await Payment.create({
        paymentId: `PAY-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`,
        orderId: null,
        user: req.user._id,
        companyId: req.user.companyId,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmount,
        currency: 'INR',
        status: 'Created',
        method: 'online',
        customerEmail: req.user.email,
        customerPhone: shippingDetails.phone,
        customerName: shippingDetails.fullName,
        receiptId: razorpayOrder.receipt,
        checkoutSnapshot: {
            shippingDetails: {
                fullName: shippingDetails.fullName,
                address: shippingDetails.address,
                phone: shippingDetails.phone,
                city: shippingDetails.city,
                pincode: shippingDetails.pincode
            },
            serviceRequest: {
                required: Boolean(serviceRequest.required),
                projectType: serviceRequest.projectType || 'Repair Work',
                workType: serviceRequest.workType || 'General Work',
                expectedEndDate: serviceRequest.expectedEndDate ? new Date(serviceRequest.expectedEndDate) : null,
                notes: serviceRequest.notes || ''
            },
            items,
            totalAmount
        }
    });

    try {
        authLogger(
            req.user.email,
            'PAYMENT_INITIATED',
            true,
            req.ip || '0.0.0.0',
            `Amount: ₹${totalAmount}, Razorpay Order ID: ${razorpayOrder.id}`
        );
    } catch (logErr) {
        console.log('Logging error:', logErr.message);
    }

    res.status(201).json({
        success: true,
        data: {
            paymentId: payment._id,
            razorpayOrderId: razorpayOrder.id,
            amount: totalAmount,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID,
            email: req.user.email,
            phone: shippingDetails.phone,
            name: shippingDetails.fullName,
            cartItems: cart.items.length
        }
    });
});

// @desc    Verify Razorpay payment
// @route   POST /api/payment/verify
// @access  Private
exports.verifyPayment = asyncHandler(async (req, res) => {
    const razorpayPaymentId = req.body.razorpayPaymentId || req.body.razorpay_payment_id;
    const razorpayOrderId = req.body.razorpayOrderId || req.body.razorpay_order_id;
    const razorpaySignature = req.body.razorpaySignature || req.body.razorpay_signature;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        res.status(400);
        throw new Error('Missing payment verification details');
    }

    let payment = await Payment.findOne({ razorpayOrderId });

    if (!payment) {
        res.status(404);
        throw new Error('Payment record not found');
    }

    if (payment.status === 'Captured' && payment.orderId) {
        const order = await Order.findById(payment.orderId)
            .populate('items.product')
            .populate('serviceSite', 'siteId customerName status projectType workType')
            .populate('user', 'name email phone');

        const invoice = await buildInvoiceFromOrder(order);

        return res.status(200).json({
            success: true,
            message: 'Payment already verified',
            data: {
                paymentId: payment._id,
                orderId: order._id,
                invoiceId: invoice._id,
                amount: payment.amount,
                transactionId: payment.razorpayPaymentId,
                status: 'Completed'
            }
        });
    }

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    if (razorpaySignature !== expectedSignature) {
        res.status(400);
        throw new Error('Payment signature verification failed');
    }

    const razorpay = getRazorpayClient();
    const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);

    if (!paymentDetails || paymentDetails.status !== 'captured') {
        res.status(400);
        throw new Error(`Payment not captured. Status: ${paymentDetails ? paymentDetails.status : 'unknown'}`);
    }

    // Now start the transaction for atomic local state updates
    const session = await mongoose.startSession();
    session.startTransaction();

    let order;
    let invoice;

    try {
        // Refetch payment under this session to ensure we have the transactional lock context
        payment = await Payment.findOne({ razorpayOrderId }).session(session);

        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        payment.status = 'Captured';
        payment.capturedAt = new Date();
        payment.authorizedAt = payment.authorizedAt || new Date();
        payment.transactionId = razorpayPaymentId;
        await payment.save({ session });

        order = await buildOrderFromPayment(payment, session);
        payment.orderId = order._id;
        payment.status = 'Captured';
        await payment.save({ session });

        invoice = await buildInvoiceFromOrder(order, session);
        
        await session.commitTransaction();
    } catch (sessionError) {
        await session.abortTransaction();
        throw sessionError;
    } finally {
        session.endSession();
    }

    // Post-transaction tasks (Emails, Logs should not block the transaction success)
    await sendOrderAndInvoiceEmails(order, payment, invoice);

    try {
        authLogger(
            payment.customerEmail,
            'PAYMENT_SUCCESS',
            true,
            req.ip || '0.0.0.0',
            `Amount: ₹${payment.amount}, Transaction ID: ${razorpayPaymentId}`
        );
    } catch (logErr) {
        console.log('Logging error:', logErr.message);
    }

    // Emit real-time payment success
    emitEvent('PAYMENT_SUCCESS', {
        orderId: order.orderId,
        amount: payment.amount,
        customerName: payment.customerName
    }, `company_${payment.companyId}`);

    res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
            paymentId: payment._id,
            orderId: order._id,
            invoiceId: invoice._id,
            amount: payment.amount,
            transactionId: razorpayPaymentId,
            status: 'Completed'
        }
    });
});

// @desc    Handle payment failure
// @route   POST /api/payment/failure
// @access  Private
exports.handlePaymentFailure = asyncHandler(async (req, res) => {
    const { razorpayOrderId, errorCode, errorDescription } = req.body || {};

    if (!razorpayOrderId) {
        res.status(400);
        throw new Error('Razorpay Order ID is required');
    }

    const payment = await Payment.findOne({ razorpayOrderId });

    if (!payment) {
        res.status(404);
        throw new Error('Payment record not found');
    }

    payment.status = 'Failed';
    payment.failureCode = errorCode || 'UNKNOWN';
    payment.failureDescription = errorDescription || 'Payment failed';
    payment.failureReason = errorDescription || 'Payment failed';
    payment.retryCount += 1;

    if (payment.retryCount >= payment.maxRetries) {
        await payment.save();

        try {
            authLogger(
                payment.customerEmail,
                'PAYMENT_FAILED_NO_RETRIES',
                false,
                req.ip || '0.0.0.0',
                `Max retries exceeded. Error: ${payment.failureDescription}`
            );
        } catch (logErr) {
            console.log('Logging error:', logErr.message);
        }

        return res.status(200).json({
            success: true,
            retryable: false,
            message: 'Payment failed. Maximum retries exceeded.',
            data: {
                paymentId: payment._id,
                errorCode,
                errorDescription: payment.failureDescription
            }
        });
    }

    const nextRetry = payment.retryCount + 1;
    payment.lastRetryAt = new Date();
    await payment.save();

    const razorpayOrder = await createOrRefreshRazorpayOrder(payment, `retry-${nextRetry}`);

    try {
        authLogger(
            payment.customerEmail,
            'PAYMENT_FAILED_RETRYABLE',
            false,
            req.ip || '0.0.0.0',
            `Error: ${payment.failureDescription}, Retry: ${payment.retryCount}/${payment.maxRetries}`
        );
    } catch (logErr) {
        console.log('Logging error:', logErr.message);
    }

    res.status(200).json({
        success: true,
        retryable: true,
        retryCount: payment.retryCount,
        maxRetries: payment.maxRetries,
        message: `Payment failed. You can retry (${payment.maxRetries - payment.retryCount} retries remaining)`,
        data: {
            paymentId: payment._id,
            razorpayOrderId: razorpayOrder.id,
            amount: payment.amount,
            currency: payment.currency,
            key: process.env.RAZORPAY_KEY_ID,
            email: payment.customerEmail,
            phone: payment.customerPhone,
            name: payment.customerName
        }
    });
});

// @desc    Get payment details
// @route   GET /api/payment/:paymentId
// @access  Private
exports.getPaymentDetails = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.paymentId).populate('orderId');

    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }

    const isOwner = String(payment.user) === String(req.user._id);
    const isAdmin = req.user.role === 'admin' && String(payment.companyId) === String(req.user.companyId);

    if (!isOwner && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to access this payment');
    }

    res.status(200).json({
        success: true,
        data: payment
    });
});

// @desc    Get order's payment status
// @route   GET /api/payment/order/:orderId
// @access  Private
exports.getOrderPaymentStatus = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    const isOwner = String(order.user) === String(req.user._id);
    const isAdmin = req.user.role === 'admin' && String(order.companyId) === String(req.user.companyId);

    if (!isOwner && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to access this order');
    }

    const payment = await Payment.findById(order.payment.paymentId);

    if (!payment) {
        res.status(404);
        throw new Error('Payment record not found');
    }

    res.status(200).json({
        success: true,
        data: {
            paymentStatus: payment.status,
            orderStatus: order.status,
            amount: payment.amount,
            currency: payment.currency,
            transactionId: payment.razorpayPaymentId,
            paidAt: payment.capturedAt,
            retryCount: payment.retryCount,
            maxRetries: payment.maxRetries,
            canRetry: payment.status === 'Failed' && payment.retryCount < payment.maxRetries,
            failureReason: payment.failureReason,
            failureDescription: payment.failureDescription
        }
    });
});

// @desc    Retry payment
// @route   POST /api/payment/retry/:orderId
// @access  Private
exports.retryPayment = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    const isOwner = String(order.user) === String(req.user._id);
    if (!isOwner) {
        res.status(403);
        throw new Error('Not authorized to retry payment for this order');
    }

    const payment = await Payment.findById(order.payment.paymentId);

    if (!payment) {
        res.status(404);
        throw new Error('Payment record not found');
    }

    if (payment.status !== 'Failed') {
        res.status(400);
        throw new Error(`Payment is not in failed state. Current status: ${payment.status}`);
    }

    if (payment.retryCount >= payment.maxRetries) {
        res.status(400);
        throw new Error('Maximum retries exceeded for this payment');
    }

    payment.status = 'Created';
    payment.failureReason = '';
    payment.failureCode = '';
    payment.failureDescription = '';
    payment.lastRetryAt = new Date();
    await payment.save();

    const razorpayOrder = await createOrRefreshRazorpayOrder(payment, `retry-${payment.retryCount + 1}`);

    try {
        authLogger(
            payment.customerEmail,
            'PAYMENT_RETRY',
            true,
            req.ip || '0.0.0.0',
            `Retry ${payment.retryCount + 1}/${payment.maxRetries}, New Razorpay Order: ${razorpayOrder.id}`
        );
    } catch (logErr) {
        console.log('Logging error:', logErr.message);
    }

    res.status(200).json({
        success: true,
        data: {
            paymentId: payment._id,
            razorpayOrderId: razorpayOrder.id,
            amount: payment.amount,
            currency: payment.currency,
            key: process.env.RAZORPAY_KEY_ID,
            orderId: order._id,
            email: payment.customerEmail,
            phone: payment.customerPhone,
            name: payment.customerName,
            retryCount: payment.retryCount + 1,
            maxRetries: payment.maxRetries
        }
    });
});

// @desc    Get all payments
// @route   GET /api/payment
// @access  Private
exports.getPayments = asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin'
        ? { companyId: req.user.companyId }
        : { companyId: req.user.companyId, user: req.user._id };

    const payments = await Payment.find(filter)
        .populate('orderId', 'orderId status totalAmount createdAt')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: payments.length,
        data: payments
    });
});