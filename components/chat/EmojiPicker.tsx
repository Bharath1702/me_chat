"use client";

import { useState, useEffect, useRef } from "react";

const EMOJI_CATEGORIES = [
  {
    name: "Frequently Used",
    emojis: ["❤️", "😘", "🥰", "😍", "😊", "🥹", "🤍", "✨", "🔥", "😂", "😭", "👍", "🙏", "🙈"],
  },
  {
    name: "Smileys & Romance",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥹", "☺️", "😊", "😇", "🙂", "🙃", "😉",
      "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓",
      "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫",
    ],
  },
  {
    name: "Hearts & Love",
    emojis: [
      "❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🤎", "🖤", "🩶", "🤍", "💔", "❤️‍🔥", "❤️‍🩹",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "👩‍❤️‍👨", "👩‍❤️‍👩", "👨‍❤️‍👨", "👩‍❤️‍💋‍👨", "👩‍❤️‍💋‍👩",
    ],
  },
  {
    name: "Gestures & Celebrations",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈",
      "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐",
      "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🎉", "🎊", "🥳", "🎂", "🎈", "🎁", "🥂", "🍾",
    ],
  },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelectEmoji, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-14 left-0 z-50 w-72 sm:w-80 rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              className={`px-2 py-1 text-xs rounded-lg transition font-medium whitespace-nowrap ${
                activeCategory === idx
                  ? "bg-teal-soft/20 text-teal-soft border border-teal-soft/30"
                  : "text-mist-dim hover:text-mist hover:bg-white/5"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-mist-dim hover:text-mist text-sm font-semibold px-1"
        >
          ✕
        </button>
      </div>

      {/* Emoji Grid */}
      <div className="h-48 overflow-y-auto no-scrollbar grid grid-cols-7 gap-1 p-1">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-xl hover:bg-white/10 transition active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
