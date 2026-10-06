"use client";

import { useState } from "react";

export function CopyButton({
  value,
  id,
  label = "Copy Connection Link",
  isConnectionId = false,
}: {
  value: string;
  id: string;
  label?: string;
  isConnectionId?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      let textToCopy = value;
      if (
        isConnectionId ||
        (!value.startsWith("http") && /^[A-Z]{3}-?[A-Z0-9]{4}$/i.test(value.trim()))
      ) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const cleanId = value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const formattedId = cleanId.length === 7 ? `${cleanId.slice(0, 3)}-${cleanId.slice(3)}` : value;
        textToCopy = `${origin}/connect?code=${formattedId}`;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      id={id}
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-mist transition hover:border-teal-soft/40 hover:text-teal-soft"
      aria-live="polite"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-teal-soft" fill="currentColor" aria-hidden="true">
            <path d="M7.7 13.3 4.4 10l-1.4 1.4 4.7 4.7 9.3-9.3-1.4-1.4z" />
          </svg>
          Link Copied!
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="9" width="12" height="12" rx="3" />
            <path d="M5 15V6a3 3 0 0 1 3-3h9" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
