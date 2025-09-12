"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const VipRoomSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, {
    timestamps: true,
});
VipRoomSchema.index({ expiresAt: 1 });
VipRoomSchema.index({ userId: 1, guildId: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('VipRoom', VipRoomSchema);
