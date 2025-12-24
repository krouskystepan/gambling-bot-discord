import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatNumberToReadableString } from '@/utils/common/utils';
import { createBetEmbed } from '@/utils/discord/createEmbed';
import { encodeId } from './customId';
import { calculateHandValue } from './math';
const formatFinalResult = (result, netProfit) => {
    switch (result) {
        case 'WIN':
            return {
                color: 'Green',
                text: `You win!\n💰 Total: 🟢 **$${formatNumberToReadableString(netProfit)}**`
            };
        case 'LOSS':
            return {
                color: 'Red',
                text: `You lose!\n💰 Total: 🔴 **$${formatNumberToReadableString(Math.abs(netProfit))}**`
            };
        case 'EVEN':
            return {
                color: 'Yellow',
                text: `Break-even.\n💰 Total: 🟡 **$0**`
            };
    }
};
const formatPhaseResult = (result) => {
    switch (result) {
        case 'PLAYER_TURN':
            return {
                color: 'Blue',
                text: 'Player’s turn'
            };
        case 'DEALER_DRAWING':
            return {
                color: 'Yellow',
                text: 'Dealer’s turn'
            };
    }
};
const formatStartResult = (result, totalBet) => {
    switch (result) {
        case 'PBJ':
            return {
                color: 'Green',
                text: `You have Blackjack!\n💰 Total: 🟢 **$${formatNumberToReadableString(totalBet * 2.5)}**`
            };
        case 'DBJ':
            return {
                color: 'Red',
                text: `Dealer has Blackjack!\n💰 Total: 🔴 **$-${formatNumberToReadableString(totalBet)}**`
            };
        case 'BBJ':
            return {
                color: 'Yellow',
                text: `Both have Blackjack.\n💰 Total: 🟡 **$0**`
            };
    }
};
export const renderBlackjackEmbed = ({ hands, activeHandIndex, dealerCards, showBalance, userBalance, result, dealerHideSecondCard, betId }) => {
    const playerHandsText = hands
        .map((hand, index) => {
        const total = calculateHandValue(hand.cards);
        const cards = hand.cards.map((c) => `${c.label}${c.suite}`).join(' ');
        const isActive = activeHandIndex !== -1 && index === activeHandIndex;
        const busted = total > 21;
        return [
            `**Hand ${index + 1}** ${isActive ? '👉 **ACTIVE**' : ''}`,
            `${cards} (**${total}**)${busted ? ' 💥 BUST' : ''}`,
            `💵 Bet: **$${formatNumberToReadableString(hand.betAmount)}**`
        ].join('\n');
    })
        .join('\n\n');
    const dealerTotal = calculateHandValue(dealerCards);
    const dealerHand = dealerHideSecondCard
        ? `${dealerCards[0].label}${dealerCards[0].suite} ??`
        : `${dealerCards
            .map((c) => `${c.label}${c.suite}`)
            .join(' ')} (**${dealerTotal}**)`;
    let color = 'Yellow';
    let resultText = '';
    const totalBet = hands.reduce((sum, h) => sum + h.betAmount, 0);
    if (result) {
        switch (result.kind) {
            case 'START': {
                const formatted = formatStartResult(result.startResultId, totalBet);
                color = formatted.color;
                resultText = formatted.text;
                break;
            }
            case 'PHASE': {
                const formatted = formatPhaseResult(result.gamePhaseId);
                color = formatted.color;
                resultText = formatted.text;
                break;
            }
            case 'FINAL': {
                const netProfit = hands.reduce((sum, h) => sum + h.betAmount, 0) * -1 +
                    (result.finalResultId === 'WIN'
                        ? Math.abs(hands.reduce((sum, h) => sum + h.betAmount, 0)) * 2
                        : 0);
                const formatted = formatFinalResult(result.finalResultId, netProfit);
                color = formatted.color;
                resultText = formatted.text;
                break;
            }
        }
    }
    const sections = [
        `💵 Total Bet: **$${formatNumberToReadableString(totalBet)}**`,
        `**Dealer**\n${dealerHand}`,
        `**You**\n${playerHandsText}`
    ];
    if (resultText) {
        let resultSection = `**Result**\n${resultText}`;
        if (showBalance && typeof userBalance === 'number') {
            resultSection += `\n🏦 Balance: **$${formatNumberToReadableString(userBalance)}**`;
        }
        sections.push(resultSection);
    }
    return createBetEmbed('🃏 Blackjack', color, sections.join('\n\n'), betId);
};
export const renderBlackjackButtons = ({ betId, showBalance, canDouble, canSplit }) => {
    const mk = (action) => encodeId({
        betId,
        action,
        showBalance
    });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId(mk('HIT'))
        .setLabel('Hit')
        .setStyle(ButtonStyle.Success), new ButtonBuilder()
        .setCustomId(mk('STAND'))
        .setLabel('Stand')
        .setStyle(ButtonStyle.Danger));
    if (canDouble) {
        row.addComponents(new ButtonBuilder()
            .setCustomId(mk('DOUBLE'))
            .setLabel('Double')
            .setStyle(ButtonStyle.Primary));
    }
    if (canSplit) {
        row.addComponents(new ButtonBuilder()
            .setCustomId(mk('SPLIT'))
            .setLabel('Split')
            .setStyle(ButtonStyle.Secondary));
    }
    return row;
};
