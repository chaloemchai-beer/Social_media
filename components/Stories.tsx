"use client"

import StoryCard from "./common/StoryCard";
import {useState, useEffect} from "react"
import { faker } from "@faker-js/faker";

type StoryType = {
  id: string;
  name: string;
  src: string;
  profile: string | null;
};

const Stories: React.FC = () => {
  const [stories, setStories] = useState<StoryType[]>([]);

  useEffect(() => {
    const generateStories = (): void => {
      const newStories: StoryType[] = Array.from({ length: 5 }, () => ({
        id: faker.string.uuid(),
        name: faker.person.firstName(),
        src: faker.image.url(),
        profile: faker.image.avatar(),
      }));
      setStories(newStories);
    };

    generateStories();
  }, []);

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
      {/* Add your story card */}
      <div className="relative w-28 h-48 flex-shrink-0 cursor-pointer rounded-2xl overflow-hidden ring-1 ring-gray-800 hover:ring-violet-500/50 transition-all bg-gray-900 flex flex-col items-center justify-end pb-3 group">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gray-800 to-gray-900" />
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center ring-2 ring-gray-900 group-hover:bg-violet-500 transition-colors">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-white text-xs font-semibold text-center relative z-10">Add Story</p>
      </div>
      {stories.map((story) => (
        <StoryCard
          key={story.src}
          name={story.name}
          src={story.src}
          profile={story.profile}
        />
      ))}
    </div>
  );
};

export default Stories;
