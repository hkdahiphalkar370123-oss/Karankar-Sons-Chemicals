const mongoose = require('mongoose');

// Load environment variables if not already loaded (e.g., in a main entry point)
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        
        if (!mongoUri) {
            console.error('❌ MONGODB_URI is not defined in environment variables!');
            process.exit(1);
        }

        // Safety check: Don't allow localhost in production
        if (process.env.NODE_ENV === 'production' && (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1'))) {
            console.error('❌ ERROR: Attempting to connect to LOCALHOST MongoDB in PRODUCTION environment!');
            console.error('Please set a valid MONGODB_URI in your Render environment variables.');
            process.exit(1);
        }

        const conn = await mongoose.connect(mongoUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
