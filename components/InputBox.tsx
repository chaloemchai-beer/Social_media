"use client";

import React, { useState } from "react";
import Image from "next/image";
import VideocamIcon from "@mui/icons-material/Videocam";
import { useRouter } from "next/navigation";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import FeelingPicker, { FeelingSelection } from "./FeelingPicker";

type InputBoxProps = {
  onPosted?: () => void;
};

const InputBox: React.FC<InputBoxProps> = ({ onPosted }) => {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feelingSel, setFeelingSel] = useState<FeelingSelection | null>(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const clearFiles = () => setFiles(null);
  const hasMedia = !!files && files.length > 0;
  
  const sendPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !files && !feelingSel) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("text", text);
    if (feelingSel) {
      if (feelingSel.kind === "feeling") {
        formData.append("feelingType", "feeling");
        formData.append("feelingValue", feelingSel.value);
        if (feelingSel.emoji) formData.append("feelingEmoji", feelingSel.emoji);
      } else {
        formData.append("feelingType", feelingSel.typeLabel);
        formData.append("feelingValue", feelingSel.value);
        if (feelingSel.emoji) formData.append("feelingEmoji", feelingSel.emoji);
      }
    }

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
      setFeelingSel(null);
      if (onPosted) onPosted();
      
      // You might want to add some feedback to the user here
      console.log("Post created successfully!");
      
      // Optionally, you can trigger a refresh of the posts in the Feed component
      // This would require lifting the state up or using a state management solution
    } catch (error) {
      console.error("Error posting data:", error);
      // You might want to show an error message to the user here
    } finally {
      setSubmitting(false);
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
        <form className="flex flex-1 items-center gap-2" onSubmit={sendPost}>
          <input
            className="rounded-full h-12 bg-gray-100 flex-grow px-5 focus:outline-none"
            type="text"
            placeholder="What's on your mind?"
            value={text}
            onChange={handleTextChange}
          />
          <button
            type="submit"
            disabled={submitting || (!text.trim() && !hasMedia && !feelingSel)}
            className={`px-4 py-2 rounded-full text-white font-semibold ${
              submitting || (!text.trim() && !hasMedia && !feelingSel)
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            aria-busy={submitting}
          >
            {submitting ? "Posting..." : "Post"}
          </button>
        </form>
      </div>

      <div className="flex justify-evenly p-3 border-t">
        <button
          type="button"
          onClick={() => router.push('/live/go')}
          className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer"
        >
          <VideocamIcon className="h-7 text-red-500" />
          <p className="text-xs sm:text-sm xl:text-base">Live Video</p>
        </button>
        <button
          onClick={() => document.getElementById("fileInput")?.click()}
          className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer"
        >
          <CameraAltIcon className="h-7 text-green-500" />
          <p className="text-xs sm:text-sm xl:text-base">Photo/Video</p>
        </button>
        <button
          type="button"
          onClick={() => setShowFeelingPicker(true)}
          className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer"
        >
          <EmojiEmotionsIcon className="h-7 text-yellow-500" />
          <p className="text-xs sm:text-sm xl:text-base">Feeling/Activity</p>
        </button>
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

      {/* Previews and feeling selector */}
      {(hasMedia || feelingSel) && (
        <div className="px-4 pb-3 flex flex-col gap-3">
          {hasMedia && (
            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-600">
                {Array.from(files!).map((f) => (
                  <span key={f.name} className="mr-2">{f.type.startsWith("image") ? "🖼️" : "🎬"} {f.name}</span>
                ))}
              </div>
              <button type="button" onClick={clearFiles} className="text-xs text-blue-600 hover:underline">Clear</button>
            </div>
          )}
          {feelingSel && (
            <div className="flex items-center gap-2 text-sm bg-gray-50 rounded p-2">
              <span>{(feelingSel as any).emoji}</span>
              <span className="text-gray-700">
                {feelingSel.kind === "feeling"
                  ? `Feeling ${feelingSel.value}`
                  : `${feelingSel.typeLabel} ${feelingSel.value}`}
              </span>
              <button
                type="button"
                onClick={() => setFeelingSel(null)}
                className="ml-auto text-blue-600 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      <FeelingPicker
        open={showFeelingPicker}
        onClose={() => setShowFeelingPicker(false)}
        onSelect={(sel) => {
          setFeelingSel(sel);
          setShowFeelingPicker(false);
        }}
      />
    </div>
  );
};

export default InputBox;
