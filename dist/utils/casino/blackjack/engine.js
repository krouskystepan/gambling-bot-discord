import { calculateHandValue } from './math';
const draw = (s) => {
    const card = s.deck[s.deckIndex];
    if (!card)
        throw new Error('Deck exhausted');
    s.deckIndex++;
    return card;
};
export const applyAction = (s, action) => {
    if (action === 'HIT' || action === 'DOUBLE') {
        s.playerCards.push(draw(s));
        const p = calculateHandValue(s.playerCards);
        if (p > 21) {
            return { finished: true, resultId: 'PB', payout: 0 };
        }
        if (action === 'DOUBLE') {
            s.betAmount *= 2;
            return { finished: false, dealerTurn: true };
        }
        return { finished: false };
    }
    return { finished: false, dealerTurn: true };
};
export const dealerDrawOne = (s) => {
    s.dealerCards.push(draw(s));
};
export const dealerShouldDraw = (s) => {
    return calculateHandValue(s.dealerCards) < 17;
};
export const resolveResult = (s) => {
    const p = calculateHandValue(s.playerCards);
    const d = calculateHandValue(s.dealerCards);
    if (d > 21) {
        return { finished: true, resultId: 'DB', payout: s.betAmount * 2 };
    }
    if (p === d) {
        return { finished: true, resultId: 'PUSH', payout: s.betAmount };
    }
    if (p > d) {
        return { finished: true, resultId: 'PW', payout: s.betAmount * 2 };
    }
    return { finished: true, resultId: 'DW', payout: 0 };
};
