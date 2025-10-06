import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: String, required: true }], // array of user emails
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

// A unique compound index for 2-participant conversations (sorted order)
conversationSchema.index(
  { participants: 1 },
  { name: 'participants_compound' }
);

const Conversation =
  (mongoose.models.Conversation as mongoose.Model<any>) ||
  mongoose.model('Conversation', conversationSchema);

export default Conversation;

