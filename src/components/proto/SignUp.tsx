"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, Field, FormError } from "@/components/proto/AuthCard";
import { FairyMascot } from "@/components/proto/FairyMascot";
import { signUp, type Account } from "@/client/dripy-api";

export function SignUp() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setAccount(await signUp(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  if (account) return <StartChat account={account} onDone={() => { router.push("/"); router.refresh(); }} />;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <AuthCard>
      <h1 className="font-display text-4xl">Meet your <em className="text-primary">fairy</em></h1>
      <p className="mt-2 text-sm text-muted-foreground">Dripy reads your order emails to build your closet, and texts with you on iMessage.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Your name">
          <Input required autoComplete="name" value={form.name} onChange={set("name")} placeholder="Alex Rivera" />
        </Field>
        <Field label="Gmail" hint="Dripy reads your order confirmations to build your wardrobe (demo inbox for now).">
          <Input required type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@gmail.com" />
        </Field>
        <Field label="Phone number" hint="The number you use for iMessage.">
          <Input required type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="(206) 555-0123" />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={busy} className="w-full rounded-full bg-dot text-dot-foreground hover:bg-dot/90">{busy ? "Setting up your closet…" : "Sign up"}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link></p>
    </AuthCard>
  );
}

/** Step 2: open iMessage with the start code pre-filled, so Dripy can greet this account. */
export function StartChat({ account, onDone }: { account: Account; onDone: () => void }) {
  const first = account.user.name.split(" ")[0];
  const { handle, body, url } = account.imessage;
  return (
    <AuthCard>
      <div className="text-center">
        <FairyMascot className="mx-auto h-24 -scale-x-100" />
        <h1 className="mt-4 font-display text-4xl">You&apos;re in, {first}!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Say hi to Dripy on iMessage. Your fairy will reply with your digital wardrobe.</p>
      </div>
      {url ? (
        <Button asChild size="lg" className="mt-6 w-full gap-2 rounded-full">
          <a href={url}><MessageCircle />Open iMessage</a>
        </Button>
      ) : (
        <p className="mt-6 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          Dripy&apos;s iMessage number isn&apos;t configured yet (set <code>DRIPY_IMESSAGE_HANDLE</code>). Text the message below to the Dripy line.
        </p>
      )}
      <div className="mt-4 rounded-2xl bg-muted p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{handle ? `Text ${handle}` : "Your first message"}</p>
        <p className="mt-1 font-medium">{body}</p>
      </div>
      <Button variant="ghost" onClick={onDone} className="mt-4 w-full rounded-full">Go to my closet</Button>
    </AuthCard>
  );
}
