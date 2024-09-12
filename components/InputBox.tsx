"use client";

import React, { useState } from "react";
import Image from "next/image";
import VideocamIcon from "@mui/icons-material/Videocam";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";

const InputBox = () => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const sendPost = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("text", text);

    if (files) {
      Array.from(files).forEach((file) => {
        formData.append("files", file); // Sending all files (images, videos)
      });
    }

    try {
      const response = await fetch("/api/post", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to post");
      }

      // Clear the form after successful post
      setText("");
      setFiles(null);
      
      // You might want to add some feedback to the user here
      console.log("Post created successfully!");
      
      // Optionally, you can trigger a refresh of the posts in the Feed component
      // This would require lifting the state up or using a state management solution
    } catch (error) {
      console.error("Error posting data:", error);
      // You might want to show an error message to the user here
    }
  };

  return (
    <div className="bg-white p-2 rounded-2xl shadow-md text-gray-500 font-medium mt-6">
      <div className="flex space-x-4 p-4 items-center">
        <Image
          className="rounded-full"
          src="https://archive.smashing.media/assets/344dbf88-fdf9-42bb-adb4-46f01eedd629/d0a4481f-e801-4cb7-9daa-17cdae32cc89/icon-design-21-opt.png"
          width={40}
          height={40}
          alt="User Icon"
        />
        <form className="flex flex-1" onSubmit={sendPost}>
          <input
            className="rounded-full h-12 bg-gray-100 flex-grow px-5 focus:outline-none"
            type="text"
            placeholder="What's on your mind?"
            value={text}
            onChange={handleTextChange}
          />
          <button hidden type="submit">
            Submit
          </button>
        </form>
      </div>

      <div className="flex justify-evenly p-3 border-t">
        <div className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer">
          <VideocamIcon className="h-7 text-red-500" />
          <p className="text-xs sm:text-sm xl:text-base">Live Video</p>
        </div>
        <button
          onClick={() => document.getElementById("fileInput")?.click()}
          className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer"
        >
          <CameraAltIcon className="h-7 text-green-500" />
          <p className="text-xs sm:text-sm xl:text-base">Photo/Video</p>
        </button>
        <div className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer">
          <EmojiEmotionsIcon className="h-7 text-yellow-500" />
          <p className="text-xs sm:text-sm xl:text-base">Feeling/Activity</p>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        className="hidden"
        type="file"
        accept="video/*,image/*"
        id="fileInput"
        multiple
        onChange={handleFileChange}
      />
    </div>
  );
};

export default InputBox;