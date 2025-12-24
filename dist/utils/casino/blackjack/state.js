const handDocToState = (hand) => ({
    ...hand,
    isSplitHand: false
});
const handStateToDoc = ({ isSplitHand: _isSplitHand, ...rest }) => rest;
export const docToEngine = (game) => ({
    deck: game.deck,
    deckIndex: game.deckIndex,
    hands: game.hands.map(handDocToState),
    activeHandIndex: game.activeHandIndex,
    dealerCards: game.dealerCards
});
export const engineToDoc = (engine, game) => {
    game.deck = engine.deck;
    game.deckIndex = engine.deckIndex;
    game.hands = engine.hands.map(handStateToDoc);
    game.activeHandIndex = engine.activeHandIndex;
    game.dealerCards = engine.dealerCards;
};
