import { TAtmRequest } from 'gambling-bot-shared'

import AtmRequest from '@/models/AtmRequest'

export type ListAtmRequestsParams = {
  guildId: string
  status?: TAtmRequest['status'] | TAtmRequest['status'][]
  type?: TAtmRequest['type']
  userId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  sort?: Record<string, 1 | -1>
}

export const createAtmRequest = async (data: {
  requestId: string
  userId: string
  guildId: string
  type: 'deposit' | 'withdraw'
  amount: number
  account: string
}) => {
  return AtmRequest.create(data)
}

export const attachAtmRequestMessage = async (
  requestId: string,
  logChannelId: string,
  logMessageId: string
) => {
  return AtmRequest.updateOne(
    { requestId, status: 'pending' },
    { logChannelId, logMessageId }
  )
}

export const deleteAtmRequest = async (requestId: string) => {
  return AtmRequest.deleteOne({ requestId })
}

export const getPendingAtmRequest = async (requestId: string) => {
  return AtmRequest.findOne({ requestId, status: 'pending' })
}

export const completeAtmRequest = async ({
  requestId,
  status,
  handledBy,
  notes,
  meta
}: {
  requestId: string
  status: 'approved' | 'rejected'
  handledBy: string
  notes?: string
  meta?: Record<string, unknown>
}) => {
  return AtmRequest.findOneAndUpdate(
    { requestId, status: 'pending' },
    {
      status,
      handledBy,
      handledAt: new Date(),
      ...(notes !== undefined ? { notes } : {}),
      ...(meta !== undefined ? { meta } : {})
    },
    { returnDocument: 'after' }
  )
}

export const listAtmRequests = async ({
  guildId,
  status,
  type,
  userId,
  dateFrom,
  dateTo,
  page = 1,
  limit = 15,
  sort = { createdAt: -1 }
}: ListAtmRequestsParams) => {
  const query: Record<string, unknown> = { guildId }

  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status
  }

  if (type) query.type = type
  if (userId) query.userId = userId

  if (dateFrom || dateTo) {
    query.createdAt = {
      ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { $lte: new Date(dateTo) } : {})
    }
  }

  const skip = (page - 1) * limit

  const [requests, total] = await Promise.all([
    AtmRequest.find(query).sort(sort).skip(skip).limit(limit).lean(),
    AtmRequest.countDocuments(query)
  ])

  return { requests, total }
}

export const getAtmRequestCounts = async ({ guildId }: { guildId: string }) => {
  const rows = await AtmRequest.aggregate([
    { $match: { guildId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ])

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  }

  for (const row of rows) {
    const status = row._id as TAtmRequest['status']
    counts[status] = row.count
    counts.total += row.count
  }

  return counts
}
