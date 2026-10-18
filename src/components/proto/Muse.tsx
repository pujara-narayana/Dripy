"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ArrowUpRight, ChevronRight, Heart, MessageCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Hanger } from "@/components/proto/Garment";
import { mascot } from "@/components/proto/mascots";
import { ChatInput, Chips, FairyMsg, TypingMsg, UserMsg } from "@/components/proto/Chat";
import { photoClothes } from "@/components/proto/photo-clothes";
import { FairyMascot } from "@/components/proto/FairyMascot";
import { notesFromCards, picksFromCards, sendChat, type ChatPick, type Mode } from "@/client/dripy-api";


type PhotoGarment = (typeof photoClothes)[number];

const byId = (id: string) => photoClothes.find((g) => g.id === id)!;
const byIds = (ids: string[]) => ids.map(byId);

type FairyReply = { match: string[]; text: string; picks: PhotoGarment[] };

const fairyReplies: FairyReply[] = [
  { match: ["cold", "warm", "cozy", "chilly", "winter"], text: "Cold out? Layer your cotton shirt under a soft knit — and a structured jacket on top keeps the wind out.", picks: byIds(["knit", "cardigan", "jacket"]) },
  { match: ["date", "coffee", "dinner", "night"], text: "For a date, your pleated midi dress with the crew-neck knit over your shoulders reads effortless. Add the cardigan if it gets chilly.", picks: byIds(["dress", "knit", "cardigan"]) },
  { match: ["work", "office", "meeting", "interview"], text: "A clean work look: the stand-collar shirt tucked into straight jeans, with the utility jacket over the top.", picks: byIds(["shirt", "jeans", "jacket"]) },
  { match: ["party", "event", "wedding", "celebration"], text: "Something for an occasion — the pleated midi dress does the talking; the cardigan covers shoulders if needed.", picks: byIds(["dress", "cardigan", "knit"]) },
  { match: ["shoes", "sneaker", "boot", "footwear", "flats"], text: "From your shoe shelf: knit lace-up sneakers for daytime, pointed flats when it's dressier, and the beige suede pair for weekends.", picks: byIds(["sneakers-knit", "flats-pointed", "sneakers-suede"]) },
  { match: ["travel", "trip", "pack", "flight"], text: "Easy travel kit: the utility jacket (pockets!), cotton shirt, and straight jeans — all wrinkle-friendly.", picks: byIds(["jacket", "shirt", "jeans"]) },
  { match: ["laundry", "wash", "clean"], text: "No worries — I'll only suggest pieces from your closet that are clean and ready to wear.", picks: byIds(["shirt", "knit", "jeans"]) },
  { match: ["donate", "unworn", "declutter"], text: "Great instinct. I'd start with anything unworn for two seasons — I'll flag candidates as we go.", picks: byIds(["cardigan", "knit", "dress"]) },
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

type ChatMessage = { id: number; role: "user" | "fairy"; text: ReactNode; picks?: ChatPick[]; mode?: Mode | "offline" };

const toPicks = (garments: PhotoGarment[]): ChatPick[] => garments.map((g) => ({ id: g.id, name: g.name, image: g.image, link: g.link, store: "Uniqlo" }));

function initialMessages(): ChatMessage[] {
  return [
    { id: 1, role: "user", text: "Cozy but cute for a coffee date, it's cold" },
    {
      id: 2,
      role: "fairy",
      text: <>Your <b>utility jacket</b> + <b>cotton shirt</b> + <b>straight jeans</b>. A soft knit on top would finish it — here are a few:</>,
      picks: toPicks(byIds(["knit", "jeans", "jacket"])),
    },
  ];
}

const sections = [
  { title: "Outerwear", laid: false, items: byIds(["jacket", "cardigan", "down-parka", "rain-coat", "coach-jacket", "utility-parka", "blazer", "blouson"]) },
  { title: "Tops", laid: false, items: byIds(["shirt", "knit", "merino-gray", "merino-cardigan-navy", "merino-black", "merino-long", "merino-button", "cashmere-crew"]) },
  { title: "Dresses", laid: false, items: byIds(["dress", "dress-rayon", "dress-u-shirt", "dress-sleeveless", "dress-flannel", "dress-mini", "dress-volume"]) },
  { title: "Bottoms", laid: false, items: byIds(["jeans", "denim-pants", "denim-skirt", "pleated-pants", "skinny-jeans", "culotte-denim", "jeans-wide"]) },
  { title: "Shoes", laid: true, items: byIds(["sneakers-knit", "sneakers-canvas", "flats-pointed", "sneakers-suede", "sneakers-u-knit", "sneakers-leather", "flats-tstrap", "flats-square"]) },
  { title: "Accessories", laid: true, items: byIds(["scarf-cashmere", "beanie-cashmere", "beanie-pompom", "hooded-scarf", "tote-leather", "tote-canvas", "bag-utility", "bag-shoulder"]) },
];

const wardrobeTabs = ["Daily", "Work", "Occasion"] as const;
const tabSections: Record<(typeof wardrobeTabs)[number], string[] | null> = {
  Daily: null,
  Work: ["Outerwear", "Tops", "Bottoms", "Shoes"],
  Occasion: ["Dresses", "Tops", "Accessories"],
};

const defaultPick = byIds(["jacket", "shirt", "jeans"]);

const rackTier = (i: number) => (i < 3 ? "" : i < 6 ? "rack-extra" : "rack-extra-2");


export function Muse() {
  const [chatOpen, setChatOpen] = useState(true);
  const chatPanel = useRef<PanelImperativeHandle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [tab, setTab] = useState<(typeof wardrobeTabs)[number]>("Daily");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setMessages((prev) => [...prev, { id: prev.length + 1, role: "user", text: trimmed }]);
    setInput("");
    setTyping(true);
    const addFairy = (msg: Omit<ChatMessage, "id" | "role">) =>
      setMessages((prev) => [...prev, { id: prev.length + 1, role: "fairy", ...msg }]);
    // Ask the Dripy backend (/api/chat). If it isn't running, fall back to the canned replies.
    sendChat(trimmed)
      .then((res) => {
        const notes = notesFromCards(res.cards);
        const picks = picksFromCards(res.cards);
        addFairy({
          text: (
            <>
              {res.reply}
              {notes.map((n) => (
                <span key={n} className="mt-2 block font-medium">{n}</span>
              ))}
            </>
          ),
          ...(picks.length ? { picks } : {}),
          mode: res.meta.mode,
        });
      })
      .catch((err: unknown) => {
        console.warn("Dripy API unavailable, using canned reply", err);
        const reply = pickReply(trimmed);
        addFairy({ text: reply.text, picks: toPicks(reply.picks), mode: "offline" });
      })
      .finally(() => setTyping(false));
  };

  const today = picked.size > 0 ? byIds([...picked].slice(0, 3)) : defaultPick;
  const shownSections = tabSections[tab] ? sections.filter((s) => tabSections[tab]!.includes(s.title)) : sections;
  const itemCount = shownSections.reduce((n, s) => n + s.items.length, 0);

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
                      <UserMsg key={m.id}>{m.text}</UserMsg>
                    ) : (
                      <div key={m.id} className="space-y-3">
                        <FairyMsg mirror>
                          {m.text}
                          {m.mode && m.mode !== "live" && (
                            <span className="mt-2 block text-[10px] uppercase tracking-wide text-muted-foreground">{m.mode === "offline" ? "offline: canned reply (API error)" : m.mode}</span>
                          )}
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
                      </div>
                    ),
                  )}
                  {typing && <TypingMsg />}
                </div>
              </div>
            </div>
            <div className="shrink-0 bg-background pb-6 pt-4">
              <div className="mx-auto w-full max-w-2xl space-y-3">
                <Chips items={["Try on my 3D avatar", "Swap the shoes", "Donate unworn items"]} onPick={send} />
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
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{itemCount} items</span>
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
              {shownSections.map((s) => (
                <section key={s.title} className="pt-4">
                  <p className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">{s.title}<ChevronRight className="size-3" /></p>
                  {!s.laid && <div className="closet-rod mt-2" />}
                  <div className={`closet-rack ${s.laid ? "mt-3" : "-mt-1"}`}>
                    {s.items.map((g, i) => g && (
                      <div key={g.id + i} className={`rack-item hover-sway flex flex-col items-center ${rackTier(i)}`} title={g.name}>
                        {!s.laid && <Hanger className="h-3 w-8 text-wood-dark" />}
                        <button
                          type="button"
                          onClick={() => togglePicked(g.id)}
                          aria-label={`Pick ${g.name} for today`}
                          aria-pressed={picked.has(g.id)}
                          className={`relative w-full rounded-lg p-0.5 transition-all ${picked.has(g.id) ? "bg-accent ring-2 ring-primary" : "hover:bg-accent/60"}`}
                        >
                          <img src={g.image} alt={`Owned ${g.name}`} className="-mt-1 h-28 w-full object-contain object-top drop-shadow-sm" />
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
                    <img src={g.image} alt={g.name} className="h-full object-contain" />
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
    </div>
  );
}
