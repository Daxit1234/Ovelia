/**
 * Starter catalog for development and first launch. Prices are illustrative
 * and fully editable from the admin. Copy describes intended use only — no
 * efficacy, safety-certification or eco claims — and ingredients are left
 * blank until the brand supplies its formulations.
 */

export type BottleShape = "squeeze" | "jug" | "spray" | "duck" | "wide" | "tin" | "pump" | "kit";

export interface SeedVariant {
  label: string;
  sku: string;
  sizeValue: number;
  sizeUnit: "ml" | "l" | "g" | "kg" | "pcs";
  mrp: number; // rupees
  price: number; // rupees
  costPrice: number; // rupees
  stock: number;
  weightGrams: number;
}

export interface SeedProduct {
  slug: string;
  name: string;
  category: string;
  shape: BottleShape;
  color: string;
  accent: string;
  artTitle: string;
  artSubtitle: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  usageInstructions: string;
  safetyInformation: string;
  fragrance: string;
  specifications: { label: string; value: string }[];
  tags: string[];
  hsnCode: string;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  variants: SeedVariant[];
}

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  color: string;
  shape: BottleShape;
  sortOrder: number;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { slug: "kitchen-care", name: "Kitchen Care", description: "Dishwash liquids and kitchen cleaners for everyday cooking messes.", color: "#f2c94c", shape: "squeeze", sortOrder: 1 },
  { slug: "floor-care", name: "Floor & Surfaces", description: "Floor cleaners and multipurpose cleaners for every room.", color: "#9b8ce8", shape: "jug", sortOrder: 2 },
  { slug: "bathroom-care", name: "Bathroom Care", description: "Toilet and bathroom cleaners for a fresher bathroom.", color: "#3b82f6", shape: "duck", sortOrder: 3 },
  { slug: "glass-care", name: "Glass & Mirrors", description: "Glass and mirror cleaners for windows, mirrors and glass tops.", color: "#38bdf8", shape: "spray", sortOrder: 4 },
  { slug: "laundry", name: "Laundry & Hygiene", description: "Liquid detergent and hand wash for daily laundry and hygiene.", color: "#06b6d4", shape: "pump", sortOrder: 5 },
  { slug: "car-care", name: "Car Care", description: "Car shampoo and polish for a well-kept car.", color: "#1d4ed8", shape: "wide", sortOrder: 6 },
  { slug: "kits-combos", name: "Kits & Combos", description: "Ready-made cleaning kits that bundle our favourites.", color: "#0b6b52", shape: "kit", sortOrder: 7 },
];

