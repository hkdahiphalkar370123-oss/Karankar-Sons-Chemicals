const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const Invoice = require('../../database/models/Invoice');
const Order = require('../../database/models/Order');
const Company = require('../../database/models/Company');
const { sendEmail } = require('../config/emailService');
const { invoiceEmail } = require('../config/emailTemplates');
const { getSearchTerm } = require('../utils/queryParams');

const buildInvoiceFromOrder = async (orderDoc, session = null) => {
    // Robustly handle order population
    let order = orderDoc;
    if (order.populate && !order.user?.name) {
        order = await orderDoc.populate('user', 'name email phone');
    }

    if (!order.user) {
        throw new Error('Order user details are missing, cannot generate invoice');
    }

    // Check if invoice already exists
    const existing = await Invoice.findOne({ order: order._id });
    if (existing) return existing;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Map items from order
    const invoiceItems = (order.items || []).map((item) => ({
        itemName: item.productName || 'Unknown Product',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || (item.quantity * item.unitPrice) || 0
    }));

    const invoice = await Invoice.create([{
        invoiceNumber,
        companyId: order.companyId,
        order: order._id,
        user: order.user._id,
        companyName: 'Karankar Sons & Chemicals',
        companyAddress: 'Karankar Sons Office, MIDC Road, Nagpur',
        customerDetails: {
            fullName: order.shippingDetails?.fullName || order.user.name,
            phone: order.shippingDetails?.phone || order.user.phone || '0000000000',
            address: order.shippingDetails?.address || order.user.address || 'Address Pending',
            city: order.shippingDetails?.city || order.user.city || 'City',
            pincode: order.shippingDetails?.pincode || order.user.pincode || '000000'
        },
        items: invoiceItems,
        labourCharges: order.serviceRequest?.required ? Math.round(order.totalAmount * 0.1) : 0,
        totalCost: order.totalAmount,
        invoiceDate: new Date()
    }], { session });

    return invoice[0];
};

const getInvoices = asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin'
        ? { companyId: req.user.companyId }
        : { companyId: req.user.companyId, user: req.user._id };
    const searchTerm = getSearchTerm(req).trim();

    if (searchTerm) {
        const parsedDate = new Date(searchTerm);
        const dateFilter = !Number.isNaN(parsedDate.getTime())
            ? {
                invoiceDate: {
                    $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
                    $lte: new Date(parsedDate.setHours(23, 59, 59, 999))
                }
            }
            : null;

        filter.$or = [
            { invoiceNumber: { $regex: searchTerm, $options: 'i' } },
            { 'customerDetails.fullName': { $regex: searchTerm, $options: 'i' } },
            { 'order.orderId': { $regex: searchTerm, $options: 'i' } }
        ];

        if (dateFilter) {
            filter.$or.push(dateFilter);
        }
    }

    const invoices = await Invoice.find(filter)
        .populate('order', 'orderId status totalAmount createdAt')
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: invoices.length, data: invoices });
});

const getInvoiceById = asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin'
        ? { _id: req.params.id, companyId: req.user.companyId }
        : { _id: req.params.id, companyId: req.user.companyId, user: req.user._id };

    const invoice = await Invoice.findOne(filter).populate('order', 'orderId status totalAmount createdAt');
    if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.status(200).json({ success: true, data: invoice });
});

const generateInvoiceFromOrder = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.orderId, companyId: req.user.companyId }).populate('user', 'name email phone');
    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const invoice = await buildInvoiceFromOrder(order);

    // Send invoice email
    try {
        const emailResult = await sendEmail(
            order.user.email,
            `Invoice #${invoice.invoiceNumber}`,
            invoiceEmail(
                order.user.name,
                order.orderId,
                invoice.invoiceNumber,
                invoice.totalCost,
                invoice.items,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // Due date 30 days from now
            )
        );
        if (!emailResult.success) {
            console.log('Invoice email send failed:', emailResult.error);
        }
    } catch (emailError) {
        console.log('Error sending invoice email:', emailError.message);
    }

    res.status(201).json({ success: true, data: invoice });
});

module.exports = {
    buildInvoiceFromOrder,
    getInvoices,
    getInvoiceById,
    generateInvoiceFromOrder
};
