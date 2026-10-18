"use client";

import { useRef, useState } from "react";
import { imageFiles, MAX_CHAT_IMAGES, type ChatImage } from "@/client/images";
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

export function ChatInput({ value, onChange, onSubmit, placeholder = "Ask your fairy anything…", images = [], onAddFiles, onRemoveImage, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Attached photos waiting to be sent (shown as removable thumbnails). */
  images?: ChatImage[];
  /** Picked, pasted or dropped image files; omit to hide the attach button. */
  onAddFiles?: (files: File[]) => void;
  onRemoveImage?: (id: string) => void;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const canAttach = !!onAddFiles && images.length < MAX_CHAT_IMAGES;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onDragOver={(e) => {
        if (!onAddFiles || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!onAddFiles) return;
        e.preventDefault();
        setDragging(false);
        const files = imageFiles(e.dataTransfer);
        if (files.length) onAddFiles(files);
      }}
      className={`rounded-3xl border bg-card px-4 py-3 shadow-sm transition-colors ${dragging ? "border-primary bg-accent" : "border-border"}`}
    >
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative">
              <img src={img.dataUrl} alt={img.name || "Attached photo"} className="h-16 w-16 rounded-xl border border-border object-cover" />
              {onRemoveImage && (
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  aria-label={`Remove ${img.name || "photo"}`}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        {onAddFiles ? (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!canAttach}
              aria-label="Attach a photo"
              title={canAttach ? "Attach a photo (or paste / drop one)" : `Up to ${MAX_CHAT_IMAGES} photos`}
              className="flex size-7 items-center justify-center rounded-full text-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              ＋
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = ""; // picking the same file again still fires onChange
                if (files.length) onAddFiles(files);
              }}
            />
          </>
        ) : (
          <span className="text-muted-foreground">＋</span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            if (!onAddFiles) return;
            const files = imageFiles(e.clipboardData);
            if (!files.length) return; // plain text pastes as usual
            e.preventDefault();
            onAddFiles(files);
          }}
          placeholder={placeholder}
          aria-label="Message fairy"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <span className="text-muted-foreground">◎</span>
        <button type="submit" disabled={disabled} aria-label="Send message" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">↑</button>
      </div>
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
