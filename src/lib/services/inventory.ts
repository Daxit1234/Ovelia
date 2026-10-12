import "server-only";
import type { ClientSession, Types } from "mongoose";
import {
  connectDB,
  InventoryMovement,
  Product,
  StockReservation,
  type MovementType,
  type StockReservationDoc,
  type VariantDoc,
} from "@/lib/db";
import { toObjectId } from "@/lib/db/model";
import { AppError } from "@/lib/result";

export interface StockLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface InventoryActor {
  id: string | null;
  name: string;
  email?: string | null;
  type: "admin" | "system" | "customer";
}

export const SYSTEM_ACTOR: InventoryActor = { id: null, name: "System", type: "system" };

export class InsufficientStockError extends AppError {
  readonly variantId: string;
  constructor(message: string, variantId: string) {
    super(message, "INSUFFICIENT_STOCK", 409);
    this.variantId = variantId;
  }
}

interface MovementContext {
  orderId?: Types.ObjectId | null;
  orderNumber?: string | null;
  reason?: string;
  actor?: InventoryActor;
}

/** Combines duplicate variant lines so each variant is updated once. */
export function aggregateLines(lines: StockLine[]): StockLine[] {
  const map = new Map<string, StockLine>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new AppError("Invalid quantity", "INVALID_QUANTITY");
    }
    const existing = map.get(line.variantId);
    if (existing) existing.quantity += line.quantity;
    else map.set(line.variantId, { ...line });
  }
  return [...map.values()];
}

type StockUpdateResult = { productName: string; variant: VariantDoc };

/**
 * Applies `$inc` to one variant only when `guard` matches that same variant
 * (via $elemMatch), which makes the check-and-update atomic.
 */
async function updateVariant(
  line: StockLine,
  guard: Record<string, unknown>,
  inc: { stock?: number; reserved?: number },
  session: ClientSession | null,
): Promise<StockUpdateResult | null> {
  const update: Record<string, number> = {};
  if (inc.stock) update["variants.$.stock"] = inc.stock;
  if (inc.reserved) update["variants.$.reserved"] = inc.reserved;
  const doc = await Product.findOneAndUpdate(
    { _id: toObjectId(line.productId), variants: { $elemMatch: { _id: toObjectId(line.variantId), ...guard } } },
    { $inc: update },
    { returnDocument: "after", session: session ?? undefined, projection: { name: 1, variants: 1 } },
  ).lean();
  if (!doc) return null;
  const variant = (doc.variants as VariantDoc[]).find((v) => v._id.toHexString() === line.variantId);
  return variant ? { productName: doc.name, variant } : null;
}

async function recordMovement(
  type: MovementType,
  line: StockLine,
  result: StockUpdateResult,
  change: { stock: number; reserved: number },
  ctx: MovementContext,
  session: ClientSession | null,
) {
  await InventoryMovement.create(
    [
      {
        productId: toObjectId(line.productId),
        variantId: toObjectId(line.variantId),
        sku: result.variant.sku,
        productName: result.productName,
        variantLabel: result.variant.label,
        type,
        stockChange: change.stock,
        reservedChange: change.reserved,
        stockAfter: result.variant.stock,
        reservedAfter: result.variant.reserved,
        reason: ctx.reason ?? "",
        orderId: ctx.orderId ?? null,
        orderNumber: ctx.orderNumber ?? null,
        actor: ctx.actor ?? SYSTEM_ACTOR,
      },
    ],
    { session: session ?? undefined },
  );
}

async function describeShortage(line: StockLine): Promise<string> {
  const product = await Product.findById(line.productId, { name: 1, status: 1, variants: 1 }).lean();
  const variant = (product?.variants as VariantDoc[] | undefined)?.find((v) => v._id.toHexString() === line.variantId);
  if (!product || !variant || !variant.isActive || product.status !== "published") {
    return "An item in your cart is no longer available.";
  }
  if (variant.stock <= 0) return `${product.name} (${variant.label}) is out of stock.`;
  return `Only ${variant.stock} of ${product.name} (${variant.label}) left in stock.`;
}

/**
 * Decrements several variants atomically. With a session the surrounding
 * transaction provides atomicity; without one, already-applied lines are
 * reverted when a later line fails.
 */
