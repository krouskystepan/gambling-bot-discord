import User from '@/models/User';
export const getUser = async ({ userId, guildId }) => {
    const user = await User.findOne({ userId, guildId });
    return user;
};
export const withdrawBalance = async ({ userId, guildId, amount }) => {
    const user = await User.findOne({ userId, guildId }).lean();
    if (!user) {
        return { ok: false, reason: 'INSUFFICIENT_BALANCE', balance: 0 };
    }
    if (user.balance < amount) {
        return {
            ok: false,
            reason: 'INSUFFICIENT_BALANCE',
            balance: user.balance
        };
    }
    const withdrawable = user.balance - user.lockedBalance;
    if (withdrawable < amount) {
        return {
            ok: false,
            reason: 'INSUFFICIENT_WITHDRAWABLE',
            withdrawable,
            locked: user.lockedBalance
        };
    }
    const updatedUser = await User.findOneAndUpdate({ userId, guildId }, { $inc: { balance: -amount } }, { new: true }).lean();
    return { ok: true, user: updatedUser };
};
export const updateUserBalance = async ({ userId, guildId, amount, lockedAmount = 0 }) => {
    const user = await User.findOneAndUpdate({ userId, guildId }, { $inc: { balance: amount, lockedBalance: lockedAmount } }, { new: true });
    return user;
};
export const resetUserBalance = async ({ userId, guildId }) => {
    const updatedUser = await User.findOneAndUpdate({ userId, guildId }, { $set: { balance: 0, lockedBalance: 0 } }, { new: true });
    return updatedUser;
};
export const createUser = async ({ userId, guildId }) => {
    return User.create({ userId, guildId }).then((doc) => doc.toObject());
};
export const consumeUserBalance = async ({ userId, guildId, amount }) => {
    return User.findOneAndUpdate({
        userId,
        guildId,
        balance: { $gte: amount }
    }, [
        {
            $set: {
                balance: { $subtract: ['$balance', amount] },
                lockedBalance: {
                    $max: [{ $subtract: ['$lockedBalance', amount] }, 0]
                }
            }
        }
    ], { new: true });
};
export const forceCreateUser = async ({ userId, guildId }) => {
    try {
        const user = await User.create({
            userId,
            guildId
        });
        return user;
    }
    catch (error) {
        if (error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 11000) {
            return null;
        }
        throw error;
    }
};
export const forceDeleteUser = async ({ userId, guildId }) => {
    const user = await User.findOne({ userId, guildId });
    if (!user)
        return null;
    await User.deleteOne({ userId, guildId });
    return user;
};
