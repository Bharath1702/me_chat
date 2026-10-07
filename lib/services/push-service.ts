import webpush from "web-push";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { PushSubscription, type PushSubscriptionDocument } from "@/models/PushSubscription";
import { User, type UserDocument } from "@/models/User";
import { AppError } from "@/lib/utils/errors";
import type { PublicMessage } from "./message-service";

// Fallback VAPID keys generated in-memory for testing/development if process.env is unset
let fallbackVapidKeys: { publicKey: string; privateKey: string } | null = null;

function getVapidDetails() {
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@mechat.app";

  if (!publicKey || !privateKey) {
    if (!fallbackVapidKeys) {
      fallbackVapidKeys = webpush.generateVAPIDKeys();
    }
    publicKey = fallbackVapidKeys.publicKey;
    privateKey = fallbackVapidKeys.privateKey;
  }

  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string {
  return getVapidDetails().publicKey;
}

function configureWebPush() {
  const { publicKey, privateKey, subject } = getVapidDetails();
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export type SubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
  deviceName?: string | null;
};

export async function registerPushSubscriptionService(
  authenticatedUserId: Types.ObjectId,
  input: SubscriptionInput
): Promise<{ success: boolean; subscriptionId: string }> {
  if (!input || !input.endpoint || typeof input.endpoint !== "string") {
    throw new AppError("VALIDATION", "Invalid subscription endpoint.", 400);
  }
  if (!input.keys || typeof input.keys.p256dh !== "string" || typeof input.keys.auth !== "string") {
    throw new AppError("VALIDATION", "Invalid subscription keys.", 400);
  }
  if (!input.endpoint.startsWith("http://") && !input.endpoint.startsWith("https://")) {
    throw new AppError("VALIDATION", "Subscription endpoint must be a valid HTTP(S) URL.", 400);
  }

  await connectToDatabase();

  const filter = { userId: authenticatedUserId, endpoint: input.endpoint };
  const update = {
    userId: authenticatedUserId,
    endpoint: input.endpoint,
    keys: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
    userAgent: input.userAgent || null,
    deviceName: input.deviceName || null,
    lastUsedAt: new Date(),
  };

  const doc = await PushSubscription.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  return { success: true, subscriptionId: doc._id.toString() };
}

export async function unregisterPushSubscriptionService(
  authenticatedUserId: Types.ObjectId,
  endpoint: string
): Promise<{ success: boolean }> {
  if (!endpoint || typeof endpoint !== "string") {
    throw new AppError("VALIDATION", "Invalid subscription endpoint.", 400);
  }

  await connectToDatabase();

  await PushSubscription.deleteOne({
    userId: authenticatedUserId,
    endpoint,
  });

  return { success: true };
}

export type PushNotificationPayload = {
  type: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    messageId?: string;
    senderId?: string;
    [key: string]: unknown;
  };
};

export async function sendPushNotificationToUser(
  userId: Types.ObjectId | string,
  payload: PushNotificationPayload
): Promise<{ sentCount: number; failedCount: number }> {
  await connectToDatabase();

  const subscriptions = await PushSubscription.find({ userId }).lean<PushSubscriptionDocument[]>();
  if (!subscriptions || subscriptions.length === 0) {
    return { sentCount: 0, failedCount: 0 };
  }

  configureWebPush();

  let sentCount = 0;
  let failedCount = 0;
  const payloadString = JSON.stringify(payload);

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, payloadString);
      sentCount++;
      // Update lastUsedAt asynchronously
      PushSubscription.updateOne({ _id: sub._id }, { lastUsedAt: new Date() }).catch(() => {});
    } catch (err: unknown) {
      failedCount++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // Stale / Expired subscriptions (404 Not Found or 410 Gone) must be removed
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      }
    }
  }

  return { sentCount, failedCount };
}

export async function sendTestNotificationService(
  authenticatedUserId: Types.ObjectId
): Promise<{ sentCount: number; failedCount: number }> {
  return await sendPushNotificationToUser(authenticatedUserId, {
    type: "test",
    title: "TwoChat Test Notification",
    body: "Push notifications are working perfectly on this device! 🎉",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: {
      url: "/chat",
    },
  });
}

export function formatPushBody(
  message: PublicMessage,
  showPreview = true
): string {
  if (!showPreview) {
    return "New message";
  }

  if (message.type === "image") {
    return "📷 Photo";
  }
  if (message.type === "audio") {
    return "🎙️ Voice message";
  }
  if (message.type === "call") {
    return "📞 Call";
  }

  const content = message.content ? message.content.trim() : "";
  if (!content) {
    return "New message";
  }
  return content.length > 150 ? `${content.slice(0, 147)}...` : content;
}

export async function triggerMessagePushNotification(
  message: PublicMessage
): Promise<{ sentCount: number; failedCount: number }> {
  await connectToDatabase();

  const [sender, receiver] = await Promise.all([
    User.findById(message.senderId).lean<UserDocument>(),
    User.findById(message.receiverId).lean<UserDocument>(),
  ]);

  const senderName = sender?.name || "TwoChat";
  const showPreview = receiver?.notificationPreview !== false;
  const bodyText = formatPushBody(message, showPreview);

  return await sendPushNotificationToUser(message.receiverId, {
    type: "new_message",
    title: senderName,
    body: bodyText,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: {
      url: "/chat",
      messageId: message.id,
      senderId: message.senderId,
    },
  });
}
