"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormAlert, Input } from "@/components/ui/Input";
import { postJson } from "@/lib/utils/api-client";
import { connectSchema } from "@/lib/validation/schemas";
import type { PartnerInfo } from "@/types";

export function ConnectForm() {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = connectSchema.safeParse({ connectionId: String(data.get("connectionId") ?? "") });

    setFormError(null);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);

    setLoading(true);
    const result = await postJson<{ partner: PartnerInfo }>("/api/connect", parsed.data);
    if (!result.ok) {
      setLoading(false);
      if (result.code === "UNAUTHORIZED") {
        router.replace("/login");
        return;
      }
      setFormError(result.error);
      return;
    }
    router.replace("/chat");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <Input
        id="partner-connection-id"
        name="connectionId"
        label="Enter their TwoChat ID"
        placeholder="ABC-9K2P"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="text-center font-mono text-lg uppercase tracking-[0.25em]"
        error={fieldError}
      />
      <Button id="connect-submit" type="submit" className="w-full" loading={loading}>
        Connect
      </Button>
    </form>
  );
}
