import VipRoom from '@/models/VipRoom';
const vipChannelCache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute
export const getActiveVipChannels = async (guildId) => {
    const cached = vipChannelCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.channels;
    }
    const vipRooms = await VipRoom.find({
        guildId,
        expiresAt: { $gt: new Date() }
    }).lean();
    const channels = vipRooms.map((room) => room.channelId);
    vipChannelCache.set(guildId, {
        channels,
        expiresAt: Date.now() + CACHE_TTL_MS
    });
    return channels;
};
