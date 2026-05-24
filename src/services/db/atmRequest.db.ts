import AtmRequest from '@/models/AtmRequest'

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
  handledBy
}: {
  requestId: string
  status: 'approved' | 'rejected'
  handledBy: string
}) => {
  return AtmRequest.findOneAndUpdate(
    { requestId, status: 'pending' },
    { status, handledBy, handledAt: new Date() },
    { returnDocument: 'after' }
  )
}
