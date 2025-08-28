"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const PredictionSchema = new mongoose_1.Schema({
    predictionId: {
        type: String,
        required: true,
    },
    guildId: {
        type: String,
        required: true,
    },
    channelId: {
        type: String,
        required: true,
    },
    creatorId: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    choices: [
        {
            choiceName: { type: String, required: true },
            odds: { type: Number, required: true },
            bets: [
                {
                    userId: { type: String, required: true },
                    amount: { type: Number, required: true },
                },
            ],
        },
    ],
    status: {
        type: String,
        enum: ['active', 'ended', 'paid', 'canceled'],
        default: 'active',
    },
}, { timestamps: true });
PredictionSchema.index({ predictionId: 1, guildId: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('Prediction', PredictionSchema);
