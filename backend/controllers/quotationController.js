const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const Estimate = require('../../database/models/Estimate');
const Order = require('../../database/models/Order');
const Product = require('../../database/models/Product');
const User = require('../../database/models/User');
const { calculateEstimate } = require('../config/estimatePricing');
const { getSearchTerm } = require('../utils/queryParams');

const quotationStatus = ['Draft', 'Sent', 'Approved', 'Converted', 'Rejected'];

const readNonNegativeNumber = (value, fieldName, { allowZero = true, max = null } = {}) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${fieldName} must be a non-negative number`);
    }

    if (!allowZero && parsed === 0) {
        throw new Error(`${fieldName} must be greater than zero`);
    }

    if (max !== null && parsed > max) {
        throw new Error(`${fieldName} must be ${max} or less`);
    }

    return parsed;
};

const prepareQuotationPayload = (body = {}, { requireMeasurement = false } = {}) => {
    const area = readNonNegativeNumber(body.area, 'Area', { allowZero: false });
    const pricePerSqft = readNonNegativeNumber(body.pricePerSqft, 'Average price per sq.ft');
    const materialCost = readNonNegativeNumber(body.materialCost, 'Material cost') ?? 0;
    const labourCost = readNonNegativeNumber(body.labourCost, 'Labour cost') ?? 0;
    const additionalCharges = readNonNegativeNumber(body.additionalCharges, 'Additional charges') ?? 0;
    const discount = readNonNegativeNumber(body.discount, 'Discount', { max: 100 }) ?? 0;
    const gst = readNonNegativeNumber(body.gst, 'GST', { max: 100 }) ?? 0;
    const surfaceType = String(body.surfaceType || '').trim();

    if (requireMeasurement && !area) {
        throw new Error('Area is required');
    }

    if (requireMeasurement && !surfaceType) {
        throw new Error('Surface type is required');
    }

    return calculateEstimate({
        area,
        surfaceType,
        pricePerSqft,
        materialCost,
        labourCost,
        additionalCharges,
        discount,
        gst,
        baseAmount: body.baseAmount,
        totalEstimatedCost: body.totalEstimatedCost,
        finalAmount: body.finalAmount
    });
};

const getQuotations = asyncHandler(async (req, res) => {
    const searchTerm = getSearchTerm(req).trim();
    const filter = { companyId: req.user.companyId };

    if (searchTerm) {
        const parsedDate = new Date(searchTerm);
        const dateFilter = !Number.isNaN(parsedDate.getTime())
            ? {
                createdAt: {
                    $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
                    $lte: new Date(parsedDate.setHours(23, 59, 59, 999))
                }
            }
            : null;

        filter.$or = [
            { quotationId: { $regex: searchTerm, $options: 'i' } },
            { customerName: { $regex: searchTerm, $options: 'i' } },
            { surfaceType: { $regex: searchTerm, $options: 'i' } },
            { status: { $regex: searchTerm, $options: 'i' } }
        ];

        if (dateFilter) {
            filter.$or.push(dateFilter);
        }
    }

    const quotations = await Estimate.find(filter)
        .populate('linkedOrder', 'orderId status totalAmount')
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: quotations.length, data: quotations });
});

const createQuotation = asyncHandler(async (req, res) => {
    const {
        customerName,
        customerPhone,
        customerEmail,
        siteAddress,
        projectType,
        workType,
        area,
        surfaceType,
        pricePerSqft,
        materialCost,
        labourCost,
        additionalCharges,
        discount,
        gst,
        notes,
        status
    } = req.body;

    if (!customerName || !customerPhone || !siteAddress || !projectType || !workType) {
        return res.status(400).json({ success: false, error: 'Missing required quotation fields' });
    }

    if (!String(surfaceType || '').trim()) {
        return res.status(400).json({ success: false, error: 'Surface type is required' });
    }

    if (area === undefined || area === null || area === '' || Number(area) <= 0) {
        return res.status(400).json({ success: false, error: 'Area must be greater than zero' });
    }

    const user = customerEmail
        ? await User.findOne({ companyId: req.user.companyId, email: customerEmail.toLowerCase() })
        : null;

    const calculation = prepareQuotationPayload({
        area,
        surfaceType,
        pricePerSqft,
        materialCost,
        labourCost,
        additionalCharges,
        discount,
        gst
    });

    const quotation = await Estimate.create({
        quotationId: `QTN-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
        companyId: req.user.companyId,
        user: user ? user._id : null,
        customerName,
        customerPhone,
        customerEmail: customerEmail || '',
        siteAddress,
        projectType,
        workType,
        area: calculation.area,
        surfaceType: calculation.surfaceType,
        pricePerSqft: calculation.pricePerSqft,
        baseAmount: calculation.baseAmount,
        subtotal: calculation.subtotal,
        discountAmount: calculation.discountAmount,
        gstAmount: calculation.gstAmount,
        materialCost: calculation.materialCost,
        labourCost: calculation.labourCost,
        additionalCharges: calculation.additionalCharges,
        discount: calculation.discount,
        gst: calculation.gst,
        totalEstimatedCost: calculation.totalEstimatedCost,
        finalAmount: calculation.finalAmount,
        notes: notes || '',
        status: quotationStatus.includes(status) ? status : 'Draft'
    });

    res.status(201).json({ success: true, data: quotation });
});

