import { MINI_NUMBERS } from 'gambling-bot-shared';
export function getRouletteColor(number) {
    const color = MINI_NUMBERS[number];
    if (color === 'green')
        return '🟢';
    if (color === 'red')
        return '🔴';
    if (color === 'black')
        return '⚫';
    return '❓ Unknown';
}
