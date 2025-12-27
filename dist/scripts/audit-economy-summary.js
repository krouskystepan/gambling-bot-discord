import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import { connectToDatabase } from '@/services';
import { logger } from '@/utils/logger';
const LOG_DIR = path.resolve('logs');
const LOG_FILE = path.join(LOG_DIR, `audit-economy-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const reportLines = [];
const writeReport = (line) => {
    reportLines.push(line);
};
async function auditEconomySummary() {
    logger.boot('📊 Starting economy summary audit');
    writeReport('ECONOMY SUMMARY AUDIT');
    writeReport(`Started at: ${new Date().toISOString()}`);
    await connectToDatabase();
    const users = await User.find();
    const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);
    const totalLocked = users.reduce((sum, u) => sum + (u.lockedBalance ?? 0), 0);
    writeReport(`Users count: ${users.length}`);
    writeReport(`Total balance: ${totalBalance}`);
    writeReport(`Total locked balance: ${totalLocked}`);
    writeReport(`Free balance: ${totalBalance - totalLocked}`);
    const transactions = await Transaction.find();
    const totalTransactions = transactions.length;
    const totalBet = transactions
        .filter((t) => t.type === 'bet')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalWin = transactions
        .filter((t) => t.type === 'win')
        .reduce((sum, t) => sum + t.amount, 0);
    writeReport(`Transactions count: ${totalTransactions}`);
    writeReport(`Total bet amount: ${totalBet}`);
    writeReport(`Total win amount: ${totalWin}`);
    writeReport(`Net flow (win - bet): ${totalWin - totalBet}`);
    writeReport(`House result (bet - win): ${totalBet - totalWin}`);
    writeReport(`Finished at: ${new Date().toISOString()}`);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, reportLines.join('\n'), 'utf-8');
    logger.ready(`📝 Economy summary saved to ${LOG_FILE}`);
    await mongoose.disconnect();
    process.exit(0);
}
auditEconomySummary().catch((err) => {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, ['AUDIT FAILED', `Time: ${new Date().toISOString()}`, String(err)].join('\n'), 'utf-8');
    logger.error('Economy summary audit failed', err);
    process.exit(1);
});
