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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded ${tab === "feeling" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
              onClick={() => setTab("feeling")}
            >
              Feeling
            </button>
            <button
              className={`px-3 py-1 rounded ${tab === "activity" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
              onClick={() => setTab("activity")}
            >
              Activity
            </button>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-black">✕</button>
        </div>

        <div className="px-4 py-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder={tab === "feeling" ? "Search feelings..." : "Search activities..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto px-2 pb-2">
          {tab === "feeling"
            ? filteredFeelings.map((f) => (
                <button
                  key={f.label}
                  onClick={() => onSelect({ kind: "feeling", value: f.label, emoji: f.emoji })}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-50 text-left"
                >
                  <span className="text-xl w-6 text-center">{f.emoji}</span>
                  <span className="text-sm">{f.label}</span>
                </button>
              ))
            : filteredActivities.map((a) => (
                <button
                  key={`${a.typeLabel}-${a.label}`}
                  onClick={() =>
                    onSelect({ kind: "activity", value: a.label, emoji: a.emoji, typeLabel: a.typeLabel || "" })
                  }
                  className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-50 text-left"
                >
                  <span className="text-xl w-6 text-center">{a.emoji}</span>
                  <span className="text-sm">
                    <span className="text-gray-600">{a.typeLabel} </span>
                    {a.label}
                  </span>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
};

export default FeelingPicker;

