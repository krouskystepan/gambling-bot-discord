export const SUITES = ['♠️', '♣️', '♥️', '♦️'];
export const VALUES = [
    { label: 'A', value: 11 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '6', value: 6 },
    { label: '7', value: 7 },
    { label: '8', value: 8 },
    { label: '9', value: 9 },
    { label: '10', value: 10 },
    { label: 'J', value: 10 },
    { label: 'Q', value: 10 },
    { label: 'K', value: 10 }
];
const createDeck = (deckCount) => Array.from({ length: deckCount }, () => SUITES.flatMap((suite) => VALUES.map(({ label, value }) => ({ suite, label, value })))).flat();
export const DECK = createDeck(2); // 2 decks
export const shuffleDeck = (deck) => {
    const arr = [...deck];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};
