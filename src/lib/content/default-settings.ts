import {
  DEFAULT_ABOUT,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_RETURN_POLICY,
  DEFAULT_SHIPPING_POLICY,
  DEFAULT_TERMS,
} from "@/lib/content/default-policies";
import type { StoreSettings } from "@/lib/validation/settings";

/**
 * Factory defaults. Business details are intentionally blank: the storefront
 * shows clear placeholders and the admin dashboard lists what still needs to
 * be filled in before launch.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  store: {
    name: "Ovelia",
    legalName: "",
    tagline: "Clean, fresh, everyday care",
    supportEmail: "",
    supportPhone: "",
    whatsappNumber: "",
    businessHours: "",
    gstin: "",
    address: { line1: "", line2: "", city: "", state: "", pincode: "" },
    social: { instagram: "", facebook: "", youtube: "", x: "", linkedin: "" },
  },
  announcement: { enabled: true, text: "", href: "/shop" },
  shipping: {
    provider: "manual",
    standardLabel: "Standard delivery",
    standardEta: "Usually 3–7 business days",
    standardFee: 4_900,
    expressEnabled: true,
    expressLabel: "Express delivery",
    expressEta: "Priority dispatch, faster where available",
    expressFee: 9_900,
    freeShippingThreshold: 49_900,
    processingTime: "Orders are usually packed and handed to our courier partner within 1–2 business days.",
    originPincode: "",
    blockedPincodes: [],
    defaultPackageWeightGrams: 1_000,
  },
  payments: {
    razorpayEnabled: true,
    codEnabled: true,
    codFee: 3_000,
    codMinOrderValue: null,
    codMaxOrderValue: 500_000,
  },
  tax: { pricesIncludeTax: true, defaultGstRate: 18, shippingGstRate: 18, storeState: "" },
  orders: {
    guestCheckoutEnabled: true,
    reservationMinutes: 30,
    maxQuantityPerItem: 10,
    customerCancelUntil: "confirmed",
    autoRefundOnCustomerCancel: true,
    returnsEnabled: true,
    returnWindowDays: 7,
    notificationEmails: [],
  },
  reviews: { enabled: true, requirePurchase: true, autoApprove: false },
  homepage: {
    heroEyebrow: "Home & car care essentials",
    heroTitle: "A cleaner, fresher home starts with Ovelia",
    heroSubtitle:
      "Dishwash, floor, kitchen, bathroom, glass and car care essentials for everyday Indian homes — clearly priced and delivered to your door.",
    heroCtaLabel: "Shop now",
    heroCtaHref: "/shop",
    showBestSellers: true,
    showNewArrivals: true,
    showBundles: true,
    showTestimonials: true,
    showFaq: true,
    showNewsletter: true,
    whyChoose: [
      {
        title: "Care for every room",
        description: "Kitchen, floors, bathrooms, glass and your car — one trusted range for the whole home.",
        icon: "home",
      },
      {
        title: "Honest pricing",
        description: "Clear MRP and selling prices. Savings are shown only when they are real.",
        icon: "badge",
      },
      {
        title: "Secure checkout",
        description: "Pay by UPI, cards, net banking or wallets through Razorpay, or choose Cash on Delivery where available.",
        icon: "shield",
      },
      {
        title: "Tracked delivery",
        description: "Follow your order from dispatch to doorstep with live tracking updates.",
        icon: "truck",
      },
    ],
  },
  policies: {
    shipping: DEFAULT_SHIPPING_POLICY,
    returns: DEFAULT_RETURN_POLICY,
    privacy: DEFAULT_PRIVACY_POLICY,
    terms: DEFAULT_TERMS,
    about: DEFAULT_ABOUT,
  },
  seo: {
    defaultTitle: "Ovelia — Home & Car Cleaning Essentials",
    defaultDescription:
      "Shop Ovelia dishwash liquid, floor cleaner, kitchen and toilet cleaners, glass cleaner, car shampoo and more. Secure payments and doorstep delivery in India.",
  },
};
