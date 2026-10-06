"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormAlert, Input } from "@/components/ui/Input";
import { postJson } from "@/lib/utils/api-client";
import { connectSchema, normalizeConnectionId } from "@/lib/validation/schemas";
import type { PartnerInfo } from "@/types";

export function ConnectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCode = searchParams.get("code") || searchParams.get("connect");

  const [connectionIdVal, setConnectionIdVal] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rawCode) {
      setConnectionIdVal(normalizeConnectionId(rawCode));
    }
  }, [rawCode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawVal = String(data.get("connectionId") ?? connectionIdVal);
    const parsed = connectSchema.safeParse({ connectionId: rawVal });

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
      {rawCode && (
        <div className="p-3 rounded-2xl bg-teal-soft/10 border border-teal-soft/30 text-teal-soft text-xs font-medium text-center">
          💌 Direct invite link detected! TwoChat ID pre-filled below.
        </div>
      )}
      <Input
        id="partner-connection-id"
        name="connectionId"
        label="Enter their TwoChat ID or Paste Invite Link"
        placeholder="ABC-9K2P or https://..."
        value={connectionIdVal}
        onChange={(e) => setConnectionIdVal(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="text-center font-mono text-lg uppercase tracking-[0.15em]"
        error={fieldError}
      />
      <Button id="connect-submit" type="submit" className="w-full" loading={loading}>
        {rawCode ? "Connect Directly Now" : "Connect"}
      </Button>
    </form>
  );
}