const STANDARD_SAFETY =
  "Keep out of reach of children and pets. Avoid contact with eyes; in case of contact, rinse thoroughly with clean water. Do not swallow. Do not mix with other cleaning products. Store in a cool, dry place with the cap closed.";

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "lemon-fresh-dishwash-liquid",
    name: "Lemon Fresh Dishwash Liquid",
    category: "kitchen-care",
    shape: "squeeze",
    color: "#f2c94c",
    accent: "#2f9e44",
    artTitle: "Dishwash",
    artSubtitle: "Lemon Fresh",
    shortDescription: "Lemon-scented dishwash liquid for plates, pans, glasses and lunch boxes.",
    description:
      "Ovelia Lemon Fresh Dishwash Liquid is made for the daily pile of plates, kadhais, pans, glasses and tiffin boxes. A small amount on a wet scrubber works up a rich lather that lifts everyday food residue and grease, then rinses off cleanly.\n\nThe fresh lemon fragrance keeps your sink area smelling pleasant, and the flip-top cap makes it easy to dispense just what you need.",
    highlights: ["Works up a rich lather with a small amount", "Fresh lemon fragrance", "Easy-dispense flip-top cap", "Value refill sizes available"],
    usageInstructions:
      "Squeeze a few drops onto a wet sponge or scrubber, or dilute 1 teaspoon in a bowl of water. Scrub utensils, then rinse thoroughly with clean water.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Lemon",
    specifications: [
      { label: "Form", value: "Liquid" },
      { label: "Fragrance", value: "Lemon" },
      { label: "Recommended for", value: "Plates, cookware, glassware, lunch boxes" },
    ],
    tags: ["dishwash", "utensil cleaner", "kitchen", "lemon"],
    hsnCode: "3402",
    isFeatured: true,
    isBestSeller: true,
    variants: [
      { label: "500 ml", sku: "OV-DW-500", sizeValue: 500, sizeUnit: "ml", mrp: 120, price: 99, costPrice: 52, stock: 180, weightGrams: 560 },
      { label: "1 L", sku: "OV-DW-1000", sizeValue: 1000, sizeUnit: "ml", mrp: 220, price: 179, costPrice: 95, stock: 140, weightGrams: 1100 },
      { label: "5 L", sku: "OV-DW-5000", sizeValue: 5000, sizeUnit: "ml", mrp: 899, price: 749, costPrice: 420, stock: 40, weightGrams: 5400 },
    ],
  },
  {
    slug: "lavender-floor-cleaner",
    name: "Lavender Bloom Floor Cleaner",
    category: "floor-care",
    shape: "jug",
    color: "#9b8ce8",
    accent: "#5b4bc4",
    artTitle: "Floor Cleaner",
    artSubtitle: "Lavender Bloom",
    shortDescription: "Floor cleaner with a calming lavender fragrance for tiles, marble and mosaic floors.",
    description:
      "Ovelia Lavender Bloom Floor Cleaner is made for regular mopping of tiled, marble, granite and mosaic floors. Dilute it in a bucket of water to lift everyday dust and footprints, and leave your rooms with a soft lavender fragrance.\n\nThe sturdy jug with a comfortable grip makes measuring and pouring simple.",
    highlights: ["Made for daily mopping", "Soft lavender fragrance", "Suitable for tile, marble, granite and mosaic", "Easy-pour jug"],
    usageInstructions:
      "Add 2 capfuls (about 30 ml) to half a bucket (4–5 L) of water. Mop the floor and allow it to air dry. For sticky spots, use a little more and wipe with a damp cloth. Test on a small hidden area of delicate or unsealed surfaces first.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Lavender",
    specifications: [
      { label: "Form", value: "Liquid" },
      { label: "Fragrance", value: "Lavender" },
      { label: "Recommended for", value: "Tile, marble, granite and mosaic floors" },
    ],
    tags: ["floor cleaner", "mopping", "lavender"],
    hsnCode: "3402",
    isFeatured: true,
    isBestSeller: true,
    variants: [
      { label: "500 ml", sku: "OV-FL-500", sizeValue: 500, sizeUnit: "ml", mrp: 110, price: 89, costPrice: 45, stock: 160, weightGrams: 560 },
      { label: "1 L", sku: "OV-FL-1000", sizeValue: 1000, sizeUnit: "ml", mrp: 195, price: 159, costPrice: 82, stock: 150, weightGrams: 1100 },
      { label: "5 L", sku: "OV-FL-5000", sizeValue: 5000, sizeUnit: "ml", mrp: 850, price: 699, costPrice: 380, stock: 35, weightGrams: 5400 },
    ],
  },
  {
    slug: "kitchen-degreaser-spray",
    name: "Kitchen Cleaner Spray",
    category: "kitchen-care",
    shape: "spray",
    color: "#f59e42",
    accent: "#c2410c",
    artTitle: "Kitchen Cleaner",
    artSubtitle: "Orange Zest",
    shortDescription: "Ready-to-use spray for stovetops, counters, chimneys and kitchen tiles.",
    description:
      "Ovelia Kitchen Cleaner Spray is a ready-to-use spray for the greasy, sticky surfaces around your stove — gas tops, counters, chimney exteriors and kitchen tiles. Spray, wait a moment, and wipe clean.\n\nPick up the 1 L refill to top up your spray bottle and reduce plastic.",
    highlights: ["Ready to use — no dilution", "Made for stovetops, counters and kitchen tiles", "Orange zest fragrance", "1 L refill pack available"],
    usageInstructions:
      "Spray directly onto the surface from about 20 cm away. Leave for 1–2 minutes, then wipe with a damp cloth or sponge. For food-contact surfaces, rinse with clean water afterwards. Do not spray on hot surfaces.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Orange",
    specifications: [
      { label: "Form", value: "Spray (ready to use)" },
      { label: "Fragrance", value: "Orange zest" },
      { label: "Recommended for", value: "Stovetops, counters, chimney exteriors, kitchen tiles" },
    ],
    tags: ["kitchen cleaner", "degreaser", "spray"],
    hsnCode: "3402",
    isFeatured: true,
    isNewArrival: true,
    variants: [
      { label: "500 ml Spray", sku: "OV-KC-500", sizeValue: 500, sizeUnit: "ml", mrp: 180, price: 149, costPrice: 74, stock: 120, weightGrams: 600 },
      { label: "1 L Refill", sku: "OV-KC-1000R", sizeValue: 1000, sizeUnit: "ml", mrp: 299, price: 249, costPrice: 120, stock: 90, weightGrams: 1100 },
    ],
  },
  {
    slug: "thick-gel-toilet-cleaner",
    name: "Thick Gel Toilet Cleaner",
    category: "bathroom-care",
    shape: "duck",
    color: "#3b82f6",
    accent: "#1e40af",
    artTitle: "Toilet Cleaner",
    artSubtitle: "Thick Gel",
    shortDescription: "Thick gel toilet cleaner with an angled nozzle that reaches under the rim.",
    description:
      "Ovelia Thick Gel Toilet Cleaner clings to the bowl so it has time to work on stains and limescale build-up. The angled neck makes it easy to reach under the rim.\n\nUse it regularly for a cleaner, fresher-smelling toilet.",
    highlights: ["Thick gel clings to the bowl", "Angled neck reaches under the rim", "Fresh fragrance", "Child-resistant cap"],
    usageInstructions:
      "Lift the seat and point the nozzle under the rim. Squeeze to apply all around the bowl. Leave for 10–15 minutes, scrub with a toilet brush and flush. Use only on toilet bowls.",
    safetyInformation:
      "Keep out of reach of children. Do not mix with bleach or other cleaning products. Avoid contact with skin and eyes; wear gloves. In case of contact with eyes, rinse immediately with plenty of water. Do not swallow. Use in a ventilated area.",
    fragrance: "Fresh",
    specifications: [
      { label: "Form", value: "Gel" },
      { label: "Recommended for", value: "Ceramic toilet bowls" },
      { label: "Pack", value: "Angled-neck bottle with child-resistant cap" },
    ],
    tags: ["toilet cleaner", "bathroom", "gel"],
    hsnCode: "3402",
    isBestSeller: true,
    variants: [
      { label: "500 ml", sku: "OV-TC-500", sizeValue: 500, sizeUnit: "ml", mrp: 120, price: 99, costPrice: 50, stock: 170, weightGrams: 580 },
      { label: "1 L", sku: "OV-TC-1000", sizeValue: 1000, sizeUnit: "ml", mrp: 210, price: 179, costPrice: 90, stock: 110, weightGrams: 1120 },
    ],
  },
  {
    slug: "glass-and-mirror-cleaner",
    name: "Glass & Mirror Cleaner",
    category: "glass-care",
    shape: "spray",
    color: "#38bdf8",
    accent: "#0369a1",
    artTitle: "Glass Cleaner",
    artSubtitle: "Crystal Clear",
    shortDescription: "Spray cleaner for windows, mirrors, glass tables and shower screens.",
    description:
      "Ovelia Glass & Mirror Cleaner is a quick spray-and-wipe cleaner for windows, mirrors, glass table tops, cabinet doors and shower screens. Wipe with a dry microfibre cloth for a clear finish.",
    highlights: ["Spray and wipe", "For windows, mirrors and glass tops", "Light, clean fragrance", "1 L refill available"],
    usageInstructions:
      "Spray evenly onto the glass from about 20 cm away. Wipe with a clean, dry, lint-free or microfibre cloth. Avoid spraying on electronic screens or in direct hot sunlight.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Fresh",
    specifications: [
      { label: "Form", value: "Spray (ready to use)" },
      { label: "Recommended for", value: "Windows, mirrors, glass tables, shower screens" },
    ],
    tags: ["glass cleaner", "mirror", "windows", "spray"],
    hsnCode: "3402",
    variants: [
      { label: "500 ml Spray", sku: "OV-GC-500", sizeValue: 500, sizeUnit: "ml", mrp: 125, price: 99, costPrice: 48, stock: 150, weightGrams: 600 },
      { label: "1 L Refill", sku: "OV-GC-1000R", sizeValue: 1000, sizeUnit: "ml", mrp: 199, price: 169, costPrice: 80, stock: 80, weightGrams: 1100 },
    ],
  },
  {
    slug: "multipurpose-surface-cleaner",
    name: "Multipurpose Surface Cleaner",
    category: "floor-care",
    shape: "spray",
    color: "#14b8a6",
    accent: "#0f766e",
    artTitle: "Multipurpose",
    artSubtitle: "Surface Cleaner",
    shortDescription: "One cleaner for counters, tables, appliance exteriors, sinks and tiles.",
    description:
      "Ovelia Multipurpose Surface Cleaner is the everyday all-rounder for hard, washable surfaces around the home — dining tables, counters, appliance exteriors, switchboards (power off), sinks and tiles.\n\nUse it neat for quick wipe-downs or dilute it for larger areas.",
    highlights: ["One bottle for many surfaces", "Use neat or diluted", "Clean, light fragrance", "Value 5 L pack"],
    usageInstructions:
      "Spray onto the surface and wipe with a damp cloth. For large areas, dilute 1 capful in 1 L of water. Rinse food-contact surfaces with water after cleaning. Test on a small hidden area first.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Fresh",
    specifications: [
      { label: "Form", value: "Liquid / spray" },
      { label: "Recommended for", value: "Hard, washable surfaces" },
    ],
    tags: ["multipurpose", "surface cleaner", "all purpose"],
    hsnCode: "3402",
    isFeatured: true,
    variants: [
      { label: "500 ml Spray", sku: "OV-MP-500", sizeValue: 500, sizeUnit: "ml", mrp: 150, price: 129, costPrice: 62, stock: 130, weightGrams: 600 },
      { label: "1 L", sku: "OV-MP-1000", sizeValue: 1000, sizeUnit: "ml", mrp: 260, price: 219, costPrice: 105, stock: 100, weightGrams: 1100 },
      { label: "5 L", sku: "OV-MP-5000", sizeValue: 5000, sizeUnit: "ml", mrp: 1050, price: 899, costPrice: 470, stock: 25, weightGrams: 5400 },
    ],
  },
  {
    slug: "tile-and-bathroom-cleaner",
    name: "Tile & Bathroom Cleaner",
    category: "bathroom-care",
    shape: "spray",
    color: "#34d399",
    accent: "#047857",
    artTitle: "Bathroom Cleaner",
    artSubtitle: "Tiles & Taps",
    shortDescription: "Spray cleaner for bathroom tiles, taps, washbasins and buckets.",
    description:
      "Ovelia Tile & Bathroom Cleaner helps with soap scum and water marks on bathroom tiles, taps, washbasins, buckets and mugs. Spray, leave briefly, scrub and rinse.",
    highlights: ["For tiles, taps and washbasins", "Spray, scrub and rinse", "Fresh fragrance"],
    usageInstructions:
      "Spray onto the surface and leave for 2–3 minutes. Scrub with a brush or sponge and rinse with water. Not for use on natural stone, coloured grout or metal fittings with damaged finishes — test on a small area first.",
    safetyInformation:
      "Keep out of reach of children. Do not mix with bleach or other cleaners. Avoid contact with skin and eyes; wear gloves. Use in a ventilated area. Do not swallow.",
    fragrance: "Fresh",
    specifications: [
      { label: "Form", value: "Spray (ready to use)" },
      { label: "Recommended for", value: "Ceramic tiles, taps, washbasins" },
    ],
    tags: ["bathroom cleaner", "tile cleaner", "spray"],
    hsnCode: "3402",
    isNewArrival: true,
    variants: [
      { label: "500 ml Spray", sku: "OV-BC-500", sizeValue: 500, sizeUnit: "ml", mrp: 140, price: 119, costPrice: 58, stock: 110, weightGrams: 600 },
      { label: "1 L Refill", sku: "OV-BC-1000R", sizeValue: 1000, sizeUnit: "ml", mrp: 240, price: 209, costPrice: 98, stock: 70, weightGrams: 1100 },
    ],
  },
  {
    slug: "liquid-laundry-detergent",
    name: "Liquid Laundry Detergent",
    category: "laundry",
    shape: "jug",
    color: "#06b6d4",
    accent: "#0e7490",
    artTitle: "Liquid Detergent",
    artSubtitle: "Top & Front Load",
    shortDescription: "Liquid detergent for machine and hand wash, with a measuring cap.",
    description:
      "Ovelia Liquid Laundry Detergent dissolves easily in water for top-load machines, front-load machines and bucket wash. Use the measuring cap to dose by load size.",
    highlights: ["For machine and hand wash", "Dissolves easily", "Measuring cap included", "Value 5 L pack"],
    usageInstructions:
      "Machine wash: 1 capful (40 ml) for a normal load; add more for large or heavily soiled loads. Hand wash: dissolve half a capful in a bucket of water. Always check the garment care label. Test on a hidden area for colour fastness.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Fresh",
    specifications: [
      { label: "Form", value: "Liquid" },
      { label: "Suitable for", value: "Top-load, front-load and hand wash" },
    ],
    tags: ["detergent", "laundry", "washing liquid"],
    hsnCode: "3402",
    variants: [
      { label: "1 L", sku: "OV-LD-1000", sizeValue: 1000, sizeUnit: "ml", mrp: 240, price: 199, costPrice: 105, stock: 120, weightGrams: 1150 },
      { label: "2 L", sku: "OV-LD-2000", sizeValue: 2000, sizeUnit: "ml", mrp: 450, price: 379, costPrice: 200, stock: 80, weightGrams: 2250 },
      { label: "5 L", sku: "OV-LD-5000", sizeValue: 5000, sizeUnit: "ml", mrp: 1050, price: 899, costPrice: 480, stock: 30, weightGrams: 5450 },
    ],
  },
  {
    slug: "aloe-hand-wash",
    name: "Aloe Hand Wash",
    category: "laundry",
    shape: "pump",
    color: "#84cc16",
    accent: "#3f6212",
    artTitle: "Hand Wash",
    artSubtitle: "Aloe Fresh",
    shortDescription: "Liquid hand wash in a pump bottle, with a refill pack.",
    description:
      "Ovelia Aloe Hand Wash is a liquid hand wash for kitchens and bathrooms, in an easy pump bottle. Refill packs help you reuse the pump bottle.",
    highlights: ["Easy pump dispenser", "Aloe fragrance", "Refill pack available"],
    usageInstructions: "Wet hands, pump once or twice, lather for at least 20 seconds and rinse well with water.",
    safetyInformation: "For external use only. Avoid contact with eyes; if it happens, rinse with water. Keep out of reach of small children. Discontinue use if irritation occurs.",
    fragrance: "Aloe",
    specifications: [
      { label: "Form", value: "Liquid" },
      { label: "Fragrance", value: "Aloe" },
    ],
    tags: ["hand wash", "hygiene", "aloe"],
    hsnCode: "3401",
    isNewArrival: true,
    variants: [
      { label: "250 ml Pump", sku: "OV-HW-250", sizeValue: 250, sizeUnit: "ml", mrp: 99, price: 89, costPrice: 40, stock: 150, weightGrams: 320 },
      { label: "1 L Refill", sku: "OV-HW-1000R", sizeValue: 1000, sizeUnit: "ml", mrp: 299, price: 249, costPrice: 120, stock: 70, weightGrams: 1100 },
    ],
  },
  {
    slug: "car-shampoo",
    name: "Car Shampoo",
    category: "car-care",
    shape: "wide",
    color: "#1d4ed8",
    accent: "#0f172a",
    artTitle: "Car Shampoo",
    artSubtitle: "Foam Wash",
    shortDescription: "Concentrated car shampoo for bucket washes that lathers into rich foam.",
    description:
      "Ovelia Car Shampoo is a concentrated shampoo for washing cars and bikes by hand. Mix it into a bucket of water for a rich foam that lifts road dust and grime from painted surfaces, glass and trims.",
    highlights: ["Concentrated — a little goes a long way", "Rich foam for hand washing", "For cars and bikes"],
    usageInstructions:
      "Add 2 capfuls (about 30 ml) to a bucket of water (8–10 L). Wash the vehicle in the shade with a wash mitt or soft sponge, working from top to bottom. Rinse with clean water and dry with a microfibre towel.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Fresh",
    specifications: [
      { label: "Form", value: "Concentrated liquid" },
      { label: "Recommended for", value: "Cars and bikes (painted surfaces, glass, trims)" },
    ],
    tags: ["car shampoo", "car wash", "car care"],
    hsnCode: "3402",
    isFeatured: true,
    variants: [
      { label: "500 ml", sku: "OV-CS-500", sizeValue: 500, sizeUnit: "ml", mrp: 249, price: 199, costPrice: 95, stock: 90, weightGrams: 580 },
      { label: "1 L", sku: "OV-CS-1000", sizeValue: 1000, sizeUnit: "ml", mrp: 399, price: 349, costPrice: 170, stock: 60, weightGrams: 1120 },
    ],
  },
  {
    slug: "car-polish",
    name: "Car Polish",
    category: "car-care",
    shape: "tin",
    color: "#d4a017",
    accent: "#7c2d12",
    artTitle: "Car Polish",
    artSubtitle: "Gloss Finish",
    shortDescription: "Liquid car polish for a glossy finish on painted car and bike surfaces.",
    description:
      "Ovelia Car Polish is a liquid polish for clean, dry painted surfaces on cars and bikes. Apply thin, buff off, and enjoy a glossy finish.",
    highlights: ["Easy apply-and-buff liquid", "Glossy finish", "For cars and bikes"],
    usageInstructions:
      "Wash and dry the vehicle first. Shake well. Apply a small amount to a foam applicator and spread thinly in circular motions, one panel at a time, in the shade. Let it haze for a few minutes, then buff off with a clean microfibre cloth. Avoid rubber, plastic trims and glass.",
    safetyInformation: STANDARD_SAFETY,
    fragrance: "Mild",
    specifications: [
      { label: "Form", value: "Liquid polish" },
      { label: "Recommended for", value: "Painted car and bike surfaces" },
    ],
    tags: ["car polish", "car care", "shine"],
    hsnCode: "3405",
    variants: [
      { label: "250 ml", sku: "OV-CP-250", sizeValue: 250, sizeUnit: "ml", mrp: 299, price: 249, costPrice: 120, stock: 70, weightGrams: 320 },
      { label: "500 ml", sku: "OV-CP-500", sizeValue: 500, sizeUnit: "ml", mrp: 520, price: 449, costPrice: 220, stock: 45, weightGrams: 600 },
    ],
  },
  {
    slug: "complete-home-care-kit",
    name: "Complete Home Care Kit",
    category: "kits-combos",
    shape: "kit",
    color: "#0b6b52",
    accent: "#f2c94c",
    artTitle: "Home Care Kit",
    artSubtitle: "4 essentials",
    shortDescription: "Dishwash 500 ml, Floor Cleaner 1 L, Toilet Cleaner 500 ml and Glass Cleaner 500 ml in one kit.",
    description:
      "Set up a new home — or restock in one go — with the Ovelia Complete Home Care Kit. It brings together four everyday essentials: Lemon Fresh Dishwash Liquid (500 ml), Lavender Bloom Floor Cleaner (1 L), Thick Gel Toilet Cleaner (500 ml) and Glass & Mirror Cleaner (500 ml spray).",
    highlights: ["Four essentials in one pack", "Lower price than buying separately", "Great for new homes and gifting"],
    usageInstructions: "Refer to the label on each product for directions.",
    safetyInformation: "See individual product labels. Keep all cleaning products out of reach of children and pets.",
    fragrance: "Assorted",
    specifications: [
      { label: "Contents", value: "Dishwash 500 ml, Floor Cleaner 1 L, Toilet Cleaner 500 ml, Glass Cleaner 500 ml" },
    ],
    tags: ["kit", "combo", "gift", "home care"],
    hsnCode: "3402",
    isFeatured: true,
    variants: [{ label: "Kit of 4", sku: "OV-KIT-HOME4", sizeValue: 4, sizeUnit: "pcs", mrp: 575, price: 449, costPrice: 260, stock: 50, weightGrams: 2900 }],
  },
  {
    slug: "car-care-kit",
    name: "Car Care Kit",
    category: "kits-combos",
    shape: "kit",
    color: "#1d4ed8",
    accent: "#d4a017",
    artTitle: "Car Care Kit",
    artSubtitle: "Wash + Polish",
    shortDescription: "Car Shampoo 500 ml and Car Polish 250 ml together at a kit price.",
    description: "Everything you need for a weekend wash and shine: Ovelia Car Shampoo (500 ml) and Car Polish (250 ml) in one kit.",
    highlights: ["Wash and polish in one kit", "Lower price than buying separately"],
    usageInstructions: "Refer to the label on each product for directions.",
    safetyInformation: "See individual product labels. Keep out of reach of children.",
    fragrance: "Assorted",
    specifications: [{ label: "Contents", value: "Car Shampoo 500 ml, Car Polish 250 ml" }],
    tags: ["kit", "car care", "combo"],
    hsnCode: "3405",
    variants: [{ label: "Kit of 2", sku: "OV-KIT-CAR2", sizeValue: 2, sizeUnit: "pcs", mrp: 548, price: 399, costPrice: 215, stock: 40, weightGrams: 950 }],
  },
];

