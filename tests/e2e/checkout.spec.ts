import { expect, test, type Page } from "@playwright/test";

async function fillCheckout(page: Page) {
  await page.locator("#contact-name").fill("Asha Verma");
  await page.locator("#contact-email").fill(`e2e+${Date.now()}@example.com`);
  await page.locator("#contact-phone").fill("9876543210");
  await page.locator("#shippingAddress-fullName").fill("Asha Verma");
  await page.locator("#shippingAddress-phone").fill("9876543210");
  await page.locator("#shippingAddress-line1").fill("Flat 12, Green Residency, MG Road");
  await page.locator("#shippingAddress-city").fill("Pune");
  await page.locator("#shippingAddress-pincode").fill("411001");
  await page.locator("#shipping-state").click();
  await page.getByRole("option", { name: "Maharashtra", exact: true }).click();
}

test("guest can buy a product with Cash on Delivery", async ({ page }) => {
  await page.goto("/products/lemon-fresh-dishwash-liquid");
  await page.getByRole("radiogroup", { name: "Choose a size" }).getByRole("radio", { name: /^1 L/ }).click();
  await page.getByRole("button", { name: /add to cart/i }).click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText("Lemon Fresh Dishwash Liquid");
  await drawer.getByRole("link", { name: "Checkout" }).click();
  await page.waitForURL("**/checkout");

  await fillCheckout(page);
  await page.getByText("Cash on Delivery", { exact: true }).click();
  const placeOrder = page.getByRole("button", { name: /place order/i });
  await expect(placeOrder).toBeEnabled();
  await placeOrder.click();

  await page.waitForURL(/\/orders\/OV-\d{6}-[A-Z0-9]{5}\?token=.+placed=1/);
  await expect(page.getByText("Thank you! Your order is confirmed.")).toBeVisible();
  // Previously visited pages stay mounted (hidden), so scope to this page.
  await expect(page.getByRole("region", { name: "Items" }).getByText("Lemon Fresh Dishwash Liquid")).toBeVisible();

  // The cart is emptied after a successful order.
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
});

test("coupon codes are validated on the server", async ({ page }) => {
  await page.goto("/products/glass-and-mirror-cleaner");
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.getByRole("dialog").getByRole("link", { name: "View cart" }).click();
  await page.waitForURL("**/cart");

  await page.getByLabel("Coupon code").fill("NOTREAL");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("This coupon code is not valid.")).toBeVisible();

  await page.getByLabel("Coupon code").fill("FREESHIP");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("FREESHIP", { exact: true })).toBeVisible();
});
