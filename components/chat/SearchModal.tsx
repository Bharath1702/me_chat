"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicMessage } from "@/lib/services/message-service";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
}

export function SearchModal({ isOpen, onClose, onSelectMessage }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.messages) {
          setResults(data.messages);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-ink-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 bg-ink-950/50">
          <span className="text-mist-dim text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversation..."
            className="flex-1 bg-transparent text-mist placeholder:text-mist-dim/50 text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-mist-dim hover:text-mist text-xs font-semibold px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-mist-dim hover:text-mist text-sm font-semibold px-2 py-1"
          >
            Close
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
          {loading && (
            <div className="p-8 text-center text-sm text-mist-dim animate-pulse">
              Searching messages...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-sm text-mist-dim">
              No messages matching &quot;{query}&quot;
            </div>
          )}

          {!loading &&
            results.map((msg) => (
              <button
                key={msg.id}
                onClick={() => {
                  onSelectMessage(msg.id);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-2xl hover:bg-white/5 transition border border-transparent hover:border-white/5 flex flex-col gap-1 group"
              >
                <div className="flex items-center justify-between text-xs text-mist-dim">
                  <span className="font-semibold text-teal-soft">
                    {msg.type === "image" ? "📷 Photo" : msg.type === "audio" ? "🎙️ Audio" : "Message"}
                  </span>
                  <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-mist line-clamp-2 group-hover:text-white transition">
                  {msg.content}
                </p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
