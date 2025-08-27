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
    switch (game) {
        case 'dice': {
            const winChance = 1 / 6;
            return winChance * settings.winMultiplier;
        }
        case 'coinflip': {
            const winChance = 0.5;
            return winChance * settings.winMultiplier;
        }
        case 'slots': {
            const { symbolWeights, winMultipliers } = settings;
            const totalWeight = Object.values(symbolWeights).reduce((a, b) => a + b, 0);
            let rtp = 0;
            for (const [symbol, weight] of Object.entries(symbolWeights)) {
                const probability = Math.pow(weight / totalWeight, 3);
                const combo = symbol + symbol + symbol;
                const multiplier = winMultipliers[combo] ?? 0;
                rtp += probability * multiplier;
            }
            return rtp;
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
                const multiplier = winMultipliers[k] ?? 0;
                rtp += probability * multiplier;
            }
            return rtp;
        }
        case 'rps': {
            const { casinoCut } = settings;
            return 1 - casinoCut;
        }
        case 'goldenJackpot': {
            const { winMultiplier, oneInChance } = settings;
            return (1 / oneInChance) * winMultiplier;
        }
        case 'blackjack': {
            // Blackjack RTP depends on strategy and rules.
            // In an infinite deck model, without splits and with basic strategy:
            // ~99.3–99.5%. We return 0.994 as the average.
            return 0.994;
        }
        default:
            throw new Error(`RTP for ${game} not implemented`);
    }
};
exports.calculateRTP = calculateRTP;