async function applyAll(
  lines: StockLine[],
  apply: (line: StockLine) => Promise<StockUpdateResult | null>,
  revert: (line: StockLine) => Promise<unknown>,
  session: ClientSession | null,
): Promise<StockUpdateResult[]> {
  const applied: { line: StockLine; result: StockUpdateResult }[] = [];
  for (const line of lines) {
    const result = await apply(line);
    if (!result) {
      const message = await describeShortage(line);
      if (!session) {
        for (const done of applied.reverse()) await revert(done.line).catch((e) => console.error("Stock revert failed", e));
      }
      throw new InsufficientStockError(message, line.variantId);
    }
    applied.push({ line, result });
  }
  return applied.map((a) => a.result);
}

/** Holds stock for an online payment that is in progress. */
export async function reserveStock(
  rawLines: StockLine[],
  ctx: { orderId: Types.ObjectId; orderNumber: string; expiresAt: Date; actor?: InventoryActor; reservationId?: Types.ObjectId },
  session: ClientSession | null,
): Promise<StockReservationDoc> {
  await connectDB();
  const lines = aggregateLines(rawLines);
  const results = await applyAll(
    lines,
    (line) => updateVariant(line, { isActive: true, stock: { $gte: line.quantity } }, { stock: -line.quantity, reserved: line.quantity }, session),
    (line) => updateVariant(line, {}, { stock: line.quantity, reserved: -line.quantity }, null),
    session,
  );
  const [reservation] = await StockReservation.create(
    [
      {
        ...(ctx.reservationId ? { _id: ctx.reservationId } : {}),
        orderId: ctx.orderId,
        orderNumber: ctx.orderNumber,
        items: lines.map((line, i) => ({
          productId: toObjectId(line.productId),
          variantId: toObjectId(line.variantId),
          sku: results[i].variant.sku,
          quantity: line.quantity,
        })),
        status: "active",
        expiresAt: ctx.expiresAt,
      },
    ],
    { session: session ?? undefined },
  );
  for (let i = 0; i < lines.length; i++) {
    await recordMovement("reserve", lines[i], results[i], { stock: -lines[i].quantity, reserved: lines[i].quantity }, { ...ctx, reason: "Reserved for online payment" }, session);
  }
  return reservation.toObject();
}

/**
 * Converts a reservation into a sale after a verified payment. Returns
 * "committed" on success, "already" if done before, or "released" if the
 * reservation had already expired and its stock was returned.
 */
export async function commitReservation(
  reservationId: Types.ObjectId,
  ctx: MovementContext,
  session: ClientSession | null,
): Promise<"committed" | "already" | "released" | "missing"> {
  await connectDB();
  const reservation = await StockReservation.findOneAndUpdate(
    { _id: reservationId, status: "active" },
    { $set: { status: "committed" } },
    { returnDocument: "after", session: session ?? undefined },
  ).lean();
  if (!reservation) {
    const existing = await StockReservation.findById(reservationId, { status: 1 }, { session: session ?? undefined }).lean();
    if (!existing) return "missing";
    return existing.status === "committed" ? "already" : "released";
  }
  for (const item of reservation.items) {
    const line = { productId: item.productId.toHexString(), variantId: item.variantId.toHexString(), quantity: item.quantity };
    const result = await updateVariant(line, { reserved: { $gte: item.quantity } }, { reserved: -item.quantity }, session);
    if (result) {
      await recordMovement("commit", line, result, { stock: 0, reserved: -item.quantity }, { ...ctx, reason: ctx.reason ?? "Payment confirmed" }, session);
    } else {
      console.error(`Reserved count lower than expected for variant ${line.variantId} (reservation ${reservationId})`);
    }
  }
  return "committed";
}

/** Returns reserved stock to sale. Idempotent: only active reservations are released. */
export async function releaseReservation(
  reservationId: Types.ObjectId,
  reason: string,
  ctx: MovementContext,
  session: ClientSession | null,
): Promise<boolean> {
  await connectDB();
  const reservation = await StockReservation.findOneAndUpdate(
    { _id: reservationId, status: "active" },
    { $set: { status: "released", releasedAt: new Date(), releaseReason: reason } },
    { returnDocument: "after", session: session ?? undefined },
  ).lean();
  if (!reservation) return false;
  for (const item of reservation.items) {
    const line = { productId: item.productId.toHexString(), variantId: item.variantId.toHexString(), quantity: item.quantity };
    const result = await updateVariant(line, { reserved: { $gte: item.quantity } }, { stock: item.quantity, reserved: -item.quantity }, session);
    if (result) {
      await recordMovement("release", line, result, { stock: item.quantity, reserved: -item.quantity }, { ...ctx, reason }, session);
    }
  }
  return true;
}

