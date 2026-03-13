"use client";

import React, { useState } from "react";
import Image from "next/image";
import VideocamIcon from "@mui/icons-material/Videocam";
import { useRouter } from "next/navigation";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import FeelingPicker, { FeelingSelection } from "./FeelingPicker";
import { useSession } from "next-auth/react";

type InputBoxProps = {
  onPosted?: () => void;
  meAvatar?: string | null;
};

const InputBox: React.FC<InputBoxProps> = ({ onPosted, meAvatar }) => {
  const router = useRouter();
  const { data: session } = useSession();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feelingSel, setFeelingSel] = useState<FeelingSelection | null>(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [focused, setFocused] = useState(false);

  const fallbackAvatar = "https://avatars.githubusercontent.com/u/1?v=4";
  const myAvatar = meAvatar || session?.user?.image || fallbackAvatar;
  const myName = session?.user?.name || session?.user?.email || "You";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(e.target.files);
  };

  const clearFiles = () => setFiles(null);
  const hasMedia = !!files && files.length > 0;

  const previewUrls = React.useMemo(() => {
    if (!files) return [];
    return Array.from(files).map((f) => ({
      url: f.type.startsWith("image") ? URL.createObjectURL(f) : null,
      name: f.name,
      isVideo: f.type.startsWith("video"),
    }));
  }, [files]);

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
      Array.from(files).forEach((file) => formData.append("files", file));
    }
    try {
      const response = await fetch("/api/post", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to post");
      setText("");
      setFiles(null);
      setFeelingSel(null);
      setFocused(false);
      if (onPosted) onPosted();
    } catch (error) {
      console.error("Error posting data:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={sendPost} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

      {/* ── Composer area ── */}
      <div className="px-4 pt-4 pb-3 flex gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-700 flex-shrink-0">
          <Image src={myAvatar} alt={myName} width={40} height={40} className="w-full h-full object-cover" />
        </div>

        {/* Text + feeling chip */}
        <div className="flex-1 min-w-0">
          <textarea
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none leading-relaxed"
            rows={focused || text ? 3 : 1}
            placeholder={`What's on your mind, ${myName.split(" ")[0]}?`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => { if (!text) setFocused(false); }}
          />

          {/* Feeling chip */}
          {feelingSel && (
            <div className="inline-flex items-center gap-1.5 mt-1 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs px-3 py-1 rounded-full">
              <span>{(feelingSel as any).emoji}</span>
              <span>
                {feelingSel.kind === "feeling"
                  ? `Feeling ${feelingSel.value}`
                  : `${feelingSel.typeLabel} ${feelingSel.value}`}
              </span>
              <button
                type="button"
                onClick={() => setFeelingSel(null)}
                className="ml-1 text-violet-400 hover:text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Media preview grid ── */}
      {hasMedia && (
        <div className="px-4 pb-3">
          <div className={`grid gap-1 rounded-xl overflow-hidden ${previewUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {previewUrls.map((f, idx) => (
              <div key={idx} className="relative bg-gray-800 rounded-xl overflow-hidden h-32">
                {f.url ? (
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                    <span className="text-xs truncate max-w-[80px]">{f.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={clearFiles}
            className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Remove all media
          </button>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-800">
        <button
          type="button"
          onClick={() => router.push('/live/go')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
        >
          <VideocamIcon style={{ fontSize: 20 }} className="text-red-400" />
          <span className="hidden sm:block text-xs">Live</span>
        </button>

        <button
          type="button"
          onClick={() => document.getElementById("fileInput")?.click()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
        >
          <CameraAltIcon style={{ fontSize: 20 }} className="text-green-400" />
          <span className="hidden sm:block text-xs">Photo</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFeelingPicker(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
        >
          <EmojiEmotionsIcon style={{ fontSize: 20 }} className="text-yellow-400" />
          <span className="hidden sm:block text-xs">Feeling</span>
        </button>

        <button
          type="submit"
          disabled={submitting || (!text.trim() && !hasMedia && !feelingSel)}
          className="ml-auto px-5 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Posting...
            </>
          ) : "Post"}
        </button>
      </div>

      <input
        className="hidden"
        type="file"
        accept="video/*,image/*"
        id="fileInput"
        multiple
        onChange={handleFileChange}
      />

      <FeelingPicker
        open={showFeelingPicker}
        onClose={() => setShowFeelingPicker(false)}
        onSelect={(sel) => {
          setFeelingSel(sel);
          setShowFeelingPicker(false);
        }}
      />
    </form>
  );
};

export default InputBox;
