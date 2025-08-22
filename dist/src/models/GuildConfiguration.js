"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const guildConfigurationSchema = new mongoose_1.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    atmChannelIds: {
        actions: {
            type: String,
            default: '',
        },
        logs: {
            type: String,
            default: '',
        },
    },
    adminChannelIds: {
        type: [String],
        default: [],
    },
    casinoChannelIds: {
        type: [String],
        default: [],
    },
    predictionChannelIds: {
        type: [String],
        default: [],
    },
});
exports.default = (0, mongoose_1.model)('GuildConfiguration', guildConfigurationSchema);
