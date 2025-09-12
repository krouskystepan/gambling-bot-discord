"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const BlackjackGameSchema = new mongoose_1.Schema({
    gameId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    guildId: {
        type: String,
        required: true,
        index: true,
    },
    betAmount: {
        type: Number,
        required: true,
    },
    deck: [
        {
            suite: { type: String, required: true },
            label: { type: String, required: true },
            value: { type: Number, required: true },
        },
    ],
    playerCards: [
        {
            suite: { type: String, required: true },
            label: { type: String, required: true },
            value: { type: Number, required: true },
        },
    ],
    dealerCards: [
        {
            suite: { type: String, required: true },
            label: { type: String, required: true },
            value: { type: Number, required: true },
        },
    ],
});
BlackjackGameSchema.index({ userId: 1, guildId: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('BlackjackGame', BlackjackGameSchema);
