"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TutorialStep } from "@/lib/tutorial";
import { FlowlyIcon } from "./icons";

/** One step at a time: progress bar, swipe or arrow keys to move, skip any time. */
export function Tutorial({ steps, finishHref, finishLabel, skipLabel }: { steps: TutorialStep[]; finishHref: string; finishLabel: string; skipLabel: string }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), steps.length - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setIndex((value) => Math.min(value + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  return <div className="tutorial"
    onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
    onTouchEnd={(event) => {
      if (touchStart.current === null) return;
      const distance = event.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(distance) > 50) go(index + (distance < 0 ? 1 : -1));
    }}>
    <div className="tutorial-progress">{steps.map((item, position) => <button key={item.title} type="button" className={position <= index ? "is-done" : ""} onClick={() => go(position)} aria-label={`${position + 1}. adım: ${item.title}`} aria-current={position === index ? "step" : undefined}/>)}</div>

    <article key={index} className="tutorial-card" aria-live="polite">
      <span className="tutorial-icon"><FlowlyIcon name={step.icon} size={30}/></span>
      <p className="eyebrow">{index + 1} / {steps.length}{step.where && <> · {step.where}</>}</p>
      <h2>{step.title}</h2>
      <p>{step.text}</p>
      {step.tips && <ul>{step.tips.map((tip) => <li key={tip}><FlowlyIcon name="check" size={16}/><span>{tip}</span></li>)}</ul>}
    </article>

    <div className="tutorial-actions">
      {index > 0
        ? <button type="button" className="flowly-button is-outline" onClick={() => go(index - 1)}>Geri</button>
        : <Link href={finishHref} className="flowly-button is-outline">{skipLabel}</Link>}
      {last
        ? <Link href={finishHref} className="flowly-button">{finishLabel}<FlowlyIcon name="arrow-right" size={20}/></Link>
        : <button type="button" className="flowly-button" onClick={() => go(index + 1)}>İleri<FlowlyIcon name="arrow-right" size={20}/></button>}
    </div>
  </div>;
}
