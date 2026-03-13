"use client";

import React, { useMemo, useState } from "react";

type FeelingOption = { label: string; emoji?: string };
type ActivityOption = { label: string; emoji?: string; typeLabel?: string };

const FEELINGS: FeelingOption[] = [
  { label: "Happy", emoji: "😊" },
  { label: "Sad", emoji: "😢" },
  { label: "Excited", emoji: "🤩" },
  { label: "Loved", emoji: "❤️" },
  { label: "Angry", emoji: "😡" },
  { label: "Tired", emoji: "😴" },
  { label: "Blessed", emoji: "🙏" },
  { label: "Grateful", emoji: "🙏" },
  { label: "Bored", emoji: "😐" },
  { label: "Sick", emoji: "🤒" },
  { label: "Confused", emoji: "😕" },
  { label: "Proud", emoji: "😌" },
  { label: "Hopeful", emoji: "🤞" },
  { label: "Anxious", emoji: "😬" },
  { label: "Relaxed", emoji: "😌" },
  { label: "Energetic", emoji: "⚡" },
  { label: "Motivated", emoji: "💪" },
  { label: "Curious", emoji: "🤔" },
];

// typeLabel is the verb phrase shown in the post (e.g. "watching", "listening to")
const ACTIVITIES: ActivityOption[] = [
  { label: "a movie", emoji: "🎬", typeLabel: "watching" },
  { label: "music", emoji: "🎧", typeLabel: "listening to" },
  { label: "a book", emoji: "📖", typeLabel: "reading" },
  { label: "a game", emoji: "🎮", typeLabel: "playing" },
  { label: "coffee", emoji: "☕", typeLabel: "drinking" },
  { label: "lunch", emoji: "🍽️", typeLabel: "eating" },
  { label: "code", emoji: "💻", typeLabel: "working on" },
  { label: "exercises", emoji: "🏋️", typeLabel: "doing" },
  { label: "friends", emoji: "🎉", typeLabel: "celebrating with" },
  { label: "a meetup", emoji: "🎟️", typeLabel: "attending" },
  { label: "the mountains", emoji: "🏔️", typeLabel: "traveling to" },
  { label: "shopping", emoji: "🛍️", typeLabel: "going" },
];

export type FeelingSelection =
  | { kind: "feeling"; value: string; emoji?: string }
  | { kind: "activity"; value: string; emoji?: string; typeLabel: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (sel: FeelingSelection) => void;
};

const FeelingPicker: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const [tab, setTab] = useState<"feeling" | "activity">("feeling");
  const [query, setQuery] = useState("");

  const filteredFeelings = useMemo(() => {
    const q = query.toLowerCase();
    return FEELINGS.filter((f) => f.label.toLowerCase().includes(q));
  }, [query]);

  const filteredActivities = useMemo(() => {
    const q = query.toLowerCase();
    return ACTIVITIES.filter((a) =>
      (a.typeLabel || "").toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
    );
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
            <button
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "feeling"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              onClick={() => { setTab("feeling"); setQuery(""); }}
            >
              😊 Feeling
            </button>
            <button
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "activity"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              onClick={() => { setTab("activity"); setQuery(""); }}
            >
              🎯 Activity
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
              placeholder={tab === "feeling" ? "Search feelings..." : "Search activities..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto px-2 pb-3">
          {tab === "feeling" ? (
            filteredFeelings.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-6">No feelings found</p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {filteredFeelings.map((f) => (
                  <button
                    key={f.label}
                    onClick={() => onSelect({ kind: "feeling", value: f.label, emoji: f.emoji })}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-left group"
                  >
                    <span className="text-xl w-7 text-center flex-shrink-0">{f.emoji}</span>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{f.label}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            filteredActivities.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-6">No activities found</p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {filteredActivities.map((a) => (
                  <button
                    key={`${a.typeLabel}-${a.label}`}
                    onClick={() => onSelect({ kind: "activity", value: a.label, emoji: a.emoji, typeLabel: a.typeLabel || "" })}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-left group"
                  >
                    <span className="text-xl w-7 text-center flex-shrink-0">{a.emoji}</span>
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500 block">{a.typeLabel}</span>
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors truncate block">{a.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default FeelingPicker;

