export const encodeId = (d) => `bj:${d.betId}:${d.action}:${d.showBalance ? 1 : 0}`;
export const decodeId = (id) => {
    if (!id.startsWith('bj:'))
        return null;
    const parts = id.split(':');
    if (parts.length !== 4)
        return null;
    const [, betId, actionRaw, showRaw] = parts;
    if (actionRaw !== 'HIT' &&
        actionRaw !== 'STAND' &&
        actionRaw !== 'DOUBLE' &&
        actionRaw !== 'SPLIT') {
        return null;
    }
    return {
        betId,
        action: actionRaw,
        showBalance: showRaw === '1'
    };
};
