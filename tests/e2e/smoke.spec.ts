import { expect, test } from "@playwright/test";

test.describe("storefront smoke", () => {
  test("home page shows hero, categories and products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /shop now/i }).first()).toBeVisible();
    await expect(page.getByText("Care for every corner")).toBeVisible();
    await expect(page.getByText("Featured products")).toBeVisible();
  });

  test("shop search and filters update the results", async ({ page }) => {
    await page.goto("/shop?q=floor");
    await expect(page.getByRole("heading", { name: /results for/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lavender Bloom Floor Cleaner" }).first()).toBeVisible();
    await page.goto("/shop?category=car-care&sort=price_asc");
    await expect(page.getByRole("link", { name: "Car Shampoo" }).first()).toBeVisible();
  });

  test("product page shows variants, price and add to cart", async ({ page }) => {
    await page.goto("/products/lemon-fresh-dishwash-liquid");
    await expect(page.getByRole("heading", { level: 1, name: "Lemon Fresh Dishwash Liquid" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Choose a size" }).getByRole("radio", { name: /^1 L/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  });

  test("unknown pages show the 404 page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
  });

  test("account pages require sign in", async ({ page }) => {
    await page.goto("/account");
    await page.waitForURL(/\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
