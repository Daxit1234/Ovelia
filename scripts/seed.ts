/**
 * Seeds the catalog, starter content, example promotions and (optionally)
 * the first super admin. Safe to run repeatedly: existing records are left
 * untouched unless --reset-catalog is passed.
 *
 *   npm run db:seed
 *   npm run db:seed -- --reset-catalog
 */
import "./load-env";
import mongoose from "mongoose";
import {
  Banner,
  Category,
  connectDB,
  Faq,
  Product,
  Promotion,
  StoreSettingsModel,
  User,
} from "@/lib/db";
import { recordInitialStock, SYSTEM_ACTOR } from "@/lib/services/inventory";
import { getAuth } from "@/lib/auth/auth";
import { toPaise } from "@/lib/money";
import { SEED_CATEGORIES, SEED_FAQS, SEED_PRODUCTS } from "./seed-data";

const resetCatalog = process.argv.includes("--reset-catalog");

async function seedSettings() {
  const exists = await StoreSettingsModel.exists({ key: "default" });
  if (!exists) {
    await StoreSettingsModel.create({ key: "default" });
    console.log("• Store settings initialised with defaults");
  }
}

async function seedCategories() {
  const ids = new Map<string, mongoose.Types.ObjectId>();
  for (const c of SEED_CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      {
        $setOnInsert: {
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: { url: `/images/categories/${c.slug}.svg`, alt: c.name },
          sortOrder: c.sortOrder,
          isActive: true,
          showOnHome: true,
        },
      },
      { upsert: true, returnDocument: "after" },
    ).lean();
    ids.set(c.slug, doc!._id);
  }
  console.log(`• ${ids.size} categories ready`);
  return ids;
}

async function seedProducts(categories: Map<string, mongoose.Types.ObjectId>) {
  if (resetCatalog) {
    await Product.deleteMany({ slug: { $in: SEED_PRODUCTS.map((p) => p.slug) } });
    console.log("• Removed existing seed products (--reset-catalog)");
  }
  let created = 0;
  for (const p of SEED_PRODUCTS) {
    if (await Product.exists({ slug: p.slug })) continue;
    const categoryId = categories.get(p.category)!;
    const product = await Product.create({
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      description: p.description,
      category: categoryId,
      categoryPath: [categoryId],
      images: [1, 2, 3].map((n) => ({
        url: `/images/products/${p.slug}-${n}.svg`,
        alt: n === 1 ? `Ovelia ${p.name}` : n === 2 ? `${p.name} — key features` : `${p.name} — available sizes`,
      })),
      variants: p.variants.map((v, i) => ({
        label: v.label,
        sku: v.sku,
        sizeValue: v.sizeValue,
        sizeUnit: v.sizeUnit,
        mrp: toPaise(v.mrp),
        price: toPaise(v.price),
        costPrice: toPaise(v.costPrice),
        stock: v.stock,
        reserved: 0,
        lowStockThreshold: 10,
        weightGrams: v.weightGrams,
        isActive: true,
        sortOrder: i,
      })),
      highlights: p.highlights,
      specifications: p.specifications,
      usageInstructions: p.usageInstructions,
      ingredients: "",
      safetyInformation: p.safetyInformation,
      fragrance: p.fragrance,
      tags: p.tags,
      status: "published",
      isFeatured: !!p.isFeatured,
      isBestSeller: !!p.isBestSeller,
      isNewArrival: !!p.isNewArrival,
      reviewsEnabled: true,
      hsnCode: p.hsnCode,
      gstRate: 18,
      seo: { title: `${p.name} | Ovelia`, description: p.shortDescription },
    });
    await recordInitialStock(product.toObject(), SYSTEM_ACTOR);
    created++;
  }

  // Related and frequently-bought-together links.
  const all = await Product.find({ slug: { $in: SEED_PRODUCTS.map((p) => p.slug) } }, { slug: 1, category: 1 }).lean();
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const fbt: Record<string, string[]> = {
    "lemon-fresh-dishwash-liquid": ["kitchen-degreaser-spray", "lavender-floor-cleaner"],
    "lavender-floor-cleaner": ["lemon-fresh-dishwash-liquid", "thick-gel-toilet-cleaner"],
    "kitchen-degreaser-spray": ["lemon-fresh-dishwash-liquid", "multipurpose-surface-cleaner"],
    "thick-gel-toilet-cleaner": ["tile-and-bathroom-cleaner", "lavender-floor-cleaner"],
    "glass-and-mirror-cleaner": ["multipurpose-surface-cleaner", "lavender-floor-cleaner"],
    "car-shampoo": ["car-polish", "glass-and-mirror-cleaner"],
    "car-polish": ["car-shampoo"],
    "liquid-laundry-detergent": ["aloe-hand-wash"],
  };
  for (const p of all) {
    const related = all.filter((o) => o.category.equals(p.category) && o.slug !== p.slug).map((o) => o._id);
    const together = (fbt[p.slug] ?? []).map((s) => bySlug.get(s)?._id).filter(Boolean);
    await Product.updateOne(
      { _id: p._id, relatedProducts: { $size: 0 } },
      { $set: { relatedProducts: related.slice(0, 6), frequentlyBoughtTogether: together } },
    );
  }
  console.log(`• Products: ${created} created, ${SEED_PRODUCTS.length - created} already present`);
  return bySlug;
}

