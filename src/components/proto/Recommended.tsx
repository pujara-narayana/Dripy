"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Heart, Search, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCheckout } from "@/components/proto/useCheckout";
import { getShop, money, type ShopItem } from "@/client/dripy-api";

const categories = ["All pieces", "Outerwear", "Tops", "Dresses", "Bottoms", "Shoes", "Accessories"];

export function Recommended() {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState("All pieces");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [bought, setBought] = useState<string | null>(null);

  const load = () =>
    getShop().then(
      (list) => {
        setItems(list);
        setLoadError(null);
      },
      (err: unknown) => setLoadError(err instanceof Error ? err.message : "Couldn't load recommendations."),
    );
  useEffect(() => {
    load();
  }, []);

  const checkout = useCheckout(({ reply }) => {
    setBought(reply);
    load(); // what you bought moves to your closet, so it leaves the shop
  });

  const pieces = (items ?? []).filter((piece) =>
    (category === "All pieces" || piece.type === category) &&
    `${piece.name} ${piece.type} ${piece.reason}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!savedOnly || saved.has(piece.id)),
  );
  const toggleSaved = (id: string) => setSaved((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <main aria-label="Recommended" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-secondary">Recommended for you</p>
            <h1 className="font-display text-5xl sm:text-6xl">Your <em className="text-primary">next favourite.</em></h1>
            <p className="mt-3 text-sm text-muted-foreground">Pieces you don&apos;t own yet that go with what you do. Buy here, or ask your fairy.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} className="rounded-full"><Shuffle />Shuffle</Button>
            <Button variant={savedOnly ? "secondary" : "outline"} onClick={() => setSavedOnly((value) => !value)} aria-pressed={savedOnly} className="rounded-full">
              <Heart className={savedOnly ? "fill-current" : ""} />Saved{saved.size > 0 ? ` (${saved.size})` : ""}
            </Button>
          </div>
        </div>

        {bought && (
          <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-secondary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="whitespace-pre-line">{bought}</p>
              <Link href="/" className="mt-1 inline-block text-primary hover:underline">See it in your closet</Link>
            </div>
            <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => setBought(null)}><X /></Button>
          </div>
        )}

        <div className="mb-6 mt-8 flex flex-col justify-between gap-4 border-y border-border py-4 lg:flex-row lg:items-center">
          <div aria-label="Clothing categories" className="flex flex-wrap gap-2">
            {categories.map((name) => (
              <Button key={name} size="sm" variant={category === name ? "secondary" : "ghost"} aria-pressed={category === name} onClick={() => setCategory(name)} className="rounded-full">{name}</Button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input aria-label="Search pieces" placeholder="Search pieces…" value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-full bg-card pl-9 pr-10" />
            {query && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-0 top-0 rounded-full"><X /></Button>}
          </div>
        </div>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{savedOnly ? "Your saved edit" : category === "All pieces" ? "Picked for your closet" : category}</h2>
          <span aria-live="polite" className="text-xs text-muted-foreground">{items ? `${pieces.length} ${pieces.length === 1 ? "piece" : "pieces"}` : "Loading…"}</span>
        </div>
        {loadError && <p className="py-16 text-center text-sm text-muted-foreground">{loadError}</p>}
        {items && pieces.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {pieces.map((piece) => (
              <article key={piece.id} className="group flex min-w-0 flex-col">
                <div className="relative rounded-lg border border-border bg-muted">
                  <a href={piece.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${piece.name} at ${piece.brand}`} className="flex aspect-[4/5] items-center justify-center overflow-hidden p-6 sm:p-8">
                    <img src={piece.image_url} alt={piece.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" />
                  </a>
                  <Button variant="ghost" size="icon" aria-label={`Save ${piece.name}`} title={`Save ${piece.name}`} aria-pressed={saved.has(piece.id)} onClick={() => toggleSaved(piece.id)} className="absolute right-2 top-2 rounded-full bg-card/90 text-primary hover:bg-card">
                    <Heart className={saved.has(piece.id) ? "fill-current" : ""} />
                  </Button>
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground">{piece.brand} · {piece.type}</p>
                <a href={piece.url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-start justify-between gap-2 text-sm font-medium hover:text-primary">{piece.name}<ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" /></a>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{piece.reason}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-display text-xl">{money(piece.price_cents)}</span>
                  <Button size="sm" className="rounded-full bg-dot text-dot-foreground hover:bg-dot/90" disabled={checkout.busy === piece.id} onClick={() => checkout.buy(piece.id)}>
                    {checkout.busy === piece.id ? "One sec…" : "Buy"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        {items && pieces.length === 0 && (
          <div className="py-16 text-center">
            <Heart className="mx-auto mb-4 size-6 text-primary" />
            <h2 className="font-display text-3xl">{savedOnly && saved.size === 0 ? "A little room for favourites." : "No pieces found."}</h2>
            <Button variant="link" className="mt-3" onClick={() => { setSavedOnly(false); setQuery(""); setCategory("All pieces"); }}>Browse all pieces</Button>
          </div>
        )}
      </div>
      {checkout.error && (
        <div role="alert" className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-card p-4 text-sm text-destructive shadow-lg ring-1 ring-destructive/30">
          <p className="flex-1">{checkout.error}</p>
          <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={checkout.clearError}><X /></Button>
        </div>
      )}
      {checkout.dialog}
    </main>
  );
}
