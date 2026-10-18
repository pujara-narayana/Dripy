import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-header px-4 py-3 sm:px-8">
      <Link href="/welcome" aria-label="dripy home" className="font-display text-3xl italic">dripy<span className="dot-pink">.</span></Link>
      <div className="flex items-center gap-3 sm:gap-6">
        <nav aria-label="Main navigation" className="text-sm text-muted-foreground">
          <Link href="/about">About</Link>
        </nav>
        <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-5">
          <Button asChild variant="ghost" className="rounded-full"><Link href="/login">Log in</Link></Button>
          <Button asChild className="rounded-full bg-dot text-dot-foreground hover:bg-dot/90"><Link href="/signup">Sign up</Link></Button>
        </div>
      </div>
    </header>
  );
}
