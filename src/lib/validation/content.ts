import { z } from "zod";
import { parseIstDateTime } from "@/lib/format";
import { linkSchema } from "@/lib/validation/link";

const dateTime = z.union([z.literal(""), z.string().refine((v) => parseIstDateTime(v) !== null, "Enter a valid date and time")]);

export const BANNER_THEMES = ["green", "teal", "blue", "light"] as const;

export const bannerInputSchema = z
  .object({
    placement: z.enum(["hero", "promo"]),
    eyebrow: z.string().trim().max(60),
    title: z.string().trim().min(1, "Enter a title").max(120),
    subtitle: z.string().trim().max(300),
    ctaLabel: z.string().trim().max(40),
    ctaHref: linkSchema,
    imageUrl: z.string().trim().max(500),
    imageAlt: z.string().trim().max(200),
    theme: z.enum(BANNER_THEMES),
    sortOrder: z.number().int().min(0).max(10_000),
    isActive: z.boolean(),
    startsAt: dateTime,
    endsAt: dateTime,
  })
  .refine((v) => !v.imageUrl || v.imageAlt.length > 0, { path: ["imageAlt"], message: "Describe the image for screen readers" })
  .refine((v) => !v.startsAt || !v.endsAt || parseIstDateTime(v.endsAt)! > parseIstDateTime(v.startsAt)!, { path: ["endsAt"], message: "The end must be after the start" });

export type BannerInput = z.input<typeof bannerInputSchema>;

export const EMPTY_BANNER: BannerInput = {
  placement: "promo",
  eyebrow: "",
  title: "",
  subtitle: "",
  ctaLabel: "Shop now",
  ctaHref: "/shop",
  imageUrl: "",
  imageAlt: "",
  theme: "green",
  sortOrder: 0,
  isActive: true,
  startsAt: "",
  endsAt: "",
};

export const faqInputSchema = z.object({
  question: z.string().trim().min(5, "Enter the question").max(300),
  answer: z.string().trim().min(2, "Enter the answer").max(3000),
  category: z.string().trim().min(1, "Enter a category").max(60),
  sortOrder: z.number().int().min(0).max(10_000),
  isPublished: z.boolean(),
  showOnHome: z.boolean(),
});

export type FaqInput = z.input<typeof faqInputSchema>;

export const EMPTY_FAQ: FaqInput = { question: "", answer: "", category: "General", sortOrder: 0, isPublished: true, showOnHome: false };

/**
 * Testimonials must come from real customers who agreed to be quoted; the
 * store ships with none and publishing requires that confirmation.
 */
export const testimonialInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the customer's name as they agreed to be shown").max(60),
    location: z.string().trim().max(60),
    quote: z.string().trim().min(10, "Enter the customer's words").max(600),
    rating: z.number().int().min(1).max(5).nullable(),
    isPublished: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
    consentConfirmed: z.boolean(),
  })
  .refine((v) => !v.isPublished || v.consentConfirmed, { path: ["consentConfirmed"], message: "Confirm the customer agreed to be quoted before publishing" });

export type TestimonialInput = z.input<typeof testimonialInputSchema>;

export const EMPTY_TESTIMONIAL: TestimonialInput = { name: "", location: "", quote: "", rating: null, isPublished: false, sortOrder: 0, consentConfirmed: false };
