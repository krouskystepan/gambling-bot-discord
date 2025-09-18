"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    balance: { type: Number, default: 0 },
    lockedBalance: { type: Number, default: 0 },
    lastDailyClaim: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
}, { timestamps: true });
UserSchema.index({ userId: 1, guildId: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('User', UserSchema);
