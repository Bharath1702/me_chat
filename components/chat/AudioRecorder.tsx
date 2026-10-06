"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AudioRecorderProps {
  onConfirm: (blob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
  maxDurationSeconds?: number;
}

export function AudioRecorder({
  onConfirm,
  onCancel,
  maxDurationSeconds = 120, // 2 minutes limit
}: AudioRecorderProps) {
  const [status, setStatus] = useState<"recording" | "preview">("recording");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function initRecorder() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setPermissionError("Audio recording is not supported in this browser.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let mimeType = "audio/webm";
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setRecordedBlob(blob);
          setAudioUrl(url);
          setStatus("preview");
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
        };

        recorder.start(100);

        timerRef.current = setInterval(() => {
          setElapsed((prev) => {
            if (prev >= maxDurationSeconds - 1) {
              stopRecording();
              return maxDurationSeconds;
            }
            return prev + 1;
          });
        }, 1000);
      } catch (err) {
        console.error("[AudioRecorder] Error acquiring microphone:", err);
        setPermissionError("Microphone access was denied. You can still send text and photos.");
      }
    }

    initRecorder();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [maxDurationSeconds, stopRecording]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  const handleSend = () => {
    if (recordedBlob) {
      onConfirm(recordedBlob, elapsed);
    }
  };

  if (permissionError) {
    return (
      <div className="flex items-center justify-between glass rounded-2xl p-3 border border-rose-soft/30 text-rose-soft text-xs">
        <span>{permissionError}</span>
        <button type="button" onClick={onCancel} className="underline ml-2">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between glass rounded-2xl px-4 py-2.5 border border-teal-soft/30 animate-fade-up">
      {status === "recording" ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono text-sm font-semibold text-mist">{formatTime(elapsed)}</span>
            <span className="text-xs text-mist-dim hidden sm:inline">Recording audio message...</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-mist-dim hover:text-mist rounded-xl hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-1.5 text-xs font-medium bg-rose-500/80 text-white rounded-xl hover:bg-rose-500 transition"
            >
              Stop
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              onClick={() => {
                if (audioPreviewRef.current) {
                  if (isPlayingPreview) {
                    audioPreviewRef.current.pause();
                  } else {
                    audioPreviewRef.current.play();
                  }
                  setIsPlayingPreview(!isPlayingPreview);
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft/20 text-teal-soft"
            >
              {isPlayingPreview ? "❚❚" : "▶"}
            </button>
            <span className="font-mono text-sm text-mist">{formatTime(elapsed)}</span>
            {audioUrl && (
              <audio
                ref={audioPreviewRef}
                src={audioUrl}
                onEnded={() => setIsPlayingPreview(false)}
                className="hidden"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-mist-dim hover:text-mist rounded-xl hover:bg-white/5"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-teal-soft to-teal-deep text-ink-950 rounded-xl hover:brightness-110 shadow-md"
            >
              Send Voice
            </button>
          </div>
        </>
      )}
    </div>
  );
}
