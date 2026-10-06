import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/connect");
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
