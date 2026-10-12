# Ovelia — home & car care store

Online store for Ovelia's household cleaning, hygiene and car care products, built for India: prices in ₹ (GST inclusive), Indian addresses and PIN codes, UPI / cards / net banking / wallets through Razorpay, and Cash on Delivery.

It has two parts:

- **Storefront**: home page, shop with search, filters and sorting, product pages with sizes (500 ml / 1 L / 5 L…), cart with coupons and a free-delivery meter, guest or account checkout, order tracking, cancellations, returns, reviews, wishlist and customer accounts.
- **Admin** (`/admin`): dashboard, orders and fulfilment, returns and refunds, customers, products (with CSV import/export), categories, inventory with a full stock ledger, promotions, reviews, storefront content, settings, staff roles and an audit log.

## Tech stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 + shadcn/ui · MongoDB + Mongoose 9 · Better Auth · React Hook Form + Zod · Razorpay · Resend · Cloudinary · Shiprocket (optional) · Vitest · Playwright.

## Run it locally

You need Node.js 20.9 or newer. MongoDB does not need to be installed: `npm run db:dev` starts a local single-node replica set, which supports transactions like MongoDB Atlas does.

```bash
npm install
cp .env.example .env.local
```

In `.env.local`, set at least:

- `BETTER_AUTH_SECRET`: a random string of 32+ characters (`openssl rand -base64 32`).
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: the first admin account.

Then, in two terminals:

```bash
npm run db:dev     # terminal 1: local MongoDB on 127.0.0.1:27017, data in ~/.ovelia/mongo-data
npm run db:seed    # terminal 2: categories, sample products, offers, FAQs and the admin account
npm run dev        # http://localhost:3100   (admin: http://localhost:3100/admin)
```

The seed is safe to run again; it only adds what is missing. Sample product prices, stock and descriptions are placeholders for you to replace.

Without Razorpay keys, online payment is unavailable and checkout offers Cash on Delivery (when enabled in Settings). Without Resend, emails are not sent: each one is printed to the terminal in development and recorded as skipped. Without Cloudinary, uploaded images are saved to `public/uploads` (development only).

## Configuration

Every variable is described in [.env.example](.env.example). Secrets live only in environment variables on the server. They are never sent to the browser or shown in the admin; **Admin → Settings → Integrations** shows only whether each one is configured.

| Integration | Variables | Notes |
| --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Add a webhook to `https://<your-domain>/api/webhooks/razorpay` with the events `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed` and `refund.failed`. Use test keys (`rzp_test_…`) until launch. |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | `EMAIL_FROM` must use a domain verified in Resend. |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required for image uploads in production. |
| Shiprocket (optional) | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_WEBHOOK_TOKEN` | Use a Shiprocket API user. For tracking updates, add the webhook `https://<your-domain>/api/webhooks/shipping` with the token as `x-api-key`. Without Shiprocket, staff enter the courier and tracking number by hand. |
| Scheduled jobs | `CRON_SECRET` | `/api/cron/maintenance` expires unpaid online orders and returns their held stock. |

Store details, shipping fees, COD rules, GST, return window, review rules and policy pages are edited in **Admin → Settings**, not in code.

## How orders stay correct

- **Prices are always recalculated on the server.** Item prices, discounts, shipping, COD fees, GST and the total are computed by one pricing engine (`src/lib/domain/pricing.ts`). The browser's totals are never trusted, and an order is refused if its total changed while the customer was checking out.
- **Payments are verified, never assumed.** Razorpay orders are created on the server and payment signatures checked there. A payment is confirmed only after fetching it from Razorpay or receiving a signed webhook. Reaching the success page alone never marks an order as paid. Webhooks are deduplicated by event id, and checkout requests by an idempotency key, so retries never create duplicate orders or charges.
- **Stock can't be oversold.** Every stock change is a single atomic database update that checks availability. Online payments hold stock while the customer pays and release it if the payment never completes; COD orders take stock when placed. With MongoDB transactions (Atlas, or `npm run db:dev`) multi-item orders are all-or-nothing; without them, earlier lines are put back automatically. Every change is written to the stock ledger in **Admin → Inventory**.
- **Orders keep a snapshot** of product names, SKUs, sizes, prices, discounts, tax and quantities, so later catalog edits never change past orders or invoices.

