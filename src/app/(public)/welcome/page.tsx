import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FairyMascot } from "@/components/proto/FairyMascot";

export const metadata: Metadata = {
  title: { absolute: "dripy. — Your closet, with a fairy" },
};

const steps = [
  { icon: Sparkles, title: "Sign up", text: "Your email and phone number. That's it." },
  { icon: MessageCircle, title: "Say hi on iMessage", text: "Your fairy texts you back with your digital wardrobe, built from your Gmail orders." },
  { icon: Shirt, title: "Shop smarter", text: "Send a screenshot of anything you love. Dripy finds it, tells you if you need it, and checks out with your Visa only when you say yes." },
];

export default function Welcome() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-8 sm:py-20">
        <FairyMascot className="mx-auto h-28 -scale-x-100" />
        <h1 className="mt-6 font-display text-5xl sm:text-7xl">Your closet, <em className="text-primary">with a fairy</em></h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          dripy. knows every piece you own, talks you out of the buys you don&apos;t need, and pays for the ones you do.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full bg-dot px-8 text-dot-foreground hover:bg-dot/90"><Link href="/signup">Get started</Link></Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-8"><Link href="/login">I have an account</Link></Button>
        </div>
        <ol className="mt-16 grid gap-6 text-left sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-dot font-display text-sm text-dot-foreground">{i + 1}</span>
                <s.icon className="size-5 text-primary" />
              </div>
              <h2 className="mt-4 font-display text-2xl">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