async function seedPromotions(products: Map<string, { _id: mongoose.Types.ObjectId }>, categories: Map<string, mongoose.Types.ObjectId>) {
  const year = new Date().getFullYear();
  const dishwash = products.get("lemon-fresh-dishwash-liquid")!;
  const floor = products.get("lavender-floor-cleaner")!;
  const dishwash1L = (await Product.findById(dishwash._id, { variants: 1 }).lean())!.variants.find((v) => v.sku === "OV-DW-1000")!;
  const floor1L = (await Product.findById(floor._id, { variants: 1 }).lean())!.variants.find((v) => v.sku === "OV-FL-1000")!;

  const promos = [
    {
      key: { code: "WELCOME10" },
      doc: {
        name: "Welcome offer — 10% off your first order",
        description: "10% off your first order above ₹299, up to ₹100.",
        campaign: "Welcome",
        code: "WELCOME10",
        type: "percentage",
        value: 10,
        maxDiscount: toPaise(100),
        minSubtotal: toPaise(299),
        firstOrderOnly: true,
        usageLimitPerCustomer: 1,
        showOnStorefront: true,
        bannerText: "New here? Use WELCOME10 for 10% off your first order",
        priority: 10,
      },
    },
    {
      key: { name: "Buy any 2, save 10%" },
      doc: {
        name: "Buy any 2, save 10%",
        description: "Automatically get 10% off when you buy 2 or more products.",
        campaign: "Everyday savings",
        isAutomatic: true,
        type: "percentage",
        value: 10,
        minQuantity: 2,
        maxDiscount: toPaise(300),
        stackable: false,
        showOnStorefront: true,
        bannerText: "Buy any 2 products and save 10% automatically",
        priority: 5,
      },
    },
    {
      key: { name: "Kitchen & Floor Combo" },
      doc: {
        name: "Kitchen & Floor Combo",
        description: "Dishwash Liquid 1 L + Floor Cleaner 1 L for ₹299.",
        campaign: "Combos",
        isAutomatic: true,
        type: "bundle",
        bundleItems: [
          { productId: dishwash._id, variantId: dishwash1L._id, quantity: 1 },
          { productId: floor._id, variantId: floor1L._id, quantity: 1 },
        ],
        bundlePrice: toPaise(299),
        stackable: true,
        showOnStorefront: true,
        bannerText: "Dishwash 1 L + Floor Cleaner 1 L combo at ₹299",
        priority: 20,
      },
    },
    {
      key: { code: "FREESHIP" },
      doc: {
        name: "Free shipping coupon",
        description: "Free standard shipping on orders above ₹199.",
        campaign: "Shipping",
        code: "FREESHIP",
        type: "free_shipping",
        minSubtotal: toPaise(199),
        usageLimit: 500,
        stackable: true,
        priority: 1,
      },
    },
    {
      key: { code: "FESTIVE15" },
      doc: {
        name: "Festive deep-clean — 15% off floor & surface care",
        description: "Seasonal offer on the Floor & Surfaces range.",
        campaign: "Festive season",
        code: "FESTIVE15",
        type: "percentage",
        value: 15,
        appliesTo: "categories",
        categoryIds: [categories.get("floor-care")!],
        maxDiscount: toPaise(250),
        startsAt: new Date(`${year}-10-15T00:00:00+05:30`),
        endsAt: new Date(`${year}-11-15T23:59:59+05:30`),
        showOnStorefront: true,
        bannerText: "Festive deep-clean: 15% off floor & surface care with FESTIVE15",
        priority: 8,
      },
    },
  ];
  let created = 0;
  for (const promo of promos) {
    const res = await Promotion.updateOne(promo.key, { $setOnInsert: { isActive: true, usageCount: 0, ...promo.doc } }, { upsert: true });
    if (res.upsertedCount) created++;
  }
  console.log(`• Promotions: ${created} created`);
}

async function seedContent() {
  if ((await Banner.countDocuments()) === 0) {
    await Banner.insertMany([
      {
        placement: "promo",
        eyebrow: "Combo offer",
        title: "Dishwash + Floor Cleaner for ₹299",
        subtitle: "Add Lemon Fresh Dishwash 1 L and Lavender Floor Cleaner 1 L to your cart — the combo price applies automatically.",
        ctaLabel: "Shop the combo",
        ctaHref: "/offers",
        imageUrl: "/images/banners/kitchen-combo.svg",
        imageAlt: "Ovelia dishwash liquid and floor cleaner",
        theme: "green",
        sortOrder: 1,
      },
      {
        placement: "promo",
        eyebrow: "Car care",
        title: "Weekend wash & shine",
        subtitle: "Car Shampoo and Car Polish — or save with the Car Care Kit.",
        ctaLabel: "Explore car care",
        ctaHref: "/categories/car-care",
        imageUrl: "/images/banners/car-care.svg",
        imageAlt: "Ovelia car shampoo and car polish",
        theme: "blue",
        sortOrder: 2,
      },
    ]);
    console.log("• Promotional banners created");
  }
  if ((await Faq.countDocuments()) === 0) {
    await Faq.insertMany(SEED_FAQS.map((f, i) => ({ ...f, sortOrder: i, isPublished: true })));
    console.log(`• ${SEED_FAQS.length} FAQs created`);
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Store Owner";
  if (!email || !password) {
    console.log("• Skipping admin user (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)");
    return;
  }
  const existing = await User.findOne({ email }).lean();
  if (!existing) {
    const auth = await getAuth();
    await auth.api.signUpEmail({ body: { email, password, name } });
    console.log(`• Admin account created: ${email}`);
  }
  await User.updateOne({ email }, { $set: { role: "super_admin", status: "active", emailVerified: true } });
  console.log(`• ${email} has the Super Admin role`);
}

async function main() {
  await connectDB();
  console.log(`Seeding ${mongoose.connection.name}…`);
  await seedSettings();
  const categories = await seedCategories();
  const products = await seedProducts(categories);
  await seedPromotions(products, categories);
  await seedContent();
  await seedAdmin();
  console.log("Done.");
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
