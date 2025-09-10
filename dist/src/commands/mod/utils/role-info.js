"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.data = void 0;
exports.run = run;
const discord_js_1 = require("discord.js");
exports.data = {
    name: 'role-info',
    description: 'Display information about a role.',
    options: [
        {
            name: 'role',
            description: 'The role you want to get information about.',
            type: discord_js_1.ApplicationCommandOptionType.Role,
            required: true,
        },
    ],
    dm_permission: false,
};
exports.options = {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
    deleted: false,
};
async function run({ interaction }) {
    const options = interaction.options;
    const role = options.getRole('role', true);
    const permissions = new discord_js_1.PermissionsBitField(role.permissions.bitfield)
        .toArray()
        .map((perm) => permissionMappings[perm] ||
        `✅ ${perm.replace(/_/g, ' ').toLowerCase()}`)
        .join('\n') || '❌ No permissions';
    const roleColor = role.hexColor === '#000000' ? 'No color' : role.hexColor;
    const roleCreatedAt = role.createdAt.toLocaleDateString('en-US');
    const rolePosition = role.position;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(role.color || 0x3498db)
        .setTitle(`ℹ️ **ROLE INFORMATION** ℹ️`)
        .addFields({
        name: '📛 Role Name',
        value: `\`\`\`${role.name}\`\`\``,
        inline: true,
    }, {
        name: '🎨 Role Color',
        value: `\`\`\`${roleColor}\`\`\``,
        inline: true,
    }, {
        name: '🆔 Role ID',
        value: `\`\`\`${role.id}\`\`\``,
        inline: false,
    }, {
        name: '🔢 Role Position',
        value: `\`\`\`${rolePosition}\`\`\``,
        inline: true,
    }, {
        name: '👥 Member Count',
        value: `\`\`\`${role.members.size}\`\`\``,
        inline: true,
    }, {
        name: '🛠️ Permissions',
        value: `\`\`\`${permissions}\`\`\``,
        inline: false,
    }, {
        name: '📅 Created',
        value: `\`\`\`${roleCreatedAt}\`\`\``,
        inline: true,
    })
        .setTimestamp();
    return interaction.reply({
        embeds: [embed],
    });
}
const permissionMappings = {
    Administrator: '👑 Administrator (all permissions)',
    ManageGuild: '✅ Manage Server',
    ManageRoles: '✅ Manage Roles',
    ManageChannels: '✅ Manage Channels',
    KickMembers: '✅ Kick Members',
    BanMembers: '✅ Ban Members',
    CreateInstantInvite: '✅ Create Instant Invite',
    ChangeNickname: '✅ Change Nickname',
    ManageNicknames: '✅ Manage Nicknames',
    ManageEmojisAndStickers: '✅ Manage Emojis and Stickers',
    ViewAuditLog: '✅ View Audit Log',
    ViewGuildInsights: '✅ View Server Insights',
    SendMessages: '✅ Send Messages',
    SendMessagesInThreads: '✅ Send Messages in Threads',
    CreatePublicThreads: '✅ Create Public Threads',
    CreatePrivateThreads: '✅ Create Private Threads',
    ManageThreads: '✅ Manage Threads',
    ManageMessages: '✅ Manage Messages',
    EmbedLinks: '✅ Embed Links',
    AttachFiles: '✅ Attach Files',
    ReadMessageHistory: '✅ Read Message History',
    MentionEveryone: '✅ Mention Everyone',
    AddReactions: '✅ Add Reactions',
    UseExternalEmojis: '✅ Use External Emojis',
    UseExternalStickers: '✅ Use External Stickers',
    UseApplicationCommands: '✅ Use Application Commands',
    Connect: '✅ Connect to Voice Channels',
    Speak: '✅ Speak in Voice Channels',
    Stream: '✅ Stream',
    UseVAD: '✅ Use Voice Activity',
    PrioritySpeaker: '✅ Priority Speaker',
    MuteMembers: '✅ Mute Members',
    DeafenMembers: '✅ Deafen Members',
    MoveMembers: '✅ Move Members',
    ManageEvents: '✅ Manage Events',
    CreateEvents: '✅ Create Scheduled Events',
    ModerateMembers: '✅ Moderate Members (Timeout)',
    RequestToSpeak: '✅ Request to Speak',
    UseEmbeddedActivities: '✅ Use Embedded Activities',
    UseSoundboard: '✅ Use Soundboard',
    CreateGuildExpressions: '✅ Create Guild Expressions',
    UseExternalSounds: '✅ Use External Sounds',
    SendVoiceMessages: '✅ Send Voice Messages',
    SendPolls: '✅ Send Polls',
    UseExternalApps: '✅ Use External Apps',
};
