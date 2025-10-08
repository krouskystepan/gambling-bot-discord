"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TransactionSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: {
        type: String,
        required: true,
        enum: ['deposit', 'withdraw', 'bet', 'win', 'refund', 'bonus', 'vip'],
    },
    source: {
        type: String,
        required: true,
        enum: ['command', 'manual', 'web', 'system', 'casino'],
    },
    meta: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    betId: { type: String, default: null },
    handledBy: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
// for pagination / sorting
TransactionSchema.index({ guildId: 1, createdAt: -1 });
// filter + sort
TransactionSchema.index({ guildId: 1, type: 1, createdAt: -1 });
// filter + sort
TransactionSchema.index({ guildId: 1, source: 1, createdAt: -1 });
// user search
TransactionSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
// admin search
TransactionSchema.index({ guildId: 1, handledBy: 1, createdAt: -1 });
// for bet lookups
TransactionSchema.index({ guildId: 1, betId: 1 });
exports.default = (0, mongoose_1.model)('Transaction', TransactionSchema);
