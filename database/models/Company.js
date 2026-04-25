const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const companySchema = new mongoose.Schema({
    companyId: { 
        type: String, 
        required: true, 
        unique: true, 
        default: uuidv4 
    },
    companyName: { 
        type: String, 
        required: true 
    },
    adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
