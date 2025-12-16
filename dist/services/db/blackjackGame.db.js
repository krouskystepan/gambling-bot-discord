import BlackjackGame from '@/models/BlackjackGame';
export const getBlackjackGameByUserAndGuild = async ({ userId, guildId }) => {
    return await BlackjackGame.findOne({ userId, guildId });
};
export const updateBlackjackGameState = async ({ userId, guildId, playerCards, deck }) => {
    await BlackjackGame.findOneAndUpdate({ userId, guildId }, { playerCards, deck });
};
export const upsertBlackjackGame = async ({ userId, guildId, gameId, betAmount, deck, playerCards, dealerCards }) => {
    return BlackjackGame.findOneAndUpdate({ userId, guildId }, {
        $set: {
            gameId,
            betAmount,
            deck,
            playerCards,
            dealerCards
        }
    }, { upsert: true, new: true });
};
export const deleteBlackjackGame = async ({ userId, guildId }) => {
    await BlackjackGame.findOneAndDelete({ userId, guildId });
};
