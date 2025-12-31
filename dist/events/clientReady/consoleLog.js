import { logger } from '@/utils/logger';
export default async (client) => {
    const currentTime = new Date().toLocaleString('cs-CZ');
    logger.ready(`🕛 Time: ${currentTime}`);
    logger.ready(`🤖 ${client.user?.tag} is online`);
};
