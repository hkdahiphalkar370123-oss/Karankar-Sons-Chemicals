const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'app.log');
const errorLogFile = path.join(logsDir, 'error.log');
const authLogFile = path.join(logsDir, 'auth.log');

// Helper function to format timestamp
const getTimestamp = () => {
    return new Date().toISOString();
};

// Helper function to write logs to file with rotation
const writeLog = (filePath, message) => {
    const timestamp = getTimestamp();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    try {
        fs.appendFileSync(filePath, logMessage);
    } catch (err) {
        console.error(`Failed to write to log file: ${err.message}`);
    }
};

// Rotate log files if they exceed 10MB
const rotateLog = (filePath) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > maxSize) {
            const ext = path.extname(filePath);
            const name = path.basename(filePath, ext);
            const dir = path.dirname(filePath);
            const timestamp = new Date().getTime();
            const newPath = path.join(dir, `${name}-${timestamp}${ext}`);
            fs.renameSync(filePath, newPath);
        }
    } catch (err) {
        // Log file doesn't exist yet, which is fine
    }
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const method = req.method;
    const url = req.originalUrl;
    const remoteAddr = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'Unknown';
    
    // Log request
    const logMessage = `[REQUEST] ${method} ${url} | IP: ${remoteAddr} | User-Agent: ${userAgent}`;
    writeLog(logFile, logMessage);
    
    // Capture response
    const send = res.send;
    res.send = function(data) {
        const statusCode = res.statusCode;
        const responseLogMessage = `[RESPONSE] ${method} ${url} | Status: ${statusCode}`;
        writeLog(logFile, responseLogMessage);
        
        return send.call(this, data);
    };
    
    next();
};

// Auth event logger (login attempts, registrations)
const authLogger = (email, action, success, ipAddress, details = '') => {
    rotateLog(authLogFile);
    const status = success ? 'SUCCESS' : 'FAILED';
    const message = `[AUTH] ${action} | Email: ${email} | Status: ${status} | IP: ${ipAddress} | Details: ${details}`;
    writeLog(authLogFile, message);
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
    rotateLog(errorLogFile);
    
    const timestamp = getTimestamp();
    const method = req.method;
    const url = req.originalUrl;
    const statusCode = res.statusCode || 500;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const errorMessage = err.message || 'Unknown error';
    const errorStack = err.stack || 'No stack trace';
    
    const logMessage = `${timestamp} | METHOD: ${method} | URL: ${url} | STATUS: ${statusCode} | IP: ${ipAddress} | ERROR: ${errorMessage} | STACK: ${errorStack}`;
    writeLog(errorLogFile, logMessage);
    
    // Pass to next error handler
    next(err);
};

// Get logs (for admin view)
const getLogs = (logType = 'app') => {
    try {
        let filePath;
        switch(logType) {
            case 'error':
                filePath = errorLogFile;
                break;
            case 'auth':
                filePath = authLogFile;
                break;
            default:
                filePath = logFile;
        }
        
        if (!fs.existsSync(filePath)) {
            return [];
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').filter(line => line.length > 0);
    } catch (err) {
        console.error(`Error reading log file: ${err.message}`);
        return [];
    }
};

module.exports = {
    requestLogger,
    authLogger,
    errorLogger,
    getLogs,
    logFile,
    errorLogFile,
    authLogFile
};
