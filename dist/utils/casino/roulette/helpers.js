import { MINI_NUMBERS } from 'gambling-bot-shared';
export function getRouletteHelpers() {
    const numbers = Object.keys(MINI_NUMBERS).map(Number);
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
        `- **Dozens:**\n${dozensText}`
    ].join('\n');
}
