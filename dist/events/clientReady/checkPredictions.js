"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Prediction_1 = require("../../models/Prediction");
exports.default = async (client) => {
    console.log('👀 Prediction listener started');
    // OLD PREDICTION CLEANUP
    setInterval(async () => {
        const now = new Date();
        // 7 days
        const oneMonthAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oldPredictions = await Prediction_1.default.find({
            status: { $in: ['canceled', 'paid'] },
            updatedAt: { $lte: oneMonthAgo },
        });
        for (const prediction of oldPredictions) {
            await Prediction_1.default.deleteOne({ _id: prediction._id });
            console.log(`Deleted old prediction "${prediction.title}" (${prediction.predictionId}) with status "${prediction.status}".`);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    // AUTOLOCK CHECK
    setInterval(async () => {
        const now = new Date();
        const predictionsToLock = await Prediction_1.default.find({
            status: 'active',
            autolock: { $lte: now },
        });
        if (predictionsToLock.length === 0)
            return;
        for (const prediction of predictionsToLock) {
            try {
                await Prediction_1.default.findOneAndUpdate({ _id: prediction._id }, { $set: { status: 'ended' } }, { new: true });
                const channel = await client.channels.fetch(prediction.channelId);
                if (!channel?.isTextBased())
                    continue;
                const message = await channel.messages
                    .fetch(prediction.predictionId)
                    .catch(() => null);
                if (!message)
                    continue;
                const embed = message.embeds[0]?.toJSON() || {};
                const editedEmbed = { ...embed, color: discord_js_1.Colors.Orange };
                await message.edit({
                    content: '**Status:** Ended',
                    embeds: [editedEmbed],
                    components: [],
                });
                console.log(`Prediction "${prediction.title}" (${prediction.predictionId}) was auto-locked.`);
            }
            catch (err) {
                console.error(`Failed to autolock prediction "${prediction.title}" (${prediction.predictionId}):`, err);
            }
        }
    }, 60 * 1000); // 1 Minute
};
