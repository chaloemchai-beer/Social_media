import mongoose from 'mongoose'

export async function connectToMongoDB() {
  if (mongoose.connections[0]?.readyState) return
  const uri = process.env.MONGODB_URI as string
  if (!uri) throw new Error('MONGODB_URI is not set')
  await mongoose.connect(uri)
}

