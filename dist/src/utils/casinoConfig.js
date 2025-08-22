"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPS_CASINO_CUT = exports.getLotteryMultiplier = exports.LOTTERY_MAX_BET = exports.MAX_SIMULATE_LOTTERY = exports.SLOT_MAX_BET = exports.WEIGHTED_SYMBOLS = exports.SYMBOL_WEIGHTS = exports.SLOT_MULTIPLIERS = exports.MAX_SIMULATE_SPINS = exports.COINFLIP_MAX_BET = exports.COINFLIP_WIN_MULTIPLIER = exports.MAX_SIMULATE_FLIPS = exports.DICE_MAX_BET = exports.DICE_WIN_MULTIPLIER = exports.MAX_SIMULATE_ROLLS = void 0;
// Dice
exports.MAX_SIMULATE_ROLLS = 100_000_0000;
exports.DICE_WIN_MULTIPLIER = 5;
exports.DICE_MAX_BET = 3000;
// Coin Flip
exports.MAX_SIMULATE_FLIPS = 200_000_000;
exports.COINFLIP_WIN_MULTIPLIER = 1.9;
exports.COINFLIP_MAX_BET = 3000;
// Slots
exports.MAX_SIMULATE_SPINS = 50_000_000;
exports.SLOT_MULTIPLIERS = {
    '🍒🍒🍒': 5,
    '🍋🍋🍋': 10,
    '🍉🍉🍉': 20,
    '🔔🔔🔔': 50,
    '7️⃣7️⃣7️⃣': 100,
};
exports.SYMBOL_WEIGHTS = {
    '🍒': 35,
    '🍋': 25,
    '🍉': 10,
    '🔔': 4,
    '7️⃣': 2,
};
exports.WEIGHTED_SYMBOLS = Object.entries(exports.SYMBOL_WEIGHTS).flatMap(([symbol, weight]) => Array(weight).fill(symbol));
exports.SLOT_MAX_BET = 1000;
// Lottery
exports.MAX_SIMULATE_LOTTERY = 10_000_000;
exports.LOTTERY_MAX_BET = 1000;
const getLotteryMultiplier = (matchedNumbers) => {
    let multiplier;
    switch (matchedNumbers) {
        case 5:
            multiplier = 1000;
            break;
        case 4:
            multiplier = 125;
            break;
        case 3:
            multiplier = 25;
            break;
        case 2:
            multiplier = 4;
            break;
        default:
            multiplier = 0;
    }
    return multiplier;
};
exports.getLotteryMultiplier = getLotteryMultiplier;
// Rock, Paper, Scissors
exports.RPS_CASINO_CUT = 0.025;
