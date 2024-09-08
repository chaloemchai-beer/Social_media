"use client";

import React, { useState, useEffect } from 'react';
import { faker } from "@faker-js/faker";
import InputBox from "./InputBox";
import Post from "./Post";
import Stories from "./Stories";

type PostType = {
  id: string;
  name: string;
  message: string;
  email: string;
  postImage: string | null;
  image: string;
  timestamp: string;
};

const Feed: React.FC = () => {
  const [posts, setPosts] = useState<PostType[]>([]);

  useEffect(() => {
    const generatePosts = (): void => {
      const newPosts: PostType[] = Array.from({ length: 10 }, () => ({
        id: faker.string.uuid(),
        name: faker.person.firstName(),
        message: faker.lorem.lines(),
        email: faker.internet.email(),
        postImage: faker.image.url(),
        image: faker.image.avatar(),
        timestamp: new Date(faker.date.recent()).toLocaleString(),
      }));
      setPosts(newPosts);
    };

    generatePosts();
  }, []);

  return (
    <div className="flex-grow h-screen pb-44 pt-6 mr-4 xl:mr-40 overflow-y-auto">
      <div className="mx-auto max-w-md md:max-w-lg lg:max-w-2xl">
        <Stories />
        <InputBox />
        {posts.map((post) => (
          <Post
            key={post.id}
            name={post.name}
            message={post.message}
            email={post.email}
            image={post.image}
            postImage={post.postImage}
            timestamp={post.timestamp}
          />
        ))}
      </div>
    </div>
  );
};

export default Feed;