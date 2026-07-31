import { createPeerTransferService } from 'gambling-bot-shared/pay'

import Transaction from '@/models/Transaction'
import User from '@/models/User'

export const peerTransfer = createPeerTransferService({
  userModel: User,
  transactionModel: Transaction
})
