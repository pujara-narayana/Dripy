import { Fragment } from "react";

// Agent replies are plain text; this turns the URLs in them into links. Dripy's own pages
// (checkout, closet) open in the same tab, store links in a new one.

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const TRAILING = /[.,;:!?]+$/; // "…here: https://x.com/a." -> the period isn't part of the link

/** "https://www.cos.com/en-us/men/p/123?x=1" -> "cos.com/en-us/men/p/123…" */
function label(url: string): string {
  try {
    const u = new URL(url);
    const shown = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
    return shown.length > 42 ? `${shown.slice(0, 40)}…` : shown;
  } catch {
    return url;
  }
}

function isSameSite(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function Linkify({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, "");
    const start = m.index;
    if (start > last) parts.push(<Fragment key={`t${last}`}>{text.slice(last, start)}</Fragment>);
    const internal = isSameSite(url);
    parts.push(
      <a
        key={`a${start}`}
        href={url}
        title={url}
        {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="font-medium text-primary underline underline-offset-2 [overflow-wrap:anywhere] hover:opacity-80"
      >
        {label(url)}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return <span className={className}>{parts}</span>;
}
