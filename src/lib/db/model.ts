import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Registers a model once. Next.js dev reloads modules, so re-compiling an
 * existing model name would otherwise throw OverwriteModelError.
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  return existing ?? mongoose.model<T>(name, schema as never);
}

export type WithId<T> = T & { _id: mongoose.Types.ObjectId };

export const { ObjectId } = mongoose.Types;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value);
}

export function toObjectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

export function idOf(value: { _id: mongoose.Types.ObjectId } | mongoose.Types.ObjectId | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  return value._id.toHexString();
}
