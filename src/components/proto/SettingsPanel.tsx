"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/proto/AuthCard";
import { GenderToggle, SpendLimitPicker } from "@/components/proto/Preferences";
import { getSettings, money, saveSettings, type Gender, type Settings } from "@/client/dripy-api";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = (s: Settings) => {
    setSettings(s);
    setGender(s.gender);
    setCents(s.spend_limit_cents ?? s.max_spend_limit_cents);
  };

  useEffect(() => {
    getSettings().then(apply, (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load your settings."));
  }, []);

  const save = async () => {
    if (!gender || cents == null) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      apply(await saveSettings({ gender, spend_limit_cents: cents }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your settings.");
    } finally {
      setBusy(false);
    }
  };

  const dirty = !!settings && (gender !== settings.gender || cents !== (settings.spend_limit_cents ?? settings.max_spend_limit_cents));

  return (
    <main aria-label="Settings" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Your <em className="text-primary">settings</em></h1>
        <p className="mt-2 text-muted-foreground">How your fairy shops for you, on iMessage and here.</p>

        {!settings && !error && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

        {settings && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-2xl">Spending limit</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The most your fairy can spend on one purchase. Anything pricier, it won&apos;t set up. It still asks you before every buy.
              </p>
              <div className="mt-5">
                <SpendLimitPicker key={settings.spend_limit_cents ?? "max"} value={cents} max={settings.max_spend_limit_cents} onChange={setCents} />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-2xl">Shopping for</h2>
              <p className="mt-1 text-sm text-muted-foreground">Which pieces show up in Recommended. Your closet stays as it is.</p>
              <div className="mt-5 max-w-xs"><GenderToggle value={gender} onChange={setGender} /></div>
            </section>

            <FormError message={error} />
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={busy || !dirty} className="rounded-full bg-dot px-6 text-dot-foreground hover:bg-dot/90">
                {busy ? "Saving…" : "Save changes"}
              </Button>
              {saved && !dirty && (
                <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-primary" />Saved. Your fairy can spend up to {money(settings.spend_limit_cents ?? settings.max_spend_limit_cents)} per purchase.
                </p>
              )}
            </div>
          </div>
        )}
        {!settings && <div className="mt-6"><FormError message={error} /></div>}
      </div>
    </main>
  );
}
