import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  text: { type: String, required: true },
  imageUrl: { type: String, required: false }, // Optional, legacy single image
  imageUrls: [{ type: String }], // Optional, multiple images
  videoUrl: { type: String, required: false }, // Optional
  email: { type: String, required: true },
  name: { type: String, required: false },
  feeling: { type: String, required: false }, // legacy simple field
  feelingType: { type: String, required: false }, // e.g., 'feeling', 'watching', 'listening to'
  feelingValue: { type: String, required: false }, // e.g., 'Happy', 'a movie'
  feelingEmoji: { type: String, required: false },
  comments: [
    new mongoose.Schema(
      {
        email: { type: String, required: true },
        name: { type: String, required: false },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        // Likes on comment (simple like toggle per user)
        likes: { type: Number, default: 0 },
        userLikes: [
          new mongoose.Schema(
            {
              email: { type: String, required: true },
              updatedAt: { type: Date, default: Date.now },
            },
            { _id: false }
          ),
        ],
        // One-level replies
        replies: [
          new mongoose.Schema(
            {
              email: { type: String, required: true },
              name: { type: String, required: false },
              text: { type: String, required: true },
              createdAt: { type: Date, default: Date.now },
              likes: { type: Number, default: 0 },
              userLikes: [
                new mongoose.Schema(
                  {
                    email: { type: String, required: true },
                    updatedAt: { type: Date, default: Date.now },
                  },
                  { _id: false }
                ),
              ],
            },
            { timestamps: false }
          ),
        ],
      },
      { timestamps: false }
    ),
  ],
  reactionCounts: {
    like: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    care: { type: Number, default: 0 },
    haha: { type: Number, default: 0 },
    wow: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 },
  },
  userReactions: [
    {
      email: { type: String, required: true },
      type: { type: String, enum: ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'], required: true },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  shareCount: { type: Number, default: 0 },
  sharedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: false },
  createdAt: { type: Date, default: Date.now },
});

// Avoid OverwriteModelError in Next.js dev (hot reload)
const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
export default Post;
