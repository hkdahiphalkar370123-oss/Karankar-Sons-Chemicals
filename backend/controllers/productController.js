const Product = require('../../database/models/Product');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { getSearchTerm } = require('../utils/queryParams');

// @desc    Get all products for the company catalog
// @route   GET /api/products?page=1&limit=10
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const query = {};
    const { category, sort } = req.query;
    const searchTerm = getSearchTerm(req);

    if (category) {
        query.category = category;
    }
    if (searchTerm) {
        query.$or = [
            { productId: { $regex: searchTerm, $options: 'i' } },
            { productName: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
            { category: { $regex: searchTerm, $options: 'i' } }
        ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') {
        sortOption = { pricePerUnit: 1 };
    } else if (sort === 'price_desc') {
        sortOption = { pricePerUnit: -1 };
    } else if (sort === 'newest') {
        sortOption = { createdAt: -1 };
    }

    // Check if pagination is requested
    const page = req.query.page;
    const limit = req.query.limit;

    if (page || limit) {
        // Pagination mode
        const { page: pageNum, limit: limitNum, skip } = getPaginationParams(req, 10, 100);
        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum);
        
        return res.status(200).json(buildPaginationResponse(products, pageNum, limitNum, total));
    } else {
        // Legacy mode - return all products
        const products = await Product.find(query).sort(sortOption);
        res.status(200).json({ success: true, count: products.length, data: products });
    }
});

// @desc    Get one product by id
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    res.status(200).json({ success: true, data: product });
});

// @desc    Add a new product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
    const {
        productName,
        category,
        description,
        pricePerUnit,
        quantityUnit,
        discountPercent,
        stockQuantity,
        rating,
        status,
        imageURL: imageURLFromBody
    } = req.body;

    if (!productName || !category || typeof pricePerUnit === 'undefined' || !quantityUnit) {
        res.status(400);
        throw new Error('productName, category, pricePerUnit and quantityUnit are required');
    }

    let imageURL = imageURLFromBody || '';

    if (req.file) {
        // Image was uploaded
        imageURL = `/uploads/${req.file.filename}`;
    }

    const product = await Product.create({
        productId: uuidv4(),
        companyId: req.user.companyId,
        productName,
        category,
        description,
        imageURL,
        pricePerUnit,
        quantityUnit,
        discountPercent: discountPercent || 0,
        stockQuantity: stockQuantity || 0,
        rating: rating || 0,
        status: status || 'Active'
    });

    res.status(201).json({ success: true, data: product });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    const updates = { ...req.body };
    if (req.file) {
        updates.imageURL = `/uploads/${req.file.filename}`;
    }

    const updated = await Product.findByIdAndUpdate(product._id, updates, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: updated });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    await Product.deleteOne({ _id: product._id });
    res.status(200).json({ success: true, message: 'Product deleted' });
});

const getCategories = asyncHandler(async (req, res) => {
    const categories = await Product.distinct('category');
    res.status(200).json({ success: true, data: categories.filter(Boolean) });
});

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories
};
