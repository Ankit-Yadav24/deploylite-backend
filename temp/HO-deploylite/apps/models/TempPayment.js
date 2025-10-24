import mongoose from "mongoose";
import { Schema } from "mongoose";

const TempPaymentSchema = Schema({
    email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true,
        index: true 
    },
    amount: { 
        type: Number, 
        required: true,
        min: [1, 'Amount must be at least 1'],
        validate: {
            validator: function(value) {
                return Number.isFinite(value) && value > 0;
            },
            message: 'Amount must be a positive number'
        }
    },
    orderId: {
        type: String,
        required: true,
        index: true,  
        unique: true 
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true 
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    failureReason: {
        type: String,
        default: null
    },
    metadata: {
        userAgent: String,
        ipAddress: String,
        sessionId: String
    }
}, { 
    timestamps: true,
    expires: 86400  
});

// Compound indexes for better query performance
TempPaymentSchema.index({ email: 1, status: 1 });
TempPaymentSchema.index({ orderId: 1, status: 1 });
TempPaymentSchema.index({ createdAt: 1 });

// Add pre-save middleware for validation
TempPaymentSchema.pre('save', function(next) {
    // Ensure amount is properly formatted
    if (this.amount) {
        this.amount = Math.round(this.amount * 100) / 100; 
    }
    next();
});

// Add methods to the schema
TempPaymentSchema.methods.markCompleted = function(paymentId) {
    this.status = 'completed';
    this.razorpayPaymentId = paymentId;
    this.completedAt = new Date();
    return this.save();
};

TempPaymentSchema.methods.markFailed = function(reason) {
    this.status = 'failed';
    this.failureReason = reason;
    return this.save();
};

// Static methods
TempPaymentSchema.statics.findByOrderId = function(orderId) {
    return this.findOne({ 
        orderId: orderId.toString(),
        status: { $in: ['pending', 'processing'] }
    });
};

TempPaymentSchema.statics.cleanupExpired = function() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.deleteMany({
        createdAt: { $lt: oneDayAgo },
        status: { $in: ['pending', 'failed'] }
    });
};

mongoose.models = {};

export default mongoose.model('TempPayment', TempPaymentSchema);