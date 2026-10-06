import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { registerUser, loginUser } from "@/lib/services/auth-service";
import { connectWithPartner, getActiveCoupleForUser } from "@/lib/services/couple-service";
import { createSession, getUserFromSessionToken } from "@/lib/auth/session";
import { User } from "@/models/User";
import { Couple } from "@/models/Couple";
import { Session } from "@/models/Session";

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
  await Session.deleteMany({});
});

describe("TwoChat Core Foundation Logic", () => {
  it("User registration generates unique Connection ID and hashes password", async () => {
    const user = await registerUser({ name: "Alice", password: "password123" });
    expect(user.name).toBe("Alice");
    expect(user.connectionId).toMatch(/^[A-Z]{3}-[A-Z0-9]{4}$/);

    const fetchedUser = await User.findById(user._id).lean();
    expect(fetchedUser?.passwordHash).toBeUndefined(); // select: false by default on query

    const dbUser = await User.findById(user._id).select("+passwordHash");
    expect(dbUser?.passwordHash).not.toBe("password123");
    expect(dbUser?.passwordHash).toContain("scrypt$");
  });

  it("Login handles valid and invalid credentials", async () => {
    const user = await registerUser({ name: "Bob", password: "password123" });
    
    // Valid login
    const loggedIn = await loginUser({ connectionId: user.connectionId, password: "password123" });
    expect(loggedIn._id.toString()).toBe(user._id.toString());

    // Invalid password
    await expect(loginUser({ connectionId: user.connectionId, password: "wrongpassword" }))
      .rejects.toThrow("Incorrect Connection ID or password.");
  });

  it("Session creation and token authentication", async () => {
    const user = await registerUser({ name: "Charlie", password: "password123" });
    const { token } = await createSession(user._id);

    const fetchedUser = await getUserFromSessionToken(token);
    expect(fetchedUser?._id.toString()).toBe(user._id.toString());
  });

  it("Self connection is rejected", async () => {
    const user = await registerUser({ name: "David", password: "password123" });
    await expect(connectWithPartner(user._id, { connectionId: user.connectionId }))
      .rejects.toThrow("That's your own TwoChat ID");
  });

  it("User A + User B creates valid Couple", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });

    const result = await connectWithPartner(alice._id, { connectionId: bob.connectionId });
    expect(result.partner.name).toBe("Bob");

    const coupleAlice = await getActiveCoupleForUser(alice._id);
    const coupleBob = await getActiveCoupleForUser(bob._id);
    expect(coupleAlice?._id.toString()).toBe(coupleBob?._id.toString());
  });

  it("One-couple-per-user enforcement (User A already connected rejected)", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    const charlie = await registerUser({ name: "Charlie", password: "password123" });

    await connectWithPartner(alice._id, { connectionId: bob.connectionId });

    await expect(connectWithPartner(alice._id, { connectionId: charlie.connectionId }))
      .rejects.toThrow("You are already connected with someone.");
  });

  it("Target already connected rejected", async () => {
    const alice = await registerUser({ name: "Alice", password: "password123" });
    const bob = await registerUser({ name: "Bob", password: "password123" });
    const charlie = await registerUser({ name: "Charlie", password: "password123" });

    await connectWithPartner(bob._id, { connectionId: charlie.connectionId });

    await expect(connectWithPartner(alice._id, { connectionId: bob.connectionId }))
      .rejects.toThrow("This connection is unavailable.");
  });
});
