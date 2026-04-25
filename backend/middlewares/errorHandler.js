const errorHandler = (err, req, res, next) => {
    console.error('[Error Handler]', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        return res.status(400).json({ 
            success: false, 
            error: message,
            errorType: 'VALIDATION_ERROR',
            statusCode: 400
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        return res.status(400).json({ 
            success: false, 
            error: 'This record already exists',
            errorType: 'DUPLICATE_ERROR',
            statusCode: 400
        });
    }

    // JWT Error
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired token. Please login again.',
            errorType: 'AUTH_ERROR',
            statusCode: 401
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
            success: false, 
            error: 'Your session has expired. Please login again.',
            errorType: 'TOKEN_EXPIRED',
            statusCode: 401
        });
    }

    // Cast error (Invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID format',
            errorType: 'CAST_ERROR',
            statusCode: 400
        });
    }

    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const errorMessage = err.message || 'An unexpected server error occurred';

    res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'SERVER_ERROR',
        statusCode: statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 Not Found Handler (should be placed after all routes)
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        errorType: 'NOT_FOUND',
        statusCode: 404,
        path: req.originalUrl,
        method: req.method
    });
};

module.exports = { errorHandler, notFoundHandler };
