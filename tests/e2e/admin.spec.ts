import { expect, test, type Page } from "@playwright/test";
import { parseCsv } from "../../src/lib/csv";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const ADMIN_STATE = "test-results/.auth/admin.json";

async function signInAsAdmin(page: Page) {
  await page.goto("/login?next=/admin");
  await page.locator("#login-email").fill(email!);
  await page.locator("#login-password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/admin");
}

/** Reads one column of one SKU from the products CSV export (as the signed-in admin). */
async function exportedValue(page: Page, sku: string, column: string): Promise<string> {
  const res = await page.request.get("/api/admin/export/products");
  expect(res.status()).toBe(200);
  const [header, ...rows] = parseCsv(await res.text()).map((r) => r.cells);
  const columns = header;
  const row = rows.find((cells) => cells[columns.indexOf("sku")] === sku);
  expect(row, `SKU ${sku} in export`).toBeTruthy();
  return row![columns.indexOf(column)];
}

test("customers cannot open the admin area", async ({ page }) => {
  await page.goto("/register?next=/admin");
  await page.locator("#reg-name").fill("Ravi Kumar");
  await page.locator("#reg-email").fill(`customer+${Date.now()}@example.com`);
  await page.locator("#reg-password").fill("Sparkle123");
  await page.locator("#reg-confirm").fill("Sparkle123");
  await page.getByRole("checkbox", { name: /I agree/ }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  // Admin APIs check permissions on the server too.
  expect((await page.request.get("/api/admin/export/orders")).status()).toBe(403);
});

test("admin APIs reject anonymous requests", async ({ request }) => {
  for (const path of ["/api/admin/export/orders", "/api/admin/export/products", "/api/admin/export/customers", "/api/admin/export/newsletter"]) {
    expect((await request.get(path)).status(), path).toBe(403);
  }
  const upload = await request.post("/api/admin/uploads", { multipart: { folder: "products" } });
  expect(upload.status()).toBe(403);
});

test.describe("admin", () => {
  test.skip(!email || !password, "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD and run the seed first");
  // Sign in once and reuse the session: repeated sign-ins would trip the login rate limit.
  test.use({ storageState: ADMIN_STATE });

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await signInAsAdmin(page);
    await context.storageState({ path: ADMIN_STATE });
    await context.close();
  });

  test("staff can sign in and see the dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Key metrics" })).toContainText("Total sales");
  });

  test("a coupon created in the admin is applied by the storefront", async ({ page }) => {
    const code = `E2E${Date.now().toString(36).toUpperCase()}`;
    await page.goto("/admin/promotions/new");
    await page.getByLabel("Name", { exact: true }).fill(`E2E coupon ${code}`);
    await page.getByRole("textbox", { name: "Coupon code" }).fill(code);
    await page.getByLabel("Percentage off").fill("5");
    await page.getByRole("button", { name: "Create promotion" }).click();
    await page.waitForURL(/\/admin\/promotions\/[a-f0-9]{24}$/);

    await page.goto("/products/glass-and-mirror-cleaner");
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.getByRole("dialog").getByRole("link", { name: "View cart" }).click();
    await page.waitForURL("**/cart");
    // The admin's cart persists between runs; clear a coupon left by an earlier run.
    const removeCoupon = page.getByRole("button", { name: "Remove coupon" });
    if (await removeCoupon.isVisible()) await removeCoupon.click();
    await page.getByLabel("Coupon code").fill(code.toLowerCase());
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    // Unused promotions can be deleted; this keeps repeated runs tidy.
    await page.goto(`/admin/promotions?q=${code}`);
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Promotion deleted")).toBeVisible();
  });

  test("product CSV import previews, applies and audits changes", async ({ page }) => {
    const sku = "OV-GC-500";
    const current = Number(await exportedValue(page, sku, "low_stock_threshold"));
    const next = current === 12 ? 13 : 12;

    await page.goto("/admin/products/import");
    // A file with a mistake is rejected with the line and column.
    await page.locator("#product-csv").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("sku,price_inr\nOV-GC-500,10\n") });
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(page.getByText("Unknown column “price_inr”.")).toBeVisible();

    await page.locator("#product-csv").setInputFiles({ name: "update.csv", mimeType: "text/csv", buffer: Buffer.from(`sku,low_stock_threshold\n${sku},${next}\n`) });
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(page.getByText(`${sku}: alert level ${current} → ${next}`)).toBeVisible();
    await page.getByRole("button", { name: "Import 1 product" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import" }).click();
    await expect(page.getByRole("region", { name: "Import result" })).toContainText("Import complete");

    expect(Number(await exportedValue(page, sku, "low_stock_threshold"))).toBe(next);
    await page.goto("/admin/audit?q=CSV+import");
    await expect(page.getByText("CSV import: 0 created, 1 updated").first()).toBeVisible();
  });

  test("announcement bar edits reach the storefront", async ({ page }) => {
    const text = `Monsoon offers are live ${Date.now()}`;
    await page.goto("/admin/content?tab=announcement");
    const field = page.getByLabel("Text", { exact: true });
    const original = await field.inputValue();
    await field.fill(text);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Announcement bar saved")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(text)).toBeVisible();

    await page.goto("/admin/content?tab=announcement");
    await page.getByLabel("Text", { exact: true }).fill(original);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Announcement bar saved")).toBeVisible();
  });
});
