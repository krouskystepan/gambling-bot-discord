"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const utils_1 = require("../../../utils/utils");
const discord_js_1 = require("discord.js");
const createEmbed_1 = require("../../../utils/createEmbed");
const GuildConfiguration_1 = require("../../../models/GuildConfiguration");
const User_1 = require("../../../models/User");
const Transaction_1 = require("../../../models/Transaction");
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
};
async function run({ interaction }) {
    try {
        const subcommand = interaction.options.getSubcommand();
        const user = await (0, utils_1.checkUserRegistration)(interaction.user.id, interaction.guildId);
        if (!user) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Not registered', 'Use `/register` first.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const guildConfig = await GuildConfiguration_1.default.findOne({
            guildId: interaction.guildId,
        });
        if (!guildConfig || guildConfig.bonusSettings.baseReward === 0) {
            return interaction.reply({
                embeds: [
                    (0, createEmbed_1.createErrorEmbed)('Error - Bonus not configured', 'Daily bonus is not configured for this server.'),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        const { baseReward, streakMultiplier, maxReward, resetOnMax } = guildConfig.bonusSettings;
        const now = new Date();
        const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null;
        let streak = user.dailyStreak ?? 0;
        const calculateReward = (streakNum) => {
            let reward = baseReward;
            for (let i = 1; i < streakNum; i++) {
                reward = Number((reward * streakMultiplier).toFixed(2));
                if (maxReward > 0 && reward > maxReward) {
                    reward = resetOnMax ? baseReward : maxReward;
                    if (resetOnMax)
                        break;
                }
            }
            return reward;
        };
        if (subcommand === 'check') {
            let nextStreak = !lastClaim
                ? 1
                : (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60) >= 48
                    ? 1
                    : streak + 1;
            const nextReward = calculateReward(nextStreak);
            let claimInfo = 'Available now!';
            if (lastClaim) {
                const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                if (now < nextClaim) {
                    claimInfo = `**<t:${Math.floor(nextClaim.getTime() / 1000)}:f> / <t:${Math.floor(nextClaim.getTime() / 1000)}:R>**`;
                }
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Daily Bonus Info')
                .setColor(discord_js_1.Colors.Blue)
                .setDescription('Here is your bonus info and streak progress:')
                .addFields({ name: '🔥 Current Streak', value: `${streak} days`, inline: true }, {
                name: '💰 Next Reward',
                value: `$${(0, utils_1.formatNumberToReadableString)(nextReward)}`,
                inline: true,
            }, { name: '⏰ Next Claim', value: claimInfo, inline: false })
                .setFooter({ text: 'Use `/bonus claim` to claim your bonus!' })
                .setTimestamp();
            return interaction.reply({
                embeds: [embed],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        if (subcommand === 'claim') {
            let canClaim = !lastClaim || now.getTime() - lastClaim.getTime() >= 24 * 60 * 60 * 1000;
            if (!canClaim) {
                const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Daily Bonus Already Claimed', `Come back at **<t:${Math.floor(nextClaim.getTime() / 1000)}:f> / <t:${Math.floor(nextClaim.getTime() / 1000)}:R>**`),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            streak =
                lastClaim && now.getTime() - lastClaim.getTime() < 48 * 60 * 60 * 1000
                    ? streak + 1
                    : 1;
            const reward = calculateReward(streak);
            const updatedUser = await User_1.default.findOneAndUpdate({
                userId: user.userId,
                guildId: user.guildId,
                $or: [
                    {
                        lastDailyClaim: {
                            $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                        },
                    },
                    { lastDailyClaim: null },
                ],
            }, {
                $inc: { balance: reward, lockedBalance: reward },
                $set: { lastDailyClaim: now, dailyStreak: streak },
            }, { new: true });
            if (!updatedUser) {
                return interaction.reply({
                    embeds: [
                        (0, createEmbed_1.createInfoEmbed)('Daily Bonus Already Claimed', 'You already claimed your daily bonus.'),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            await Transaction_1.default.create({
                userId: updatedUser.userId,
                guildId: updatedUser.guildId,
                amount: reward,
                type: 'bonus',
                source: 'system',
                createdAt: now,
            });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Daily Bonus Claimed!')
                .setColor(discord_js_1.Colors.Gold)
                .setDescription(`You claimed your daily bonus and received **$${(0, utils_1.formatNumberToReadableString)(reward)}** coins!`)
                .addFields({ name: '🔥 Current Streak', value: `${streak} days`, inline: true }, {
                name: '💰 New Balance',
                value: `$${(0, utils_1.formatNumberToReadableString)(updatedUser.balance)}`,
                inline: true,
            })
                .setFooter({ text: 'Come back tomorrow to keep your streak alive!' })
                .setTimestamp();
            return interaction.reply({
                embeds: [embed],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        console.error('Error running /bonus command:', error);
    }
}
