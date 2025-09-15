"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
const utils_1 = require("../../../utils/utils");
const createEmbed_1 = require("../../../utils/createEmbed");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
exports.data = {
    name: 'bonus',
    description: 'Daily bonus system with streaks.',
    dm_permission: false,
    options: [
        {
            name: 'claim',
            description: 'Claim your daily bonus',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
        },
        {
            name: 'check',
            description: 'Check your streak and next bonus',
            type: discord_js_1.ApplicationCommandOptionType.Subcommand,
        },
    ],
};
exports.options = {
    deleted: false,
    devOnly: true,
};
async function run({ interaction }) {
    try {
        const subcommand = interaction.options.getSubcommand();
        const user = await (0, utils_1.checkUserRegistration)(interaction.user.id, interaction.guildId);
        if (!user)
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'Use `/register` first.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        const guildConfig = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfig || guildConfig.bonusSettings.baseReward === 0)
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Bonus not configured', 'Daily bonus is not configured for this server.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        const { baseReward, streakMultiplier, maxReward, resetOnMax } = guildConfig.bonusSettings;
        const now = new Date();
        const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null;
        let streak = user.dailyStreak ?? 0;
        const calculateReward = (streak) => {
            let reward = streakMultiplier > 0
                ? baseReward * (streak * streakMultiplier)
                : baseReward;
            if (maxReward > 0 && reward > maxReward)
                reward = maxReward;
            return reward;
        };
        if (subcommand === 'check') {
            let nextStreak = 1;
            if (lastClaim) {
                const diffHours = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
                if (diffHours < 24)
                    nextStreak = streak;
                else if (diffHours >= 24 && diffHours < 48)
                    nextStreak = streak + 1;
            }
            const nextReward = calculateReward(nextStreak);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Daily Bonus Info')
                .setColor('Blue')
                .setDescription('Here is your bonus info and streak progress:')
                .addFields({ name: '🔥 Current Streak', value: `${streak} days`, inline: true }, {
                name: '💰 Next Reward',
                value: `$${(0, utils_1.formatNumberToReadableString)(nextReward)}`,
                inline: true,
            })
                .setFooter({ text: 'Use `/bonus claim` to claim your bonus!' })
                .setTimestamp();
            return interaction.reply({
                embeds: [embed],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        let canClaim = false;
        if (!lastClaim) {
            canClaim = true;
            streak = 1;
        }
        else {
            const diffHours = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
            if (diffHours >= 24 && diffHours < 48) {
                canClaim = true;
                streak++;
            }
            else if (diffHours >= 48) {
                canClaim = true;
                streak = 1;
            }
        }
        if (!canClaim) {
            const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createInfoEmbed)('Daily Bonus Already Claimed', `Come back at **<t:${Math.floor(nextClaim.getTime() / 1000)}:t>**`),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        let reward = calculateReward(streak);
        if (maxReward > 0 && reward >= maxReward && resetOnMax)
            streak = 1;
        user.balance += reward;
        user.dailyStreak = streak;
        user.lastDailyClaim = now;
        await user.save();
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('Daily Bonus Claimed!')
            .setColor('Gold')
            .setDescription(`You claimed your daily bonus and received **$${(0, utils_1.formatNumberToReadableString)(reward)}** coins!`)
            .addFields({ name: '🔥 Current Streak', value: `${streak} days`, inline: true }, {
            name: '💰 New Balance',
            value: `$${(0, utils_1.formatNumberToReadableString)(user.balance)}`,
            inline: true,
        })
            .setFooter({ text: 'Come back tomorrow to keep your streak alive!' })
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        console.error('Error running /bonus command:', error);
    }
}
