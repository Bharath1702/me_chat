"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserName: string;
  partnerName: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  currentUserName,
  partnerName,
  soundEnabled,
  onToggleSound,
}: ProfileModalProps) {
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

  const initial = currentUserName ? currentUserName.charAt(0).toUpperCase() : "U";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md p-4 animate-fade-up">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden p-6 space-y-5 relative max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute top-5 right-5 text-mist-dim hover:text-mist text-lg h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 transition"
        >
          ✕
        </button>

        {/* Profile Card Header */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-teal-soft via-teal-deep to-plum font-bold text-ink-950 text-2xl shadow-lg border-2 border-white/20">
              {initial}
            </div>
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-teal-soft ring-4 ring-ink-900" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-serif text-mist">{currentUserName}</h2>
            <p className="text-xs text-mist-dim mt-0.5">Connected with {partnerName} ❤️</p>
          </div>
        </div>

        {/* Settings Section */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <h3 className="text-xs font-semibold text-mist-dim uppercase tracking-wider px-1">Settings</h3>
          
          {/* Theme Switcher */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition">
            <div className="flex items-center gap-3">
              <span className="text-base">{theme === "dark" ? "🌙" : "☀️"}</span>
              <div>
                <p className="text-xs font-semibold text-mist">Theme</p>
                <p className="text-[11px] text-mist-dim">{theme === "dark" ? "Dark Mode" : "Light Mode"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-mist transition"
            >
              Toggle
            </button>
          </div>

          {/* Sound Notification Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition">
            <div className="flex items-center gap-3">
              <span className="text-base">{soundEnabled ? "🔊" : "🔇"}</span>
              <div>
                <p className="text-xs font-semibold text-mist">Audio Notifications</p>
                <p className="text-[11px] text-mist-dim">{soundEnabled ? "Sound enabled" : "Muted"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                soundEnabled
                  ? "bg-teal-soft/20 text-teal-soft border border-teal-soft/30 hover:bg-teal-soft/30"
                  : "bg-white/10 text-mist-dim hover:bg-white/20"
              }`}
            >
              {soundEnabled ? "Enabled" : "Muted"}
            </button>
          </div>

          {/* Browser Push Notifications Toggle */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-base">🔔</span>
                <div>
                  <p className="text-xs font-semibold text-mist">Browser Push Notifications</p>
                  <p className="text-[11px] text-mist-dim">
                    {permission === "denied"
                      ? "Blocked in browser settings"
                      : isSubscribed
                      ? "Active on this device"
                      : "Off"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={pushLoading || permission === "denied"}
                onClick={() => (isSubscribed ? disableNotifications() : enableNotifications())}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                  isSubscribed
                    ? "bg-teal-soft/20 text-teal-soft border border-teal-soft/30 hover:bg-teal-soft/30"
                    : "bg-white/10 text-mist-dim hover:bg-white/20"
                }`}
              >
                {pushLoading ? "..." : isSubscribed ? "Enabled" : "Enable"}
              </button>
            </div>

            {pushError && (
              <p className="text-[11px] text-rose-soft mt-1 px-1">{pushError}</p>
            )}

            {/* Notification Preview Privacy Control */}
            {isSubscribed && (
              <div className="pt-2 mt-1 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-mist">Notification Preview</p>
                  <p className="text-[10px] text-mist-dim">
                    {showPreview ? "Shows message content" : "Shows 'New message' only"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotificationPreview(!showPreview)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/20 text-mist transition"
                >
                  {showPreview ? "Text Preview" : "Hide Text"}
                </button>
              </div>
            )}

            {/* Test Notification Button */}
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

        {/* Logout Section */}
        <div className="pt-2 border-t border-white/10">
          <LogoutButton className="w-full justify-center py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-soft font-semibold rounded-2xl border border-rose-500/20 transition" />
        </div>
      </div>
    </div>
  );
}
