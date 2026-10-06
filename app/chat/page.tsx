import { redirect } from "next/navigation";
import { ChatShell } from "@/components/chat/ChatShell";
import { requireUser } from "@/lib/auth/current-user";
import { getPartner } from "@/lib/services/couple-service";

export const metadata = { title: "Private Chat" };

export default async function ChatPage() {
  const user = await requireUser();
  const partner = await getPartner(user._id);

  if (!partner) {
    redirect("/connect");
  }

  return (
    <ChatShell
      currentUserId={user._id.toString()}
      currentUserName={user.name}
      partnerName={partner.name}
    />
  );
}
