"use client";

import { useState } from "react";
import { ArrowUpRight, Heart, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { photoClothes } from "@/components/proto/photo-clothes";


const categories = ["All pieces", "Outerwear", "Tops", "Dresses", "Bottoms", "Shoes", "Accessories"];

export function Discover() {
  const [category, setCategory] = useState("All pieces");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const pieces = photoClothes.filter((piece) =>
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
    <main aria-label="Discover" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-secondary">The everyday edit</p>
            <h1 className="font-display text-5xl sm:text-6xl">Discover your <em className="text-primary">next favourite.</em></h1>
            <p className="mt-3 text-sm text-muted-foreground">Thoughtful layers. Easy silhouettes. Pieces that belong together.</p>
          </div>
          <Button variant={savedOnly ? "secondary" : "outline"} onClick={() => setSavedOnly((value) => !value)} aria-pressed={savedOnly} className="rounded-full">
            <Heart className={savedOnly ? "fill-current" : ""} />Saved{saved.size > 0 ? ` (${saved.size})` : ""}
          </Button>
        </div>

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
          <span aria-live="polite" className="text-xs text-muted-foreground">{pieces.length} {pieces.length === 1 ? "piece" : "pieces"}</span>
        </div>
        {pieces.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {pieces.map((piece) => (
              <article key={piece.id} className="group min-w-0">
                <div className="relative rounded-lg border border-border bg-muted">
                  <a href={piece.link} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${piece.name} at Uniqlo`} className="flex aspect-[4/5] items-center justify-center overflow-hidden p-6 sm:p-8">
                    <img src={piece.image} alt={piece.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" />
                  </a>
                  <Button variant="ghost" size="icon" aria-label={`Save ${piece.name}`} title={`Save ${piece.name}`} aria-pressed={saved.has(piece.id)} onClick={() => toggleSaved(piece.id)} className="absolute right-2 top-2 rounded-full bg-card/90 text-primary hover:bg-card">
                    <Heart className={saved.has(piece.id) ? "fill-current" : ""} />
                  </Button>
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground">Uniqlo · {piece.type}</p>
                <a href={piece.link} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-start justify-between gap-2 text-sm font-medium hover:text-primary">{piece.name}<ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" /></a>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{piece.reason}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Heart className="mx-auto mb-4 size-6 text-primary" />
            <h2 className="font-display text-3xl">{savedOnly && saved.size === 0 ? "A little room for favourites." : "No pieces found."}</h2>
            <Button variant="link" className="mt-3" onClick={() => { setSavedOnly(false); setQuery(""); setCategory("All pieces"); }}>Browse all pieces</Button>
          </div>
        )}
      </div>
    </main>
  );
}