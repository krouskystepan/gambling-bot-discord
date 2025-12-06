"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferTypeFromValue = inferTypeFromValue;
exports.calculateRouletteWin = calculateRouletteWin;
exports.getRouletteColor = getRouletteColor;
exports.getRouletteHelpers = getRouletteHelpers;
const gambling_bot_shared_1 = require("@krouskystepan/gambling-bot-shared");
function inferTypeFromValue(value) {
    const val = value.toLowerCase();
    if (['red', 'black'].includes(val))
        return 'color';
    if (['even', 'odd'].includes(val))
        return 'parity';
    if (['low', 'high'].includes(val))
        return 'range';
    if (val.startsWith('d') && ['1', '2', '3'].includes(val[1]))
        return 'dozen';
    if (val.startsWith('c') && ['1', '2', '3'].includes(val[1]))
        return 'column';
    if (val in gambling_bot_shared_1.MINI_NUMBERS)
        return 'number';
    throw new Error(`Invalid bet value: ${value}`);
}
function calculateRouletteWin(bet, result, payouts) {
    const amount = bet.amount;
    const numResult = Number(result);
    switch (bet.type) {
        case 'number':
            return bet.value === result ? amount * payouts.number : 0;
        case 'color':
            if (result === '0')
                return 0;
            return gambling_bot_shared_1.MINI_NUMBERS[result] === bet.value.toLowerCase()
                ? amount * payouts.color
                : 0;
        case 'parity':
            if (result === '0')
                return 0;
            const isEven = numResult % 2 === 0;
            return bet.value.toLowerCase() === (isEven ? 'even' : 'odd')
                ? amount * payouts.parity
                : 0;
        case 'range':
            if (result === '0')
                return 0;
            const isLow = numResult >= 1 && numResult <= 9;
            return bet.value.toLowerCase() === (isLow ? 'low' : 'high')
                ? amount * payouts.range
                : 0;
        case 'dozen':
            if (result === '0')
                return 0;
            const dozen = Math.ceil(Number(result) / 6);
            return Number(bet.value) === dozen ? amount * payouts.dozen : 0;
        case 'column':
            if (result === '0')
                return 0;
            const col = ((Number(result) - 1) % 3) + 1;
            return Number(bet.value) === col ? amount * payouts.column : 0;
    }
}
function getRouletteColor(number) {
    const color = gambling_bot_shared_1.MINI_NUMBERS[number];
    if (color === 'green')
        return '🟢';
    if (color === 'red')
        return '🔴';
    if (color === 'black')
        return '⚫';
    return '❓ Unknown';
}
function getRouletteHelpers() {
    const numbers = Object.keys(gambling_bot_shared_1.MINI_NUMBERS).map(Number);
    const columns = { 1: [], 2: [], 3: [] };
    numbers.forEach((n) => {
        if (n === 0)
            return;
        const col = ((n - 1) % 3) + 1;
        columns[col].push(n);
    });
    const dozens = { 1: [], 2: [], 3: [] };
    numbers.forEach((n) => {
        if (n === 0)
            return;
        const dozen = Math.ceil(n / 6);
        dozens[dozen].push(n);
    });
    const numbersTest = '   - 0–36';
    const colorsTest = '   - red / black';
    const parityTest = '   - odd / even';
    const rangesTest = '   - low (1–9) / high (10–18)';
    const columnsText = Object.keys(columns)
        .map((k) => `   - C${k} → ${columns[Number(k)].join(', ')}`)
        .join('\n');
    const dozensText = Object.keys(dozens)
        .map((k) => `   - D${k} → ${dozens[Number(k)].join(', ')}`)
        .join('\n');
    return [
        `- **Numbers:**\n${numbersTest}`,
        `- **Colors:**\n${colorsTest}`,
        `- **Parity:**\n${parityTest}`,
        `- **Ranges:**\n${rangesTest}`,
        `- **Columns:**\n${columnsText}`,
        `- **Dozens:**\n${dozensText}`,
    ].join('\n');
}
