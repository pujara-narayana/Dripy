import type { ReactNode } from "react";

/** Centered card shared by the sign-up, log-in and checkout screens. */
export function AuthCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-10 sm:py-16">
      <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8`}>{children}</div>
    </main>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</p>;
}
