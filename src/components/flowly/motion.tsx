"use client";

import { usePathname } from "next/navigation";
import { useEffect, ViewTransition } from "react";

/*
 * Page motion. Every screen sits in one <PageMotion>; when a navigation swaps screens the browser
 * animates the old one out and the new one in (View Transitions API, see src/app/motion.css).
 * Links say which way the user is going:
 *   transitionTypes={["nav-back"]}  the top bar's back arrow: the new screen comes in from the left
 *   transitionTypes={["nav-tab"]}   bottom bar / header tabs: a soft crossfade, no sideways move
 *   (nothing)                       going deeper (a lesson, a booking) or a form's redirect: in from the right
 * Browsers without View Transitions simply swap the screen, as before.
 */
const page = { "nav-back": "page-back", "nav-tab": "page-tab", default: "page-forward" };

export function PageMotion({ children }: { children: React.ReactNode }) {
  // Screens share the same frame, so React would update the old screen in place; keying by the path
  // makes a new screen a new element, which is what lets the exit and enter animations run.
  // (Query changes such as another day in the schedule keep the key and animate with DayMotion.)
  const pathname = usePathname();
  return <ViewTransition key={pathname} enter={page} exit={page} default="none">{children}</ViewTransition>;
}

/** The lessons of one day in the schedule; changing the day slides them in the direction of the new day. */
const day = { "day-next": "day-next", "day-prev": "day-prev", default: "day-fade" };

export function DayMotion({ day: key, children }: { day: string; children: React.ReactNode }) {
  return <ViewTransition key={key} name="day-lessons" share={day} enter={day} exit={day} default="none">{children}</ViewTransition>;
}

/**
 * The phone's back button and the iOS swipe-back gesture carry no transition type, and the gesture
 * already slides the page itself. Marking those navigations lets motion.css answer with a plain fade
 * instead of a second, forward-looking slide.
 */
export function NavDirection() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPop = () => {
      document.documentElement.dataset.nav = "pop";
      clearTimeout(timer);
      timer = setTimeout(() => { delete document.documentElement.dataset.nav; }, 900);
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); clearTimeout(timer); };
  }, []);
  return null;
}
