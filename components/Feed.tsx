import React, { useState, useEffect } from "react";
import InputBox from "./InputBox";
import Post from "./Post";
import Stories from "./Stories";

type PostType = {
  _id: string;
  text: string;
  videoUrl: string | null;
  imageUrl: string | null;
  name: string;
  message: string;
  email: string;
  postImage: string | null;
  image: string;
  createdAt: string;
  updatedAt: string;
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
        <InputBox />
        {isLoading ? (
          <p>กำลังโหลดโพสต์...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          posts.map((post) => (
            <Post
              key={post._id}
              name={post.name}
              message={post.message || post.text}
              email={post.email}
              image={post.image}
              postImage={post.postImage || post.imageUrl}
              timestamp={post.createdAt}
              videoUrl={post.videoUrl}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;
