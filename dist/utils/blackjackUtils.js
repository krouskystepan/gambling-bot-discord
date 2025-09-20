"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlackjackEmbed = exports.revealDealerCards = exports.calculateHandValue = exports.shuffleDeck = exports.DECK = exports.VALUES = exports.SUITES = void 0;
const createEmbed_1 = require("./createEmbed");
const BlackjackGame_1 = require("../models/BlackjackGame");
const casinoHelpers_1 = require("./casinoHelpers");
const User_1 = require("../models/User");
const utils_1 = require("./utils");
const Transaction_1 = require("../models/Transaction");
exports.SUITES = ['♠️', '♣️', '♥️', '♦️'];
exports.VALUES = [
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
    { label: 'K', value: 10 },
];
exports.DECK = exports.SUITES.flatMap((suite) => exports.VALUES.map(({ label, value }) => ({ suite, label, value })));
const shuffleDeck = (deck) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};
exports.shuffleDeck = shuffleDeck;
const calculateHandValue = (cards) => {
    let total = 0;
    let aceCount = 0;
    cards.forEach((card) => {
        if (card.label === 'A') {
            aceCount++;
            total += 1;
        }
        else {
            total += card.value;
        }
    });
    while (aceCount > 0 && total + 10 <= 21) {
        total += 10;
        aceCount--;
    }
    return total;
};
exports.calculateHandValue = calculateHandValue;
const revealDealerCards = async (bet, message, dealerCards, dealerTotal, playerCards, playerTotal, deck, gameIndex, user, guildId, gameId, showBalnce, betId) => {
    await message.edit({
        embeds: [
            (0, exports.createBlackjackEmbed)(bet, dealerCards, dealerTotal, playerCards, playerTotal, 'DRAWING', false, 0, betId),
        ],
        components: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    while (dealerTotal < 17) {
        const drawnCard = (0, casinoHelpers_1.drawNextCard)(deck, gameIndex);
        dealerCards.push(drawnCard);
        dealerTotal = (0, exports.calculateHandValue)(dealerCards);
        gameIndex++;
        await message.edit({
            embeds: [
                (0, exports.createBlackjackEmbed)(bet, dealerCards, dealerTotal, playerCards, playerTotal, 'DRAWING', false, 0, betId),
            ],
            components: [],
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const betAmount = (0, utils_1.parseReadableStringToNumber)(bet);
    let resultId;
    let balanceChange = 0;
    if (dealerTotal > 21) {
        resultId = 'DB';
        balanceChange = betAmount * 2;
    }
    else if (dealerTotal === playerTotal) {
        resultId = 'PUSH';
        balanceChange = betAmount;
    }
    else if (playerTotal > dealerTotal) {
        resultId = 'PW';
        balanceChange = betAmount * 2;
    }
    else {
        resultId = 'DW';
        balanceChange = 0;
    }
    if (balanceChange > 0) {
        const updatedUser = await User_1.default.findOneAndUpdate({ userId: user.userId, guildId }, { $inc: { balance: balanceChange } }, { new: true });
        if (!updatedUser)
            throw new Error('User not found when paying out');
        await Transaction_1.default.create({
            userId: user.userId,
            guildId: user.guildId,
            amount: balanceChange,
            type: 'win',
            source: 'casino',
            betId,
            createdAt: new Date(),
        });
        user.balance = updatedUser.balance;
    }
    await message.edit({
        embeds: [
            (0, exports.createBlackjackEmbed)(bet, dealerCards, dealerTotal, playerCards, playerTotal, resultId, showBalnce, user.balance, betId),
        ],
        components: [],
    });
    await BlackjackGame_1.default.findOneAndDelete({ userId: user.userId, guildId, gameId });
};
exports.revealDealerCards = revealDealerCards;
const createBlackjackEmbed = (bet, dealerCards, dealerTotal, playerCards, playerTotal, resultId, showBalance, userBalance, betId, dealerVisibleOneCard = false) => {
    const dealerHandText = dealerVisibleOneCard
        ? `${dealerCards[0].label}${dealerCards[0].suite} ??`
        : `${dealerCards
            .map((c) => `${c.label}${c.suite}`)
            .join(' ')} (**${dealerTotal}**)`;
    let resultText = '';
    let color = 'Yellow';
    const betAmount = (0, utils_1.parseReadableStringToNumber)(bet);
    switch (resultId) {
        case 'BBJ':
            resultText = `You both have Blackjack!\n💰 Total: 🟡 **$${0}**`;
            break;
        case 'PBJ':
            resultText = `You have Blackjack!\n💰 Total: 🟢 **$${(0, utils_1.formatNumberToReadableString)(betAmount * 2.5)}**`;
            color = 'Green';
            break;
        case 'DBJ':
            resultText = `Dealer has Blackjack!\n💰 Total: 🔴 **$-${bet}**`;
            color = 'Red';
            break;
        case 'PB':
            resultText = `You busted!\n💰 Total: 🔴 **$-${bet}**`;
            color = 'Red';
            break;
        case 'DB':
            resultText = `Dealer busted!\n💰 Total: 🟢 **$${(0, utils_1.formatNumberToReadableString)(betAmount * 2)}**`;
            color = 'Green';
            break;
        case 'PW':
            resultText = `You win!\n💰 Total: 🟢 **$${(0, utils_1.formatNumberToReadableString)(betAmount * 2)}**`;
            color = 'Green';
            break;
        case 'DW':
            resultText = `Dealer wins!\n💰 Total: 🔴 **$-${bet}**`;
            color = 'Red';
            break;
        case 'PUSH':
            resultText = `It's a push!\n💰 Total: 🟡 **$${0}**`;
            break;
        case 'DRAWING':
            resultText = `Dealer is drawing...`;
            break;
        default:
            resultText = '';
            break;
    }
    const sections = [
        `💵 Total Bet: **$${bet}**`,
        `**Dealer's Hand:**\n${dealerHandText}`,
        `**Your Hand:**\n${playerCards
            .map((c) => `${c.label}${c.suite}`)
            .join(' ')} (**${playerTotal}**)`,
    ];
    if (resultText) {
        let resultSection = `**Result**\n${resultText}`;
        if (showBalance) {
            resultSection += `\n🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(userBalance)}**`;
        }
        sections.push(resultSection);
    }
    else if (showBalance) {
        sections.push(`🏦 Balance: **$${(0, utils_1.formatNumberToReadableString)(userBalance)}**`);
    }
    return (0, createEmbed_1.createBetEmbed)('🃏 Blackjack', color, sections.join('\n\n'), betId);
};
exports.createBlackjackEmbed = createBlackjackEmbed;
