import { useTheme } from "@/components/theme/ThemeProvider";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserName: string;
  partnerName: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentUserName,
  partnerName,
  soundEnabled,
  onToggleSound,
}: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const {
    permission,
    isSubscribed,
    loading: pushLoading,
    showPreview,
    error: pushError,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    toggleNotificationPreview,
  } = usePushNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-serif font-semibold text-mist">Settings & Profile</h2>
          <button onClick={onClose} className="text-mist-dim hover:text-mist text-lg">
            ✕
          </button>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-soft to-plum font-bold text-ink-950 text-xl">
            {currentUserName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-mist text-base">{currentUserName}</h3>
            <p className="text-xs text-mist-dim">Connected with {partnerName}</p>
          </div>
        </div>

        {/* Settings Options */}
        <div className="space-y-4">
          {/* Theme Switcher */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <p className="text-sm font-medium text-mist">Appearance</p>
              <p className="text-xs text-mist-dim">Current mode: {theme}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-mist transition"
            >
              Toggle {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>

          {/* Sound Notification Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <p className="text-sm font-medium text-mist">Message Sound</p>
              <p className="text-xs text-mist-dim">Play chime on incoming messages</p>
            </div>
            <button
              onClick={onToggleSound}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                soundEnabled
                  ? "bg-teal-soft/20 text-teal-soft border border-teal-soft/30"
                  : "bg-white/10 text-mist-dim"
              }`}
            >
              {soundEnabled ? "🔊 Enabled" : "🔇 Muted"}
            </button>
          </div>

          {/* Browser Push Notifications */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-mist">Browser Push Notifications</p>
                <p className="text-xs text-mist-dim">
                  {permission === "denied"
                    ? "Blocked in browser settings"
                    : isSubscribed
                    ? "Active on this device"
                    : "Receive push alerts when backgrounded"}
                </p>
              </div>
              <button
                type="button"
                disabled={pushLoading || permission === "denied"}
                onClick={() => (isSubscribed ? disableNotifications() : enableNotifications())}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  isSubscribed
                    ? "bg-teal-soft/20 text-teal-soft border border-teal-soft/30 hover:bg-teal-soft/30"
                    : "bg-white/10 text-mist-dim hover:bg-white/20"
                }`}
              >
                {pushLoading ? "..." : isSubscribed ? "Enabled" : "Enable"}
              </button>
            </div>

            {pushError && (
              <p className="text-xs text-rose-soft mt-1">{pushError}</p>
            )}

            {isSubscribed && (
              <div className="pt-2 mt-1 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-mist">Message Preview</p>
                  <p className="text-[11px] text-mist-dim">
                    {showPreview ? "Shows message content" : "Shows 'New message' only"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotificationPreview(!showPreview)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-mist transition"
                >
                  {showPreview ? "Text Preview" : "Hide Text"}
                </button>
              </div>
            )}

            {isSubscribed && (
              <button
                type="button"
                disabled={pushLoading}
                onClick={() => sendTestNotification()}
                className="w-full mt-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-mist text-xs font-medium transition text-center"
              >
                {pushLoading ? "Sending..." : "Send Test Notification"}
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-teal-soft to-teal-deep text-ink-950 font-bold text-sm shadow-md hover:brightness-110 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
