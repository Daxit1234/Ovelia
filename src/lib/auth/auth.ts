import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import mongoose from "mongoose";
import { after } from "next/server";
import { connectDB, supportsTransactions, User } from "@/lib/db";
import { getEnv, siteUrl } from "@/lib/env";
import { sendEmail } from "@/lib/services/notifications";
import { templates } from "@/lib/services/notifications/templates";

function createAuth(db: NonNullable<typeof mongoose.connection.db>, client: mongoose.mongo.MongoClient, transactions: boolean) {
  const env = getEnv();
  const isProd = env.NODE_ENV === "production";

  return betterAuth({
    appName: "Ovelia",
    baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(db, { client, usePlural: true, transaction: transactions }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      async sendResetPassword({ user, url }) {
        await sendEmail({
          to: user.email,
          template: "password_reset",
          content: templates.passwordReset(user.name, url),
          userId: user.id,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      async sendVerificationEmail({ user, url }) {
        await sendEmail({
          to: user.email,
          template: "welcome",
          content: templates.welcome(user.name, url, siteUrl("/shop")),
          userId: user.id,
          dedupeKey: `welcome:${user.id}`,
        });
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "customer", input: false },
        status: { type: "string", required: false, defaultValue: "active", input: false },
        phone: { type: "string", required: false, defaultValue: null, input: true },
        marketingOptIn: { type: "boolean", required: false, defaultValue: false, input: true },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: isProd,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    verification: { storeIdentifier: "hashed" },
    advanced: {
      cookiePrefix: "ovelia",
      useSecureCookies: isProd,
      backgroundTasks: {
        handler: (promise) => {
          try {
            after(promise);
          } catch {
            // Outside a Next.js request (e.g. CLI scripts): let it run detached.
            void promise.catch((error) => console.error("Auth background task failed", error));
          }
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          async before(session) {
            const user = await User.findById(session.userId, { status: 1 }).lean();
            if (user?.status === "suspended") {
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_SUSPENDED",
                message: "This account has been suspended. Please contact support.",
              });
            }
          },
          async after(session) {
            await User.updateOne({ _id: session.userId }, { $set: { lastLoginAt: new Date() } }).catch(() => undefined);
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __oveliaAuth?: Promise<Auth> };

/**
 * Better Auth needs a live MongoDB handle, so the instance is created lazily
 * after connecting (and after detecting transaction support).
 */
export function getAuth(): Promise<Auth> {
  globalForAuth.__oveliaAuth ??= (async () => {
    await connectDB();
    const transactions = await supportsTransactions();
    return createAuth(mongoose.connection.db!, mongoose.connection.getClient(), transactions);
  })().catch((error) => {
    globalForAuth.__oveliaAuth = undefined;
    throw error;
  });
  return globalForAuth.__oveliaAuth;
}
