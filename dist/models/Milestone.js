"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const MilestoneSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true },
    baseThreshold: { type: Number, required: true, default: 10_000 },
    baseReward: { type: Number, required: true, default: 500 },
    multiplierThreshold: { type: Number, required: true, default: 1.5 },
    multiplierReward: { type: Number, required: true, default: 1.5 },
}, { timestamps: true });
exports.default = (0, mongoose_1.model)('Milestones', MilestoneSchema);
