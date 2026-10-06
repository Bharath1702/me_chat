import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  // /connect itself forwards to /chat when the user is already connected.
  if (await getCurrentUser()) redirect("/connect");
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
