"use client";

import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type UsePushNotificationsReturn = {
  permission: NotificationPermission;
  isSubscribed: boolean;
  loading: boolean;
  showPreview: boolean;
  error: string | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  toggleNotificationPreview: (show: boolean) => Promise<void>;
};

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize permission, service worker subscription status, and user preview setting
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    // Register service worker if supported
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        if ("pushManager" in reg) {
          reg.pushManager.getSubscription().then((sub) => {
            setIsSubscribed(!!sub);
          });
        }
      }).catch((err) => {
        console.warn("[usePushNotifications] Service worker registration error:", err);
      });
    }

    // Fetch user notification settings
    fetch("/api/me/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.settings) {
          setShowPreview(data.settings.notificationPreview ?? true);
        }
      })
      .catch(() => {});
  }, []);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setError("Browser notifications are not supported on this device.");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Explicit user gesture permission request
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Notification permission was denied.");
        setLoading(false);
        return false;
      }

      // Step 2: Service worker registration
      const reg = await navigator.serviceWorker.ready;
      if (!("pushManager" in reg)) {
        setError("Push manager is not supported in this browser.");
        setLoading(false);
        return false;
      }

      // Step 3: Fetch VAPID public key from backend
      const keyRes = await fetch("/api/push/vapid-public-key");
      const keyData = await keyRes.json();
      if (!keyData.ok || !keyData.publicKey) {
        throw new Error(keyData.error || "Failed to fetch VAPID key.");
      }

      // Step 4: Obtain browser PushSubscription
      const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        });
      }

      const subJson = sub.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid push subscription output from browser.");
      }

      // Step 5: Send subscription to server
      const subRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      const subData = await subRes.json();
      if (!subData.ok) {
        throw new Error(subData.error || "Failed to save subscription on server.");
      }

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err: unknown) {
      console.error("[usePushNotifications] Enable error:", err);
      const msg = err instanceof Error ? err.message : "Failed to enable notifications.";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  const disableNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (err: unknown) {
      console.error("[usePushNotifications] Disable error:", err);
      const msg = err instanceof Error ? err.message : "Failed to disable notifications.";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      setLoading(false);
      if (!data.ok) {
        setError(data.error || "Failed to send test notification.");
        return false;
      }
      return true;
    } catch (err: unknown) {
      console.error("[usePushNotifications] Test error:", err);
      const msg = err instanceof Error ? err.message : "Failed to send test notification.";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  const toggleNotificationPreview = useCallback(async (show: boolean): Promise<void> => {
    setShowPreview(show);
    try {
      await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreview: show }),
      });
    } catch (err) {
      console.error("[usePushNotifications] Toggle preview error:", err);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    loading,
    showPreview,
    error,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    toggleNotificationPreview,
  };
}
