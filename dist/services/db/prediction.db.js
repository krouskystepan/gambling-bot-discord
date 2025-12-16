import Prediction from '@/models/Prediction';
export const getPredictionById = async ({ predictionId, guildId }) => {
    return Prediction.findOne({ predictionId, guildId });
};
export const getPredictionToLock = async ({ status = 'active', useAutolock = true }) => {
    const now = new Date();
    return Prediction.find({
        status,
        ...(useAutolock ? { autolock: { $lte: now } } : {})
    });
};
export const getOldPredictions = async ({ statuses, olderThanDays }) => {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    return Prediction.find({
        status: { $in: statuses },
        updatedAt: { $lte: cutoffDate }
    });
};
export const createPrediction = async ({ predictionId, guildId, channelId, creatorId, title, choices, autolock, status }) => {
    await Prediction.create({
        predictionId,
        guildId,
        channelId,
        creatorId,
        title,
        choices,
        autolock,
        status
    });
};
export const updatePredictionStatus = async ({ predictionId, guildId, fromStatus, toStatus }) => {
    return Prediction.findOneAndUpdate({
        predictionId,
        guildId,
        status: Array.isArray(fromStatus) ? { $in: fromStatus } : fromStatus
    }, { $set: { status: toStatus } }, { new: true });
};
export const deletePrediction = async ({ predictionId }) => {
    Prediction.deleteOne({ predictionId });
};
export const findPredictions = async (query) => {
    const predictions = await Prediction.find(query).limit(25);
    return predictions;
};
export const addPredictionBet = async ({ predictionId, guildId, choiceName, userId, amount }) => {
    return Prediction.findOneAndUpdate({
        predictionId,
        guildId,
        'choices.choiceName': choiceName
    }, {
        $push: {
            'choices.$.bets': {
                userId,
                amount
            }
        }
    });
};
