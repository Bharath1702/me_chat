import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

export function Input({ id, label, error, hint, className = "", ...rest }: InputProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-mist">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-2xl border bg-ink-900/70 px-4 py-3 text-base text-mist placeholder:text-mist-dim/60 transition-colors focus:outline-none focus:ring-2 sm:text-sm ${
          error
            ? "border-rose-soft/60 focus:ring-rose-soft/30"
            : "border-white/8 focus:border-teal-soft/50 focus:ring-teal-soft/20"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-soft">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-mist-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="animate-fade-up rounded-2xl border border-rose-soft/25 bg-rose-soft/8 px-4 py-3 text-sm text-rose-soft"
    >
      {message}
    </div>
  );
}
