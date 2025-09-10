"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const utils_1 = require("../../../utils/utils");
const Milestone_1 = require("../../../models/Milestone");
const createEmbed_1 = require("../../../utils/createEmbed");
exports.data = {
    name: 'bonus',
    description: 'Check your next milestone bonus and progress.',
    dm_permission: false,
};
exports.options = {
    deleted: false,
    devOnly: true,
};
async function run({ interaction }) {
    try {
        const user = await (0, utils_1.checkUserRegistration)(interaction.user.id, interaction.guildId);
        if (!user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'You are not registered yet.\nUse the `/register` command to register.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const guildMilestones = await Milestone_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildMilestones) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - No milestones configured', 'This server has no milestones set up yet.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const { baseThreshold, baseReward, multiplierThreshold, multiplierReward } = guildMilestones;
        const milestones = [];
        let threshold = baseThreshold;
        let reward = baseReward;
        let index = 1;
        while (threshold <= 1_000_000_000) {
            milestones.push({ threshold, reward, index });
            threshold = Math.floor(threshold * multiplierThreshold);
            reward = Math.floor(reward * multiplierReward);
            index++;
        }
        const lastUnlocked = user.milestoneUnlocked ?? 0;
        const nextMilestone = milestones.find((m) => m.threshold > lastUnlocked);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('Next Milestone Bonus')
            .setColor('Yellow');
        if (nextMilestone) {
            const amountToNext = nextMilestone.threshold - user.amountGambled;
            const progress = Math.min(((nextMilestone.threshold - amountToNext) / nextMilestone.threshold) *
                100, 100);
            embed
                .setTitle(`🎯 Milestone #${nextMilestone.index}`)
                .setColor('Gold')
                .setDescription('Here is your progress towards the next milestone:')
                .addFields({
                name: '💰 Reward',
                value: `$${(0, utils_1.formatNumberToReadableString)(nextMilestone.reward)}`,
            }, {
                name: '📈 Progress',
                value: `${progress.toFixed(2)}%`,
            }, {
                name: '⬆️ Amount Needed',
                value: `$${(0, utils_1.formatNumberToReadableString)(amountToNext)}`,
            })
                .setFooter({ text: 'Keep playing to unlock more bonuses!' })
                .setTimestamp();
        }
        else {
            embed
                .setTitle('🏆 All Milestones Unlocked!')
                .setColor('Green')
                .setDescription('You’ve reached the final milestone. Congratulations! 🎉');
        }
        return interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        console.error('Error running /bonus command:', error);
    }
}
