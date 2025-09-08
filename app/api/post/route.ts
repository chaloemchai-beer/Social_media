import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Post from '../../../models/Post';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions"
import fs from 'fs/promises';
import path from 'path';
import Profile from '../../../models/Profile';

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
    const legacyFeeling = (formData.get('feeling') as string) || undefined;
    const feelingType = (formData.get('feelingType') as string) || undefined;
    const feelingValue = (formData.get('feelingValue') as string) || undefined;
    const feelingEmoji = (formData.get('feelingEmoji') as string) || undefined;
    const files = formData.getAll('files') as File[];

    let imageUrl: string | null = null; // legacy single
    const imageUrls: string[] = [];
    let videoUrl: string | null = null;

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
        imageUrls.push(fileUrl);
        imageUrl = imageUrl || fileUrl; // keep first as legacy
      } else if (file.type.startsWith('video')) {
        // Keep only the last video if multiple are supplied
        videoUrl = fileUrl;
      }
    }

    // Resolve display name from Profile if available
    let resolvedName: string | undefined = undefined;
    try {
      const prof = await Profile.findOne({ email: session.user.email }).lean();
      if (prof?.name) resolvedName = prof.name as string;
    } catch {}

    // Create a new post object with additional user information
    const postData: any = {
      text,
      imageUrl,
      imageUrls,
      videoUrl,
      // support both new and legacy feeling fields
      feeling: legacyFeeling,
      feelingType,
      feelingValue,
      feelingEmoji,
      email: session.user.email,
      name: resolvedName || session.user.name || (session.user.email?.split('@')[0]) || 'Anonymous',
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
export async function GET(request: Request) {
  await connectToMongoDB();
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    const { searchParams } = new URL(request.url);
    const filterEmail = searchParams.get('email') || undefined;
    const findQuery: any = {};
    if (filterEmail) findQuery.email = filterEmail;
    const posts = await Post.find(findQuery).sort({ createdAt: -1 }).lean();
    const sharedIds = posts.filter((p: any) => p.sharedFrom).map((p: any) => String(p.sharedFrom));
    const originals = sharedIds.length
      ? await Post.find({ _id: { $in: sharedIds } }).lean()
      : [];
    const originalMap = new Map(originals.map((o: any) => [String(o._id), o]));
    // Profiles for original authors too
    const originalEmails = Array.from(new Set(originals.map((o: any) => o.email).filter(Boolean)));
    const profForOriginals = originalEmails.length ? await Profile.find({ email: { $in: originalEmails } }).lean() : [];
    const origNameMap = new Map(profForOriginals.map((pr: any) => [pr.email, pr.name]));
    const origAvatarMap = new Map(profForOriginals.map((pr: any) => [pr.email, pr.avatarUrl]));

    // Build profile name map for authors
    const authorEmails = Array.from(new Set(posts.map((p: any) => p.email).filter(Boolean)));
    const profiles = authorEmails.length ? await Profile.find({ email: { $in: authorEmails } }).lean() : [];
    const nameMap = new Map(profiles.map((pr: any) => [pr.email, pr.name]));
    const avatarMap = new Map(profiles.map((pr: any) => [pr.email, pr.avatarUrl]));

    const shaped = posts.map((p: any) => {
      const currentUserReaction = email
        ? (p.userReactions || []).find((r: any) => r.email === email)?.type || null
        : null;
      const commentsArr = Array.isArray(p.comments) ? p.comments : [];
      const commentCount = commentsArr.length;
      // Keep API lean; no longer return lastComments by default
      let sharedFrom: any = undefined;
      if (p.sharedFrom) {
        const o = originalMap.get(String(p.sharedFrom));
        if (o) {
          sharedFrom = {
            _id: o._id,
            name: origNameMap.get(o.email) || o.name || (o.email?.split('@')[0]) || 'Anonymous',
            avatarUrl: origAvatarMap.get(o.email) || null,
            email: o.email,
            text: o.text,
            imageUrl: o.imageUrl,
            imageUrls: o.imageUrls || [],
            videoUrl: o.videoUrl || null,
            createdAt: o.createdAt,
          };
        }
      }
      return {
        ...p,
        displayName: nameMap.get(p.email) || p.name || (p.email?.split('@')[0]) || 'Anonymous',
        authorAvatarUrl: avatarMap.get(p.email) || null,
        currentUserReaction,
        commentCount,
        shareCount: p.shareCount || 0,
        sharedFrom,
      };
    });
    return NextResponse.json(shaped);
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
