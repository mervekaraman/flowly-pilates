"use client";

import { useRef, useState } from "react";
import { deleteNotification } from "@/app/actions/account";

const OPEN = -88;

/**
 * Notification row that slides left to reveal "Sil", like iOS Mail. A long swipe deletes straight
 * away; a short one leaves the button showing. Mouse and keyboard users reach the same button
 * by hovering or tabbing to it.
 */
export function SwipeToDelete({ id, children }: { id: string; children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null);
  const moved = useRef(false);

  async function remove() {
    setGone(true);
    try { await deleteNotification(id); } catch { setGone(false); setOffset(0); }
  }

  if (gone) return null;
  return <div className={`swipe-item${offset ? " is-open" : ""}`}>
    <button type="button" className="swipe-delete" onClick={() => { remove().catch(() => {}); }}>Sil</button>
    <div className="swipe-content" style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: dragging ? "none" : undefined }}
      onTouchStart={(event) => { const t = event.touches[0]; start.current = { x: t.clientX, y: t.clientY, base: offset, horizontal: null }; moved.current = false; }}
      onTouchMove={(event) => {
        const s = start.current;
        if (!s) return;
        const t = event.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
        if (s.horizontal === null && Math.hypot(dx, dy) > 8) s.horizontal = Math.abs(dx) > Math.abs(dy);
        if (!s.horizontal) return;
        moved.current = true;
        setDragging(true);
        setOffset(Math.min(0, Math.max(-160, s.base + dx)));
      }}
      onTouchEnd={() => {
        start.current = null;
        setDragging(false);
        if (offset <= -130) { remove().catch(() => {}); return; }
        setOffset(offset < OPEN / 2 ? OPEN : 0);
      }}
      // A swipe must not also open the notification it started on.
      onClickCapture={(event) => { if (moved.current || offset) { event.preventDefault(); event.stopPropagation(); moved.current = false; setOffset(0); } }}>
      {children}
    </div>
  </div>;
}
