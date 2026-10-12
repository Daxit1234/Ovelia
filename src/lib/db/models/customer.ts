import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";

export interface AddressDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  label: "home" | "work" | "other";
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<AddressDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, enum: ["home", "work", "other"], default: "home" },
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, default: "", trim: true, maxlength: 120 },
    landmark: { type: String, default: "", trim: true, maxlength: 80 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true },
    pincode: { type: String, required: true, match: /^[1-9][0-9]{5}$/ },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

addressSchema.index({ userId: 1, isDefault: -1, updatedAt: -1 });

export const Address = defineModel<AddressDoc>("Address", addressSchema);

export interface WishlistDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: { productId: Types.ObjectId; addedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<WishlistDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        addedAt: { type: Date, default: () => new Date() },
        _id: false,
      },
    ],
  },
  { timestamps: true },
);

export const Wishlist = defineModel<WishlistDoc>("Wishlist", wishlistSchema);

export interface ContactMessageDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  subject: string;
  orderNumber: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  userId: Types.ObjectId | null;
  ipHash: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<ContactMessageDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    subject: { type: String, required: true, maxlength: 120 },
    orderNumber: { type: String, default: "" },
    message: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: ["new", "in_progress", "resolved"], default: "new" },
    userId: { type: Schema.Types.ObjectId, default: null },
    ipHash: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

contactSchema.index({ status: 1, createdAt: -1 });

export const ContactMessage = defineModel<ContactMessageDoc>("ContactMessage", contactSchema);
