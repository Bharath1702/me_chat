"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";

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

  if (!isOpen) return null;

  const initial = currentUserName ? currentUserName.charAt(0).toUpperCase() : "U";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md p-4 animate-fade-up">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden p-6 space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute top-5 right-5 text-mist-dim hover:text-mist text-lg h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 transition"
        >
          ✕
        </button>

        {/* Profile Card Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-teal-soft via-teal-deep to-plum font-bold text-ink-950 text-3xl shadow-lg border-2 border-white/20">
              {initial}
            </div>
            <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-teal-soft ring-4 ring-ink-900" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif text-mist">{currentUserName}</h2>
            <p className="text-xs text-mist-dim mt-0.5">Connected with {partnerName} ❤️</p>
          </div>
        </div>

        {/* Settings Section */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <h3 className="text-xs font-semibold text-mist-dim uppercase tracking-wider px-1">Settings</h3>
          
          {/* Theme Switcher */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition">
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
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition">
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
        </div>

        {/* Logout Section */}
        <div className="pt-2 border-t border-white/10">
          <LogoutButton className="w-full justify-center py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-soft font-semibold rounded-2xl border border-rose-500/20 transition" />
        </div>
      </div>
    </div>
  );
}
