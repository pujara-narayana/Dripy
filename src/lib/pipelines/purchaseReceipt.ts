import "server-only";
import type { RequestMeta } from "@/lib/http";
import { formatMoney } from "@/lib/http";
import { gmailConfigured, sendAndReadBack } from "@/lib/integrations/gmail";
import { parseReceiptEmail, saveReceipt } from "@/lib/pipelines/receipts";
import type { PaymentMode, WardrobeItem } from "@/lib/types";

// After a paid purchase, Dripy emails a merchant-style order confirmation from the connected
// Gmail to the buyer's sign-up address (to itself for the seeded demo user), reads the sent
// copy back and runs it through the same receipt parser as real order emails, so the new item
// enters the wardrobe the way any other order would.
// It reads like a normal order confirmation (no "demo" labels), but it never claims to come
// from the store: it is sent from the connected account's address as "<Store> via Dripy",
// and the footer says Dripy sent it.

export interface ReceiptOrder {
  intentId: string;
  userId: string;
  customerName: string;
  /** Where the receipt goes; null/absent sends it to the connected Gmail itself. */
  customerEmail?: string | null;
  merchantName: string; // "Zara"
  merchantDomain: string; // "zara.com"
  merchantUrl: string;
  item: { name: string; brand: string | null; color: string | null; imageUrl: string | null };
  amountCents: number;
  currency: string;
  paidAt: Date;
  reference: string | null; // pi_... / simulated id
  card: { brand: string; last4: string } | null;
  mode: PaymentMode;
}

export interface ReceiptEmail {
  fromName: string;
  subject: string;
  date: Date;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** "DRP-1A2B3C4D", stable per purchase intent. */
export function orderNumber(intentId: string): string {
  return `DRP-${intentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** The order-confirmation email for a paid intent: plain text + HTML. */
export function buildReceiptEmail(o: ReceiptOrder): ReceiptEmail {
  const order = orderNumber(o.intentId);
  const price = formatMoney(o.amountCents, o.currency);
  const when = o.paidAt.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "long", day: "numeric" });
  const isoDate = o.paidAt.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD
  const card = o.card ? `${o.card.brand.toUpperCase()} ending ${o.card.last4}` : "Visa";
  const brand = o.item.brand ?? o.merchantName;
  const color = o.item.color ? titleCase(o.item.color) : null;
  const footer = `Sent by Dripy, your shopping agent, for your ${o.merchantName} order. Dripy is not affiliated with ${o.merchantName}.`;
  const first = o.customerName.split(" ")[0] || "there";

  const text = [
    `${o.merchantName} — Order confirmation`,
    `Hi ${first}, thanks for your order! Here's your receipt.`,
    "",
    `Order number: ${order}`,
    `Order date: ${isoDate}`,
    "",
    "Item | Qty | Price",
    `${o.item.name} (${[brand, color && `Color: ${color}`].filter(Boolean).join(", ")}) | 1 | ${price}`,
    "",
    `Subtotal: ${price}`,
    "Shipping: $0.00",
    `Order total: ${price}`,
    "",
    `Paid with ${card}${o.reference ? `, payment reference ${o.reference}` : ""}.`,
    `Store: ${o.merchantUrl}`,
    "",
    footer,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 20px 8px"><div style="font-size:26px;font-weight:700;letter-spacing:2px">${esc(o.merchantName.toUpperCase())}</div>
<h1 style="font-size:18px;margin:16px 0 4px">Order confirmation</h1>
<p style="margin:0;color:#555">Hi ${esc(first)}, thanks for your order! Here's your receipt.</p></td></tr>
<tr><td style="padding:8px 20px;font-size:14px">Order number: <b>${esc(order)}</b><br>Order date: ${esc(when)}</td></tr>
<tr><td style="padding:8px 20px"><table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
<tr style="border-bottom:1px solid #ddd;text-align:left"><th></th><th>Item</th><th>Qty</th><th align="right">Price</th></tr>
<tr style="border-bottom:1px solid #eee">
<td width="72">${o.item.imageUrl ? `<img src="${esc(o.item.imageUrl)}" width="64" alt="" style="border-radius:6px;display:block">` : ""}</td>
<td><b>${esc(o.item.name)}</b><br><span style="color:#666">${esc(brand)}${color ? ` · Color: ${esc(color)}` : ""}</span></td>
<td>1</td><td align="right">${esc(price)}</td></tr>
<tr><td></td><td colspan="2">Subtotal</td><td align="right">${esc(price)}</td></tr>
<tr><td></td><td colspan="2">Shipping</td><td align="right">$0.00</td></tr>
<tr><td></td><td colspan="2"><b>Order total</b></td><td align="right"><b>${esc(price)}</b></td></tr>
</table></td></tr>
<tr><td style="padding:8px 20px 20px;font-size:13px;color:#555">Paid with ${esc(card)}${o.reference ? `<br>Payment reference: ${esc(o.reference)}` : ""}<br>Store: <a href="${esc(o.merchantUrl)}">${esc(o.merchantDomain)}</a></td></tr>
<tr><td style="padding:12px 20px;background:#fafafa;font-size:11px;color:#888">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  return { fromName: `${o.merchantName} via Dripy`, subject: `Your ${o.merchantName} order ${order} is confirmed`, date: o.paidAt, text, html };
}

/** RFC 2047 encode a header value when it isn't plain ASCII. */
function header(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();

/** Full MIME message (multipart/alternative) for Gmail's send API, from `address` to `to`. */
export function toMime(e: ReceiptEmail, address: string, to = address): string {
  const boundary = `dripy-${e.date.getTime().toString(36)}`;
  const name = header(e.fromName.replace(/["\\]/g, ""));
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", wrap76(Buffer.from(body, "utf8").toString("base64"))].join("\r\n");
  return [
    `From: "${name}" <${address}>`,
    `To: <${to}>`,
    `Subject: ${header(e.subject)}`,
    `Date: ${e.date.toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    part("text/plain", e.text),
    part("text/html", e.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** The "headers, blank line, body" shape the receipt parser reads (no Gmail round trip). */
export function toInboxText(e: ReceiptEmail): string {
  return `From: ${e.fromName}\nSubject: ${e.subject}\nDate: ${e.date.toUTCString()}\n\n${e.html}`;
}

/**
 * Email the receipt (via the connected Gmail to the buyer; otherwise it stays in-app), then parse
 * it into the wardrobe. Throws if parsing fails, so the caller can add the item directly.
 */
export async function deliverPurchaseReceipt(
  o: ReceiptOrder,
  meta: RequestMeta,
): Promise<{ emailed: boolean; retailer: string; items: WardrobeItem[] }> {
  const email = buildReceiptEmail(o);
  let sourceId = `dripy-receipt:${o.intentId}`;
  let raw = toInboxText(email);
  let emailed = false;
  if (gmailConfigured()) {
    try {
      const sent = await sendAndReadBack((address) => toMime(email, address, o.customerEmail ?? address));
      ({ id: sourceId, raw } = sent);
      emailed = true;
    } catch (err) {
      console.error("receipt email failed", err);
      meta.fallback("gmail_send");
    }
  } else {
    meta.fallback("gmail_send");
  }

  const parsed = await parseReceiptEmail(raw);
  if (!parsed.is_order_confirmation || parsed.items.length === 0) throw new Error("receipt parser found no items in the purchase receipt");
  const items = await saveReceipt(o.userId, sourceId, parsed, { source: "purchase", imageUrl: o.item.imageUrl });
  return { emailed, retailer: parsed.retailer || o.merchantName, items };
}
