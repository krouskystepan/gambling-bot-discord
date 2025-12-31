import { Schema, model } from 'mongoose';
const cardSchema = {
    suite: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Number, required: true }
};
const handSchema = new Schema({
    cards: [cardSchema],
    betAmount: { type: Number, required: true },
    finished: { type: Boolean, required: true, default: false }
}, { _id: false });
const BlackjackGameSchema = new Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    betId: { type: String, required: true, index: true },
    deck: [cardSchema],
    deckIndex: { type: Number, required: true, default: 0 },
    hands: { type: [handSchema], required: true, default: [] },
    activeHandIndex: { type: Number, required: true, default: 0 },
    dealerCards: [cardSchema]
}, { timestamps: true });
BlackjackGameSchema.index({ userId: 1, guildId: 1 }, { unique: true });
export default model('BlackjackGame', BlackjackGameSchema);
