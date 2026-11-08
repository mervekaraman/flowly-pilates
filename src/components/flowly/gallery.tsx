"use client";
/* eslint-disable @next/next/no-img-element -- Local, already-resized studio photos shown at their own aspect ratio. */

import { useEffect, useRef, useState } from "react";
import { FlowlyIcon } from "./icons";
import { LightStatusBar } from "./native";

export type GalleryPhoto = { src: string; alt: string };

/**
 * Studio photos: a row of thumbnails that opens a full-screen viewer. Swipe or use the arrows to
 * move between photos; tap ×, press Esc or swipe down to close.
 */
export function StudioGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const go = (step: number) => setOpen((value) => value === null ? value : (value + step + photos.length) % photos.length);
  // The viewer fades out before it is removed (motion.css › .is-closing); instantly when motion is reduced.
  const close = () => {
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 230;
    setClosing(true);
    setTimeout(() => { setOpen(null); setClosing(false); }, delay);
  };

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    // The page behind stays put while the viewer is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  });

  return <>
    <div className="gallery-strip">{photos.map((photo, index) => <button key={photo.src} type="button" onClick={() => setOpen(index)} aria-label={`${photo.alt} — büyüt`}>
      <img src={photo.src} alt="" loading="lazy"/>
    </button>)}</div>
    {open !== null && <div className={`gallery-viewer${closing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Stüdyo fotoğrafları"
      onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90) close();
      }}>
      <LightStatusBar/>
      <img key={open} src={photos[open].src} alt={photos[open].alt}/>
      <button type="button" className="gallery-close" onClick={close} aria-label="Kapat"><FlowlyIcon name="x" size={24}/></button>
      {photos.length > 1 && <>
        <button type="button" className="gallery-prev" onClick={() => go(-1)} aria-label="Önceki fotoğraf"><FlowlyIcon name="chevron-left" size={26}/></button>
        <button type="button" className="gallery-next" onClick={() => go(1)} aria-label="Sonraki fotoğraf"><FlowlyIcon name="chevron-right" size={26}/></button>
        <p className="gallery-count">{open + 1} / {photos.length}</p>
      </>}
    </div>}
  </>;
}
