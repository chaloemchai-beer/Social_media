import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../models/Post';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions"
import fs from 'fs/promises';
import path from 'path';

// Ensure MongoDB connection
const connectToMongoDB = async () => {
  if (mongoose.connections[0].readyState) return; // If already connected
  await mongoose.connect(process.env.MONGODB_URI as string);
};

// Handle POST request
export const POST = async (req: Request) => {
  await connectToMongoDB();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const text = formData.get('text') as string;
    const files = formData.getAll('files') as File[];

    let imageUrl = null;
    let videoUrl = null;

    // Process uploaded files
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const filename = Date.now() + '-' + file.name.replace(/\s/g, '_');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      // Ensure the upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      const fileUrl = `/uploads/${filename}`;
      
      if (file.type.startsWith('image')) {
        imageUrl = fileUrl;
      } else if (file.type.startsWith('video')) {
        videoUrl = fileUrl;
      }
    }

    // Create a new post object with additional user information
    const postData = {
      text,
      imageUrl,
      videoUrl,
      email: session.user.email,
      name: session.user.name || 'Anonymous', // Add user name if available
      createdAt: new Date(),
    };

    const post = new Post(postData);
    await post.save();
    return NextResponse.json({ message: 'Post created successfully!' });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
};

// Handle GET request to fetch posts
export async function GET() {
  await connectToMongoDB();
  try {
    const posts = await Post.find().sort({ createdAt: -1 }); // Sort by creation time
    return NextResponse.json(posts);
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
