import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { getEnv } from "@/lib/env";

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  transactions: boolean | null;
};

const globalForMongoose = globalThis as unknown as { __oveliaMongoose?: ConnectionCache };
const cache: ConnectionCache = (globalForMongoose.__oveliaMongoose ??= {
  conn: null,
  promise: null,
  transactions: null,
});

/**
 * Returns a shared Mongoose connection. The connection is cached on
 * `globalThis` so hot reloads and serverless warm starts reuse the pool.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    const env = getEnv();
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}

/**
 * Multi-document transactions need a replica set or sharded cluster
 * (MongoDB Atlas always qualifies). Standalone servers fall back to
 * compensating writes in the services that need atomicity.
 */
export async function supportsTransactions(): Promise<boolean> {
  if (cache.transactions !== null) return cache.transactions;
  const env = getEnv();
  if (env.MONGODB_TRANSACTIONS !== "auto") {
    cache.transactions = env.MONGODB_TRANSACTIONS === "true";
    return cache.transactions;
  }
  await connectDB();
  try {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    cache.transactions = Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch {
    cache.transactions = false;
  }
  return cache.transactions;
}

/**
 * Runs `fn` inside a transaction when supported. When transactions are not
 * available `fn` receives `null` and must perform its own compensation.
 */
export async function withTransaction<T>(fn: (session: ClientSession | null) => Promise<T>): Promise<T> {
  await connectDB();
  if (await supportsTransactions()) {
    return mongoose.connection.transaction((session) => fn(session));
  }
  return fn(null);
}
