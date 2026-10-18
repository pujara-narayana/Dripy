type Kind = "shirt" | "dress" | "jacket" | "pants" | "skirt" | "coat";

const paths: Record<Kind, string> = {
  shirt: "M30 10 L45 4 Q50 12 55 4 L70 10 L88 28 L76 38 L70 32 L70 92 L30 92 L30 32 L24 38 L12 28 Z",
  dress: "M38 4 L44 8 Q50 14 56 8 L62 4 L66 30 L60 36 L84 96 L16 96 L40 36 L34 30 Z",
  jacket: "M30 8 L44 4 L50 30 L56 4 L70 8 L90 30 L84 92 L72 92 L70 40 L70 96 L30 96 L30 40 L28 92 L16 92 L10 30 Z",
  pants: "M28 4 L72 4 L76 96 L56 96 L50 36 L44 96 L24 96 Z",
  skirt: "M32 6 L68 6 L70 18 L88 90 L12 90 L30 18 Z",
  coat: "M32 6 L44 2 L50 22 L56 2 L68 6 L88 26 L84 98 L16 98 L12 26 Z",
};

export function Garment({ kind, className = "" }: { kind: Kind; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d={paths[kind]} fill="currentColor" />
      <path d={paths[kind]} fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" style={{ mixBlendMode: "multiply" }} />
    </svg>
  );
}

export function Hanger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 24" className={className} aria-hidden>
      <path d="M30 2 q5 0 5 5 q0 3 -5 5 L4 22 h52 L30 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export const wardrobe: { kind: Kind; name: string; brand: string; tone: number }[] = [
  { kind: "coat", name: "Wool Trench", brand: "Zara", tone: 1 },
  { kind: "shirt", name: "Linen Shirt", brand: "H&M", tone: 2 },
  { kind: "dress", name: "Slip Dress", brand: "Zara", tone: 3 },
  { kind: "jacket", name: "Cropped Blazer", brand: "Mango", tone: 4 },
  { kind: "skirt", name: "Pleated Midi", brand: "COS", tone: 5 },
  { kind: "pants", name: "Wide Trousers", brand: "Uniqlo", tone: 1 },
  { kind: "shirt", name: "Ribbed Tee", brand: "Nike", tone: 3 },
];
