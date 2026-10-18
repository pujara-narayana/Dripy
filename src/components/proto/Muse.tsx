"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ArrowUpRight, ChevronRight, Heart, MessageCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Hanger } from "@/components/proto/Garment";
import { mascot } from "@/components/proto/mascots";
import { ChatInput, Chips, FairyMsg, TypingMsg, UserMsg } from "@/components/proto/Chat";
import { catalogById, type CatalogItem } from "@/data/catalog";
import { FairyMascot } from "@/components/proto/FairyMascot";
import { useCheckout } from "@/components/proto/useCheckout";
import {
  getChatHistory,
  getWardrobe,
  money,
  notesFromCards,
  picksFromCards,
  sendChat,
  type Card,
  type ChatPick,
  type HistoryMessage,
  type Mode,
  type PurchaseIntentCard,
  type WardrobeItem,
} from "@/client/dripy-api";

const byIds = (ids: string[]) => ids.map(catalogById).filter((g): g is CatalogItem => !!g);

type FairyReply = { match: string[]; text: string; picks: CatalogItem[] };

// Canned replies for when the chat API errors (no LLM key, quota used up), so the demo never goes silent.
const fairyReplies: FairyReply[] = [
  { match: ["cold", "warm", "cozy", "chilly", "winter"], text: "Cold out? Layer your cotton shirt under a soft knit — and a structured jacket on top keeps the wind out.", picks: byIds(["knit", "cardigan", "jacket"]) },
  { match: ["date", "coffee", "dinner", "night"], text: "For a date, your pleated midi dress with the crew-neck knit over your shoulders reads effortless. Add the cardigan if it gets chilly.", picks: byIds(["dress", "knit", "cardigan"]) },
  { match: ["work", "office", "meeting", "interview"], text: "A clean work look: the stand-collar shirt tucked into straight jeans, with the utility jacket over the top.", picks: byIds(["shirt", "jeans", "jacket"]) },
  { match: ["party", "event", "wedding", "celebration"], text: "Something for an occasion — the pleated midi dress does the talking; the cardigan covers shoulders if needed.", picks: byIds(["dress", "cardigan", "knit"]) },
  { match: ["shoes", "sneaker", "boot", "footwear", "flats"], text: "From your shoe shelf: knit lace-up sneakers for daytime, pointed flats when it's dressier, and the beige suede pair for weekends.", picks: byIds(["sneakers-knit", "flats-pointed", "sneakers-suede"]) },
  { match: ["travel", "trip", "pack", "flight"], text: "Easy travel kit: the utility jacket (pockets!), cotton shirt, and straight jeans — all wrinkle-friendly.", picks: byIds(["jacket", "shirt", "jeans"]) },
  { match: ["donate", "unworn", "declutter"], text: "Great instinct. Pick the pieces on the Donate page and I'll find the nearest drop-off.", picks: [] },
];

const fallbackReplies: FairyReply[] = [
  { match: [], text: "I picked these from what you already own — tell me the occasion and I'll narrow it down.", picks: byIds(["jacket", "shirt", "jeans"]) },
  { match: [], text: "Here's a mix from your closet — want me to shop for a missing piece instead?", picks: byIds(["dress", "cardigan", "knit"]) },
];

let fallbackIndex = 0;
function pickReply(input: string): FairyReply {
  const text = input.toLowerCase();
  return fairyReplies.find((r) => r.match.some((m) => text.includes(m))) ?? fallbackReplies[fallbackIndex++ % fallbackReplies.length]!;
}

type ChatMessage = {
  id: string;
  role: "user" | "fairy";
  text: ReactNode;
  picks?: ChatPick[];
  intents?: PurchaseIntentCard[];
  mode?: Mode | "offline";
  via?: "imessage" | "sms" | "whatsapp";
};

const toPicks = (garments: CatalogItem[]): ChatPick[] => garments.map((g) => ({ id: g.id, name: g.name, image: g.image, link: g.link, store: "Uniqlo" }));

/** Reply text plus the notes its cards carry (receipt, places). */
function fairyText(body: string, cards: Card[]): ReactNode {
  const notes = notesFromCards(cards);
  return (
    <>
      <span className="whitespace-pre-line [overflow-wrap:anywhere]">{body}</span>
      {notes.map((n) => (
        <span key={n} className="mt-2 block font-medium">{n}</span>
      ))}
    </>
  );
}

const intentsOf = (cards: Card[]) => cards.filter((c): c is PurchaseIntentCard => c.type === "purchase_intent");

