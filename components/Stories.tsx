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
    <div className="flex justify-center space-x-3 mx-auto">
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
