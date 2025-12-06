"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gambling_bot_shared_1 = require("gambling-bot-shared");
const mongoose_1 = require("mongoose");
gambling_bot_shared_1.VipRoomSchema.index({ expiresAt: 1 });
gambling_bot_shared_1.VipRoomSchema.index({ userId: 1, guildId: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('VipRoom', gambling_bot_shared_1.VipRoomSchema);
