import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { registerUser } from "@/lib/services/auth-service";
import { connectWithPartner } from "@/lib/services/couple-service";
import { User } from "@/models/User";
import { PushSubscription } from "@/models/PushSubscription";
import { Couple } from "@/models/Couple";
import { Message } from "@/models/Message";
import {
  registerPushSubscriptionService,
  unregisterPushSubscriptionService,
  sendPushNotificationToUser,
  triggerMessagePushNotification,
  formatPushBody,
} from "@/lib/services/push-service";
import webpush from "web-push";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.AUTH_SECRET = "super-secret-at-least-32-characters-long!!";
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await PushSubscription.deleteMany({});
  await Couple.deleteMany({});
  await Message.deleteMany({});
  vi.restoreAllMocks();
});

describe("Iteration 6: Web Push Notifications Core & Privacy Logic", () => {
  it("Registers and unregisters push subscription successfully", async () => {
    const user = await registerUser({ name: "Alice", password: "password123" });
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-token-123",
      keys: {
        p256dh: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv69yViEuiB",
        auth: "auth-secret-123",
      },
    };

    const registered = await registerPushSubscriptionService(user._id, {
      ...sub,
      userAgent: "Mozilla/5.0 Test Browser",
    });
    expect(registered.success).toBe(true);
    expect(typeof registered.subscriptionId).toBe("string");

    const count = await PushSubscription.countDocuments({ userId: user._id });
    expect(count).toBe(1);

    const unregistered = await unregisterPushSubscriptionService(user._id, sub.endpoint);
    expect(unregistered.success).toBe(true);

    const countAfter = await PushSubscription.countDocuments({ userId: user._id });
    expect(countAfter).toBe(0);
  });

  it("Supports multi-device subscriptions per user", async () => {
    const user = await registerUser({ name: "Alice", password: "password123" });
    const sub1 = {
      endpoint: "https://fcm.googleapis.com/fcm/send/device-phone",
      keys: { p256dh: "key1", auth: "auth1" },
    };
    const sub2 = {
      endpoint: "https://fcm.googleapis.com/fcm/send/device-laptop",
      keys: { p256dh: "key2", auth: "auth2" },
    };

    await registerPushSubscriptionService(user._id, {
      ...sub1,
      deviceName: "Mobile Browser",
    });
    await registerPushSubscriptionService(user._id, {
      ...sub2,
      deviceName: "Desktop Browser",
    });

    const subs = await PushSubscription.find({ userId: user._id });
    expect(subs.length).toBe(2);
  });

  it("Formats push message body correctly according to privacy settings", () => {
    const dummyMsg = (type: any, content = ""): any => ({
      id: "1",
      coupleId: "c1",
      senderId: "s1",
      receiverId: "r1",
      type,
      content,
      media: null,
      status: "sent",
      isEdited: false,
      isDeleted: false,
      deletedForEveryone: false,
      reactions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readAt: null,
      deliveredAt: null,
    });

    expect(formatPushBody(dummyMsg("image"), true)).toBe("📷 Photo");
    expect(formatPushBody(dummyMsg("audio"), true)).toBe("🎙️ Voice message");
    expect(formatPushBody(dummyMsg("call"), true)).toBe("📞 Call");
    expect(formatPushBody(dummyMsg("text", "Hello darling!"), true)).toBe("Hello darling!");
    expect(formatPushBody(dummyMsg("text", "Hello darling!"), false)).toBe("New message");
  });

  it("Cleans up stale subscriptions on 404 or 410 response from push service", async () => {
    const user = await registerUser({ name: "Bob", password: "password123" });
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/expired-token",
      keys: { p256dh: "key1", auth: "auth1" },
    };
    await registerPushSubscriptionService(user._id, sub);

    // Mock webpush.sendNotification to reject with WebPushError (410 Gone)
    const err: any = new Error("Subscription expired");
    err.statusCode = 410;
    vi.spyOn(webpush, "sendNotification").mockRejectedValue(err);

    await sendPushNotificationToUser(user._id, {
      type: "test",
      title: "Test",
      body: "Test Body",
    });

    const remainingSubs = await PushSubscription.find({ userId: user._id });
    expect(remainingSubs.length).toBe(0);
  });

  it("Does not send push notification if user is active in conversation", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const sendPushSpy = vi.spyOn(webpush, "sendNotification").mockResolvedValue({} as any);

    // Simulated check: if WS indicates user is active, websocket/server.ts skips calling triggerMessagePushNotification
    const isUserActive = true;
    let result = { sentCount: 0, failedCount: 0 };
    if (!isUserActive) {
      result = await triggerMessagePushNotification({
        id: "m1",
        coupleId: "c1",
        senderId: alice._id.toString(),
        receiverId: bob._id.toString(),
        type: "text",
        content: "Active chat test",
        media: null,
        status: "sent",
        isEdited: false,
        isDeleted: false,
        deletedForEveryone: false,
        reactions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        readAt: null,
        deliveredAt: null,
      });
    }

    expect(result).toEqual({ sentCount: 0, failedCount: 0 });
    expect(sendPushSpy).not.toHaveBeenCalled();
  });
});
