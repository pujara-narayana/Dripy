import type { Metadata } from "next";
import { ArrowUpRight, Footprints, Heart, Shirt, Sparkles, TrendingUp } from "lucide-react";
import { photoClothes } from "@/components/proto/photo-clothes";

export const metadata: Metadata = {
  title: "Wardrobe stats",
  description: "See how you actually wear your closet: most-worn pieces, category balance, and items ready for a new home.",
  openGraph: { title: "Wardrobe stats — dripy.", description: "See how you actually wear your closet: most-worn pieces, category balance, and items ready for a new home." },
};


const byId = (id: string) => photoClothes.find((g) => g.id === id)!;

// Mock wear data — frontend-only prototype numbers.
const mostWorn = [
  { id: "jeans", wears: 34 },
  { id: "shirt", wears: 29 },
  { id: "sneakers-knit", wears: 27 },
  { id: "knit", wears: 22 },
  { id: "jacket", wears: 18 },
];

const sleeping = [
  { id: "dress-flannel", months: 7 },
  { id: "blazer", months: 5 },
  { id: "flats-tstrap", months: 4 },
];

const categories = ["Outerwear", "Tops", "Dresses", "Bottoms", "Shoes", "Accessories"].map((type) => ({
  type,
  count: photoClothes.filter((g) => g.type === type).length,
}));
const maxCategory = Math.max(...categories.map((c) => c.count));
const totalItems = photoClothes.length;
const maxWears = mostWorn[0]!.wears;

const stats = [
  { icon: Shirt, label: "Pieces in closet", value: String(totalItems), note: "across 6 categories" },
  { icon: TrendingUp, label: "Outfits this month", value: "21", note: "+4 vs last month" },
  { icon: Footprints, label: "Cost per wear", value: "$3.20", note: "best: straight jeans" },
  { icon: Sparkles, label: "Closet in rotation", value: "78%", note: "of pieces worn in 90 days" },
];

export default function Dashboard() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl">Wardrobe <em className="text-primary">stats</em></h1>
            <p className="mt-2 text-muted-foreground">How you actually wear your closet — tracked by your fairy.</p>
          </div>
          <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">Last 90 days</span>
        </div>

        {/* Stat cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
              <s.icon className="size-5 text-primary" />
              <p className="mt-3 font-display text-3xl">{s.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{s.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Most worn */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl"><Heart className="size-5 fill-primary text-primary" />Most worn</h2>
            <div className="mt-5 space-y-4">
              {mostWorn.map((w) => {
                const g = byId(w.id);
                return (
                  <div key={w.id} className="flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted p-1.5">
                      <img src={g.image} alt={g.name} className="h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{g.name}</p>
                        <p className="shrink-0 text-xs text-muted-foreground">{w.wears} wears</p>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(w.wears / maxWears) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Category balance */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl"><Shirt className="size-5 text-primary" />Category balance</h2>
            <div className="mt-5 space-y-4">
              {categories.map((c) => (
                <div key={c.type}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">{c.type}</p>
                    <p className="text-xs text-muted-foreground">{c.count} pieces</p>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-secondary" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-accent px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Your fairy&apos;s note: tops and shoes carry most of your outfits — a second pair of dressy flats would earn its keep.
            </p>
          </section>

          {/* Sleeping pieces */}
          <section className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles className="size-5 text-primary" />Sleeping pieces</h2>
            <p className="mt-1 text-sm text-muted-foreground">Unworn for a while — restyle them or let them find a new home.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {sleeping.map((s) => {
                const g = byId(s.id);
                return (
                  <a key={s.id} href={g.link} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-border bg-background p-4 transition-shadow hover:shadow-md">
                    <div className="flex h-28 items-center justify-center rounded-xl bg-muted p-2">
                      <img src={g.image} alt={g.name} className="h-full object-contain transition-transform group-hover:-translate-y-0.5" />
                    </div>
                    <p className="mt-3 flex items-start justify-between gap-1 text-sm font-medium leading-snug">
                      {g.name}
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Unworn for {s.months} months</p>
                  </a>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
