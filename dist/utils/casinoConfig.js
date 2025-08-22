"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLACKJACK_MAX_BET = exports.GOLDEN_JACKPOT_ONE_IN_CHANCE = exports.GOLDEN_JACKPOT_MULTIPLIER = exports.GOLDEN_JACKPOT_MAX_BET = exports.GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES = exports.RPS_MAX_BET = exports.RPS_CASINO_CUT = exports.LOTTERY_MULTIPLIERS = exports.LOTTERY_MAX_BET = exports.LOTTERY_MAX_SIMULATE_ENTRIES = exports.SLOT_MAX_BET = exports.WEIGHTED_SYMBOLS = exports.SYMBOL_WEIGHTS = exports.SLOT_MULTIPLIERS = exports.SLOT_MAX_SIMULATE_SPINS = exports.COINFLIP_MAX_BET = exports.COINFLIP_WIN_MULTIPLIER = exports.COINFLIP_MAX_SIMULATE_FLIPS = exports.DICE_MAX_BET = exports.DICE_WIN_MULTIPLIER = exports.DICE_MAX_SIMULATE_ROLLS = void 0;
// Dice
exports.DICE_MAX_SIMULATE_ROLLS = 100_000_000;
exports.DICE_WIN_MULTIPLIER = 5;
exports.DICE_MAX_BET = 0; // 3000
// Coin Flip
exports.COINFLIP_MAX_SIMULATE_FLIPS = 200_000_000;
exports.COINFLIP_WIN_MULTIPLIER = 1.9;
exports.COINFLIP_MAX_BET = 0; // 3000
// Slots
exports.SLOT_MAX_SIMULATE_SPINS = 50_000_000;
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
exports.SLOT_MAX_BET = 0; // 1000
// Lottery
exports.LOTTERY_MAX_SIMULATE_ENTRIES = 10_000_000;
exports.LOTTERY_MAX_BET = 0; // 1000
exports.LOTTERY_MULTIPLIERS = {
    5: 1000,
    4: 125,
    3: 25,
    2: 4,
    1: 0,
    0: 0,
};
// Rock, Paper, Scissors
exports.RPS_CASINO_CUT = 0.025;
exports.RPS_MAX_BET = 0; // 10000
// Golden Jackpot
exports.GOLDEN_JACKPOT_MAX_SIMULATE_ENTRIES = 100_000_000;
exports.GOLDEN_JACKPOT_MAX_BET = 0; // 1000
exports.GOLDEN_JACKPOT_MULTIPLIER = 10_000;
exports.GOLDEN_JACKPOT_ONE_IN_CHANCE = 12_000;
// Blackjack
exports.BLACKJACK_MAX_BET = 0; // 1000
