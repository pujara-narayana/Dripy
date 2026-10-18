"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAccount, logOut } from "@/client/dripy-api";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/recommended", label: "Recommended" },
  { href: "/donate", label: "Donate" },
  { href: "/dashboard", label: "Dashboard", className: "hidden md:inline" },
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About", className: "hidden lg:inline" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    getAccount()
      .then((a) => setName(a.user.name.split(" ")[0] ?? a.user.name))
      .catch(() => router.replace("/welcome")); // session expired or account gone
  }, [router]);

  const signOut = async () => {
    await logOut().catch(() => {});
    router.replace("/welcome");
    router.refresh();
  };

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
          {name && <span className="hidden text-sm text-muted-foreground sm:inline">Hi, {name}</span>}
          <Button variant="ghost" className="rounded-full" onClick={signOut}>Log out</Button>
        </div>
      </div>
    </header>
  );
}
