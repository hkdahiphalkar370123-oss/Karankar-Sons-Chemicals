const User = require('../../database/models/User');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// @desc    Get all users for the workspace
// @route   GET /api/users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
    // Only fetch users that belong to the logged-in user's company
    const users = await User.find({ companyId: req.user.companyId }).select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
});

// @desc    Add a new user to the workspace
// @route   POST /api/users
// @access  Private/Admin
const createUser = asyncHandler(async (req, res) => {
    const { name, email, password, role, phone, address, city, pincode } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please add all required fields');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        userId: uuidv4(),
        companyId: req.user.companyId, // Attach user to admin's company
        name,
        email,
        password: hashedPassword,
        role: role || 'user',
        isActive: true,
        phone,
        address,
        city,
        pincode
    });

    res.status(201).json({
        success: true,
        data: {
            _id: user._id,
            companyId: user.companyId,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            address: user.address,
            city: user.city,
            pincode: user.pincode
        }
    });
});

const getMyProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({ success: true, data: user });
});

const updateMyProfile = asyncHandler(async (req, res) => {
    const allowedFields = ['name', 'phone', 'address', 'city', 'pincode'];
    const updates = {};

    allowedFields.forEach((field) => {
        if (typeof req.body[field] !== 'undefined') {
            updates[field] = req.body[field];
        }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true
    }).select('-password');

    res.status(200).json({ success: true, data: user });
});

module.exports = {
    getUsers,
    createUser,
    getMyProfile,
    updateMyProfile
};
