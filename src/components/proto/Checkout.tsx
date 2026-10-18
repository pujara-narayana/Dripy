"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, Field, FormError } from "@/components/proto/AuthCard";
import { CardPreview, VisaMark } from "@/components/proto/VisaCard";
import { Linkify } from "@/components/proto/Linkify";
import { getCheckout, money, payCheckout, type CardInput, type CheckoutSummary } from "@/client/dripy-api";

const formatNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
const formatExp = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export function Checkout() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get("t");
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [card, setCard] = useState<CardInput>({ number: "", exp: "", cvc: "", name: "" });
  const [useSaved, setUseSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ reply: string; imessaged: boolean } | null>(null);

  useEffect(() => {
    getCheckout(id, token).then(setCheckout, (err: unknown) => setLoadError(err instanceof Error ? err.message : "Couldn't load this checkout."));
  }, [id, token]);

  const pay = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = checkout?.saved_card && useSaved;
      const res = await payCheckout(id, { t: token, ...(saved ? {} : { card }) });
      if (res.status === "paid") setPaid({ reply: res.reply, imessaged: res.imessaged });
      else setError(res.reply || "The payment didn't go through. Nothing was charged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <AuthCard>
        <h1 className="font-display text-3xl">Checkout unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <Button asChild variant="outline" className="mt-6 rounded-full"><Link href="/">Back to Dripy</Link></Button>
      </AuthCard>
    );
  }
  if (!checkout) return <AuthCard wide><p className="text-sm text-muted-foreground">Loading checkout…</p></AuthCard>;

  const price = money(checkout.amount_cents);
  const summary = (
    <div className="flex gap-4 rounded-2xl bg-muted p-4">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-card p-1.5">
        {checkout.image_url && <img src={checkout.image_url} alt={checkout.item_name} className="h-full object-contain" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{checkout.merchant_domain}</p>
        <p className="mt-0.5 font-medium leading-snug">{checkout.item_name}</p>
        <p className="mt-1 font-display text-2xl">{price}</p>
      </div>
    </div>
  );

  if (paid) {
    return (
      <AuthCard>
        <CheckCircle2 className="size-10 text-secondary" />
        <h1 className="mt-3 font-display text-4xl">Paid with <VisaMark className="text-[#1a1f71]" /></h1>
        <div className="mt-5">{summary}</div>
        <Linkify text={paid.reply} className="mt-5 block whitespace-pre-line text-sm leading-relaxed" />
        {paid.imessaged && <p className="mt-3 text-xs text-muted-foreground">Dripy sent this to your iMessage chat too.</p>}
        <Button asChild className="mt-6 w-full rounded-full bg-dot text-dot-foreground hover:bg-dot/90"><Link href="/">See it in my closet</Link></Button>
      </AuthCard>
    );
  }

  if (checkout.status !== "awaiting_approval") {
    return (
      <AuthCard>
        <h1 className="font-display text-3xl">This checkout is {checkout.status.replace("_", " ")}</h1>
        <div className="mt-5">{summary}</div>
        <p className="mt-4 text-sm text-muted-foreground">
          {checkout.status === "paid" ? "It's already paid and in your closet." : "Nothing was charged. Ask Dripy to buy it again if you still want it."}
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full"><Link href="/">Back to Dripy</Link></Button>
      </AuthCard>
    );
  }

  const saved = checkout.saved_card;
  return (
    <AuthCard wide>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Checkout</h1>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" />Secured by <VisaMark className="text-sm text-[#1a1f71]" /></span>
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="space-y-5">
          {summary}
          <CardPreview number={saved && useSaved ? `000000000000${saved.last4}` : card.number} name={card.name} exp={card.exp} />
          <p className="rounded-xl bg-accent px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Demo checkout ({checkout.mode === "simulated" ? "simulated payment" : "Stripe test mode"}): no real money moves and nothing ships.
            Use the Visa test card <b className="font-mono">4242 4242 4242 4242</b>, any future expiry and any CVC.
          </p>
        </div>
        {saved && useSaved ? (
          <div className="flex flex-col justify-center gap-3">
            <p className="text-sm text-muted-foreground">Card on file</p>
            <p className="flex items-center gap-2 text-lg font-medium"><VisaMark className="text-[#1a1f71]" /> •••• {saved.last4}</p>
            <FormError message={error} />
            <Button onClick={() => pay()} disabled={busy} size="lg" className="rounded-full bg-dot text-dot-foreground hover:bg-dot/90">{busy ? "Paying…" : `Pay ${price}`}</Button>
            <Button variant="link" onClick={() => setUseSaved(false)}>Use a different card</Button>
          </div>
        ) : (
          <form onSubmit={pay} className="space-y-4">
            <Field label="Card number">
              <Input required inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: formatNumber(e.target.value) }))} placeholder="4242 4242 4242 4242" className="font-mono" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry">
                <Input required inputMode="numeric" autoComplete="cc-exp" value={card.exp} onChange={(e) => setCard((c) => ({ ...c, exp: formatExp(e.target.value) }))} placeholder="MM/YY" />
              </Field>
              <Field label="CVC">
                <Input required inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 3) }))} placeholder="123" />
              </Field>
            </div>
            <Field label="Name on card">
              <Input required autoComplete="cc-name" value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} placeholder="Alex Rivera" />
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={busy} size="lg" className="w-full rounded-full bg-dot text-dot-foreground hover:bg-dot/90">{busy ? "Paying…" : `Pay ${price} with Visa`}</Button>
            <p className="text-center text-xs text-muted-foreground">Dripy keeps only the last 4 digits, so next time you just approve.</p>
          </form>
        )}
      </div>
    </AuthCard>
  );
}
