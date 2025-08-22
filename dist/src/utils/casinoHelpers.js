"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spinSlot = spinSlot;
exports.rollDice = rollDice;
exports.flipCoin = flipCoin;
exports.drawLottery = drawLottery;
const casinoConfig_1 = require("./casinoConfig");
function spinSlot() {
    return (casinoConfig_1.WEIGHTED_SYMBOLS[Math.floor(Math.random() * casinoConfig_1.WEIGHTED_SYMBOLS.length)] +
        casinoConfig_1.WEIGHTED_SYMBOLS[Math.floor(Math.random() * casinoConfig_1.WEIGHTED_SYMBOLS.length)] +
        casinoConfig_1.WEIGHTED_SYMBOLS[Math.floor(Math.random() * casinoConfig_1.WEIGHTED_SYMBOLS.length)]);
}
function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}
function flipCoin() {
    return Math.random() < 0.5 ? 'heads' : 'tails';
}
function drawLottery() {
    return Array.from({ length: 50 }, (_, i) => i + 1)
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
}
