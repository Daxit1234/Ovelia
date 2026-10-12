import "server-only";
import { Address, connectDB, type AddressDoc } from "@/lib/db";
import { toObjectId } from "@/lib/db/model";
import { AppError } from "@/lib/result";
import type { AddressData } from "@/lib/validation/checkout";

export interface SavedAddress extends AddressData {
  id: string;
  label: "home" | "work" | "other";
  isDefault: boolean;
}

const MAX_ADDRESSES = 20;

function toView(doc: AddressDoc): SavedAddress {
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    isDefault: doc.isDefault,
    fullName: doc.fullName,
    phone: doc.phone,
    line1: doc.line1,
    line2: doc.line2,
    landmark: doc.landmark,
    city: doc.city,
    state: doc.state as AddressData["state"],
    pincode: doc.pincode,
  };
}

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  await connectDB();
  const docs = await Address.find({ userId: toObjectId(userId) }).sort({ isDefault: -1, updatedAt: -1 }).lean();
  return docs.map(toView);
}

export async function saveAddress(
  userId: string,
  data: AddressData & { label: "home" | "work" | "other"; isDefault: boolean },
  addressId?: string,
): Promise<SavedAddress> {
  await connectDB();
  const owner = toObjectId(userId);
  const count = await Address.countDocuments({ userId: owner });
  const makeDefault = data.isDefault || count === 0;
  if (makeDefault) await Address.updateMany({ userId: owner }, { $set: { isDefault: false } });

  if (addressId) {
    const updated = await Address.findOneAndUpdate(
      { _id: toObjectId(addressId), userId: owner },
      { $set: { ...data, isDefault: makeDefault } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) throw new AppError("Address not found", "NOT_FOUND", 404);
    return toView(updated);
  }

  if (count >= MAX_ADDRESSES) throw new AppError(`You can save up to ${MAX_ADDRESSES} addresses.`);
  // Avoid saving exact duplicates from repeated checkouts.
  const duplicate = await Address.findOne({ userId: owner, line1: data.line1, pincode: data.pincode, fullName: data.fullName }).lean();
  if (duplicate) {
    if (makeDefault && !duplicate.isDefault) await Address.updateOne({ _id: duplicate._id }, { $set: { isDefault: true } });
    return toView({ ...duplicate, isDefault: makeDefault || duplicate.isDefault });
  }
  const created = await Address.create({ ...data, userId: owner, isDefault: makeDefault });
  return toView(created.toObject());
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await connectDB();
  const owner = toObjectId(userId);
  const removed = await Address.findOneAndDelete({ _id: toObjectId(addressId), userId: owner }).lean();
  if (removed?.isDefault) {
    const next = await Address.findOne({ userId: owner }).sort({ updatedAt: -1 }).lean();
    if (next) await Address.updateOne({ _id: next._id }, { $set: { isDefault: true } });
  }
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  await connectDB();
  const owner = toObjectId(userId);
  const exists = await Address.exists({ _id: toObjectId(addressId), userId: owner });
  if (!exists) throw new AppError("Address not found", "NOT_FOUND", 404);
  await Address.updateMany({ userId: owner }, { $set: { isDefault: false } });
  await Address.updateOne({ _id: toObjectId(addressId) }, { $set: { isDefault: true } });
}
