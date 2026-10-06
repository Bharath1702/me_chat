/** Plain POST form: works without JavaScript and the route responds with a 303 to /login. */
export function LogoutButton({ className = "", id = "logout-button" }: { className?: string; id?: string }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        id={id}
        type="submit"
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-mist-dim transition hover:bg-white/5 hover:text-mist ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
        </svg>
        <span>Log out</span>
      </button>
    </form>
  );
}
