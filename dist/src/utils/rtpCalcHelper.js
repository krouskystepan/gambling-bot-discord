"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRTP = void 0;
const defaultConfig_1 = require("./defaultConfig");
// helper na kombinace
const combination = (n, k) => {
    if (k > n)
        return 0;
    let result = 1;
    for (let i = 1; i <= k; i++) {
        result = (result * (n - i + 1)) / i;
    }
    return result;
};
const calculateRTP = (game, settings) => {
    const toNumber = (val) => {
        if (typeof val === 'string')
            return parseFloat(val) || 0;
        if (typeof val === 'number')
            return val;
        return 0;
    };
    switch (game) {
        case 'dice': {
            const { winMultiplier } = settings;
            return (1 / 6) * toNumber(winMultiplier) * 100;
        }
        case 'coinflip': {
            const { winMultiplier } = settings;
            return 0.5 * toNumber(winMultiplier) * 100;
        }
        case 'slots': {
            const { symbolWeights, winMultipliers } = settings;
            const totalWeight = Object.values(symbolWeights).reduce((a, b) => a + toNumber(b), 0);
            let rtp = 0;
            for (const [symbol, weight] of Object.entries(symbolWeights)) {
                const probability = Math.pow(toNumber(weight) / totalWeight, 3);
                const combo = symbol + symbol + symbol;
                const multiplier = toNumber(winMultipliers[combo] ?? 0);
                rtp += probability * multiplier;
            }
            return rtp * 100;
        }
        case 'lottery': {
            const { winMultipliers } = settings;
            const userPicks = defaultConfig_1.LOTTERY_NUM_TO_DRAW;
            const drawnNumbers = defaultConfig_1.LOTTERY_NUM_TO_DRAW;
            let rtp = 0;
            for (let k = 0; k <= userPicks; k++) {
                const favorable = combination(userPicks, k) *
                    combination(defaultConfig_1.LOTTERY_TOTAL_NUMBERS - userPicks, drawnNumbers - k);
                const probability = favorable / combination(defaultConfig_1.LOTTERY_TOTAL_NUMBERS, drawnNumbers);
                const multiplier = toNumber(winMultipliers[k] ?? 0);
                rtp += probability * multiplier;
            }
            return rtp * 100;
        }
        case 'rps': {
            const { casinoCut } = settings;
            return (1 - toNumber(casinoCut)) * 100;
        }
        case 'goldenJackpot': {
            const { winMultiplier, oneInChance } = settings;
            return (toNumber(winMultiplier) / toNumber(oneInChance)) * 100;
        }
        case 'blackjack':
            return 99.4;
        case 'prediction':
            return 0;
        default:
            console.warn(`RTP for ${game} not implemented`);
            return 0;
    }
};
exports.calculateRTP = calculateRTP;
