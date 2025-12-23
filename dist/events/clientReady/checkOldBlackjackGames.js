import { TextChannel } from 'discord.js';
import { createTransaction, deleteBlackjackGame, getAllOldBlackjackGames } from '@/services';
import { applyAction, dealerDrawOne, dealerShouldDraw, resolveResult } from '@/utils/casino/blackjack/engine';
import { renderBlackjackEmbed } from '@/utils/casino/blackjack/render';
import { docToEngine } from '@/utils/casino/blackjack/state';
import { logger } from '@/utils/logger';
export default async (client) => {
    logger.boot('⏱️ Blackjack auto-stand worker started');
    setInterval(async () => {
        const oldGames = await getAllOldBlackjackGames(1); // Day
        for (const game of oldGames) {
            try {
                const guild = await client.guilds.fetch(game.guildId).catch(() => null);
                if (!guild)
                    continue;
                const channel = await guild.channels
                    .fetch(game.channelId)
                    .catch(() => null);
                if (!channel || !(channel instanceof TextChannel))
                    continue;
                const message = await channel.messages
                    .fetch(game.messageId)
                    .catch(() => null);
                if (!message)
                    continue;
                const engine = docToEngine(game);
                const result = applyAction(engine, 'STAND');
                if (!result.finished && 'dealerTurn' in result) {
                    while (dealerShouldDraw(engine)) {
                        dealerDrawOne(engine);
                    }
                    const finalResult = resolveResult(engine);
                    if (finalResult.finished && finalResult.payout > 0) {
                        await createTransaction({
                            userId: game.userId,
                            guildId: game.guildId,
                            amount: finalResult.payout,
                            type: 'win',
                            source: 'casino',
                            betId: game.betId
                        });
                    }
                    if (finalResult.finished) {
                        await message.edit({
                            embeds: [
                                renderBlackjackEmbed({
                                    userId: game.userId,
                                    guildId: game.guildId,
                                    betId: game.betId,
                                    betAmount: engine.betAmount,
                                    playerCards: engine.playerCards,
                                    dealerCards: engine.dealerCards,
                                    showBalance: false,
                                    resultId: finalResult.resultId
                                })
                            ],
                            components: []
                        });
                    }
                    await deleteBlackjackGame({
                        userId: game.userId,
                        guildId: game.guildId
                    });
                    logger.worker(`🃏 Auto-stand executed for ${game.betId} in guild: ${game.guildId}`);
                }
            }
            catch (err) {
                logger.error('Auto-stand failed:', err);
            }
        }
    }, 60_000);
};