## Admin roles

Permissions are checked on the server for every admin page, action and API, not just hidden in the interface.

| Role | Can do |
| --- | --- |
| Super Admin | Everything, including settings, staff and the audit log |
| Product Manager | Products, CSV import/export, categories, inventory, reviews |
| Order Manager | Orders, fulfilment, refunds, returns, order export; view customers |
| Marketing Manager | Promotions, storefront content, reviews, newsletter |
| Support Agent | View orders and customers, handle returns, contact messages |

The full permission table is in **Admin → Staff & roles**. To add a staff member, they first create an account on the store; a Super Admin then adds them by email. Nobody ever handles another person's password. From the command line:

```bash
npm run admin:create -- --email owner@example.com --password 'a-strong-password' --name "Owner" --role super_admin
npm run admin:create -- --email manager@example.com --role order_manager    # promote an existing account
```

Important admin actions (status changes, refunds, stock adjustments, price changes, imports, exports, settings and role changes) are recorded in **Admin → Audit log**, with sensitive values redacted.

## Tests

```bash
npm run typecheck
npm run lint
npm test             # unit tests + stock-safety integration tests (start their own in-memory MongoDB)
```

End-to-end tests drive a real browser against a production build:

```bash
npm run db:dev                  # if not already running
npm run db:seed
npm run build
npm run test:e2e                # starts `next start -p 3100` unless it is already running
```

They cover browsing, guest checkout with Cash on Delivery, coupons, sign-up, admin access control, creating a coupon in the admin and using it in the cart, CSV import with its audit entry, and content changes reaching the storefront.

## Deploying (Vercel + MongoDB Atlas)

1. Create a MongoDB Atlas cluster and copy its connection string into `MONGODB_URI`.
2. Import the repository into Vercel and add the environment variables from `.env.example`. Set `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` to your domain, e.g. `https://www.example.in`.
3. Deploy. Then, once, with production variables in your shell or `.env.local`, run `npm run db:indexes` and either `npm run db:seed` (sample catalog) or `npm run admin:create` (admin only).
4. Configure the Razorpay and Shiprocket webhooks (see Configuration).
5. `vercel.json` schedules `/api/cron/maintenance` every 15 minutes, and Vercel sends `CRON_SECRET` with each call. Cron jobs on Vercel's Hobby plan run at most once a day, so on Hobby use an external scheduler that calls the endpoint with `Authorization: Bearer <CRON_SECRET>`. If it runs less often, stock held for abandoned online payments stays reserved until the next run, or until the same customer checks out again.

## Before you launch

The dashboard lists what is still missing. In particular:

- Fill in your real business details in **Settings → Store details**: registered name, GSTIN, address, support email and phone. The site shows clear placeholders until you do; nothing has been made up.
- Review the shipping, returns, privacy and terms pages in **Settings → Policies & pages**. They are templates, not legal advice: have them checked for your business and replace every `[placeholder]`.
- Replace sample products with your real catalog, photos, prices, HSN codes and GST rates (CSV import helps), and add ingredients and safety information from your product labels.
- Testimonials start empty. Add only genuine customer feedback that customers agreed to share.
- Test a full online payment in Razorpay test mode, then switch to live keys.
- SMS and WhatsApp notifications are not connected. `src/lib/services/notifications` has the extension point for a provider; email is the only channel until one is added.

## Project layout

```
src/app/(store)        storefront pages          src/lib/domain     pricing, order states, roles (pure logic)
src/app/admin          admin pages and actions   src/lib/services   orders, payments, inventory, refunds, email…
src/app/api            webhooks, cron, exports   src/lib/db         Mongoose models and connection
src/components         UI components             scripts/           local DB, seed, admin and index tools
tests/unit             pricing, money, CSV…      tests/integration  stock safety on a real MongoDB
tests/e2e              Playwright browser tests
```