const updateQuotation = asyncHandler(async (req, res) => {
    const quotation = await Estimate.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quotation) {
        return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    if (quotation.status === 'Converted') {
        return res.status(400).json({ success: false, error: 'Converted quotations cannot be edited' });
    }

    const fields = [
        'customerName', 'customerPhone', 'customerEmail', 'siteAddress', 'projectType', 'workType',
        'area', 'surfaceType', 'pricePerSqft', 'materialCost', 'labourCost', 'additionalCharges',
        'discount', 'gst', 'notes', 'status'
    ];

    fields.forEach((field) => {
        if (req.body[field] !== undefined) {
            quotation[field] = req.body[field];
        }
    });

    if (req.body.customerEmail) {
        const user = await User.findOne({ companyId: req.user.companyId, email: req.body.customerEmail.toLowerCase() });
        quotation.user = user ? user._id : null;
    }

    const calculation = prepareQuotationPayload({
        area: quotation.area,
        surfaceType: quotation.surfaceType,
        pricePerSqft: quotation.pricePerSqft,
        materialCost: quotation.materialCost,
        labourCost: quotation.labourCost,
        additionalCharges: quotation.additionalCharges,
        discount: quotation.discount,
        gst: quotation.gst,
        baseAmount: quotation.baseAmount,
        totalEstimatedCost: quotation.totalEstimatedCost,
        finalAmount: quotation.finalAmount
    });

    quotation.area = calculation.area;
    quotation.surfaceType = calculation.surfaceType;
    quotation.pricePerSqft = calculation.pricePerSqft;
    quotation.baseAmount = calculation.baseAmount;
    quotation.subtotal = calculation.subtotal;
    quotation.discountAmount = calculation.discountAmount;
    quotation.gstAmount = calculation.gstAmount;
    quotation.materialCost = calculation.materialCost;
    quotation.labourCost = calculation.labourCost;
    quotation.additionalCharges = calculation.additionalCharges;
    quotation.discount = calculation.discount;
    quotation.gst = calculation.gst;
    quotation.totalEstimatedCost = calculation.totalEstimatedCost;
    quotation.finalAmount = calculation.finalAmount;

    await quotation.save();
    res.status(200).json({ success: true, data: quotation });
});

const deleteQuotation = asyncHandler(async (req, res) => {
    const quotation = await Estimate.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quotation) {
        return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    if (quotation.status === 'Converted') {
        return res.status(400).json({ success: false, error: 'Converted quotations cannot be deleted' });
    }

    await quotation.deleteOne();
    res.status(200).json({ success: true, data: { id: req.params.id } });
});

const convertQuotationToOrder = asyncHandler(async (req, res) => {
    const quotation = await Estimate.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quotation) {
        return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    if (quotation.linkedOrder) {
        return res.status(400).json({ success: false, error: 'Quotation already converted' });
    }

    const product = await Product.findOne({ companyId: req.user.companyId });
    if (!product) {
        return res.status(400).json({ success: false, error: 'At least one product is required to convert quotation to order' });
    }

    let customer = quotation.user ? await User.findById(quotation.user) : null;
    if (!customer) {
        customer = await User.findOne({ companyId: req.user.companyId, role: 'user' });
    }
    if (!customer) {
        return res.status(400).json({ success: false, error: 'No customer user available for order conversion' });
    }

    const total = Number(quotation.finalAmount || quotation.totalEstimatedCost || 0);
    const order = await Order.create({
        orderId: `ORD-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
        user: customer._id,
        companyId: req.user.companyId,
        items: [{
            product: product._id,
            productName: `${quotation.workType} Service Package`,
            quantity: 1,
            unitPrice: total,
            lineTotal: total
        }],
        totalAmount: total,
        shippingDetails: {
            fullName: quotation.customerName,
            address: quotation.siteAddress,
            phone: quotation.customerPhone,
            city: customer.city || 'City',
            pincode: customer.pincode || '000000'
        },
        serviceRequest: {
            required: true,
            projectType: quotation.projectType,
            workType: quotation.workType,
            notes: quotation.notes
        },
        status: 'Processing'
    });

    quotation.linkedOrder = order._id;
    quotation.status = 'Converted';
    await quotation.save();

    const populatedOrder = await Order.findById(order._id).populate('user', 'name email phone');
    res.status(200).json({ success: true, data: { quotation, order: populatedOrder } });
});

module.exports = {
    getQuotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    convertQuotationToOrder
};
