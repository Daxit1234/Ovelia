import { z } from "zod";
import { INDIAN_STATE_NAMES, normalizeIndianMobile, PINCODE_REGEX } from "@/lib/india";

export const mobileSchema = z
  .string()
  .trim()
  .refine((value) => normalizeIndianMobile(value) !== null, "Enter a valid 10-digit Indian mobile number")
  .transform((value) => normalizeIndianMobile(value)!);

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's full name").max(80),
  phone: mobileSchema,
  line1: z.string().trim().min(5, "Enter house / flat number and street").max(120),
  line2: z.string().trim().max(120),
  landmark: z.string().trim().max(80),
  city: z
    .string()
    .trim()
    .min(2, "Enter the city or town")
    .max(60)
    .regex(/^[\p{L} .'()-]+$/u, "Enter a valid city name"),
  state: z.enum(INDIAN_STATE_NAMES, { error: "Select a state" }),
  pincode: z.string().trim().regex(PINCODE_REGEX, "Enter a valid 6-digit PIN code"),
});

export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;

export const savedAddressSchema = addressSchema.extend({
  label: z.enum(["home", "work", "other"]),
  isDefault: z.boolean(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.email("Enter a valid email address").max(254).transform((v) => v.toLowerCase()),
  phone: mobileSchema,
});

const checkoutFields = {
  contact: contactSchema,
  shippingAddress: addressSchema,
  billingSameAsShipping: z.boolean(),
  shippingMethod: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["razorpay", "cod"]),
  customerNote: z.string().trim().max(500),
  saveAddress: z.boolean(),
};

/** Server-side checkout payload (always re-validated on the server). */
export const checkoutSchema = z
  .object({
    ...checkoutFields,
    billingAddress: addressSchema.optional(),
    checkoutKey: z.uuid(),
    /** Total the customer saw; used only to confirm, never to charge. */
    expectedTotal: z.number().int().min(0),
  })
  .refine((v) => v.billingSameAsShipping || !!v.billingAddress, {
    path: ["billingAddress"],
    message: "Enter the billing address",
  });

const rawAddress = z.object({
  fullName: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string(),
  landmark: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
});

/** Client form schema: billing address is only validated when it differs. */
export const checkoutFormSchema = z.object({ ...checkoutFields, billingAddress: rawAddress }).superRefine((value, ctx) => {
  if (value.billingSameAsShipping) return;
  const result = addressSchema.safeParse(value.billingAddress);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ code: "custom", message: issue.message, path: ["billingAddress", ...issue.path] });
    }
  }
});

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3, "Enter a coupon code")
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Coupon codes contain only letters, numbers, - and _")
  .transform((v) => v.toUpperCase());

export const trackOrderSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(6, "Enter your order number")
    .max(32)
    .transform((v) => v.toUpperCase()),
  contact: z.string().trim().min(5, "Enter the email or mobile number used for the order").max(254),
});
