import mongoose from "mongoose";
import { Schema } from "mongoose";

const TransactionSchema = Schema({
    amount: {
        type: Number,
        required: true,
        validate: {
            validator: function(value) {
                return Number.isFinite(value);
            },
            message: 'Transaction amount must be a valid number'
        }
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    reference: {
        orderId: String,
        paymentId: String,
        transactionId: String
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    }
}, { _id: true }); 

const WalletSchema = Schema({
    userid: { 
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Balance cannot be negative'],
        validate: {
            validator: function(value) {
                return Number.isFinite(value) && value >= 0;
            },
            message: 'Balance must be a non-negative number'
        },
        set: function(value) {
            // Ensure balance is always rounded to 2 decimal places
            return Math.round(value * 100) / 100;
        }
    },
    transactions: {
        type: [TransactionSchema],
        default: []
    },
    currency: {
        type: String,
        default: 'INR',
        enum: ['INR', 'USD', 'EUR']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastTransactionDate: {
        type: Date,
        default: Date.now
    },
    metadata: {
        totalCredits: {
            type: Number,
            default: 0
        },
        totalDebits: {
            type: Number,
            default: 0
        },
        transactionCount: {
            type: Number,
            default: 0
        }
    }
}, { 
    timestamps: true,
    versionKey: '__v'
});

// Indexes for better query performance
WalletSchema.index({ userid: 1 }, { unique: true });
WalletSchema.index({ 'transactions.date': -1 });
WalletSchema.index({ balance: 1 });
WalletSchema.index({ lastTransactionDate: -1 });

// Pre-save middleware to update metadata
WalletSchema.pre('save', function(next) {
    if (this.isModified('transactions')) {
        // Recalculate metadata
        this.metadata.transactionCount = this.transactions.length;
        this.metadata.totalCredits = this.transactions
            .filter(t => t.type === 'credit')
            .reduce((sum, t) => sum + t.amount, 0);
        this.metadata.totalDebits = this.transactions
            .filter(t => t.type === 'debit')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Update last transaction date
        if (this.transactions.length > 0) {
            this.lastTransactionDate = new Date();
        }
    }
    
    // Ensure balance precision
    if (this.isModified('balance')) {
        this.balance = Math.round(this.balance * 100) / 100;
    }
    
    next();
});

// Instance methods
WalletSchema.methods.addTransaction = function(amount, type, description, reference = {}) {
    const transaction = {
        amount: Math.round(amount * 100) / 100, 
        type,
        description,
        date: new Date(),
        reference,
        status: 'completed'
    };
    
    this.transactions.push(transaction);
    
    if (type === 'credit') {
        this.balance += amount;
    } else if (type === 'debit') {
        if (this.balance < amount) {
            throw new Error('Insufficient balance');
        }
        this.balance -= amount;
    }
    
    // Ensure balance precision
    this.balance = Math.round(this.balance * 100) / 100;
    
    return this.save();
};

WalletSchema.methods.getRecentTransactions = function(limit = 10) {
    return this.transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);
};

WalletSchema.methods.getTransactionsByDateRange = function(startDate, endDate) {
    return this.transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
    });
};

// Static methods
WalletSchema.statics.findByUserId = function(userId) {
    return this.findOne({ userid: userId });
};

WalletSchema.statics.createWalletForUser = function(userId, initialBalance = 0) {
    const wallet = new this({
        userid: userId,
        balance: initialBalance,
        transactions: initialBalance > 0 ? [{
            amount: initialBalance,
            type: 'credit',
            description: 'Initial wallet creation bonus',
            date: new Date(),
            status: 'completed'
        }] : []
    });
    
    return wallet.save();
};

// Virtual for formatted balance
WalletSchema.virtual('formattedBalance').get(function() {
    return `₹${this.balance.toFixed(2)}`;
});

mongoose.models = {};

export default mongoose.model('Wallet', WalletSchema);