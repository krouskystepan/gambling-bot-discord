"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spinSlot = spinSlot;
exports.rollDice = rollDice;
exports.flipCoin = flipCoin;
exports.drawLottery = drawLottery;
exports.drawGoldenJackpot = drawGoldenJackpot;
exports.drawNextCard = drawNextCard;
function spinSlot(slotConfig) {
    const weightedSymbols = Object.entries(slotConfig.symbolWeights).flatMap(([symbol, weight]) => Array(weight).fill(symbol));
    const spin = () => weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)];
    return spin() + spin() + spin();
}
function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}
function flipCoin() {
    return Math.random() < 0.5 ? 'heads' : 'tails';
}
function drawLottery() {
    return Array.from({ length: 50 }, (_, i) => i + 1)
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
}
function drawGoldenJackpot(goldenJackpotConfig) {
    return Math.floor(Math.random() * goldenJackpotConfig.oneInChance) + 1;
}
function drawNextCard(deck, cardIndex) {
    if (cardIndex >= deck.length) {
        cardIndex = 0;
    }
    return deck[cardIndex];
}
