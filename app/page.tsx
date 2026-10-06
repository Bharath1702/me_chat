import { LogoMark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="bg-aurora relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 py-8 sm:px-12">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="font-serif text-2xl tracking-tight text-mist">twochat</span>
        </div>
        <div className="flex items-center gap-3">
          <ButtonLink href="/login" variant="ghost" id="landing-login">
            Login
          </ButtonLink>
          <ButtonLink href="/register" variant="primary" id="landing-register">
            Create account
          </ButtonLink>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto my-auto max-w-2xl text-center space-y-6 py-12 animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-soft/20 bg-teal-soft/5 px-4 py-1.5 text-xs text-teal-soft font-medium">
          <span>Exactly two people</span>
          <span className="text-mist-dim">•</span>
          <span>No social features</span>
        </div>

        <h1 className="font-serif text-5xl font-normal text-mist sm:text-6xl tracking-tight leading-[1.15]">
          Your private corner.
        </h1>

        <p className="text-xl sm:text-2xl font-light text-mist-dim max-w-lg mx-auto leading-relaxed">
          One connection. Two people. No groups. No noise.
        </p>

        <p className="text-sm text-mist-dim/80 max-w-md mx-auto">
          TwoChat is designed for one private connection between two people.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <ButtonLink href="/register" variant="primary" className="w-full sm:w-auto px-8 py-3.5 text-base" id="hero-get-started">
            Get Started
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="w-full sm:w-auto px-8 py-3.5 text-base" id="hero-login">
            Sign In
          </ButtonLink>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-mist-dim/50 py-4">
        &copy; {new Date().getFullYear()} TwoChat. Built for private 1-to-1 connection.
      </footer>
    </main>
  );
}
