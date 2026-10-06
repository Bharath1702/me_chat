"use client";

import { useState, useRef, useEffect } from "react";

interface CustomAudioPlayerProps {
  src: string;
  duration?: number | null;
  isMe?: boolean;
}

export function CustomAudioPlayer({ src, duration, isMe }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder.toString().padStart(2, "0")}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 p-1 w-48 sm:w-64 max-w-full ${isMe ? "text-ink-950" : "text-mist"}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause audio message" : "Play audio message"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition shadow-sm ${
          isMe
            ? "bg-ink-950/20 text-ink-950 hover:bg-ink-950/30"
            : "bg-teal-soft/20 text-teal-soft hover:bg-teal-soft/30"
        }`}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${
            isMe ? "bg-ink-950/20" : "bg-white/10"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              isMe ? "bg-ink-950" : "bg-teal-soft"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className={`flex justify-between text-[11px] font-mono opacity-75`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}
