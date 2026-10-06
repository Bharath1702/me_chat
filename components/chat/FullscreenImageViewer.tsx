"use client";

import { useEffect, useState } from "react";

interface FullscreenImageViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function FullscreenImageViewer({ src, alt = "Image", onClose }: FullscreenImageViewerProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-up"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-mist hover:bg-white/20 transition"
      >
        ✕
      </button>

      <div
        className="relative max-h-full max-w-full overflow-hidden flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-soft border-r-transparent" />
          </div>
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          className={`max-h-[90dvh] max-w-[90vw] object-contain rounded-2xl transition-opacity duration-300 ${
            loading ? "opacity-0" : "opacity-100"
          }`}
        />
      </div>
    </div>
  );
}
