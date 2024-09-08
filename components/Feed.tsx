"use client";

import InputBox from "./InputBox";
import Post from "./Post";
import Stories from "./Stories";

const Feed = () => {
  return (
    <div
      className="flex-grow h-screen pb-44 pt-6 mr-4
    xl:mr-40 overflow-y-auto"
    >
      <div
        className="mx-auto max-w-md md:max-w-lg
        lg:max-x-2xl"
      >
        <Stories />
        <InputBox />
        <Post
          name="First Post"
          message="Hello"
          postImage="https://archive.smashing.media/assets/344dbf88-fdf9-42bb-adb4-46f01eedd629/d0a4481f-e801-4cb7-9daa-17cdae32cc89/icon-design-21-opt.png"
          image="https://archive.smashing.media/assets/344dbf88-fdf9-42bb-adb4-46f01eedd629/d0a4481f-e801-4cb7-9daa-17cdae32cc89/icon-design-21-opt.png"
        />
      </div>
    </div>
  );
};

export default Feed;
