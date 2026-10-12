/**
 * Starter policy templates. They intentionally contain [bracketed]
 * placeholders and {{tokens}} filled from Settings. Review every policy with a
 * qualified professional before publishing; nothing here is legal advice.
 *
 * Supported formatting: "## Heading", "### Subheading", "- bullet",
 * blank-line separated paragraphs, **bold** and [link text](/path).
 */

export const DEFAULT_SHIPPING_POLICY = `## Order processing
{{processingTime}}

Orders placed on Sundays or public holidays are processed on the next working day.

## Delivery charges
- Standard delivery: {{standardFee}} per order.
- Free standard delivery on orders of {{freeShippingThreshold}} or more (after discounts).
- Express delivery, when offered at checkout: {{expressFee}} per order.
- Cash on Delivery orders carry a handling fee of {{codFee}}.

## Delivery timelines
Delivery timelines shown at checkout are estimates provided by our courier partners. Remote locations may take longer. We will share tracking details by email as soon as your order is dispatched.

## Serviceable locations
We deliver to serviceable PIN codes within India. If your PIN code cannot be serviced, you will be informed at checkout.

## Failed deliveries
If a delivery attempt fails, the courier may re-attempt delivery. Orders that cannot be delivered are returned to us. For prepaid orders that are returned undelivered, we will contact you to arrange re-shipping or a refund as described in our [Return & Refund Policy](/policies/returns).

## Damaged or leaking parcels
Liquids can occasionally leak in transit. If your parcel arrives damaged, please photograph the package and contact us within 48 hours of delivery at {{supportEmail}}.

## Contact
{{storeName}} · {{supportEmail}} · {{supportPhone}}`;

export const DEFAULT_RETURN_POLICY = `## Overview
We want you to be happy with every {{storeName}} product. Because our products are household cleaning liquids, returns are accepted only in the situations below.

## Eligible returns
You may request a return or replacement within **{{returnWindowDays}} days of delivery** if:
- the product arrived damaged, leaking or tampered with;
- you received the wrong product or size; or
- the product is past its expiry date on arrival.

For hygiene and safety reasons, opened or used products cannot be returned unless they are defective.

## How to request a return
1. Sign in and open the order from **My Account → Orders**, then choose **Request return**. Guest customers can [contact us](/contact) with their order number.
2. Tell us what went wrong and attach photos if requested.
3. Our team reviews requests within [number] business days and shares pickup or next steps.

## Refunds
- Approved refunds for online payments are issued to the original payment method.
- Refunds for Cash on Delivery orders are issued via [bank transfer / UPI — describe your process].
- Banks and payment providers typically take 5–7 business days to credit refunds after we initiate them.
- Shipping and COD charges are refunded only when the return is due to our error.

## Cancellations
You can cancel an order from your account before it is packed. Once an order has been dispatched it can no longer be cancelled, but you may refuse delivery or request a return where eligible.

## Contact
{{storeName}} · {{supportEmail}} · {{supportPhone}}`;

export const DEFAULT_PRIVACY_POLICY = `## Who we are
This website is operated by {{legalName}} ("{{storeName}}", "we", "us"), {{address}}.

## Information we collect
- **Account and order details:** name, email address, phone number, delivery and billing addresses, and order history.
- **Payment information:** payments are processed by Razorpay. We do not store your full card details, UPI PIN or net banking credentials.
- **Technical information:** cookies required for your session and cart, and basic device and log information used for security.
- **Communications:** messages you send us and your newsletter preferences.

## How we use it
- To process, deliver and support your orders, including sharing delivery details with courier partners.
- To send transactional emails such as order confirmations and shipping updates.
- To send marketing emails only if you have subscribed. You can unsubscribe at any time.
- To prevent fraud and keep the website secure.
- To meet legal, tax and accounting obligations.

## Sharing
We share personal data only with service providers that help us run the store — for example payment processing (Razorpay), email delivery, image hosting and courier partners — and when required by law. We do not sell your personal data.

## Retention
We keep order records for as long as required by applicable tax and accounting laws, and other data only as long as needed for the purposes above.

## Your choices and rights
You can review and update your profile and addresses from your account. To request access, correction or deletion of your personal data, contact [Grievance / Data Protection Officer name] at {{supportEmail}}.

## Cookies
We use essential cookies to keep you signed in and remember your cart. [Describe any analytics cookies here if you add them.]

## Changes
We may update this policy from time to time. The latest version will always be published on this page.

## Contact
{{storeName}} · {{supportEmail}} · {{supportPhone}}`;

export const DEFAULT_TERMS = `## Introduction
These terms govern your use of this website operated by {{legalName}} ("{{storeName}}"). By placing an order you agree to these terms.

## Products and pricing
- All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.
- MRP and selling prices are displayed on each product page. We make every effort to keep prices and stock accurate; if an error is found we will contact you before processing the order.
- Product images are for illustration. Always read the label and usage instructions before use.

## Orders
An order is confirmed when you receive an order confirmation email. For online payments, confirmation happens only after the payment is verified. We may cancel orders affected by stock unavailability, pricing errors or suspected fraud, and will refund any amount paid.

## Payments
Online payments are processed securely by Razorpay. Cash on Delivery is available on eligible orders.

## Offers and coupons
Offers are subject to their stated conditions, validity dates and usage limits, and cannot be exchanged for cash.

## Use of products
Cleaning products must be used as directed on the label and kept out of reach of children and pets.

## Shipping, cancellations and returns
Please see our [Shipping Policy](/policies/shipping) and [Return & Refund Policy](/policies/returns).

## Accounts
You are responsible for keeping your password confidential and for activity under your account.

## Governing law
These terms are governed by the laws of India. [Specify the courts with jurisdiction, e.g. courts at your registered city.]

## Grievance officer
[Name of grievance officer] · {{supportEmail}} · {{supportPhone}}

## Contact
{{storeName}} · {{address}}`;

export const DEFAULT_ABOUT = `## Our story
[Tell customers how {{storeName}} started, who is behind it and what you care about.]

## What we make
{{storeName}} offers everyday cleaning essentials for Indian homes and vehicles — dishwash liquid, floor cleaner, kitchen cleaner, toilet cleaner, glass cleaner, multipurpose cleaners, car shampoo, car polish and more.

## Our approach
- Clear labels with usage and safety directions on every product page.
- Transparent pricing: savings are shown only when the selling price is genuinely below MRP.
- Secure checkout and order tracking from dispatch to delivery.

## Get in touch
Questions, bulk orders or feedback? [Contact us](/contact) — we would love to hear from you.`;
