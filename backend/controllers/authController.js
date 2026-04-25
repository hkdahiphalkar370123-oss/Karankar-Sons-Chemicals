const User = require('../../database/models/User');
const Company = require('../../database/models/Company');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const { authLogger } = require('../middlewares/logger');
const { sendEmail } = require('../config/emailService');
const { registrationEmail } = require('../config/emailTemplates');

// @desc    Register customer user (single-company system)
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
    const { name, email, password, phone, address, city, pincode } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please include all fields');
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const company = await Company.findOne({});
    if (!company) {
        res.status(500);
        throw new Error('Company is not initialized. Please seed the database first.');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        userId: uuidv4(),
        companyId: company._id,
        name,
        email,
        password: hashedPassword,
        role: 'user',
        isActive: true,
        phone,
        address,
        city,
        pincode
    });

    // Log successful registration
    authLogger(email, 'USER_REGISTRATION', true, req.ip || 'Unknown', `User registered with role: user`);

    // Send welcome email
    try {
        const emailResult = await sendEmail(
            user.email,
            'Welcome to Karankar Chemicals',
            registrationEmail(user.name, user.email)
        );
        if (!emailResult.success) {
            console.log('Registration email send failed:', emailResult.error);
        }
    } catch (emailError) {
        console.log('Error sending registration email:', emailError.message);
    }

    res.status(201).json({
        success: true,
        data: {
            _id: user._id,
            companyId: company._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            address: user.address,
            city: user.city,
            pincode: user.pincode,
            token: generateToken(user._id, user.role)
        }
    });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        authLogger(email, 'LOGIN', false, req.ip || 'Unknown', 'User not found');
        res.status(401);
        throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        authLogger(email, 'LOGIN', false, req.ip || 'Unknown', 'Invalid password');
        res.status(401);
        throw new Error('Invalid credentials');
    }

    // Log successful login
    authLogger(email, 'LOGIN', true, req.ip || 'Unknown', `User role: ${user.role}`);

    res.status(200).json({
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
            pincode: user.pincode,
            token: generateToken(user._id, user.role)
        }
    });
});

// @desc    Register admin user (protected endpoint)
// @route   POST /api/auth/register-admin
// @access  Admin Only
const registerAdmin = asyncHandler(async (req, res) => {
    const { name, email, password, phone, address, city, pincode } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please include all fields');
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const company = await Company.findOne({});
    if (!company) {
        res.status(500);
        throw new Error('Company is not initialized. Please seed the database first.');
    }

    // Hash password with strong salt
    const salt = await bcrypt.genSalt(12);  // Higher salt rounds for admin accounts
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await User.create({
        userId: uuidv4(),
        companyId: company._id,
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        phone,
        address,
        city,
        pincode
    });

    // Log admin registration
    authLogger(email, 'ADMIN_REGISTRATION', true, req.ip || 'Unknown', `Admin account created with elevated privileges`);

    // Send welcome email to admin
    try {
        const emailResult = await sendEmail(
            admin.email,
            'Admin Account Created - Karankar Chemicals',
            registrationEmail(admin.name, admin.email)
        );
        if (!emailResult.success) {
            console.log('Admin registration email send failed:', emailResult.error);
        }
    } catch (emailError) {
        console.log('Error sending admin registration email:', emailError.message);
    }

    res.status(201).json({
        success: true,
        data: {
            _id: admin._id,
            companyId: company._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            phone: admin.phone,
            address: admin.address,
            city: admin.city,
            pincode: admin.pincode,
            token: generateToken(admin._id, admin.role)
        }
    });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    // req.user is set in the verify token middleware
    res.status(200).json({
        success: true,
        data: req.user
    });
});

// Generate Token with role and expiry
const generateToken = (id, role = 'user') => {
    return jwt.sign(
        { 
            id, 
            role,
            iat: Math.floor(Date.now() / 1000)
        }, 
        process.env.JWT_SECRET || 'fallback_secret', 
        {
            expiresIn: '7d'  // Shorter expiry for better security
        }
    );
};

module.exports = {
    register,
    registerAdmin,
    login,
    getMe
};
