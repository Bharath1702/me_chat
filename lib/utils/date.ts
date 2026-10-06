/**
 * Format timestamp into 12-hour local time with AM/PM (e.g. "05:14 PM").
 */
export function formatLocalTime(isoString: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/**
 * Returns WhatsApp-style date divider label (e.g. "Today", "Yesterday", "2 days ago", or "Oct 3, 2026").
 */
export function getDateDividerLabel(isoString: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();

    // Reset time components for accurate calendar day difference comparison
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = today.getTime() - targetDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

/**
 * Groups array of messages into date-divided sections based on calendar day.
 */
export function groupMessagesByDate<T extends { createdAt: string }>(messages: T[]) {
  const groups: { label: string; dateKey: string; messages: T[] }[] = [];
  let currentGroup: { label: string; dateKey: string; messages: T[] } | null = null;

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const label = getDateDividerLabel(msg.createdAt);

    if (!currentGroup || currentGroup.dateKey !== dateKey) {
      currentGroup = { label, dateKey, messages: [msg] };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(msg);
    }
  }

  return groups;
}
