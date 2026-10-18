"use client";

import { useEffect, useRef, useState } from "react";
const mascotWings = "/images/mascot-crown-wings.svg";
const mascotWave = "/images/mascot-crown-wave-2.svg";
const mascotShake = "/images/mascot-crown-shake.svg";
const mascotSpin = "/images/mascot-crown-spin.svg";

const clickAnims = [
  { url: mascotWave, duration: 2600, alt: "Fairy mascot waving its wand" },
  { url: mascotShake, duration: 2200, alt: "Fairy mascot shaking with sparkles" },
  { url: mascotSpin, duration: 3400, alt: "Fairy mascot spinning around" },
];

export function FairyMascot({ className, label = "Make the fairy dance" }: { className?: string; label?: string }) {
  const [playing, setPlaying] = useState<{ url: string; alt: string } | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const last = useRef(-1);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = () => {
    if (busy.current) return;
    const options = clickAnims.map((_, i) => i).filter((i) => i !== last.current);
    const idx = options[Math.floor(Math.random() * options.length)]!;
    last.current = idx;
    const anim = clickAnims[idx]!;
    busy.current = true;
    setAnimKey((k) => k + 1);
    setPlaying({ url: anim.url, alt: anim.alt });
    timer.current = window.setTimeout(() => {
      busy.current = false;
      setPlaying(null);
    }, anim.duration + 150);
  };

  return (
    <button type="button" onClick={play} disabled={!!playing} aria-label={label} title={label} className="mx-auto block w-fit cursor-pointer disabled:cursor-default">
      <img
        key={animKey}
        src={playing ? playing.url : mascotWings}
        alt={playing ? playing.alt : "Fairy mascot flapping its wings"}
        draggable={false}
        className={className}
      />
    </button>
  );
}
