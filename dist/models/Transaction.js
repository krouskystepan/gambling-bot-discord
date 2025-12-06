"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gambling_bot_shared_1 = require("@krouskystepan/gambling-bot-shared");
const mongoose_1 = require("mongoose");
exports.default = (0, mongoose_1.model)('Transaction', gambling_bot_shared_1.TransactionSchema);
