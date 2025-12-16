import { Colors } from 'discord.js';
import { deletePrediction, getOldPredictions, getPredictionToLock, updatePredictionStatus } from '@/services';
// OLD PREDICTION CLEANUP
const cleanupOldPredictions = async () => {
    const oldPredictions = await getOldPredictions({
        statuses: ['canceled', 'paid'],
        olderThanDays: 7
    });
    if (!oldPredictions.length)
        return;
    await Promise.all(oldPredictions.map((prediction) => deletePrediction({ predictionId: prediction.predictionId })));
    for (const p of oldPredictions) {
        console.log(`Deleted old prediction "${p.title}" (${p.predictionId}) [${p.status}]`);
    }
};
// AUTOLOCK PREDICTIONS
const autolockPredictions = async (client) => {
    const predictions = await getPredictionToLock({
        status: 'active',
        useAutolock: true
    });
    if (!predictions.length)
        return;
    for (const prediction of predictions) {
        try {
            const updated = await updatePredictionStatus({
                predictionId: prediction.predictionId,
                guildId: prediction.guildId,
                fromStatus: 'active',
                toStatus: 'ended'
            });
            if (!updated)
                continue;
            const channel = await client.channels.fetch(prediction.channelId);
            if (!channel?.isTextBased())
                continue;
            const message = await channel.messages
                .fetch(prediction.predictionId)
                .catch(() => null);
            if (!message)
                continue;
            const embed = message.embeds[0]?.toJSON();
            if (!embed)
                continue;
            await message.edit({
                content: '**Status:** Ended',
                embeds: [{ ...embed, color: Colors.Orange }],
                components: []
            });
            console.log(`Prediction "${prediction.title}" (${prediction.predictionId}) auto-locked`);
        }
        catch (err) {
            console.error(`Failed to autolock prediction "${prediction.predictionId}"`, err);
        }
    }
};
const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;
export default async (client) => {
    console.log('👀 Prediction listener started');
    setInterval(cleanupOldPredictions, ONE_DAY);
    setInterval(() => autolockPredictions(client), ONE_MINUTE);
};
