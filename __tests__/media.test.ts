import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { registerUser } from "@/lib/services/auth-service";
import { connectWithPartner } from "@/lib/services/couple-service";
import {
  sendMessageService,
  generateUploadAuthorizationService,
} from "@/lib/services/message-service";
import { User } from "@/models/User";
import { Couple } from "@/models/Couple";
import { Message } from "@/models/Message";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.AUTH_SECRET = "super-secret-at-least-32-characters-long!!";
  process.env.R2_ACCOUNT_ID = "mock-account-id";
  process.env.R2_ACCESS_KEY_ID = "mock-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "mock-secret-key";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_PUBLIC_URL = "https://pub-r2.dev";
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Couple.deleteMany({});
  await Message.deleteMany({});
});

describe("Iteration 3: Media Uploads & Security Integration Tests", () => {
  it("Generates secure media upload authorization key for authenticated couple", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    const couple = await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const authResult = await generateUploadAuthorizationService(
      alice._id,
      "image",
      "image/jpeg",
      1024 * 500
    );

    expect(authResult.storageKey).toContain(`couples/${couple.coupleId}/image_`);
    expect(authResult.publicUrl).toBeDefined();
  });

  it("Rejects unsupported image format or oversized file", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    // Invalid MIME type
    await expect(
      generateUploadAuthorizationService(alice._id, "image", "application/pdf", 1024)
    ).rejects.toThrow("Unsupported image format");

    // Oversized file (>10MB)
    await expect(
      generateUploadAuthorizationService(alice._id, "image", "image/jpeg", 15 * 1024 * 1024)
    ).rejects.toThrow("Image size exceeds maximum");
  });

  it("Persists image and audio messages with correct media metadata", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    const couple = await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const imageKey = `couples/${couple.coupleId}/image_test123.jpg`;
    const imageMsg = await sendMessageService(alice._id, "", "client-img-1", {
      storageKey: imageKey,
      url: `https://pub-r2.dev/${imageKey}`,
      mimeType: "image/jpeg",
      size: 204800,
      width: 800,
      height: 600,
    });

    expect(imageMsg.message.type).toBe("image");
    expect(imageMsg.message.media?.storageKey).toBe(imageKey);
    expect(imageMsg.message.media?.width).toBe(800);

    const audioKey = `couples/${couple.coupleId}/audio_test456.webm`;
    const audioMsg = await sendMessageService(alice._id, "", "client-audio-1", {
      storageKey: audioKey,
      url: `https://pub-r2.dev/${audioKey}`,
      mimeType: "audio/webm",
      size: 50000,
      duration: 12,
    });

    expect(audioMsg.message.type).toBe("audio");
    expect(audioMsg.message.media?.duration).toBe(12);
  });

  it("Enforces Couple Media Isolation: Cannot attach storage key belonging to another Couple", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const charlie = await registerUser({ name: "Charlie", password: "password123" });
    const david = await registerUser({ name: "David", password: "password123" });
    const coupleB = await connectWithPartner(charlie._id, { connectionId: david.connectionId });

    // Alice tries to use a storage key generated for Couple B
    const forgedKey = `couples/${coupleB.coupleId}/image_forged.jpg`;

    await expect(
      sendMessageService(alice._id, "", "client-forged-1", {
        storageKey: forgedKey,
        url: `https://pub-r2.dev/${forgedKey}`,
        mimeType: "image/jpeg",
        size: 1000,
      })
    ).rejects.toThrow("Invalid media storage authorization.");
  });
});
