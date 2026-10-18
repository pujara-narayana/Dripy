"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About", className: "hidden sm:inline" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-header px-4 py-3 sm:px-8">
      <Link href="/" aria-label="dripy home" className="font-display text-3xl italic">dripy<span className="dot-pink">.</span></Link>
      <div className="flex items-center gap-3 sm:gap-6">
        <nav aria-label="Main navigation" className="flex gap-3 text-sm text-muted-foreground sm:gap-6">
          {navLinks.map(({ href, label, className }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={[active && "text-foreground", className].filter(Boolean).join(" ")}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-5">
          <Button variant="ghost" className="hidden rounded-full sm:inline-flex">Log in</Button>
          <Button className="rounded-full bg-dot text-dot-foreground hover:bg-dot/90">Sign up</Button>
        </div>
      </div>
    </header>
  );
}
