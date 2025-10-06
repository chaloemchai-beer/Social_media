import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: String, required: true }, // sender email
    text: { type: String, default: '' },
    attachments: [{ type: String }], // URLs (images/videos)
    readBy: [{ type: String }], // emails who have read
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message =
  (mongoose.models.Message as mongoose.Model<any>) ||
  mongoose.model('Message', messageSchema);

export default Message;

