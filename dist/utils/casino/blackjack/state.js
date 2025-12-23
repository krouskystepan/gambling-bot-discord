export const docToEngine = (doc) => ({
    deck: [...doc.deck],
    deckIndex: doc.deckIndex,
    playerCards: [...doc.playerCards],
    dealerCards: [...doc.dealerCards],
    betAmount: doc.betAmount
});
export const engineToDoc = (engine, doc) => {
    doc.deck = engine.deck;
    doc.deckIndex = engine.deckIndex;
    doc.playerCards = engine.playerCards;
    doc.dealerCards = engine.dealerCards;
    doc.betAmount = engine.betAmount;
};
