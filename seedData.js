const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const User = require('./database/models/User');
const Product = require('./database/models/Product');
const Company = require('./database/models/Company');
const Order = require('./database/models/Order');
const Estimate = require('./database/models/Estimate');
const Contact = require('./database/models/Contact');
const Cart = require('./database/models/Cart');
const Site = require('./database/models/Site');
const Service = require('./database/models/Service');
const Invoice = require('./database/models/Invoice');

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/KarankarChemicalsDB').replace('localhost', '127.0.0.1');
    await mongoose.connect(uri);
};

const upsertUserAccount = async ({ companyId, name, email, password, role, phone, address, city, pincode }) => {
    const existing = await User.findOne({ email });
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!existing) {
        return User.create({
            userId: uuidv4(),
            companyId,
            name,
            email,
            password: hashedPassword,
            role,
            isActive: true,
            phone,
            address,
            city,
            pincode
        });
    }

    existing.companyId = companyId;
    existing.name = name;
    existing.role = role;
    existing.isActive = true;
    existing.phone = phone;
    existing.address = address;
    existing.city = city;
    existing.pincode = pincode;

    const passwordMatches = await bcrypt.compare(password, existing.password);
    if (!passwordMatches) {
        existing.password = hashedPassword;
    }

    await existing.save();
    return existing;
};

