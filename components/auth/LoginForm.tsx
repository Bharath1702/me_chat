"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormAlert, Input } from "@/components/ui/Input";
import { postJson } from "@/lib/utils/api-client";
import { loginSchema } from "@/lib/validation/schemas";

type FieldErrors = { connectionId?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCode = searchParams.get("code") || searchParams.get("connect");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      connectionId: String(data.get("connectionId") ?? ""),
      password: String(data.get("password") ?? ""),
    });

    setFormError(null);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    setLoading(true);
    const result = await postJson<{ redirectTo: string }>("/api/auth/login", parsed.data);
    if (!result.ok) {
      setLoading(false);
      setFormError(result.error);
      return;
    }
    router.replace(result.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="text-center">
        <h1 className="font-serif text-2xl text-mist">Welcome back</h1>
        <p className="mt-1 text-sm text-mist-dim">Your corner is waiting.</p>
      </div>
      <FormAlert message={formError} />
      <Input
        id="login-connection-id"
        name="connectionId"
        label="Connection ID"
        placeholder="AHN-7K2M"
        autoComplete="username"
        autoCapitalize="characters"
        spellCheck={false}
        className="font-mono uppercase tracking-widest"
        error={errors.connectionId}
      />
      <Input
        id="login-password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password}
      />
      <Button id="login-submit" type="submit" className="w-full" loading={loading}>
        Login
      </Button>
      <p className="text-center text-sm text-mist-dim">
        Don&apos;t have an account?{" "}
        <Link href={rawCode ? `/register?code=${rawCode}` : "/register"} className="font-medium text-teal-soft hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
