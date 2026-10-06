import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Centered card layout shared by login / register / connect. */
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="bg-aurora relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden="true"
        className="animate-float pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-plum/10 blur-3xl"
      />
      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <section className="glass rounded-3xl p-6 shadow-2xl shadow-black/40 sm:p-8">{children}</section>
        {footer && <div className="mt-6 text-center text-sm text-mist-dim">{footer}</div>}
      </div>
    </main>
  );
}
