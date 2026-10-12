import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";
import { USER_ROLES, type UserRole, type UserStatus } from "@/lib/domain/roles";

/**
 * The `users` collection is owned by Better Auth (credentials live in the
 * `accounts` collection). This model gives the rest of the app typed read
 * access plus the few admin-managed fields (role, status).
 */
export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  marketingOptIn?: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, enum: USER_ROLES, default: "customer" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    phone: { type: String, default: null },
    marketingOptIn: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { collection: "users", versionKey: false },
);

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ status: 1 });

export const User = defineModel<UserDoc>("User", userSchema);

/** Better Auth session records, used to revoke sessions of suspended users. */
export interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    token: String,
    expiresAt: Date,
    ipAddress: String,
    userAgent: String,
  },
  { collection: "sessions", versionKey: false, strict: false },
);

export const AuthSession = defineModel<SessionDoc>("AuthSession", sessionSchema);
