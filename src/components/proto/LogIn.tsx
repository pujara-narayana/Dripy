"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, Field, FormError } from "@/components/proto/AuthCard";
import { logIn } from "@/client/dripy-api";

export function LogIn() {
  const router = useRouter();
  const expired = useSearchParams().get("expired") === "1";
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(expired ? "That link has expired. Log in with your phone number." : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await logIn(phone);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log-in failed.");
      setBusy(false);
    }
  };

  return (
    <AuthCard>
      <h1 className="font-display text-4xl">Welcome <em className="text-primary">back</em></h1>
      <p className="mt-2 text-sm text-muted-foreground">Log in with the phone number you signed up with.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Phone number">
          <Input required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(206) 555-0123" />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={busy} className="w-full rounded-full bg-dot text-dot-foreground hover:bg-dot/90">{busy ? "Logging in…" : "Log in"}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">New here? <Link href="/signup" className="text-primary hover:underline">Sign up</Link></p>
    </AuthCard>
  );
}
