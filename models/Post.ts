import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  text: { type: String, required: true },
  imageUrl: { type: String, required: false }, // Optional
  videoUrl: { type: String, required: false }, // Optional
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Post', postSchema);
