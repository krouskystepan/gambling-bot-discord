import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { checkUserRegistration } from '@/services';
import { formatNumberToReadableString } from '@/utils/utils';
export const data = {
    name: 'who-is',
    description: 'Get information about a user.',
    options: [
        {
            name: 'user',
            description: 'The user you want to get information about.',
            type: ApplicationCommandOptionType.User,
            required: true
        }
    ],
    dm_permission: false
};
export const options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false
};
export async function run({ interaction }) {
    const options = interaction.options;
    const user = options.getUser('user', true);
    const userDocument = await checkUserRegistration({ interaction });
    const member = await interaction.guild?.members.fetch(user.id);
    if (!member)
        return;
    const roles = member.roles.cache
        .filter((role) => role.id !== interaction.guild?.id)
        .map((role) => role.toString())
        .reverse()
        .join(', ');
    const formattedJoinDate = member.joinedAt
        ? member.joinedAt.toLocaleDateString('en-GB')
        : 'Unknown';
    const formattedCreatedAt = user.createdAt.toLocaleDateString('en-GB');
    let registered = '';
    let balance = '';
    if (userDocument) {
        registered = userDocument.createdAt.toLocaleDateString('en-GB');
        balance = userDocument.balance
            ? `$${formatNumberToReadableString(userDocument.balance)}`
            : 'No balance';
    }
    const embed = new EmbedBuilder()
        .setColor(member.displayColor || 0x3498db)
        .setTitle('ℹ️ **USER INFORMATION** ℹ️')
        .addFields({
        name: '👤 Username',
        value: `\`\`\`${user.username}\`\`\``,
        inline: true
    }, {
        name: '🤡 Nickname',
        value: `\`\`\`${member.displayName}\`\`\``,
        inline: true
    }, {
        name: '',
        value: '',
        inline: false
    }, {
        name: '🆔 User ID',
        value: `\`\`\`${member.id}\`\`\``,
        inline: true
    }, {
        name: '',
        value: '',
        inline: false
    }, {
        name: '🗓️ Account Created',
        value: `\`\`\`${formattedCreatedAt}\`\`\``,
        inline: true
    }, {
        name: '🗓️ Joined Server',
        value: `\`\`\`${formattedJoinDate}\`\`\``,
        inline: true
    }, {
        name: '',
        value: '',
        inline: false
    }, ...(userDocument
        ? [
            {
                name: '💰 Balance',
                value: `\`\`\`${balance}\`\`\``,
                inline: true
            },
            {
                name: '📅 Registered',
                value: `\`\`\`${registered}\`\`\``,
                inline: true
            }
        ]
        : [
            {
                name: '📅 Registered',
                value: `\`\`\`Not registered\`\`\``,
                inline: true
            }
        ]), {
        name: '',
        value: '',
        inline: false
    }, {
        name: '🏅 Roles',
        value: roles.length > 0 ? roles : 'No roles',
        inline: false
    })
        .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 128 }));
    return interaction.reply({
        embeds: [embed]
    });
}
