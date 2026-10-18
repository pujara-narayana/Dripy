import { Garment, wardrobe } from "./Garment";
import { mascot } from "./mascots";

const toneText = ["", "text-tone-1", "text-tone-2", "text-tone-3", "text-tone-4", "text-tone-5"];

export function FairyMsg({ children, avatar = mascot.crown, mirror = false }: { children: React.ReactNode; avatar?: string; mirror?: boolean }) {
  return (
    <div className="flex items-end gap-3">
      <img src={avatar} alt="Fairy" draggable={false} className={`h-14 w-[5.5rem] shrink-0 object-contain ${mirror ? "-scale-x-100" : ""}`} />
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function UserMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground">{children}</div>
    </div>
  );
}

export function TypingMsg() {
  return (
    <div className="flex items-end gap-3">
      <img src={mascot.crown} alt="Fairy typing" draggable={false} className="h-14 w-[5.5rem] shrink-0 object-contain -scale-x-100" />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3.5" aria-label="Fairy is typing">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 180}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function ProductRow() {
  const picks = [
    { i: 3, p: "$148", o: "$290", s: "Mango" },
    { i: 4, p: "$59", o: "$89", s: "COS" },
    { i: 2, p: "$42", o: "$70", s: "Zara" },
  ];
  return (
    <div className="ml-14 flex gap-2">
      {picks.map((x) => (
        <div key={x.i} className="w-28 rounded-xl border border-border bg-card p-2">
          <div className="flex h-20 items-center justify-center rounded-lg bg-muted">
            <Garment kind={wardrobe[x.i]!.kind} className={`h-14 w-12 ${toneText[wardrobe[x.i]!.tone]}`} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{x.s}</p>
          <p className="text-xs"><span className="font-medium">{x.p}</span> <s className="text-muted-foreground">{x.o}</s></p>
        </div>
      ))}
    </div>
  );
}

export function ChatInput({ value, onChange, onSubmit, placeholder = "Ask your fairy anything…" }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-3 shadow-sm"
    >
      <span className="text-muted-foreground">＋</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Message fairy"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <span className="text-muted-foreground">◎</span>
      <button type="submit" aria-label="Send message" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground transition-transform hover:scale-105">↑</button>
    </form>
  );
}

export function Chips({ items, onPick }: { items: string[]; onPick?: (chip: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) =>
        onPick ? (
          <button key={c} type="button" onClick={() => onPick(c)} className="rounded-full bg-accent px-3.5 py-1.5 text-xs text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
            {c}
          </button>
        ) : (
          <span key={c} className="rounded-full bg-accent px-3.5 py-1.5 text-xs text-accent-foreground">{c}</span>
        ),
      )}
    </div>
  );
}
