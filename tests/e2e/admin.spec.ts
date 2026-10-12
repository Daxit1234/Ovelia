import { expect, test } from "@playwright/test";

test("staff can sign in and reach the admin area", async ({ page }) => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  test.skip(!email || !password, "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD and run the seed first");

  await page.goto("/login?next=/admin");
  await page.locator("#login-email").fill(email!);
  await page.locator("#login-password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByText(/Signed in as/)).toBeVisible();
});

test("customers cannot open the admin area", async ({ page }) => {
  await page.goto("/register?next=/admin");
  await page.locator("#reg-name").fill("Ravi Kumar");
  await page.locator("#reg-email").fill(`customer+${Date.now()}@example.com`);
  await page.locator("#reg-password").fill("Sparkle123");
  await page.locator("#reg-confirm").fill("Sparkle123");
  await page.getByRole("checkbox", { name: /I agree/ }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByText("We couldn't find that page")).toBeVisible();
});
