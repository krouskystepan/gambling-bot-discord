import { createSuccessEmbed } from '@/utils/discord/createEmbed';
export const data = {
    name: 'ping',
    description: 'Check the bot latency.'
};
export const options = {
    deleted: false
};
const formatUptime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
        days && `${days}d`,
        hours && `${hours}h`,
        minutes && `${minutes}m`,
        `${seconds}s`
    ]
        .filter(Boolean)
        .join(' ');
};
export async function run({ interaction, client }) {
    const start = Date.now();
    await interaction.deferReply({ ephemeral: true });
    const clientPing = Date.now() - start;
    const wsPing = client.ws.ping ?? 0;
    const uptime = formatUptime(client.uptime ?? 0);
    await interaction.editReply({
        embeds: [
            createSuccessEmbed('🏓 Pong!', [
                `**Client latency:** \`${clientPing}ms\``,
                `**WebSocket latency:** \`${wsPing}ms\``,
                `**Uptime:** \`${uptime}\``
            ].join('\n'))
        ]
    });
}
