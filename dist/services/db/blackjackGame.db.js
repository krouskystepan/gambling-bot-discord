import BlackjackGame from '@/models/BlackjackGame';
export const getBlackjackGameByUserAndGuild = async ({ userId, guildId }) => {
    return await BlackjackGame.findOne({ userId, guildId });
};
export const getBlackjackGameByBetId = async ({ betId, guildId }) => {
    return BlackjackGame.findOne({ betId, guildId });
};
export const getAllOldBlackjackGames = async (days) => {
    return BlackjackGame.find({
        updatedAt: {
            $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
    });
};
export const updateBlackjackGameState = async ({ userId, guildId, playerCards, deck }) => {
    await BlackjackGame.findOneAndUpdate({ userId, guildId }, { playerCards, deck });
};
export const updateBlackjackGame = async (game) => {
    await game.save();
};
export const upsertBlackjackGame = async ({ userId, guildId, channelId, messageId, betId, betAmount, deck, deckIndex, playerCards, dealerCards }) => {
    return BlackjackGame.findOneAndUpdate({ userId, guildId }, {
        $set: {
            channelId,
            messageId,
            betId,
            betAmount,
            deck,
            deckIndex,
            playerCards,
            dealerCards
        }
    }, {
        upsert: true,
        new: true
    });
};
export const deleteBlackjackGame = async ({ userId, guildId }) => {
    await BlackjackGame.findOneAndDelete({ userId, guildId });
};
