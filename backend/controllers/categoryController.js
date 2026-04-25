const Category = require('../../database/models/Category');
const asyncHandler = require('express-async-handler');

exports.getCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find();
    res.json(categories);
});

exports.createCategory = asyncHandler(async (req, res) => {
    const category = await Category.create(req.body);
    res.status(201).json(category);
});
