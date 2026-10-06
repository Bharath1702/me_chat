import Link from "next/link";

/** Two overlapping rings — one connection, two people. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tc-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6fdccb" />
          <stop offset="1" stopColor="#2fa898" />
        </linearGradient>
        <linearGradient id="tc-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9d8cf0" />
          <stop offset="1" stopColor="#eea6bd" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="16" r="8" fill="none" stroke="url(#tc-a)" strokeWidth="3" />
      <circle cx="20" cy="16" r="8" fill="none" stroke="url(#tc-b)" strokeWidth="3" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-mist" aria-label="TwoChat home">
      <LogoMark />
      <span className="font-serif text-xl tracking-tight">twochat</span>
    </Link>
  );
}
