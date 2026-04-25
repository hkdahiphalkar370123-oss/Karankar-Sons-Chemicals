const Service = require('../../database/models/Service');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../config/emailService');
const { serviceBookingEmail } = require('../config/emailTemplates');
const { getSearchTerm } = require('../utils/queryParams');

const validStatus = ['Pending', 'Approved', 'Assigned', 'In Progress', 'Completed'];

const getServices = asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin'
        ? { companyId: req.user.companyId }
        : { companyId: req.user.companyId, user: req.user._id };
    const searchTerm = getSearchTerm(req).trim();

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
            { serviceId: { $regex: searchTerm, $options: 'i' } },
            { serviceName: { $regex: searchTerm, $options: 'i' } },
            { siteAddress: { $regex: searchTerm, $options: 'i' } },
            { site: { $regex: searchTerm, $options: 'i' } },
            { notes: { $regex: searchTerm, $options: 'i' } },
            { status: { $regex: searchTerm, $options: 'i' } }
        ];

        if (dateFilter) {
            filter.$or.push(dateFilter);
        }
    }

    const services = await Service.find(filter)
        .sort({ createdAt: -1 })
        .populate('user', 'name email phone');

    res.status(200).json({ success: true, count: services.length, data: services });
});

const createService = asyncHandler(async (req, res) => {
    const {
        serviceName,
        projectType,
        siteAddress,
        preferredStartDate,
        notes,
        assignedLabour,
        site,
        status
    } = req.body;

    if (!serviceName || !siteAddress) {
        return res.status(400).json({ success: false, error: 'Service type and site address are required' });
    }

    const service = await Service.create({
        serviceId: `SRV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
        companyId: req.user.companyId,
        user: req.user.role === 'admin' ? (req.body.userId || null) : req.user._id,
        serviceName,
        projectType: projectType || 'Repair Work',
        siteAddress,
        preferredStartDate: preferredStartDate || null,
        notes: notes || '',
        assignedLabour: assignedLabour || null,
        site: site || siteAddress,
        status: validStatus.includes(status) ? status : 'Pending'
    });

    // Populate user details for email
    await service.populate('user', 'name email phone');

    // Send service booking confirmation email
    if (service.user && service.user.email) {
        try {
            const expectedDate = preferredStartDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const emailResult = await sendEmail(
                service.user.email,
                `Service Booking Confirmation #${service.serviceId}`,
                serviceBookingEmail(
                    service.user.name,
                    service.serviceId,
                    serviceName,
                    expectedDate,
                    0,  // Amount - can be updated if there's a charge
                    siteAddress
                )
            );
            if (!emailResult.success) {
                console.log('Service booking email send failed:', emailResult.error);
            }
        } catch (emailError) {
            console.log('Error sending service booking email:', emailError.message);
        }
    }

    res.status(201).json({ success: true, data: service });
});

const updateServiceStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!validStatus.includes(status)) {
        res.status(400);
        throw new Error('Invalid service status');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        res.status(404);
        throw new Error('Service not found');
    }

    service.status = status;
    await service.save();

    // Automatically create a Site record when approved or assigned
    if (status === 'Approved' || status === 'Assigned') {
        const Site = require('../../database/models/Site');
        const existingSite = await Site.findOne({ 
            companyId: service.companyId,
            $or: [
                { siteAddress: service.siteAddress },
                { customerName: service.user ? (await service.populate('user')).user.name : '' }
            ],
            status: { $ne: 'Completed' }
        });

        if (!existingSite) {
            const { v4: uuidv4 } = require('uuid');
            await Site.create({
                siteId: `SITE-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
                companyId: service.companyId,
                customerName: service.user ? (await service.populate('user')).user.name : 'Unknown',
                customerPhone: service.user ? service.user.phone || '0000000000' : '0000000000',
                siteAddress: service.siteAddress || 'Address Pending',
                projectType: service.projectType || 'Repair Work',
                workType: service.serviceName || 'Waterproofing',
                startDate: service.preferredStartDate || new Date(),
                expectedEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 2 weeks
                status: 'Pending',
                siteName: service.serviceName || 'New Project',
                location: service.siteAddress || 'Address Pending',
                currentPhase: 'Pending'
            });
        }
    }

    res.status(200).json({ success: true, data: service });
});

const assignServiceLabour = asyncHandler(async (req, res) => {
    const { labourId } = req.body;
    if (!labourId) {
        return res.status(400).json({ success: false, error: 'Labour ID is required' });
    }

    const service = await Service.findOneAndUpdate(
        { _id: req.params.id, companyId: req.user.companyId },
        { assignedLabour: labourId, status: 'Assigned' },
        { new: true }
    ).populate('user', 'name email phone');

    if (!service) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.status(200).json({ success: true, data: service });
});

const requestServiceFromOrder = asyncHandler(async (req, res) => {
    const Order = require('../../database/models/Order');
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });

    if (!order) {
        res.status(404);
        throw new Error('Order not found or does not belong to you');
    }

    // Check if a service for this order already exists
    const existingService = await Service.findOne({ 
        companyId: req.user.companyId,
        $or: [
            { siteAddress: order.shippingDetails.address },
            { notes: { $regex: order.orderId, $options: 'i' } }
        ]
    });

    if (existingService) {
        return res.status(400).json({ success: false, error: 'Service already requested for this order' });
    }

    const service = await Service.create({
        serviceId: `SRV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
        companyId: req.user.companyId,
        user: req.user._id,
        serviceName: 'Order Waterproofing Service',
        projectType: order.serviceRequest?.projectType || 'Repair Work',
        siteAddress: order.shippingDetails.address,
        preferredStartDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Default 3 days later
        notes: `Service request for Order #${order.orderId}. ${order.serviceRequest?.notes || ''}`,
        status: 'Pending'
    });

    res.status(201).json({ success: true, data: service });
});

module.exports = {
    getServices,
    createService,
    updateServiceStatus,
    assignServiceLabour,
    requestServiceFromOrder
};
