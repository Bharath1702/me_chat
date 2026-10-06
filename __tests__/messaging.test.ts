import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { registerUser } from "@/lib/services/auth-service";
import { connectWithPartner } from "@/lib/services/couple-service";
import {
  sendMessageService,
  getMessagesService,
  markMessagesAsReadService,
  markMessagesAsDeliveredService,
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

describe("Iteration 2: Realtime Messaging & Security Core Logic", () => {
  it("Authenticated user sends a valid message and persists it", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const result = await sendMessageService(alice._id, "Hello Bob! ❤️", "client-id-1");
    expect(result.message.content).toBe("Hello Bob! ❤️");
    expect(result.message.senderId).toBe(alice._id.toString());
    expect(result.message.receiverId).toBe(bob._id.toString());

    const savedDoc = await Message.findById(result.message.id);
    expect(savedDoc?.content).toBe("Hello Bob! ❤️");
  });

  it("Rejects empty or oversized messages", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    // Empty message
    await expect(sendMessageService(alice._id, "   ")).rejects.toThrow(
      "Message content cannot be empty."
    );

    // Oversized message (>2000 chars)
    const longString = "a".repeat(2001);
    await expect(sendMessageService(alice._id, longString)).rejects.toThrow(
      "Message exceeds maximum length"
    );
  });

  it("Enforces Couple isolation: User cannot read or write to another Couple", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const charlie = await registerUser({ name: "Charlie", password: "password123" });
    const david = await registerUser({ name: "David", password: "password123" });
    await connectWithPartner(charlie._id, { connectionId: david.connectionId });

    // Alice sends message in Couple A
    await sendMessageService(alice._id, "Secret Couple A message");

    // Charlie fetches messages in Couple B
    const charlieMessages = await getMessagesService(charlie._id);
    expect(charlieMessages.messages.length).toBe(0);
  });

  it("Pagination: Fetches latest messages and handles 'before' cursor", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    // Create 55 messages
    for (let i = 1; i <= 55; i++) {
      await sendMessageService(alice._id, `Message ${i}`);
    }

    const firstPage = await getMessagesService(alice._id, undefined, 50);
    expect(firstPage.messages.length).toBe(50);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.messages[0].content).toBe("Message 6");
    expect(firstPage.messages[49].content).toBe("Message 55");

    const oldestOnFirstPage = firstPage.messages[0].id;
    const secondPage = await getMessagesService(alice._id, oldestOnFirstPage, 50);
    expect(secondPage.messages.length).toBe(5);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.messages[0].content).toBe("Message 1");
    expect(secondPage.messages[4].content).toBe("Message 5");
  });

  it("Delivery and Read Receipts status progression", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    const msg = await sendMessageService(alice._id, "Check status ticks");
    expect(msg.message.status).toBe("sent");

    // Bob connects & marks delivered
    const delResult = await markMessagesAsDeliveredService(bob._id);
    expect(delResult?.updatedCount).toBe(1);

    let doc = await Message.findById(msg.message.id);
    expect(doc?.status).toBe("delivered");
    expect(doc?.deliveredAt).not.toBeNull();

    // Bob opens chat & marks read
    const readResult = await markMessagesAsReadService(bob._id);
    expect(readResult?.updatedCount).toBe(1);

    doc = await Message.findById(msg.message.id);
    expect(doc?.status).toBe("read");
    expect(doc?.readAt).not.toBeNull();
  });
});
