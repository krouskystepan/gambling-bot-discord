import Transaction from '../../models/Transaction';
export const createTransaction = async ({ userId, guildId, amount, type, source, betId, meta, createdAt = new Date() }) => {
    const transaction = await Transaction.create({
        userId,
        guildId,
        amount,
        type,
        source,
        betId,
        meta,
        createdAt
    });
    return transaction;
};
export const createMultipleTransactions = async (transactions) => {
    await Transaction.insertMany(transactions);
};
export const deleteAllTransactionsByUserId = async ({ userId, guildId }) => {
    await Transaction.deleteMany({
        userId,
        guildId
    });
};
