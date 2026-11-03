"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { useEffect, useState } from "react";
import { Notice } from "./ui";

/**
 * The iOS app keeps its launch screen (logo on cream) up until the first page is on screen, instead
 * of showing an empty web view while it connects (see SplashScreen in capacitor.config.ts).
 */
export function NativeReady() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
  }, []);
  return null;
}

/** A short "success" tap from the iPhone's haptic engine; nothing happens in a browser. */
export function SuccessHaptic() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  }, []);
  return null;
}

/**
 * "Verilerimi indir" inside the iOS app. Its web view cannot download files, so the export is
 * fetched with the member's session and handed to the iPhone share sheet (Save to Files, Mail…).
 */
export function ShareDataButton() {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function share() {
    setState("busy");
    try {
      const response = await fetch("/profil/verilerim", { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      const name = `flowly-pilates-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([await response.blob()], name, { type: "application/json" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("share unavailable");
      await navigator.share({ files: [file], title: "Flowly Pilates verilerim" });
      setState("idle");
    } catch (error) {
      // Closing the share sheet without choosing is not an error.
      setState(error instanceof DOMException && error.name === "AbortError" ? "idle" : "error");
    }
  }
  return <>
    {state === "error" && <Notice tone="error">Dosya hazırlanamadı. Biraz sonra tekrar dene ya da web sitesinden indir.</Notice>}
    <button type="button" className="flowly-button is-outline" onClick={share} disabled={state === "busy"} aria-busy={state === "busy"}>
      {state === "busy" ? "Hazırlanıyor…" : "Verilerimi Paylaş veya Kaydet"}
    </button>
  </>;
}
