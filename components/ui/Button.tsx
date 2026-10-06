import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-soft disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-teal-soft to-teal-deep text-ink-950 shadow-[0_8px_30px_-10px_rgb(111_220_203/0.6)] hover:brightness-110 hover:-translate-y-px active:translate-y-0",
  secondary: "glass text-mist hover:border-white/15 hover:bg-ink-700/80",
  ghost: "text-mist-dim hover:text-mist hover:bg-white/5",
};

export function buttonClasses(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  id,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Link href={href} id={id} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
