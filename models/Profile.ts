import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  bio: { type: String, required: false },
  location: { type: String, required: false },
  website: { type: String, required: false },
  avatarUrl: { type: String, required: false },
  coverUrl: { type: String, required: false },
  friendsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

profileSchema.pre('save', function (next) {
  (this as any).updatedAt = new Date();
  next();
});

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
export default Profile;

