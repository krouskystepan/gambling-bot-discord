import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder } from 'discord.js';
import { formatNumberToReadableString, parseReadableStringToNumber } from '@/utils/common/utils';
export const data = {
    name: 'money-manager',
    description: 'Create an embed for manage balance.',
    options: [
        {
            name: 'give-balance',
            description: 'Create an embed for giving money.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'amount',
                    description: 'The amount of money you want to give.',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: 'reset-balance',
            description: 'Create an embed for resetting money.',
            type: ApplicationCommandOptionType.Subcommand
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
    devOnly: true
};
export async function run({ interaction }) {
    try {
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        if (subcommand === 'give-balance') {
            const amount = interaction.options.getString('amount', true);
            const parsedAmount = parseReadableStringToNumber(amount);
            const readableAmount = formatNumberToReadableString(parsedAmount);
            const embed = new EmbedBuilder()
                .setTitle('Money Generator')
                .setColor(Colors.DarkGreen)
                .setDescription(`Click to add **$${readableAmount}** to your account.\n` +
                'You can use this money to try **CASINO** games.')
                .setTimestamp();
            const giveButton = new ButtonBuilder()
                .setLabel(`💸 Claim Money`)
                .setStyle(ButtonStyle.Success)
                .setCustomId(`give-money.${parsedAmount}`);
            const row = new ActionRowBuilder().addComponents(giveButton);
            return interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }
        if (subcommand === 'reset-balance') {
            const embed = new EmbedBuilder()
                .setTitle('Money Reset')
                .setColor(Colors.DarkRed)
                .setDescription('Click to reset your account balance.')
                .setTimestamp();
            const resetButton = new ButtonBuilder()
                .setLabel(`🔄 Reset Money`)
                .setStyle(ButtonStyle.Danger)
                .setCustomId(`reset-money`);
            const row = new ActionRowBuilder().addComponents(resetButton);
            return interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }
    }
    catch (error) {
        console.error('Error running the command:', error);
    }
}