export const SEED_FAQS = [
  {
    category: "Orders & delivery",
    question: "How long does delivery take?",
    answer:
      "Orders are usually packed and handed to our courier partner within 1–2 business days. The delivery estimate for your PIN code is shown at checkout, and you will receive tracking details by email once your order ships.",
    showOnHome: true,
  },
  {
    category: "Orders & delivery",
    question: "How much is shipping?",
    answer: "Shipping charges are shown in your cart before you pay. Standard delivery is free on orders above the free-shipping amount shown in the cart.",
    showOnHome: true,
  },
  {
    category: "Payments",
    question: "Which payment methods do you accept?",
    answer:
      "You can pay securely online with UPI, debit and credit cards, net banking and supported wallets through Razorpay. Cash on Delivery is available on eligible orders and PIN codes.",
    showOnHome: true,
  },
  {
    category: "Payments",
    question: "Is it safe to pay online?",
    answer:
      "Online payments are processed by Razorpay. Your card details, UPI PIN and banking passwords are entered on Razorpay's secure checkout and are never stored by us.",
    showOnHome: false,
  },
  {
    category: "Orders & delivery",
    question: "Can I cancel my order?",
    answer:
      "Yes — you can cancel from My Account → Orders before your order is packed. If it has already moved further, you can send a cancellation request and our team will review it. Online payments are refunded to the original payment method.",
    showOnHome: true,
  },
  {
    category: "Returns",
    question: "What if a product arrives damaged or leaking?",
    answer:
      "Please contact us within the return window with your order number and photos, or request a return from your order page. We will arrange a replacement or refund for eligible items as described in our Return & Refund Policy.",
    showOnHome: true,
  },
  {
    category: "Orders & delivery",
    question: "How do I track my order?",
    answer: "Use the Track Order page with your order number and the email or phone number used at checkout, or open the order from your account.",
    showOnHome: false,
  },
  {
    category: "Account",
    question: "Do I need an account to order?",
    answer: "No. You can check out as a guest. Creating an account lets you save addresses, see your order history, track orders and keep a wishlist.",
    showOnHome: false,
  },
  {
    category: "Products",
    question: "How should I store cleaning products?",
    answer:
      "Store products in a cool, dry place away from direct sunlight, with caps tightly closed and out of reach of children and pets. Always read and follow the directions on the label, and never mix different cleaning products.",
    showOnHome: false,
  },
];
