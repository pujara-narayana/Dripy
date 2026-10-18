"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { money, type Gender } from "@/client/dripy-api";

// Controls shared by sign-up and the Settings page.

const pill = (on: boolean) =>
  `flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
  }`;

/** Girl / boy: picks the demo closet and the shop the user gets. */
export function GenderToggle({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  return (
    <div role="radiogroup" aria-label="Shop for" className="flex gap-2">
      {([["women", "Girl"], ["men", "Boy"]] as const).map(([g, label]) => (
        <button key={g} type="button" role="radio" aria-checked={value === g} onClick={() => onChange(g)} className={pill(value === g)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** How much the agent may spend on one purchase. `value` null means the server cap. */
export function SpendLimitPicker({ value, max, onChange }: { value: number | null; max: number; onChange: (cents: number) => void }) {
  const presets = [5000, 10000, 15000, max].filter((c, i, all) => c <= max && all.indexOf(c) === i);
  const current = value ?? max;
  const [custom, setCustom] = useState(presets.includes(current) ? "" : String(current / 100));
  const [customError, setCustomError] = useState<string | null>(null);

  const setDollars = (text: string) => {
    setCustom(text);
    const dollars = Number(text);
    if (!text.trim()) return setCustomError(null);
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > max / 100) return setCustomError(`Pick an amount from $1 to ${money(max)}.`);
    setCustomError(null);
    onChange(Math.round(dollars * 100));
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {presets.map((cents) => (
          <button
            key={cents}
            type="button"
            aria-pressed={!custom && current === cents}
            onClick={() => {
              setCustom("");
              setCustomError(null);
              onChange(cents);
            }}
            className={pill(!custom && current === cents)}
          >
            {money(cents).replace(".00", "")}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        Or another amount: $
        <Input inputMode="decimal" value={custom} onChange={(e) => setDollars(e.target.value)} placeholder="e.g. 75" className="w-28 placeholder:text-muted-foreground/60" aria-label="Custom spending limit in dollars" />
      </label>
      {customError && <p className="mt-1 text-xs text-destructive">{customError}</p>}
    </div>
  );
}
