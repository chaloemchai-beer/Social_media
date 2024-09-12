import mongoose from 'mongoose';

const PostSchema = new mongoose.Schema({
  text: { type: String, required: false },
  videoUrl: { type: String, required: false },
  imageUrl: { type: String, required: false },
  name: { type: String, required: true },
  message: { type: String, required: false },
  email: { type: String, required: true },
  postImage: { type: String, required: false },
  image: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Post || mongoose.model('Post', PostSchema);