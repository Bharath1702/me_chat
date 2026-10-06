"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { FormAlert, Input } from "@/components/ui/Input";
import { postJson } from "@/lib/utils/api-client";
import { nameSchema, passwordSchema, PASSWORD_MIN_LENGTH, normalizeConnectionId } from "@/lib/validation/schemas";
import type { PublicUser } from "@/types";

type FieldErrors = { name?: string; password?: string };

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCode = searchParams.get("code") || searchParams.get("connect");
  const inviteCode = rawCode ? normalizeConnectionId(rawCode) : null;

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<PublicUser | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = nameSchema.safeParse(String(data.get("name") ?? ""));
    const password = passwordSchema.safeParse(String(data.get("password") ?? ""));

    const next: FieldErrors = {
      name: name.success ? undefined : name.error.issues[0]?.message,
      password: password.success ? undefined : password.error.issues[0]?.message,
    };
    setErrors(next);
    setFormError(null);
    if (!name.success || !password.success) return;

    setLoading(true);
    const result = await postJson<{ user: PublicUser }>("/api/auth/register", {
      name: name.data,
      password: password.data,
    });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setCreated(result.user);
  }

  if (created) {
    return (
      <div className="animate-fade-up text-center">
        <p className="text-sm text-mist-dim">Welcome, {created.name}</p>
        <h1 className="mt-1 font-serif text-2xl text-mist">Your TwoChat ID</h1>
        <div className="mt-6 rounded-2xl border border-teal-soft/20 bg-ink-900/70 px-4 py-6">
          <p id="connection-id-display" className="font-mono text-3xl font-semibold tracking-[0.2em] text-gradient sm:text-4xl">
            {created.connectionId}
          </p>
          <div className="mt-4 flex justify-center">
            <CopyButton id="copy-connection-id" value={created.connectionId} isConnectionId={true} />
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-mist-dim">
          This is your private connection ID.
          <br />
          Share it only with the person you want to connect with.
        </p>
        <p className="mt-2 text-xs text-mist-dim/80">You&apos;ll also use it to log in — keep it somewhere safe.</p>
        <Button
          id="continue-to-connect"
          className="mt-6 w-full"
          onClick={() => {
            const targetUrl = inviteCode ? `/connect?code=${inviteCode}` : "/connect";
            router.replace(targetUrl);
            router.refresh();
          }}
        >
          {inviteCode ? `Connect Directly with Partner (${inviteCode})` : "Continue"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="text-center">
        <h1 className="font-serif text-2xl text-mist">Create your account</h1>
        <p className="mt-1 text-sm text-mist-dim">A quiet place, just for two.</p>
        {inviteCode && (
          <div className="mt-3 p-3 rounded-2xl bg-teal-soft/10 border border-teal-soft/30 text-teal-soft text-xs font-medium">
            💌 You were invited! After creating your account, you will connect directly with partner ID <span className="font-mono font-bold">{inviteCode}</span>.
          </div>
        )}
      </div>
      <FormAlert message={formError} />
      <Input id="register-name" name="name" label="Name" placeholder="Ahaan" autoComplete="nickname" maxLength={40} error={errors.name} />
      <Input
        id="register-password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={errors.password}
      />
      <Button id="register-submit" type="submit" className="w-full" loading={loading}>
        Create Account & Connect
      </Button>
      <p className="text-center text-sm text-mist-dim">
        Already have an account?{" "}
        <Link href={inviteCode ? `/login?code=${inviteCode}` : "/login"} className="font-medium text-teal-soft hover:underline">
          Login
        </Link>
      </p>
    </form>
  );
}
