"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import InputBox from "./InputBox";
import Post from "./Post";
import Stories from "./Stories";

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

const TAKE = 20;

const Feed: React.FC = () => {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meAvatar, setMeAvatar] = useState<string | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const newestPostIdRef = useRef<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Fetch current user avatar once
  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setMeAvatar(d?.avatarUrl || null))
      .catch(() => {});
  }, [session?.user]);

  const fetchPosts = useCallback(async (skip = 0, append = false) => {
    try {
      append ? setLoadingMore(true) : setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/post?take=${TAKE}&skip=${skip}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      const data: PostType[] = await res.json();
      setPosts((prev) => append ? [...prev, ...data] : data);
      setHasMore(data.length === TAKE);
      if (!append && data.length > 0) {
        newestPostIdRef.current = data[0]._id;
        setNewPostsCount(0);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError("Failed to load posts. Please try again later.");
    } finally {
      append ? setLoadingMore(false) : setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Live poll for new posts every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!newestPostIdRef.current) return;
      try {
        const res = await fetch('/api/post?take=5&skip=0');
        if (!res.ok) return;
        const data: PostType[] = await res.json();
        if (data.length === 0) return;
        const idx = data.findIndex((p) => p._id === newestPostIdRef.current);
        const count = idx === -1 ? data.length : idx;
        if (count > 0) setNewPostsCount(count);
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleNewPostsBanner = () => {
    setNewPostsCount(0);
    fetchPosts();
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex-grow h-screen pb-44 pt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
      <div ref={topRef} className="mx-auto max-w-xl px-4">
        <Stories />
        <InputBox onPosted={() => fetchPosts()} meAvatar={meAvatar} />

        {/* ── New posts live banner ── */}
        {newPostsCount > 0 && (
          <button
            onClick={handleNewPostsBanner}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600/20 border border-violet-500/40 text-violet-300 text-sm font-medium rounded-2xl hover:bg-violet-600/30 transition-all animate-pulse"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {newPostsCount} new post{newPostsCount > 1 ? 's' : ''} — click to refresh
          </button>
        )}

        {/* ── Post list ── */}
        {isLoading ? (
          <div className="flex flex-col gap-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-800 rounded w-1/3" />
                    <div className="h-2 bg-gray-800 rounded w-1/4" />
                  </div>
                </div>
                <div className="h-3 bg-gray-800 rounded w-full mb-2" />
                <div className="h-3 bg-gray-800 rounded w-4/5 mb-4" />
                <div className="h-48 bg-gray-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3">
              {posts.map((post) => (
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
                  meAvatar={meAvatar}
                />
              ))}
            </div>

            {/* ── Load More ── */}
            {posts.length > 0 && (
              <div className="flex justify-center mt-4 mb-2">
                {hasMore ? (
                  <button
                    onClick={() => fetchPosts(posts.length, true)}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 border border-gray-700 hover:border-violet-500/50 hover:bg-gray-800 text-gray-300 hover:text-white text-sm font-medium rounded-2xl transition-all disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading...
                      </>
                    ) : 'Load more posts'}
                  </button>
                ) : (
                  <p className="text-gray-600 text-xs py-2">You're all caught up ✓</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Feed;
