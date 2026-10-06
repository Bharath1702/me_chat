
import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  _twochatMongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalForMongoose._twochatMongoose ??
  (globalForMongoose._twochatMongoose = { conn: null, promise: null });

/**
 * Returns a shared Mongoose connection. The connection (and its pool) is
 * cached on globalThis so dev hot-reloads and warm serverless invocations
 * reuse it instead of opening a new connection per request.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
