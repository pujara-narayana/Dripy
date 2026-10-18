/** The Visa wordmark, drawn as text so it stays crisp at any size. */
export function VisaMark({ className = "" }: { className?: string }) {
  return <span className={`font-sans font-black italic tracking-tight ${className}`} aria-label="Visa">VISA</span>;
}

/** A live preview of the card being typed. */
export function CardPreview({ number, name, exp }: { number: string; name: string; exp: string }) {
  const digits = number.replace(/\D/g, "").padEnd(16, "•").slice(0, 16);
  return (
    <div className="relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1f71] via-[#23308f] to-[#0d1150] p-5 text-white shadow-lg">
      <div className="flex items-start justify-between">
        <div className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" aria-hidden />
        <VisaMark className="text-3xl" />
      </div>
      <p className="mt-6 font-mono text-lg tracking-[0.18em] sm:text-xl">{digits.replace(/(.{4})/g, "$1 ").trim()}</p>
      <div className="mt-4 flex items-end justify-between text-xs uppercase tracking-wide">
        <div className="min-w-0">
          <p className="text-[10px] text-white/60">Card holder</p>
          <p className="truncate">{name || "Your name"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/60">Expires</p>
          <p>{exp || "MM/YY"}</p>
        </div>
      </div>
    </div>
  );
}
