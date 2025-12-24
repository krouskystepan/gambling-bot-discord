export const docToEngine = (game) => ({
    deck: game.deck,
    deckIndex: game.deckIndex,
    hands: game.hands,
    activeHandIndex: game.activeHandIndex,
    dealerCards: game.dealerCards
});
export const engineToDoc = (engine, game) => {
    game.deck = engine.deck;
    game.deckIndex = engine.deckIndex;
    game.hands = engine.hands;
    game.activeHandIndex = engine.activeHandIndex;
    game.dealerCards = engine.dealerCards;
};
