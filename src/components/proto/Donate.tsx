"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, HandHeart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { donateItems, getWardrobe, type Place, type WardrobeItem } from "@/client/dripy-api";

type Done = { names: string[]; places: Place[]; reply: string; imessaged: boolean };

/** Ask for the browser's location briefly; fall back to the account's home area. */
const locate = () =>
  new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000, maximumAge: 600_000 },
    );
  });

export function Donate() {
  const [items, setItems] = useState<WardrobeItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const load = () => getWardrobe().then(setItems, (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load your closet."));
  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const donate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await donateItems([...selected], await locate());
      setDone({ names: res.removed.map((r) => r.name), places: res.places, reply: res.reply, imessaged: res.imessaged });
      setSelected(new Set());
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Donation failed.");
    } finally {
      setBusy(false);
    }
  };

  // Least-worn first: those are the best candidates.
  const sorted = [...(items ?? [])].sort((a, b) => a.times_worn - b.times_worn);

  return (
    <main aria-label="Donate" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-8 sm:pt-10">
        <p className="mb-2 text-xs uppercase tracking-wide text-secondary">One in, one out</p>
        <h1 className="font-display text-5xl sm:text-6xl">Give it a <em className="text-primary">new home.</em></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Pick the pieces you don&apos;t wear anymore. They leave your closet, and your fairy finds the nearest donation drop-off.</p>

        {done && (
          <section aria-label="Donation drop-offs" className="mt-8 rounded-3xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-3xl"><HandHeart className="size-6 text-primary" />Thank you!</h2>
            <p className="mt-2 text-sm">{done.reply}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-3">
              {done.places.slice(0, 3).map((p) => (
                <li key={p.id} className="rounded-2xl bg-muted p-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.distance_km.toFixed(1)} km{p.hours_today ? ` · ${p.hours_today}` : ""}{p.open_now === true ? " · open now" : ""}</p>
                  {p.address && <p className="mt-1 text-xs text-muted-foreground">{p.address}</p>}
                  {p.maps_url && (
                    <a href={p.maps_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><MapPin className="size-3" />Directions</a>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              {done.imessaged ? "Your fairy sent these to your iMessage chat too." : "Your fairy posted these in your chat."} <Link href="/" className="text-primary hover:underline">Open chat</Link>
            </p>
          </section>
        )}
        {error && <p role="alert" className="mt-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items === null && !error && <p className="col-span-full text-sm text-muted-foreground">Loading your closet…</p>}
          {items?.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Your closet is empty.</p>}
          {sorted.map((item) => {
            const on = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={on}
                className={`group relative rounded-2xl border bg-card p-3 text-left transition-all ${on ? "border-primary ring-2 ring-primary" : "border-border hover:shadow-md"}`}
              >
                <div className="flex aspect-square items-center justify-center rounded-xl bg-muted p-3">
                  {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full object-contain" /> : <span className="text-xs text-muted-foreground">{item.name}</span>}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.times_worn === 0 ? "Never worn" : `Worn ${item.times_worn}×`}</p>
                {on && <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="text-sm">{selected.size} {selected.size === 1 ? "piece" : "pieces"} selected</p>
            <Button onClick={donate} disabled={busy} className="rounded-full bg-dot px-6 text-dot-foreground hover:bg-dot/90">{busy ? "Finding drop-offs…" : `Donate ${selected.size === 1 ? "it" : "them"}`}</Button>
          </div>
        </div>
      )}
    </main>
  );
}
