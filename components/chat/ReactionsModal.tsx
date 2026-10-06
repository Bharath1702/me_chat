"use client";

import type { PublicReaction } from "@/lib/services/message-service";

interface ReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: PublicReaction[];
  currentUserId: string;
  currentUserName: string;
  partnerName: string;
  onRemoveReaction: (emoji: string) => void;
}

export function ReactionsModal({
  isOpen,
  onClose,
  reactions,
  currentUserId,
  currentUserName,
  partnerName,
  onRemoveReaction,
}: ReactionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-up">
      <div className="w-full max-w-xs rounded-3xl border border-white/10 bg-ink-900/95 p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-semibold text-mist text-base flex items-center gap-2">
            <span>Reactions</span>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-mist-dim font-normal">
              {reactions.length}
            </span>
          </h3>
          <button
            onClick={onClose}
            className="text-mist-dim hover:text-mist text-lg font-bold px-2"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
          {reactions.map((r, index) => {
            const isMe = r.userId === currentUserId;
            const userName = isMe ? currentUserName : partnerName;

            return (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{r.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-mist">
                      {userName} {isMe && <span className="text-xs text-teal-soft font-normal">(You)</span>}
                    </p>
                    <p className="text-[10px] text-mist-dim">
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {isMe && (
                  <button
                    onClick={() => {
                      onRemoveReaction(r.emoji);
                    }}
                    className="text-xs text-rose-soft hover:underline px-2 py-1 rounded-xl hover:bg-rose-soft/10 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
