import React, { useState, useEffect } from "react";
import InputBox from "./InputBox";
import Post from "./Post";
import Stories from "./Stories";

type PostType = {
  _id: string;
  text: string;
  videoUrl?: string | null;
  imageUrl?: string | null; // legacy single image
  imageUrls?: string[]; // multiple images
  name?: string | null;
  displayName?: string | null;
  authorAvatarUrl?: string | null;
  email: string;
  createdAt: string;
  feeling?: string | null; // legacy
  feelingType?: string | null;
  feelingValue?: string | null;
  feelingEmoji?: string | null;
  reactionCounts?: Partial<Record<'like'|'love'|'care'|'haha'|'wow'|'sad'|'angry', number>>;
  currentUserReaction?: string | null;
  commentCount?: number;
  shareCount?: number;
  sharedFrom?: {
    _id: string;
    name?: string | null;
    email: string;
    text: string;
    imageUrl?: string | null;
    imageUrls?: string[];
    videoUrl?: string | null;
    createdAt: string;
  } | null;
};

const Feed: React.FC = () => {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/post");
      if (!res.ok) {
        throw new Error("Failed to fetch posts");
      }
      const data = await res.json();
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setError("Failed to load posts. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <div className="flex-grow h-screen pb-44 pt-6 mr-4 xl:mr-40 overflow-y-auto">
      <div className="mx-auto max-w-md md:max-w-lg lg:max-w-2xl">
        <Stories />
        <InputBox onPosted={fetchPosts} />
        {isLoading ? (
          <p className="text-gray-500 px-4 py-2">Loading feed...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          posts.map((post) => (
            <Post
              key={post._id}
              id={post._id}
              name={post.displayName || post.name || post.email.split("@")[0]}
              message={post.text}
              email={post.email}
              images={post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])}
              videoUrl={post.videoUrl || null}
              feelingType={post.feelingType || (post.feeling ? "feeling" : undefined)}
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
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;
