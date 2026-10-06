import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { ConnectForm } from "@/components/connect/ConnectForm";
import { CopyButton } from "@/components/ui/CopyButton";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { requireUser } from "@/lib/auth/current-user";
import { getActiveCoupleForUser } from "@/lib/services/couple-service";

export const metadata = { title: "Connect with your person" };

export default async function ConnectPage() {
  const user = await requireUser();
  if (await getActiveCoupleForUser(user._id)) redirect("/chat");

  return (
    <AuthShell footer={<LogoutButton className="mx-auto" />}>
      <div className="text-center">
        <h1 className="font-serif text-2xl text-mist">
          Connect with your person <span className="text-rose-soft">♡</span>
        </h1>
        <p className="mt-1 text-sm text-mist-dim">Hi {user.name}. Who&apos;s on the other side?</p>
      </div>

      <div className="mt-6">
        <ConnectForm />
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-mist-dim">
        Only one person can be connected to your account.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-white/6 bg-ink-900/50 p-4 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-mist-dim">Your TwoChat ID</p>
          <p className="font-mono text-lg font-semibold tracking-[0.2em] text-teal-soft">{user.connectionId}</p>
        </div>
        <CopyButton id="copy-own-connection-id" value={user.connectionId} isConnectionId={true} />
      </div>
    </AuthShell>
  );
}
