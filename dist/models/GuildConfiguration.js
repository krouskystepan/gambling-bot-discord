"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const defaultConfig_1 = require("../utils/defaultConfig");
const guildConfigurationSchema = new mongoose_1.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true,
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
    managerRoleId: {
        type: String,
        default: '',
    },
    casinoSettings: {
        type: mongoose_1.Schema.Types.Mixed,
        default: defaultConfig_1.default,
    },
    vipSettings: {
        roleId: {
            type: String,
            default: '',
        },
        categoryId: {
            type: String,
            default: '',
        },
        pricePerDay: {
            type: Number,
            default: 0,
        },
        pricePerCreate: {
            type: Number,
            default: 0,
        },
    },
});
exports.default = (0, mongoose_1.model)('GuildConfiguration', guildConfigurationSchema);
