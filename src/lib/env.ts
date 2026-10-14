import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().default("ovelia").transform((value) => value.trim() || "ovelia"),
  MONGODB_TRANSACTIONS: z.enum(["auto", "true", "false"]).default("auto"),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: optional,

  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("Ovelia <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  CLOUDINARY_FOLDER: z.string().default("ovelia"),

  SHIPROCKET_EMAIL: optional,
  SHIPROCKET_PASSWORD: optional,
  SHIPROCKET_PICKUP_LOCATION: optional,
  SHIPROCKET_WEBHOOK_TOKEN: optional,

  CRON_SECRET: optional,
  PINCODE_LOOKUP: z.enum(["on", "off"]).default("on"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validated server environment. Validation is lazy so that modules can be
 * imported during the build without every optional integration configured.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export const integrations = {
  razorpay(): boolean {
    const env = getEnv();
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  },
  razorpayWebhook(): boolean {
    return Boolean(getEnv().RAZORPAY_WEBHOOK_SECRET);
  },
  email(): boolean {
    return Boolean(getEnv().RESEND_API_KEY);
  },
  cloudinary(): boolean {
    const env = getEnv();
    return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  },
  shiprocket(): boolean {
    const env = getEnv();
    return Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);
  },
};
