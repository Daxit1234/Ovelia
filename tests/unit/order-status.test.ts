import { describe, expect, it } from "vitest";
import {
  allowedAdminTransitions,
  canAdminTransition,
  canCarrierTransition,
  ORDER_STATUSES,
  trackingStepIndex,
} from "@/lib/domain/order-status";
import { hasPermission, permissionsFor } from "@/lib/domain/roles";

describe("order state machine", () => {
  it("never lets an admin mark an unpaid online order as confirmed", () => {
    expect(canAdminTransition("pending_payment", "confirmed")).toBe(false);
    expect(allowedAdminTransitions("pending_payment")).toEqual(["cancelled"]);
  });

  it("follows the fulfilment flow", () => {
    expect(canAdminTransition("confirmed", "processing")).toBe(true);
    expect(canAdminTransition("processing", "packed")).toBe(true);
    expect(canAdminTransition("packed", "shipped")).toBe(true);
    expect(canAdminTransition("shipped", "out_for_delivery")).toBe(true);
    expect(canAdminTransition("out_for_delivery", "delivered")).toBe(true);
  });

  it("blocks invalid jumps and changes to terminal orders", () => {
    expect(canAdminTransition("confirmed", "delivered")).toBe(false);
    expect(canAdminTransition("shipped", "cancelled")).toBe(false);
    expect(canAdminTransition("delivered", "processing")).toBe(false);
    expect(canAdminTransition("cancelled", "confirmed")).toBe(false);
  });

  it("supports failed delivery and RTO workflows", () => {
    expect(canAdminTransition("out_for_delivery", "delivery_failed")).toBe(true);
    expect(canAdminTransition("delivery_failed", "rto_initiated")).toBe(true);
    expect(canAdminTransition("rto_initiated", "rto_delivered")).toBe(true);
    expect(canCarrierTransition("shipped", "delivered")).toBe(true);
    expect(canCarrierTransition("confirmed", "delivered")).toBe(false);
  });

  it("defines transitions for every status", () => {
    for (const status of ORDER_STATUSES) expect(Array.isArray(allowedAdminTransitions(status))).toBe(true);
    expect(trackingStepIndex("delivered")).toBe(4);
  });
});

describe("role permissions", () => {
  it("grants super admins everything and customers nothing", () => {
    expect(hasPermission("super_admin", "staff:manage")).toBe(true);
    expect(permissionsFor("customer")).toEqual([]);
    expect(hasPermission(undefined, "orders:read")).toBe(false);
  });

  it("scopes managers to their areas", () => {
    expect(hasPermission("product_manager", "products:write")).toBe(true);
    expect(hasPermission("product_manager", "orders:refund")).toBe(false);
    expect(hasPermission("order_manager", "orders:refund")).toBe(true);
    expect(hasPermission("order_manager", "settings:write")).toBe(false);
    expect(hasPermission("marketing_manager", "promotions:write")).toBe(true);
    expect(hasPermission("support_agent", "orders:update")).toBe(false);
  });
});
