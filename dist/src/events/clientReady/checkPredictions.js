"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Prediction_1 = require("../../models/Prediction");
exports.default = async (client) => {
    console.log('👀 Prediction listener started');
    // OLD PREDICTION CLEANUP
    setInterval(async () => {
        const now = new Date();
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
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
        const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
        const predictionsToLock = await Prediction_1.default.find({
            status: 'active',
            autolock: { $lte: nowUTC },
        });
        if (predictionsToLock.length === 0)
            return;
        for (const prediction of predictionsToLock) {
            prediction.status = 'ended';
            await prediction.save();
            const channel = await client.channels.fetch(prediction.channelId);
            if (!channel?.isTextBased())
                continue;
            const message = await channel.messages
                .fetch(prediction.predictionId)
                .catch(() => null);
            if (!message)
                continue;
            const embed = message.embeds[0]?.toJSON() || {};
            const editedEmbed = {
                ...embed,
                color: discord_js_1.Colors.Orange,
            };
            await message.edit({
                content: '**Status:** Ended',
                embeds: [editedEmbed],
                components: [],
            });
            console.log(`Prediction "${prediction.title}" (${prediction.predictionId}) was auto-locked.`);
        }
    }, 60 * 1000); // every 1 minute
};
