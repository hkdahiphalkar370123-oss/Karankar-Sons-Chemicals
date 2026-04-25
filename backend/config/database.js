const mongoose = require('mongoose');

// Load environment variables if not already loaded (e.g., in a main entry point)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('Missing MONGODB_URI/MONGO_URI in environment');
        }
        const conn = await mongoose.connect(mongoUri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
