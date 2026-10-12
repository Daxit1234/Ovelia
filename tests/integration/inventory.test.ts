/**
 * Stock safety against a real MongoDB (an in-memory single-node replica set,
 * so transactions behave as on Atlas). These tests race real concurrent
 * writes; they are what guarantees the store never oversells.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let replSet: MongoMemoryReplSet;
let db: typeof import("@/lib/db");
let inventory: typeof import("@/lib/services/inventory");
let model: typeof import("@/lib/db/model");

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = replSet.getUri("ovelia-test");
  process.env.MONGODB_TRANSACTIONS = "auto";
  process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-0123456789abcdef";
  // Import after the environment is set: the env is validated on first use.
  db = await import("@/lib/db");
  inventory = await import("@/lib/services/inventory");
  model = await import("@/lib/db/model");
  await db.connectDB();
});

afterAll(async () => {
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  await replSet?.stop();
});

let seq = 0;

async function createProduct(stocks: number[]) {
  const id = `${Date.now().toString(36)}${seq++}`;
  const category = await db.Category.create({ name: `Category ${id}`, slug: `category-${id}` });
  const product = await db.Product.create({
    name: `Test cleaner ${id}`,
    slug: `test-cleaner-${id}`,
    category: category._id,
    categoryPath: [category._id],
    status: "published",
    variants: stocks.map((stock, i) => ({
      label: `${(i + 1) * 500} ml`,
      sku: `T-${id}-${i}`.toUpperCase(),
      sizeValue: (i + 1) * 500,
      sizeUnit: "ml",
      mrp: 20_000,
      price: 15_000,
      costPrice: 8_000,
      stock,
      reserved: 0,
      lowStockThreshold: 1,
      weightGrams: 500,
      isActive: true,
      sortOrder: i,
    })),
  });
  return {
    productId: product._id.toHexString(),
    variantIds: product.variants.map((v) => v._id.toHexString()),
  };
}

async function variantState(productId: string, variantId: string) {
  const product = await db.Product.findById(productId, { variants: 1 }).lean();
  const variant = product!.variants.find((v) => v._id.toHexString() === variantId)!;
  return { stock: variant.stock, reserved: variant.reserved };
}

async function ledgerTotal(variantId: string) {
  const movements = await db.InventoryMovement.find({ variantId: model.toObjectId(variantId) }).lean();
  return {
    stock: movements.reduce((sum, m) => sum + m.stockChange, 0),
    reserved: movements.reduce((sum, m) => sum + m.reservedChange, 0),
    count: movements.length,
  };
}

const order = () => ({ orderId: new model.ObjectId(), orderNumber: `OV-TEST-${seq++}` });

describe("inventory under concurrency", () => {
  it("never oversells when many orders race for the last units", async () => {
    const { productId, variantIds } = await createProduct([5]);
    const line = { productId, variantId: variantIds[0], quantity: 1 };
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => inventory.deductStock([line], order(), null)));

    const sold = attempts.filter((a) => a.status === "fulfilled").length;
    const refused = attempts.filter((a) => a.status === "rejected");
    expect(sold).toBe(5);
    expect(refused).toHaveLength(7);
    for (const r of refused) expect((r as PromiseRejectedResult).reason).toBeInstanceOf(inventory.InsufficientStockError);
    expect(await variantState(productId, variantIds[0])).toEqual({ stock: 0, reserved: 0 });
    expect(await ledgerTotal(variantIds[0])).toMatchObject({ stock: -5, count: 5 });
  });

  it("treats a multi-item order as all-or-nothing without a transaction", async () => {
    const { productId, variantIds } = await createProduct([3, 1]);
    const lines = [
      { productId, variantId: variantIds[0], quantity: 2 },
      { productId, variantId: variantIds[1], quantity: 2 },
    ];
    await expect(inventory.deductStock(lines, order(), null)).rejects.toBeInstanceOf(inventory.InsufficientStockError);
    // The first line was taken, then given back when the second could not be.
    expect(await variantState(productId, variantIds[0])).toEqual({ stock: 3, reserved: 0 });
    expect(await variantState(productId, variantIds[1])).toEqual({ stock: 1, reserved: 0 });
  });

  it("rolls stock back when a transaction is aborted", async () => {
    const { productId, variantIds } = await createProduct([4]);
    expect(await db.supportsTransactions()).toBe(true);
    await expect(
      db.withTransaction(async (session) => {
        await inventory.deductStock([{ productId, variantId: variantIds[0], quantity: 3 }], order(), session);
        throw new Error("Payment provider unavailable");
      }),
    ).rejects.toThrow("Payment provider unavailable");
    expect(await variantState(productId, variantIds[0])).toEqual({ stock: 4, reserved: 0 });
    expect((await ledgerTotal(variantIds[0])).count).toBe(0);
  });

  it("reserves, commits and releases stock exactly once", async () => {
    const { productId, variantIds } = await createProduct([4]);
    const variantId = variantIds[0];
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const holds = await Promise.allSettled(
      Array.from({ length: 6 }, () => inventory.reserveStock([{ productId, variantId, quantity: 1 }], { ...order(), expiresAt }, null)),
    );
    const reservations = holds.flatMap((h) => (h.status === "fulfilled" ? [h.value._id] : []));
    expect(reservations).toHaveLength(4);
    expect(await variantState(productId, variantId)).toEqual({ stock: 0, reserved: 4 });

    // A webhook and the browser confirming the same payment at once: one commit wins.
    const commits = await Promise.all([inventory.commitReservation(reservations[0], {}, null), inventory.commitReservation(reservations[0], {}, null)]);
    expect(commits.sort()).toEqual(["already", "committed"]);

    // An expiry job and a cancellation releasing the same hold: stock returns once.
    const releases = await Promise.all([inventory.releaseReservation(reservations[1], "expired", {}, null), inventory.releaseReservation(reservations[1], "cancelled", {}, null)]);
    expect(releases.filter(Boolean)).toHaveLength(1);

    // A released hold can no longer be committed (late payments are handled separately).
    expect(await inventory.commitReservation(reservations[1], {}, null)).toBe("released");
    expect(await variantState(productId, variantId)).toEqual({ stock: 1, reserved: 2 });
  });

  it("keeps the stock ledger in step with stock while an admin sets a count during sales", async () => {
    const { productId, variantIds } = await createProduct([10]);
    const variantId = variantIds[0];
    const actor = { id: null, name: "Test admin", type: "admin" as const };
    await Promise.all([
      inventory.adjustStock({ productId, variantId, mode: "set", quantity: 20, reason: "Stock count", actor }),
      ...Array.from({ length: 3 }, () => inventory.deductStock([{ productId, variantId, quantity: 1 }], order(), null)),
    ]);
    const { stock } = await variantState(productId, variantId);
    // Sales that land after the count reduce it; none are ever lost or double counted.
    expect(stock).toBeGreaterThanOrEqual(17);
    expect(stock).toBeLessThanOrEqual(20);
    expect(10 + (await ledgerTotal(variantId)).stock).toBe(stock);
  });
});