function fromHistory(m: HistoryMessage): ChatMessage {
  const via = m.channel === "web" ? undefined : m.channel;
  if (m.direction === "inbound") return { id: m.id, role: "user", text: m.body ?? (m.attachments.length ? "📷 Photo" : ""), ...(via ? { via } : {}) };
  const picks = picksFromCards(m.cards);
  const intents = intentsOf(m.cards);
  return {
    id: m.id,
    role: "fairy",
    text: fairyText(m.body ?? "", m.cards),
    ...(picks.length ? { picks } : {}),
    ...(intents.length ? { intents } : {}),
    ...(via ? { via } : {}),
  };
}

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "fairy",
  text: <>Hi! I know every piece in your closet. Ask me what to wear, or tell me about something you&apos;re eyeing and I&apos;ll tell you honestly if you need it.</>,
};

// Wardrobe categories (wardrobe_items.category) as closet sections, in display order.
const sectionDefs = [
  { category: "outerwear", title: "Outerwear", laid: false },
  { category: "top", title: "Tops", laid: false },
  { category: "dress", title: "Dresses", laid: false },
  { category: "bottom", title: "Bottoms", laid: false },
  { category: "shoes", title: "Shoes", laid: true },
  { category: "accessory", title: "Accessories", laid: true },
];

const wardrobeTabs = ["Daily", "Work", "Occasion"] as const;
const tabSections: Record<(typeof wardrobeTabs)[number], string[] | null> = {
  Daily: null,
  Work: ["Outerwear", "Tops", "Bottoms", "Shoes"],
  Occasion: ["Dresses", "Tops", "Accessories"],
};

const rackTier = (i: number) => (i < 3 ? "" : i < 6 ? "rack-extra" : "rack-extra-2");

