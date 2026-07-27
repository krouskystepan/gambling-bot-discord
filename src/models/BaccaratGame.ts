import { type TBaccaratGame } from 'gambling-bot-shared/baccarat'
import { BaccaratGameSchema } from 'gambling-bot-shared/mongoose'
import mongoose from 'mongoose'

export type { TBaccaratGame } from 'gambling-bot-shared/baccarat'

export default (mongoose.models
  .BaccaratGame as mongoose.Model<TBaccaratGame>) ||
  mongoose.model<TBaccaratGame>('BaccaratGame', BaccaratGameSchema)