const ensureMinimumData = async (companyId) => {
    const existingProductIds = await Product.distinct('productId', { companyId });
    if (existingProductIds.length < 10) {
        const missingCatalog = catalog.filter((item) => !existingProductIds.includes(item.productId));
        const needed = 10 - existingProductIds.length;
        if (missingCatalog.length && needed > 0) {
            await Product.insertMany(missingCatalog.slice(0, needed).map((item) => ({ ...item, companyId })), { ordered: false });
        }
    }

    const userDocs = await User.find({ companyId, role: 'user' }).limit(5);
    const productDocs = await Product.find({ companyId }).limit(10);
    const orderCount = await Order.countDocuments({ companyId });
    if (orderCount < 5 && userDocs.length > 0 && productDocs.length > 0) {
        const ordersToCreate = [];
        const needed = 5 - orderCount;
        for (let i = 0; i < needed; i += 1) {
            const customer = userDocs[i % userDocs.length];
            const product = productDocs[i % productDocs.length];
            const quantity = 1 + (i % 2);
            const unitPrice = product.pricePerUnit * (1 - ((product.discountPercent || 0) / 100));
            ordersToCreate.push({
                orderId: `ORD-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                user: customer._id,
                companyId,
                items: [{ product: product._id, productName: product.productName, quantity, unitPrice, lineTotal: unitPrice * quantity }],
                totalAmount: unitPrice * quantity,
                shippingDetails: {
                    fullName: customer.name,
                    address: customer.address || 'Address pending',
                    phone: customer.phone || '0000000000',
                    city: customer.city || 'City',
                    pincode: customer.pincode || '000000'
                },
                status: i % 4 === 0 ? 'Pending' : i % 4 === 1 ? 'Processing' : i % 4 === 2 ? 'Completed' : 'Cancelled'
            });
        }
        if (ordersToCreate.length) {
            await Order.insertMany(ordersToCreate, { ordered: false });
        }
    }

    const siteCount = await Site.countDocuments({ companyId });
    if (siteCount < 6) {
        const needed = 6 - siteCount;
        const extraSites = [];
        for (let i = 0; i < needed; i += 1) {
            extraSites.push({
                siteId: `SITE-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
                companyId,
                customerName: `Customer ${i + 1}`,
                customerPhone: `9876505${String(100 + i).slice(-3)}`,
                siteAddress: `Project Address ${i + 1}`,
                projectType: i % 2 === 0 ? 'Repair Work' : 'New Construction',
                workType: i % 2 === 0 ? 'Terrace' : 'Basement',
                assignedLabours: [],
                startDate: new Date(),
                expectedEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                status: i % 3 === 0 ? 'Pending' : i % 3 === 1 ? 'In Progress' : 'Completed',
                linkedOrderId: null,
                siteName: `Customer ${i + 1} Site`,
                location: `Project Address ${i + 1}`,
                currentPhase: i % 3 === 0 ? 'Pending' : i % 3 === 1 ? 'In Progress' : 'Completed',
                requiredLabours: 0,
                availableLabours: 0,
                priority: 'Medium'
            });
        }
        if (extraSites.length) {
            await Site.insertMany(extraSites, { ordered: false });
        }
    }

    const quotationCount = await Estimate.countDocuments({ companyId });
    if (quotationCount < 8) {
        const needed = 8 - quotationCount;
        const extraQuotations = [];
        for (let i = 0; i < needed; i += 1) {
            const materialCost = 18000 + (i * 1200);
            const labourCost = 8000 + (i * 600);
            const additionalCharges = 1200 + (i * 150);
            extraQuotations.push({
                quotationId: `QTN-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                companyId,
                customerName: `Quotation Customer ${i + 1}`,
                customerPhone: `9876552${String(100 + i).slice(-3)}`,
                customerEmail: `quotation${i + 1}@demo.com`,
                siteAddress: `Quotation Site Address ${i + 1}`,
                projectType: i % 2 === 0 ? 'Repair Work' : 'New Construction',
                workType: i % 2 === 0 ? 'Terrace' : 'Basement',
                materialCost,
                labourCost,
                additionalCharges,
                totalEstimatedCost: materialCost + labourCost + additionalCharges,
                notes: 'Auto-generated quotation sample',
                status: i % 3 === 0 ? 'Draft' : i % 3 === 1 ? 'Sent' : 'Approved'
            });
        }
        if (extraQuotations.length) {
            await Estimate.insertMany(extraQuotations, { ordered: false });
        }
    }

    const bookingCount = await Service.countDocuments({ companyId });
    if (bookingCount < 6) {
        const users = await User.find({ companyId, role: 'user' }).limit(6);
        const needed = Math.min(6 - bookingCount, users.length || 0);
        const extraBookings = [];
        for (let i = 0; i < needed; i += 1) {
            const user = users[i % users.length];
            extraBookings.push({
                serviceId: `SRV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                companyId,
                user: user._id,
                serviceName: i % 2 === 0 ? 'Waterproofing Application' : 'Leak Inspection',
                projectType: i % 2 === 0 ? 'Repair Work' : 'New Construction',
                siteAddress: user.address || `Booking Address ${i + 1}`,
                preferredStartDate: new Date(Date.now() + ((i + 1) * 86400000)),
                notes: 'Auto-generated booking sample',
                assignedLabour: null,
                site: user.address || `Booking Address ${i + 1}`,
                status: i % 4 === 0 ? 'Pending' : i % 4 === 1 ? 'Approved' : i % 4 === 2 ? 'Assigned' : 'Completed'
            });
        }
        if (extraBookings.length) {
            await Service.insertMany(extraBookings, { ordered: false });
        }
    }

    const invoiceCount = await Invoice.countDocuments({ companyId });
    if (invoiceCount < 5) {
        const orders = await Order.find({ companyId }).populate('user').limit(8);
        const existingOrderIds = await Invoice.distinct('order', { companyId });
        const toCreate = [];
        for (const order of orders) {
            if (toCreate.length >= (5 - invoiceCount)) break;
            if (existingOrderIds.some((id) => id.toString() === order._id.toString())) continue;

            toCreate.push({
                invoiceNumber: `INV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                companyId,
                order: order._id,
                user: order.user._id,
                companyName: 'Karankar Sons & Chemicals',
                companyAddress: 'Karankar Sons Office, MIDC Road, Nagpur',
                customerDetails: {
                    fullName: order.shippingDetails.fullName,
                    phone: order.shippingDetails.phone,
                    address: order.shippingDetails.address,
                    city: order.shippingDetails.city,
                    pincode: order.shippingDetails.pincode
                },
                items: order.items.map((item) => ({
                    itemName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.lineTotal
                })),
                labourCharges: order.serviceRequest && order.serviceRequest.required ? Math.round(order.totalAmount * 0.1) : 0,
                totalCost: order.totalAmount,
                invoiceDate: order.createdAt
            });
        }

        if (toCreate.length) {
            await Invoice.insertMany(toCreate, { ordered: false });
        }
    }
};

const catalog = [
    { productId: 'KS-001', productName: 'Roof Guard Elastomeric Shield', category: 'Repair Work', description: 'UV-resistant elastomeric coat for concrete roofs and slab joints.', pricePerUnit: 920, discountPercent: 8, stockQuantity: 120, quantityUnit: 'litre', rating: 4.6, imageURL: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?auto=format&fit=crop&q=80' },
    { productId: 'KS-002', productName: 'Acrylic Roof Membrane Pro', category: 'Repair Work', description: 'Fiber reinforced acrylic membrane for long-cycle weather protection.', pricePerUnit: 1180, discountPercent: 10, stockQuantity: 90, quantityUnit: 'litre', rating: 4.5, imageURL: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80' },
    { productId: 'KS-003', productName: 'Wall Damp Block Primer', category: 'Repair Work', description: 'Deep penetrating primer for exterior and interior damp-proofing.', pricePerUnit: 640, discountPercent: 5, stockQuantity: 160, quantityUnit: 'litre', rating: 4.3, imageURL: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80' },
    { productId: 'KS-004', productName: 'Facade Water Repellent Coat', category: 'Repair Work', description: 'Transparent wall repellent for rain-facing facades and plaster walls.', pricePerUnit: 790, discountPercent: 0, stockQuantity: 140, quantityUnit: 'litre', rating: 4.4, imageURL: 'https://images.unsplash.com/photo-1465804575741-338df8554e02?auto=format&fit=crop&q=80' },
    { productId: 'KS-005', productName: 'Basement Hydro Barrier Slurry', category: 'Repair Work', description: 'Negative-side slurry for retaining walls and basement seepage control.', pricePerUnit: 1450, discountPercent: 12, stockQuantity: 80, quantityUnit: 'pack', rating: 4.7, imageURL: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80' },
    { productId: 'KS-006', productName: 'Hydro Cement Seepage Plug', category: 'Repair Work', description: 'Fast-setting hydraulic compound for active leakage points.', pricePerUnit: 480, discountPercent: 0, stockQuantity: 220, quantityUnit: 'kg', rating: 4.2, imageURL: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80' },
    { productId: 'KS-007', productName: 'Terrace Heat Reflective Shield', category: 'Repair Work', description: 'Cool-roof waterproofing with crack-bridging polymer technology.', pricePerUnit: 1650, discountPercent: 7, stockQuantity: 75, quantityUnit: 'pack', rating: 4.6, imageURL: 'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&q=80' },
    { productId: 'KS-008', productName: 'Terrace Joint Reinforcement Tape', category: 'Repair Work', description: 'High-tensile tape for corners, joints, and drain outlet sealing.', pricePerUnit: 560, discountPercent: 0, stockQuantity: 180, quantityUnit: 'pack', rating: 4.1, imageURL: 'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&q=80' },
    { productId: 'KS-009', productName: 'Crack Filler Polymer Putty', category: 'Repair Work', description: 'Flexible crack-filling putty for walls, slabs, and parapet areas.', pricePerUnit: 390, discountPercent: 4, stockQuantity: 250, quantityUnit: 'kg', rating: 4.2, imageURL: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&q=80' },
    { productId: 'KS-010', productName: 'Injection Grout Resin Kit', category: 'Repair Work', description: 'Low-viscosity resin kit for structural crack injection.', pricePerUnit: 2100, discountPercent: 9, stockQuantity: 45, quantityUnit: 'pack', rating: 4.8, imageURL: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&q=80' },
    { productId: 'KS-011', productName: 'Acrylic Waterproof Coating 2K', category: 'New Construction', description: 'Two-component acrylic coating for wet areas and podium decks.', pricePerUnit: 1320, discountPercent: 6, stockQuantity: 95, quantityUnit: 'pack', rating: 4.5, imageURL: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80' },
    { productId: 'KS-012', productName: 'PU Liquid Membrane Premium', category: 'New Construction', description: 'PU membrane with superior elongation for high movement zones.', pricePerUnit: 1980, discountPercent: 11, stockQuantity: 60, quantityUnit: 'litre', rating: 4.9, imageURL: 'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&q=80' },
    { productId: 'KS-013', productName: 'Integral Concrete Waterproof Admixture', category: 'New Construction', description: 'Concrete admixture that reduces permeability and shrinkage cracks.', pricePerUnit: 760, discountPercent: 5, stockQuantity: 170, quantityUnit: 'kg', rating: 4.4, imageURL: 'https://images.unsplash.com/photo-1496247749665-49cf5b1022e9?auto=format&fit=crop&q=80' },
    { productId: 'KS-014', productName: 'Anti-Efflorescence Chemical Wash', category: 'New Construction', description: 'Surface treatment for salt and efflorescence affected masonry.', pricePerUnit: 520, discountPercent: 0, stockQuantity: 140, quantityUnit: 'litre', rating: 4.0, imageURL: 'https://images.unsplash.com/photo-1489514354504-1653aa90e34e?auto=format&fit=crop&q=80' },
    { productId: 'KS-015', productName: 'Silane-Siloxane Penetrating Sealer', category: 'New Construction', description: 'Long-lasting breathable sealer for concrete and stone.', pricePerUnit: 980, discountPercent: 8, stockQuantity: 85, quantityUnit: 'litre', rating: 4.5, imageURL: 'https://images.unsplash.com/photo-1438086966358-54859d0ed716?auto=format&fit=crop&q=80' },
    { productId: 'KS-016', productName: 'Bathroom Leak Stop Combo', category: 'New Construction', description: 'Ready-to-use bathroom kit for under-tile and wall treatment.', pricePerUnit: 2480, discountPercent: 10, stockQuantity: 55, quantityUnit: 'pack', rating: 4.6, imageURL: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80' },
    { productId: 'KS-017', productName: 'Cold Joint Sealing Compound', category: 'New Construction', description: 'Joint sealing material for concrete transitions and cold joints.', pricePerUnit: 670, discountPercent: 3, stockQuantity: 130, quantityUnit: 'kg', rating: 4.2, imageURL: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80' },
    { productId: 'KS-018', productName: 'External Wall Crack Bridge Mesh', category: 'New Construction', description: 'Polymer mesh for reinforcement in wall waterproofing layers.', pricePerUnit: 430, discountPercent: 0, stockQuantity: 210, quantityUnit: 'pack', rating: 4.1, imageURL: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80' },
    { productId: 'KS-019', productName: 'Bituminous Basement Coat', category: 'New Construction', description: 'High-build bituminous layer for foundation and retaining walls.', pricePerUnit: 1540, discountPercent: 6, stockQuantity: 70, quantityUnit: 'litre', rating: 4.4, imageURL: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80' },
    { productId: 'KS-020', productName: 'Terrace Drain Outlet Seal Kit', category: 'New Construction', description: 'Drain sealing kit to prevent leakage around rainwater outlets.', pricePerUnit: 850, discountPercent: 5, stockQuantity: 120, quantityUnit: 'pack', rating: 4.3, imageURL: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80' }
];

const createSeedOrders = (users, companyId, products) => {
    const pick = (code) => products.find((p) => p.productId === code);
    const buildItem = (product, quantity) => {
        const unitPrice = product.pricePerUnit * (1 - ((product.discountPercent || 0) / 100));
        return {
            product: product._id,
            productName: product.productName,
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity
        };
    };

    const userOrders = [
        { userIndex: 0, status: 'Completed', products: [['KS-001', 2], ['KS-009', 3]] },
        { userIndex: 1, status: 'Processing', products: [['KS-005', 1], ['KS-013', 2]] },
        { userIndex: 2, status: 'Pending', products: [['KS-012', 1], ['KS-020', 2]] },
        { userIndex: 3, status: 'Completed', products: [['KS-003', 3], ['KS-017', 1]] },
        { userIndex: 4, status: 'Processing', products: [['KS-011', 2], ['KS-015', 2]] }
    ];

    return userOrders.map((entry) => {
        const user = users[entry.userIndex];
        const items = entry.products.map(([code, qty]) => buildItem(pick(code), qty));
        const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

        return {
            orderId: `ORD-2026-${uuidv4().slice(0, 8).toUpperCase()}`,
            user: user._id,
            companyId,
            items,
            totalAmount,
            shippingDetails: {
                fullName: user.name,
                address: user.address,
                phone: user.phone,
                city: user.city,
                pincode: user.pincode
            },
            status: entry.status
        };
    });
};

const seedSites = (companyId, users, orders) => {
    return [
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: users[0].name, customerPhone: users[0].phone, siteAddress: users[0].address, projectType: 'Repair Work', workType: 'Terrace', assignedLabours: [], startDate: new Date('2026-03-20'), expectedEndDate: new Date('2026-04-18'), status: 'In Progress', linkedOrderId: orders[0]._id, siteName: `${users[0].name} Site`, location: users[0].address, currentPhase: 'In Progress', requiredLabours: 2, availableLabours: 0, priority: 'High' },
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: users[1].name, customerPhone: users[1].phone, siteAddress: users[1].address, projectType: 'Repair Work', workType: 'Bathroom', assignedLabours: [], startDate: new Date('2026-04-05'), expectedEndDate: new Date('2026-04-26'), status: 'Pending', linkedOrderId: orders[1]._id, siteName: `${users[1].name} Site`, location: users[1].address, currentPhase: 'Pending', requiredLabours: 1, availableLabours: 0, priority: 'Medium' },
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: users[2].name, customerPhone: users[2].phone, siteAddress: users[2].address, projectType: 'New Construction', workType: 'Basement', assignedLabours: [], startDate: new Date('2026-04-12'), expectedEndDate: new Date('2026-05-12'), status: 'Pending', linkedOrderId: orders[2]._id, siteName: `${users[2].name} Site`, location: users[2].address, currentPhase: 'Pending', requiredLabours: 0, availableLabours: 0, priority: 'Medium' },
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: users[3].name, customerPhone: users[3].phone, siteAddress: users[3].address, projectType: 'New Construction', workType: 'Tank', assignedLabours: [], startDate: new Date('2026-03-10'), expectedEndDate: new Date('2026-04-08'), status: 'Completed', linkedOrderId: orders[3]._id, siteName: `${users[3].name} Site`, location: users[3].address, currentPhase: 'Completed', requiredLabours: 1, availableLabours: 0, priority: 'Low' },
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: users[4].name, customerPhone: users[4].phone, siteAddress: users[4].address, projectType: 'Repair Work', workType: 'Wall', assignedLabours: [], startDate: new Date('2026-04-01'), expectedEndDate: new Date('2026-04-20'), status: 'In Progress', linkedOrderId: orders[4]._id, siteName: `${users[4].name} Site`, location: users[4].address, currentPhase: 'In Progress', requiredLabours: 1, availableLabours: 0, priority: 'High' },
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: 'Rohit Deshmukh', customerPhone: '9876504011', siteAddress: 'A-21, Kharadi, Pune', projectType: 'New Construction', workType: 'Terrace', assignedLabours: [], startDate: new Date('2026-04-18'), expectedEndDate: new Date('2026-05-25'), status: 'Pending', linkedOrderId: null, siteName: 'Rohit Deshmukh Site', location: 'A-21, Kharadi, Pune', currentPhase: 'Pending', requiredLabours: 0, availableLabours: 0, priority: 'Medium' },
        { siteId: `SITE-2026-${uuidv4().slice(0, 6).toUpperCase()}`, companyId, customerName: 'Meena Kulkarni', customerPhone: '9876504012', siteAddress: 'Plot 17, Baner, Pune', projectType: 'Repair Work', workType: 'Bathroom', assignedLabours: [], startDate: new Date('2026-04-09'), expectedEndDate: new Date('2026-04-30'), status: 'In Progress', linkedOrderId: null, siteName: 'Meena Kulkarni Site', location: 'Plot 17, Baner, Pune', currentPhase: 'In Progress', requiredLabours: 1, availableLabours: 0, priority: 'High' }
    ];
};

const seedDatabase = async ({ reset = true } = {}) => {
    console.log(`[SEED] Starting database seed (Reset: ${reset})...`);
    try {
        await connectDB();
        console.log('[SEED] Connected to MongoDB');

    let company = await Company.findOne({});
    if (!company) {
        const adminObjectId = new mongoose.Types.ObjectId();
        company = await Company.create({
            companyName: 'Karankar Sons & Chemicals',
            adminId: adminObjectId
        });
    }

    await upsertUserAccount({
        companyId: company._id,
        name: 'Platform Admin',
        email: 'admin@karankar.com',
        password: 'admin123',
        role: 'admin',
        phone: '9876500001',
        address: 'Karankar Sons Office, MIDC Road',
        city: 'Nagpur',
        pincode: '440001'
    });

    await upsertUserAccount({
        companyId: company._id,
        name: 'Test User',
        email: 'user@karankar.com',
        password: 'user123',
        role: 'user',
        phone: '9876500099',
        address: 'Demo Address, Pune',
        city: 'Pune',
        pincode: '411001'
    });

    const existingProducts = await Product.countDocuments();
    const existingUsers = await User.countDocuments();
    const existingCompany = await Company.countDocuments();

    if (!reset && existingProducts > 0 && existingUsers > 0 && existingCompany > 0) {
        await ensureMinimumData(company._id);
        return { skipped: true };
    }

    await User.deleteMany({});
    await Product.deleteMany({});
    await Company.deleteMany({});
    await Order.deleteMany({});
    await Site.deleteMany({});
    await Service.deleteMany({});
    await Invoice.deleteMany({});
    await Estimate.deleteMany({});
    await Contact.deleteMany({});
    await Cart.deleteMany({});

    const adminObjectId = new mongoose.Types.ObjectId();
    company = await Company.create({
        companyName: 'Karankar Sons & Chemicals',
        adminId: adminObjectId
    });

    const adminPassword = await bcrypt.hash('Admin@123', 10);

    await User.create({
        _id: adminObjectId,
        userId: uuidv4(),
        companyId: company._id,
        name: 'Platform Admin',
        email: 'admin@karankar.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        phone: '9876500001',
        address: 'Karankar Sons Office, MIDC Road',
        city: 'Nagpur',
        pincode: '440001'
    });

    const users = await User.create([
        { userId: uuidv4(), companyId: company._id, name: 'Test User', email: 'user@karankar.com', password: await bcrypt.hash('user123', 10), role: 'user', phone: '9876500099', address: 'Demo Address, Pune', city: 'Pune', pincode: '411001' },
        { userId: uuidv4(), companyId: company._id, name: 'Rahul Sharma', email: 'rahul@demo.com', password: await bcrypt.hash('Rahul@123', 10), role: 'user', phone: '9876500011', address: '12 Lake View Colony', city: 'Pune', pincode: '411001' },
        { userId: uuidv4(), companyId: company._id, name: 'Priya Patel', email: 'priya@demo.com', password: await bcrypt.hash('Priya@123', 10), role: 'user', phone: '9876500012', address: '44 Palm Residency', city: 'Ahmedabad', pincode: '380001' },
        { userId: uuidv4(), companyId: company._id, name: 'Amit Verma', email: 'amit@demo.com', password: await bcrypt.hash('Amit@123', 10), role: 'user', phone: '9876500013', address: '3 River Heights', city: 'Indore', pincode: '452001' },
        { userId: uuidv4(), companyId: company._id, name: 'Sneha Iyer', email: 'sneha@demo.com', password: await bcrypt.hash('Sneha@123', 10), role: 'user', phone: '9876500014', address: '77 Orchid Avenue', city: 'Bengaluru', pincode: '560001' },
        { userId: uuidv4(), companyId: company._id, name: 'Vikram Mehta', email: 'vikram@demo.com', password: await bcrypt.hash('Vikram@123', 10), role: 'user', phone: '9876500015', address: '29 Green Meadows', city: 'Mumbai', pincode: '400001' }
    ]);

    const products = await Product.create(catalog.map((item) => ({ ...item, companyId: company._id })));

    await Cart.create(
        users.map((user, index) => ({
            user: user._id,
            items: index < 2 ? [{ product: products[index]._id, quantity: index + 1, price: products[index].pricePerUnit }] : [],
            totalAmount: index < 2 ? products[index].pricePerUnit * (index + 1) : 0
        }))
    );

    const createdOrders = await Order.create(createSeedOrders(users, company._id, products));

    const siteDocs = await Site.create(seedSites(company._id, users, createdOrders));

    await Promise.all(createdOrders.map(async (order) => {
        const linkedSite = siteDocs.find((site) => site.linkedOrderId && site.linkedOrderId.toString() === order._id.toString());
        if (linkedSite) {
            order.serviceRequest = {
                required: true,
                projectType: linkedSite.projectType,
                workType: linkedSite.workType,
                expectedEndDate: linkedSite.expectedEndDate,
                notes: ''
            };
            order.serviceSite = linkedSite._id;
            await order.save();
        }
    }));

    const quotationSeeds = Array.from({ length: 8 }).map((_, index) => {
        const materialCost = 15000 + (index * 900);
        const labourCost = 7000 + (index * 500);
        const additionalCharges = 1000 + (index * 120);
        const area = 300 + (index * 40);
        const surfaceType = index % 3 === 0 ? 'Terrace Waterproofing' : 'Roof Waterproofing';
        const pricePerSqft = surfaceType === 'Terrace Waterproofing' ? 40 : 35;
        const baseAmount = area * pricePerSqft;
        const subtotal = baseAmount + materialCost + labourCost + additionalCharges;
        const discount = index % 2 === 0 ? 5 : 7;
        const gst = 18;
        const discountAmount = subtotal * (discount / 100);
        const gstAmount = (subtotal - discountAmount) * (gst / 100);
        return {
            quotationId: `QTN-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
            companyId: company._id,
            user: users[index % users.length]._id,
            customerName: users[index % users.length].name,
            customerPhone: users[index % users.length].phone,
            customerEmail: users[index % users.length].email,
            siteAddress: users[index % users.length].address,
            projectType: index % 2 === 0 ? 'Repair Work' : 'New Construction',
            workType: index % 2 === 0 ? 'Terrace Repair' : 'Basement Coating',
            area,
            surfaceType,
            pricePerSqft,
            baseAmount,
            materialCost,
            labourCost,
            additionalCharges,
            discount,
            gst,
            totalEstimatedCost: subtotal - discountAmount + gstAmount,
            notes: 'Seed quotation record',
            status: index % 3 === 0 ? 'Draft' : index % 3 === 1 ? 'Sent' : 'Approved'
        };
    });

    await Estimate.create(quotationSeeds);

    const bookingSeeds = Array.from({ length: 6 }).map((_, index) => {
        const user = users[index % users.length];
        return {
            serviceId: `SRV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
            companyId: company._id,
            user: user._id,
            serviceName: index % 2 === 0 ? 'Waterproofing Service' : 'Leak Inspection',
            projectType: index % 2 === 0 ? 'Repair Work' : 'New Construction',
            siteAddress: user.address,
            preferredStartDate: new Date(Date.now() + ((index + 1) * 86400000)),
            notes: 'Seed service booking',
            assignedLabour: null,
            site: user.address,
            status: index % 4 === 0 ? 'Pending' : index % 4 === 1 ? 'Approved' : index % 4 === 2 ? 'Assigned' : 'Completed'
        };
    });

    await Service.create(bookingSeeds);

    const invoiceSeeds = createdOrders.slice(0, 5).map((order) => {
        const customer = users.find((u) => u._id.toString() === order.user.toString()) || users[0];
        return {
            invoiceNumber: `INV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
            companyId: company._id,
            order: order._id,
            user: customer._id,
            companyName: 'Karankar Sons & Chemicals',
            companyAddress: 'Karankar Sons Office, MIDC Road, Nagpur',
            customerDetails: {
                fullName: order.shippingDetails.fullName,
                phone: order.shippingDetails.phone,
                address: order.shippingDetails.address,
                city: order.shippingDetails.city,
                pincode: order.shippingDetails.pincode
            },
            items: order.items.map((item) => ({
                itemName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal
            })),
            labourCharges: order.serviceRequest && order.serviceRequest.required ? Math.round(order.totalAmount * 0.1) : 0,
            totalCost: order.totalAmount,
            invoiceDate: order.createdAt
        };
    });

    await Invoice.create(invoiceSeeds);

    await Contact.create([
        { name: 'Deepak Rao', email: 'deepak@example.com', phone: '9876502001', message: 'Need terrace waterproofing recommendation.', status: 'Unread' },
        { name: 'Komal Jain', email: 'komal@example.com', phone: '9876502002', message: 'Please share quotation for basement treatment.', status: 'Read' }
    ]);

    console.log('[SEED] Seed process completed successfully');
    return { skipped: false, users: users.length + 1, products: products.length, labours: 0, sites: siteDocs.length };
} catch (error) {
    console.error('[SEED] Error during seed process:', error);
    throw error;
}
};

module.exports = { seedDatabase, connectDB };

if (require.main === module) {
    seedDatabase({ reset: true })
        .then((result) => {
            if (result.skipped) {
                console.log('Seed skipped because data already exists.');
            } else {
                console.log(`Seed complete. Users: ${result.users}, Products: ${result.products}, Sites: ${result.sites}`);
                    console.log('Admin Email: admin@karankar.com');
                console.log('Admin Password: admin123');
                console.log('Test User Email: user@karankar.com');
                console.log('Test User Password: user123');
            }
            process.exit(0);
        })
        .catch((error) => {
            console.error(`Error with data seeding: ${error.message}`);
            process.exit(1);
        });
}