/** Immediate sale (Cash on Delivery, or a late payment after a released reservation). */
export async function deductStock(rawLines: StockLine[], ctx: MovementContext, session: ClientSession | null): Promise<void> {
  await connectDB();
  const lines = aggregateLines(rawLines);
  const results = await applyAll(
    lines,
    (line) => updateVariant(line, { stock: { $gte: line.quantity } }, { stock: -line.quantity }, session),
    (line) => updateVariant(line, {}, { stock: line.quantity }, null),
    session,
  );
  for (let i = 0; i < lines.length; i++) {
    await recordMovement("sale", lines[i], results[i], { stock: -lines[i].quantity, reserved: 0 }, { ...ctx, reason: ctx.reason ?? "Order placed" }, session);
  }
}

/** Puts goods back into sellable stock (cancellations, returns, RTO). */
export async function restockLines(
  rawLines: StockLine[],
  type: "restock" | "return",
  ctx: MovementContext,
  session: ClientSession | null,
): Promise<void> {
  await connectDB();
  for (const line of aggregateLines(rawLines)) {
    const result = await updateVariant(line, {}, { stock: line.quantity }, session);
    if (result) await recordMovement(type, line, result, { stock: line.quantity, reserved: 0 }, ctx, session);
  }
}

/** Manual stock correction by an administrator. */
export async function adjustStock(input: {
  productId: string;
  variantId: string;
  mode: "add" | "remove" | "set";
  quantity: number;
  reason: string;
  actor: InventoryActor;
  /** Ledger type; "import" for CSV imports. */
  movementType?: "adjustment" | "import";
}): Promise<VariantDoc> {
  await connectDB();
  if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new AppError("Quantity must be a whole number of 0 or more");
  const movementType = input.movementType ?? "adjustment";
  const line = { productId: input.productId, variantId: input.variantId, quantity: Math.max(1, input.quantity) };

  if (input.mode === "set") {
    // Optimistic concurrency: only apply the delta if stock is unchanged
    // since we read it, so concurrent sales are never overwritten.
    for (let attempt = 0; attempt < 5; attempt++) {
      const product = await Product.findOne(
        { _id: toObjectId(input.productId), "variants._id": toObjectId(input.variantId) },
        { name: 1, variants: 1 },
      ).lean();
      const previous = (product?.variants as VariantDoc[] | undefined)?.find((v) => v._id.toHexString() === input.variantId);
      if (!product || !previous) throw new AppError("Variant not found", "NOT_FOUND", 404);
      const delta = input.quantity - previous.stock;
      if (delta === 0) return previous;
      const result = await updateVariant(line, { stock: previous.stock }, { stock: delta }, null);
      if (result) {
        await recordMovement(movementType, line, result, { stock: delta, reserved: 0 }, { reason: input.reason, actor: input.actor }, null);
        return result.variant;
      }
    }
    throw new AppError("Stock changed while saving. Please try again.");
  }

  if (input.quantity === 0) throw new AppError("Enter a quantity greater than zero");
  const delta = input.mode === "add" ? input.quantity : -input.quantity;
  const result = await updateVariant(line, delta < 0 ? { stock: { $gte: -delta } } : {}, { stock: delta }, null);
  if (!result) {
    throw new AppError(delta < 0 ? "Cannot remove more units than are in stock" : "Variant not found");
  }
  await recordMovement(movementType, line, result, { stock: delta, reserved: 0 }, { reason: input.reason, actor: input.actor }, null);
  return result.variant;
}

/** Records the opening stock of newly created variants. */
export async function recordInitialStock(
  product: { _id: Types.ObjectId; name: string; variants: VariantDoc[] },
  actor: InventoryActor,
  type: "initial" | "import" = "initial",
): Promise<void> {
  const movements = product.variants
    .filter((v) => v.stock > 0)
    .map((v) => ({
      productId: product._id,
      variantId: v._id,
      sku: v.sku,
      productName: product.name,
      variantLabel: v.label,
      type,
      stockChange: v.stock,
      reservedChange: 0,
      stockAfter: v.stock,
      reservedAfter: v.reserved ?? 0,
      reason: type === "initial" ? "Opening stock" : "Stock set by CSV import",
      actor,
    }));
  if (movements.length) await InventoryMovement.insertMany(movements);
}

/** Active reservations whose hold time has passed. */
export async function findExpiredReservations(now: Date, limit = 50) {
  await connectDB();
  return StockReservation.find({ status: "active", expiresAt: { $lte: now } }).sort({ expiresAt: 1 }).limit(limit).lean();
}
