"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gambling_bot_shared_1 = require("@krouskystepan/gambling-bot-shared");
const mongoose_1 = require("mongoose");
gambling_bot_shared_1.UserSchema.index({ userId: 1, guildId: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('User', gambling_bot_shared_1.UserSchema);
