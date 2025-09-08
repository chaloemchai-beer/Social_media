"use client";
import React, { useEffect, useState } from 'react';
import InputBox from './InputBox';
import Post from './Post';

type PostType = {
  _id: string;
  text: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  name?: string | null;
  displayName?: string | null;
  authorAvatarUrl?: string | null;
  email: string;
  createdAt: string;
  feeling?: string | null;
  feelingType?: string | null;
  feelingValue?: string | null;
  feelingEmoji?: string | null;
  reactionCounts?: Partial<Record<'like'|'love'|'care'|'haha'|'wow'|'sad'|'angry', number>>;
  currentUserReaction?: string | null;
  commentCount?: number;
  shareCount?: number;
  sharedFrom?: any;
};

export default function ProfileFeed({ email, withComposer = true }: { email: string; withComposer?: boolean }) {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = React.useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetch(`/api/post?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Failed to fetch posts');
      const data = await res.json();
      setPosts(data);
    } catch (e) {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => { if (email) fetchPosts(); }, [email, fetchPosts]);

  if (loading) return <p className="text-gray-500 px-4 py-2">Loading posts...</p>;
  if (error) return <p className="text-red-500 px-4 py-2">{error}</p>;

  return (
    <div className="space-y-2">
      {withComposer && <InputBox onPosted={fetchPosts} />}
      {posts.map((post) => (
        <Post
          key={post._id}
          id={post._id}
          name={post.displayName || post.name || post.email.split('@')[0]}
          message={post.text}
          email={post.email}
          images={post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])}
          videoUrl={post.videoUrl || null}
          feelingType={post.feelingType || (post.feeling ? 'feeling' : undefined)}
          feelingValue={post.feelingValue || post.feeling || undefined}
          feelingEmoji={post.feelingEmoji || undefined}
          reactionCounts={post.reactionCounts || {}}
          currentUserReaction={post.currentUserReaction || null}
          profileImage={post.authorAvatarUrl || ""}
          timestamp={post.createdAt}
          initialCommentCount={post.commentCount || 0}
          shareCount={post.shareCount || 0}
          sharedFrom={post.sharedFrom || undefined}
        />
      ))}
    </div>
  );
}