export function Muse() {
  const [chatOpen, setChatOpen] = useState(true);
  const chatPanel = useRef<PanelImperativeHandle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [tab, setTab] = useState<(typeof wardrobeTabs)[number]>("Daily");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [wardrobe, setWardrobe] = useState<WardrobeItem[] | null>(null);
  const [wardrobeError, setWardrobeError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const loadWardrobe = useCallback(() => {
    getWardrobe().then(
      (items) => {
        setWardrobe(items);
        setWardrobeError(null);
      },
      (err: unknown) => setWardrobeError(err instanceof Error ? err.message : "Couldn't load your closet."),
    );
  }, []);

  const addFairy = (msg: Omit<ChatMessage, "id" | "role">) =>
    setMessages((prev) => [...prev, { id: `local-${prev.length}-${Date.now()}`, role: "fairy", ...msg }]);

  const checkout = useCheckout(({ reply }) => {
    addFairy({ text: <span className="whitespace-pre-line">{reply}</span> });
    loadWardrobe();
  });

  useEffect(() => {
    loadWardrobe();
    // The same conversation as iMessage: what you texted Dripy shows up here.
    getChatHistory().then(
      (history) => setMessages(history.length ? history.map(fromHistory) : [welcomeMessage]),
      () => setMessages([welcomeMessage]),
    );
  }, [loadWardrobe]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setMessages((prev) => [...prev, { id: `local-${prev.length}-${Date.now()}`, role: "user", text: trimmed }]);
    setInput("");
    setTyping(true);
    // Ask the Dripy agent (/api/chat). If it errors, fall back to the canned replies.
    sendChat(trimmed)
      .then((res) => {
        const picks = picksFromCards(res.cards);
        const intents = intentsOf(res.cards);
        addFairy({
          text: fairyText(res.reply, res.cards),
          ...(picks.length ? { picks } : {}),
          ...(intents.length ? { intents } : {}),
          mode: res.meta.mode,
        });
        if (res.cards.some((c) => c.type === "payment_confirmation")) loadWardrobe();
      })
      .catch((err: unknown) => {
        console.warn("Dripy API unavailable, using canned reply", err);
        const reply = pickReply(trimmed);
        addFairy({ text: reply.text, ...(reply.picks.length ? { picks: toPicks(reply.picks) } : {}), mode: "offline" });
      })
      .finally(() => setTyping(false));
  };

  const sections = sectionDefs
    .map((s) => ({ ...s, items: (wardrobe ?? []).filter((w) => w.category.toLowerCase() === s.category) }))
    .filter((s) => s.items.length > 0);
  const shownSections = tabSections[tab] ? sections.filter((s) => tabSections[tab]!.includes(s.title)) : sections;
  const itemCount = shownSections.reduce((n, s) => n + s.items.length, 0);
  const byWardrobeId = (id: string) => wardrobe?.find((w) => w.id === id);
  const defaultPick = ["outerwear", "top", "bottom"].map((c) => wardrobe?.find((w) => w.category === c)).filter((w): w is WardrobeItem => !!w);
  const today = picked.size > 0 ? [...picked].map(byWardrobeId).filter((w): w is WardrobeItem => !!w).slice(0, 3) : defaultPick;

  const togglePicked = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResizablePanelGroup orientation="horizontal" className="min-h-[480px] flex-1" id="muse-workspace">
        <ResizablePanel id="fairy-chat" panelRef={chatPanel} defaultSize="60%" minSize="30%" collapsible collapsedSize="0%" onResize={(size) => setChatOpen(size.asPercentage > 0)}>
          <main aria-label="Fairy chat" className="flex h-full min-w-0 flex-col overflow-hidden px-4 sm:px-8">
            <div className="flex shrink-0 justify-end pt-3">
              <Button variant="ghost" size="icon" aria-label="Collapse chat" title="Collapse chat" onClick={() => chatPanel.current?.collapse()}><PanelLeftClose /></Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto" ref={scroller}>
              <div className="mx-auto w-full max-w-2xl pb-6">

                <div className="py-8 text-center">
                  <FairyMascot className="mx-auto h-24 -scale-x-100" />
                  <h1 className="mt-5 font-display text-4xl xl:text-6xl">What are we <em className="text-primary">wearing</em> today?</h1>
                  <p className="mt-2 text-muted-foreground">I know every piece in your closet — and where to find the rest.</p>
                </div>
                <div className="space-y-4">
                  {messages.map((m) =>
                    m.role === "user" ? (
                      <div key={m.id}>
                        <UserMsg>{m.text}</UserMsg>
                        {m.via && <p className="mt-1 text-right text-[10px] uppercase tracking-wide text-muted-foreground">via iMessage</p>}
                      </div>
                    ) : (
                      <div key={m.id} className="space-y-3">
                        <FairyMsg mirror>
                          {m.text}
                          {m.mode && m.mode !== "live" && (
                            <span className="mt-2 block text-[10px] uppercase tracking-wide text-muted-foreground">{m.mode === "offline" ? "offline: canned reply (API error)" : m.mode}</span>
                          )}
                          {m.via && <span className="mt-2 block text-[10px] uppercase tracking-wide text-muted-foreground">sent on iMessage</span>}
                        </FairyMsg>
                        {m.picks && (
                          <div className="ml-11 grid grid-cols-3 gap-3">
                            {m.picks.map((g) => (
                              <a key={g.id} href={g.link} target="_blank" rel="noopener noreferrer" draggable={false} className="group rounded-2xl border border-border bg-card p-3 transition-shadow hover:shadow-md">
                                <div className="flex h-28 items-center justify-center rounded-xl bg-muted p-2">
                                  {g.image && <img src={g.image} alt={g.name} draggable={false} className="h-full object-contain transition-transform group-hover:-translate-y-0.5" />}
                                </div>
                                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{g.store}</p>
                                <p className="mt-0.5 flex items-start justify-between gap-1 text-xs font-medium leading-snug">{g.name}{g.link && <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-primary" />}</p>
                              </a>
                            ))}
                          </div>
                        )}
                        {m.intents?.filter((c) => c.status === "awaiting_approval").map((c) => (
                          <div key={c.intent_id} className="ml-11 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.merchant_domain}</p>
                              <p className="text-sm font-medium">{c.item_name} · {money(c.amount_cents)}</p>
                            </div>
                            <Button size="sm" className="rounded-full bg-dot text-dot-foreground hover:bg-dot/90" disabled={checkout.busy === c.intent_id} onClick={() => checkout.approve(c)}>
                              {c.needs_card ? "Add Visa card & pay" : "Approve & pay"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                  {typing && <TypingMsg />}
                  {checkout.error && <p role="alert" className="ml-11 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{checkout.error}</p>}
                </div>
              </div>
            </div>
            <div className="shrink-0 bg-background pb-6 pt-4">
              <div className="mx-auto w-full max-w-2xl space-y-3">
                <Chips items={["What should I wear today?", "Buy the last thing I sent you", "Where can I donate clothes?"]} onPick={send} />
                <ChatInput value={input} onChange={setInput} onSubmit={() => send(input)} placeholder="Ask fairy — or paste a link" />
              </div>
            </div>
          </main>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize chat and wardrobe" className="z-10 w-2 shrink-0 touch-none hover:bg-accent" />
        <ResizablePanel id="wardrobe-panel" defaultSize="40%" minSize="28%">
        <aside aria-label="Wardrobe" className="flex h-full min-w-0 flex-col bg-card px-3 pb-4 pt-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!chatOpen && <Button variant="ghost" size="icon" aria-label="Open fairy chat" title="Open fairy chat" onClick={() => chatPanel.current?.expand()}><PanelLeftOpen /></Button>}
              <h2 className="font-display text-3xl">Wardrobe</h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{wardrobe ? `${itemCount} items` : "Loading…"}</span>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            {wardrobeTabs.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1 transition-colors ${tab === t ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>

          {/* Closet cabinet */}
          <div className="closet-frame mt-5 flex min-h-0 flex-1 flex-col rounded-t-xl p-2.5">
            <div className="mb-2 flex justify-center gap-6">
              <span className="h-1 w-8 rounded-full bg-wood-dark" />
              <span className="h-1 w-8 rounded-full bg-wood-dark" />
            </div>
              <div className="closet-interior min-h-0 flex-1 overflow-y-auto rounded-md px-3 pb-3">
              {wardrobeError && <p className="pt-6 text-center text-sm text-muted-foreground">{wardrobeError}</p>}
              {wardrobe && sections.length === 0 && <p className="pt-6 text-center text-sm text-muted-foreground">Your closet is empty. Buy something and it lands here.</p>}
              {shownSections.map((s) => (
                <section key={s.title} className="pt-4">
                  <p className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">{s.title}<ChevronRight className="size-3" /></p>
                  {!s.laid && <div className="closet-rod mt-2" />}
                  <div className={`closet-rack ${s.laid ? "mt-3" : "-mt-1"}`}>
                    {s.items.map((g, i) => (
                      <div key={g.id} className={`rack-item hover-sway flex flex-col items-center ${rackTier(i)}`} title={g.source === "purchase" ? `${g.name} (new)` : g.name}>
                        {!s.laid && <Hanger className="h-3 w-8 text-wood-dark" />}
                        <button
                          type="button"
                          onClick={() => togglePicked(g.id)}
                          aria-label={`Pick ${g.name} for today`}
                          aria-pressed={picked.has(g.id)}
                          className={`relative w-full rounded-lg p-0.5 transition-all ${picked.has(g.id) ? "bg-accent ring-2 ring-primary" : "hover:bg-accent/60"}`}
                        >
                          {g.image_url ? (
                            <img src={g.image_url} alt={`Owned ${g.name}`} className="-mt-1 h-28 w-full object-contain object-top drop-shadow-sm" />
                          ) : (
                            <span className="flex h-28 items-center justify-center text-center text-[10px] text-muted-foreground">{g.name}</span>
                          )}
                          {g.source === "purchase" && <span className="absolute left-1 top-1 rounded-full bg-dot px-1.5 py-0.5 text-[9px] font-medium uppercase text-dot-foreground">New</span>}
                          {picked.has(g.id) && <Heart className="absolute right-1 top-1 size-3.5 fill-primary text-primary" />}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="closet-shelf mt-3 rounded-sm" />
                </section>
              ))}
            </div>
            <div className="closet-shelf mt-2 h-3 rounded-sm" />
          </div>

          <div className="mt-3 rounded-2xl border border-border p-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Heart className="size-3.5 fill-primary text-primary" />{picked.size > 0 ? "Today's pick" : "Today's pick — tap a piece in the closet"}</p>
            <div className="mt-2 flex gap-2">
              {today.map((g) => (
                <div key={g.id} className="min-w-0 flex-1">
                  <div className="flex h-24 items-center justify-center rounded-xl bg-muted p-2">
                    {g.image_url && <img src={g.image_url} alt={g.name} className="h-full object-contain" />}
                  </div>
                  <p className="mt-1.5 line-clamp-2 h-6 text-center text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">{g.name}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
      {!chatOpen && <Button variant="outline" onClick={() => chatPanel.current?.expand()} className="fixed bottom-20 left-6 gap-2 rounded-full bg-card shadow-md"><img src={mascot.crown} alt="" className="h-7 w-9 -scale-x-100 object-contain" /><MessageCircle className="text-primary" />Ask fairy</Button>}
      {checkout.dialog}
    </div>
  );
}
