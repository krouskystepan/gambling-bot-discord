import 'dotenv/config'
import mongoose from 'mongoose'

import fs from 'node:fs'
import path from 'node:path'

import Transaction from '@/models/Transaction'
import User from '@/models/User'
import { connectToDatabase } from '@/services'
import { logger } from '@/utils/logger'

const EPSILON = 0.0001

const LOG_DIR = path.resolve('logs')
const LOG_FILE = path.join(
  LOG_DIR,
  `audit-balances-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
)

const reportLines: string[] = []

const writeReport = (line: string) => {
  reportLines.push(line)
}

// ---------- HELPERS ----------

const nearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) < EPSILON

// ---------- MAIN ----------

async function auditBalances() {
  logger.boot('🔍 Starting balance audit…')
  writeReport('Starting balance audit')
  writeReport(`Started at: ${new Date().toISOString()}`)

  await connectToDatabase()

  const users = await User.find()
  writeReport(`Users found: ${users.length}`)

  let mismatches = 0
  let checked = 0

  for (const user of users) {
    checked++

    const transactions = await Transaction.find({
      userId: user.userId,
      guildId: user.guildId
    })

    const calculatedBalance = transactions.reduce((sum, t) => sum + t.amount, 0)

    if (!nearlyEqual(calculatedBalance, user.balance)) {
      mismatches++

      const line = [
        'BALANCE MISMATCH',
        `User=${user.userId}`,
        `Guild=${user.guildId}`,
        `Stored=${user.balance}`,
        `Calculated=${calculatedBalance}`,
        `Diff=${calculatedBalance - user.balance}`
      ].join(' | ')

      writeReport(line)
    }
  }

  writeReport(`Checked users: ${checked}`)
  writeReport(`Mismatches found: ${mismatches}`)
  writeReport(`Finished at: ${new Date().toISOString()}`)

  fs.mkdirSync(LOG_DIR, { recursive: true })
  fs.writeFileSync(LOG_FILE, reportLines.join('\n'), 'utf-8')

  logger.ready(`📝 Audit report saved to ${LOG_FILE}`)

  await mongoose.disconnect()
  process.exit(0)
}

auditBalances().catch((err) => {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  fs.writeFileSync(
    LOG_FILE,
    ['AUDIT FAILED', `Time: ${new Date().toISOString()}`, String(err)].join(
      '\n'
    ),
    'utf-8'
  )

  logger.error('Economy summary audit failed', err)
  process.exit(1)
})
