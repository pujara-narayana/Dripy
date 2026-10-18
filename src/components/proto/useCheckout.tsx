"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VisaMark } from "@/components/proto/VisaCard";
import { buyFromShop, checkoutPath, money, payCheckout, type PurchaseIntentCard, type SavedCard } from "@/client/dripy-api";

type Pending = { intentId: string; itemName: string; amountCents: number; merchant: string; saved: SavedCard | null };
export type PaidResult = { reply: string; itemName: string };

/**
 * Buying from the website. No card on file -> the Visa checkout page (same page the iMessage
 * link opens). Card on file -> a one-tap confirm dialog, then pay.
 */
export function useCheckout(onPaid: (result: PaidResult) => void) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromCard = (card: PurchaseIntentCard, saved: SavedCard | null) => {
    if (card.status !== "awaiting_approval") return setError(`That checkout is ${card.status.replace("_", " ")}.`);
    if (card.needs_card && card.checkout_url) return router.push(checkoutPath(card.checkout_url));
    setPending({ intentId: card.intent_id, itemName: card.item_name, amountCents: card.amount_cents, merchant: card.merchant_domain, saved });
  };

  const buy = async (productId: string) => {
    setBusy(productId);
    setError(null);
    try {
      const res = await buyFromShop(productId);
      fromCard(res.card, res.saved_card);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(pending.intentId);
    setError(null);
    try {
      const res = await payCheckout(pending.intentId, {});
      setPending(null);
      if (res.status === "paid") onPaid({ reply: res.reply, itemName: pending.itemName });
      else setError(res.reply || "The payment didn't go through. Nothing was charged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBusy(null);
    }
  };

  const dialog = pending && (
    <div role="dialog" aria-modal="true" aria-label="Confirm purchase" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={() => setPending(null)}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{pending.merchant}</p>
        <h2 className="mt-1 font-display text-3xl leading-tight">{pending.itemName}</h2>
        <p className="mt-2 font-display text-2xl">{money(pending.amountCents)}</p>
        <p className="mt-4 flex items-center gap-2 text-sm">
          Pay with <VisaMark className="text-[#1a1f71]" />{pending.saved ? ` •••• ${pending.saved.last4}` : " card on file"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Demo payment: no real money moves.</p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-full" onClick={() => setPending(null)}>Cancel</Button>
          <Button className="flex-1 rounded-full bg-dot text-dot-foreground hover:bg-dot/90" disabled={busy === pending.intentId} onClick={confirm}>
            {busy === pending.intentId ? "Paying…" : "Approve & pay"}
          </Button>
        </div>
      </div>
    </div>
  );

  return { buy, approve: (card: PurchaseIntentCard) => fromCard(card, null), dialog, busy, error, clearError: () => setError(null) };
}
