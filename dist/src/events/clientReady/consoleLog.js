"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = async (client) => {
    const currentTime = new Date().toLocaleString('cs-CZ');
    console.log(`✅ ${client.user?.tag} is online\n🕛 Time: ${currentTime}`);
};
