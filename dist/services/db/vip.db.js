import VipRoom from '../../models/VipRoom';
export const getActiveVipByOwner = async ({ guildId, ownerId }) => {
    const vipInfo = await VipRoom.findOne({
        guildId,
        ownerId,
        expiresAt: { $gt: new Date() }
    }).lean();
    return vipInfo;
};
export const getAllActiveVipsByGuildId = async ({ guildId }) => {
    const vipInfos = await VipRoom.find({
        guildId,
        expiresAt: { $gt: new Date() }
    }).lean();
    return vipInfos;
};
export const getAllActiveVips = async () => {
    const vipInfos = await VipRoom.find({
        expiresAt: { $gt: new Date() }
    });
    return vipInfos;
};
export const getAllOldVips = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const vipInfos = await VipRoom.find({
        expiresAt: { $lt: sevenDaysAgo }
    });
    return vipInfos;
};
export const createVip = async ({ ownerId, guildId, channelId, expiresAt }) => {
    await VipRoom.create({
        ownerId,
        guildId,
        channelId,
        expiresAt
    });
};
export const deleteVipByOwnerId = async ({ ownerId, guildId }) => {
    await VipRoom.findOneAndDelete({ ownerId, guildId });
};
export const extendVipExpiry = async ({ ownerId, guildId, newExpiry }) => {
    const updatedVip = await VipRoom.findOneAndUpdate({ ownerId, guildId }, { $set: { expiresAt: newExpiry } });
    return updatedVip;
};
export const addMemberToVip = async ({ ownerId, guildId, memberId }) => {
    await VipRoom.findOneAndUpdate({ ownerId, guildId }, { $addToSet: { memberIds: memberId } });
};
export const removeMemberFromVip = async ({ ownerId, guildId, memberId }) => {
    return VipRoom.findOneAndUpdate({ ownerId, guildId }, { $pull: { memberIds: memberId } }, { new: true });
};
