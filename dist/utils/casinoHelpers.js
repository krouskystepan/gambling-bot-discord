"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawNextCard = exports.spinRouletteWheel = exports.drawGoldenJackpot = exports.drawLottery = exports.flipCoin = exports.rollDice = exports.spinSlot = void 0;
const defaultConfig_1 = require("./defaultConfig");
const rouletteUtils_1 = require("./rouletteUtils");
const spinSlot = (slotConfig) => {
    const weightedSymbols = Object.entries(slotConfig.symbolWeights).flatMap(([symbol, weight]) => Array(Number(weight)).fill(symbol));
    const spin = () => weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)];
    return spin() + spin() + spin();
};
exports.spinSlot = spinSlot;
const rollDice = () => {
    return Math.floor(Math.random() * 6) + 1;
};
exports.rollDice = rollDice;
const flipCoin = () => {
    return Math.random() < 0.5 ? 'heads' : 'tails';
};
exports.flipCoin = flipCoin;
const drawLottery = () => {
    const pool = Array.from({ length: defaultConfig_1.LOTTERY_TOTAL_NUMBERS }, (_, i) => i + 1);
    const result = [];
    for (let i = 0; i < defaultConfig_1.LOTTERY_NUM_TO_DRAW; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        result.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return result;
};
exports.drawLottery = drawLottery;
const drawGoldenJackpot = (goldenJackpotConfig) => {
    return Math.floor(Math.random() * goldenJackpotConfig.oneInChance) + 1;
};
exports.drawGoldenJackpot = drawGoldenJackpot;
const spinRouletteWheel = () => {
    const index = Math.floor(Math.random() * rouletteUtils_1.AMERICAN_NUMBERS.length);
    return rouletteUtils_1.AMERICAN_NUMBERS[index];
};
exports.spinRouletteWheel = spinRouletteWheel;
const drawNextCard = (deck, cardIndex) => {
    if (cardIndex >= deck.length) {
        cardIndex = 0;
    }
    return deck[cardIndex];
};
exports.drawNextCard = drawNextCard;
