"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRTP = void 0;
const defaultConfig_1 = require("./defaultConfig");
const rouletteUtils_1 = require("./rouletteUtils");
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
        case 'roulette': {
            const { winMultipliers } = settings;
            const numbers = Object.keys(rouletteUtils_1.MINI_NUMBERS);
            const totalNumbers = numbers.length;
            const greenCount = numbers.filter((n) => rouletteUtils_1.MINI_NUMBERS[n] === 'green').length;
            const numberRTP = (1 / totalNumbers) * toNumber(winMultipliers.number) * 100;
            const redCount = numbers.filter((n) => rouletteUtils_1.MINI_NUMBERS[n] === 'red').length;
            const colorRTP = (redCount / totalNumbers) * toNumber(winMultipliers.color) * 100;
            const evenCount = numbers.filter((n) => parseInt(n) % 2 === 0 && rouletteUtils_1.MINI_NUMBERS[n] !== 'green').length;
            const parityRTP = (evenCount / (totalNumbers - greenCount)) *
                toNumber(winMultipliers.parity) *
                100;
            const rangeCount = numbers.filter((n) => parseInt(n) >= 1 && parseInt(n) <= 9).length;
            const rangeRTP = (rangeCount / (totalNumbers - greenCount)) *
                toNumber(winMultipliers.range) *
                100;
            const dozenCount = numbers.filter((n) => parseInt(n) >= 1 && parseInt(n) <= 6).length;
            const dozenRTP = (dozenCount / (totalNumbers - greenCount)) *
                toNumber(winMultipliers.dozen) *
                100;
            const columnCount = numbers.filter((n) => parseInt(n) % 3 === 1 && rouletteUtils_1.MINI_NUMBERS[n] !== 'green').length;
            const columnRTP = (columnCount / (totalNumbers - greenCount)) *
                toNumber(winMultipliers.column) *
                100;
            return {
                number: numberRTP,
                color: colorRTP,
                parity: parityRTP,
                range: rangeRTP,
                dozen: dozenRTP,
                column: columnRTP,
            };
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
