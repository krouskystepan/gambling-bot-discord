"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Prediction_1 = require("../../models/Prediction");
exports.default = async (client) => {
    console.log('👀 Prediction listener started');
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
    }, 24 * 60 * 60 * 1000); // every 24 hours
};
