const jwt = require('jsonwebtoken');
const User = require('../../database/models/User');
const asyncHandler = require('express-async-handler');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, error: 'The user belonging to this token no longer exists.' });
        }

        req.user = user;
        
        return require('./tenantScope').runWithTenant(user.companyId, () => {
            next();
        });
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
    }
});

module.exports = { protect };
