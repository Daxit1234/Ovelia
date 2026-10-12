import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";

/**
 * Singleton store configuration. Each section is validated with Zod in the
 * settings service and merged over code defaults when read.
 */
export interface StoreSettingsDoc {
  _id: Types.ObjectId;
  key: "default";
  store: Record<string, unknown>;
  announcement: Record<string, unknown>;
  shipping: Record<string, unknown>;
  payments: Record<string, unknown>;
  tax: Record<string, unknown>;
  orders: Record<string, unknown>;
  reviews: Record<string, unknown>;
  homepage: Record<string, unknown>;
  policies: Record<string, unknown>;
  seo: Record<string, unknown>;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<StoreSettingsDoc>(
  {
    key: { type: String, default: "default", unique: true },
    store: { type: Schema.Types.Mixed, default: {} },
    announcement: { type: Schema.Types.Mixed, default: {} },
    shipping: { type: Schema.Types.Mixed, default: {} },
    payments: { type: Schema.Types.Mixed, default: {} },
    tax: { type: Schema.Types.Mixed, default: {} },
    orders: { type: Schema.Types.Mixed, default: {} },
    reviews: { type: Schema.Types.Mixed, default: {} },
    homepage: { type: Schema.Types.Mixed, default: {} },
    policies: { type: Schema.Types.Mixed, default: {} },
    seo: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);

export const StoreSettingsModel = defineModel<StoreSettingsDoc>("StoreSettings", settingsSchema);
