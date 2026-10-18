import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FairyMascot } from "@/components/proto/FairyMascot";

export const metadata: Metadata = {
  title: "About",
  description: "dripy. is your closet with a fairy: a style companion that knows every piece you own and where to find the rest.",
  openGraph: { title: "About — dripy.", description: "dripy. is your closet with a fairy: a style companion that knows every piece you own and where to find the rest." },
};


const values = [
  {
    icon: Shirt,
    title: "Wear what you own",
    text: "Your closet is already full of outfits. dripy. helps you see them — every piece, photographed and organized, ready to be styled again.",
  },
  {
    icon: Sparkles,
    title: "A fairy, not a feed",
    text: "No endless scrolling. Ask your style fairy for an occasion, a weather, a mood — and get a look built from what you actually have.",
  },
  {
    icon: Heart,
    title: "Shop with intention",
    text: "When something is genuinely missing, we point you to real pieces from real shops that fill the gap — never clutter.",
  },
];

export default function About() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <div className="text-center">
          <FairyMascot className="mx-auto h-28 -scale-x-100" />
          <h1 className="mt-6 font-display text-5xl sm:text-6xl">
            Your closet, <em className="text-primary">with a fairy</em>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            dripy. is a style companion that knows every piece in your wardrobe — and exactly where to find the ones you&apos;re missing.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-border bg-card p-6">
              <v.icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-xl">{v.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl bg-header p-10 text-center">
          <h2 className="font-display text-3xl">How it works</h2>
          <ol className="mx-auto mt-8 grid max-w-2xl gap-8 text-left sm:grid-cols-3">
            {[
              ["Add your pieces", "Photograph or link your clothes — your fairy organizes them into a beautiful closet."],
              ["Ask for a look", "Coffee date, job interview, rainy Tuesday — describe it and get an outfit from your own wardrobe."],
              ["Fill the gaps", "When a piece is missing, your fairy suggests real items from real shops that match your style."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dot font-display text-sm text-dot-foreground">{i + 1}</span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button asChild className="mt-10 rounded-full bg-dot px-8 text-dot-foreground hover:bg-dot/90">
            <Link href="/">Meet your fairy</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
