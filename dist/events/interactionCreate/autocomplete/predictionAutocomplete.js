"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Prediction_1 = require("../../../models/Prediction");
const luxon_1 = require("luxon");
const formatDate = (date) => luxon_1.DateTime.fromJSDate(date).setZone('Europe/Prague').toFormat('dd.MM / HH:mm');
exports.default = async (interaction, client) => {
    if (!interaction.isAutocomplete())
        return;
    if (interaction.commandName !== 'prediction')
        return;
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();
    const focusedValue = focusedOption.value;
    const findPredictions = async (status) => {
        const query = {
            guildId: interaction.guildId,
            title: { $regex: focusedValue, $options: 'i' },
        };
        if (Array.isArray(status)) {
            query.status = { $in: status };
        }
        else {
            query.status = status;
        }
        return await Prediction_1.default.find(query).limit(25);
    };
    if (subcommand === 'end') {
        const predictions = await findPredictions('active');
        return await interaction.respond(predictions.length > 0
            ? predictions.map((p) => ({
                name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
                value: p.predictionId,
            }))
            : [{ name: 'No predictions found', value: 'none' }]);
    }
    if (subcommand === 'payout') {
        if (focusedOption.name === 'prediction-id') {
            const predictions = await findPredictions('ended');
            return await interaction.respond(predictions.length > 0
                ? predictions.map((p) => ({
                    name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
                    value: p.predictionId,
                }))
                : [{ name: 'No predictions found', value: 'none' }]);
        }
        if (focusedOption.name === 'winner') {
            const predictionId = interaction.options.getString('prediction-id');
            if (!predictionId)
                return await interaction.respond([]);
            const prediction = await Prediction_1.default.findOne({
                guildId: interaction.guildId,
                predictionId,
            });
            if (!prediction)
                return await interaction.respond([]);
            const filteredChoices = prediction.choices
                .filter((c) => c.choiceName.toLowerCase().includes(focusedValue.toLowerCase()))
                .map((c) => ({
                name: `${c.choiceName} (Odds: ${c.odds})`,
                value: c.choiceName,
            }));
            return await interaction.respond(filteredChoices.length > 0
                ? filteredChoices
                : [{ name: 'No choices found', value: 'none' }]);
        }
    }
    if (subcommand === 'cancel') {
        const predictions = await findPredictions(['active', 'ended']);
        return await interaction.respond(predictions.length > 0
            ? predictions.map((p) => ({
                name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
                value: p.predictionId,
            }))
            : [{ name: 'No predictions found', value: 'none' }]);
    }
    if (subcommand === 'check') {
        const predictions = await findPredictions(['active', 'ended']);
        return await interaction.respond(predictions.length > 0
            ? predictions.map((p) => ({
                name: `${p.title} • ${p.status.toUpperCase()} • ${formatDate(p.createdAt)}`,
                value: p.predictionId,
            }))
            : [{ name: 'No predictions found', value: 'none' }]);
    }
};
