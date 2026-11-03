"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect, useState } from "react";
import { saveNativePushToken } from "@/app/actions/push";
import { FlowlyIcon } from "./icons";
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

/** On full-screen dark photos the iPhone's clock and battery turn white; they go back to dark on leaving. */
export function LightStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    return () => { StatusBar.setStyle({ style: Style.Light }).catch(() => {}); };
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

/* ——— Notifications in the iOS app (Apple Push Notification service) ——— */

type Permission = "prompt" | "prompt-with-rationale" | "granted" | "denied";

// One set of listeners per app run; the token is reported once per sign-in.
let listening = false;
let reportedToken: string | null = null;

function listen() {
  if (listening) return;
  listening = true;
  PushNotifications.addListener("registration", ({ value }) => {
    if (value === reportedToken) return;
    saveNativePushToken(value).then((result) => { if (result.ok) reportedToken = value; }).catch(() => {});
  }).catch(() => {});
  // Tapping a notification opens the page it is about (the server puts a path in `url`).
  PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = (notification.data as { url?: unknown } | undefined)?.url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) window.location.assign(url);
  }).catch(() => {});
}

/** Rendered on every page: keeps this iPhone's push token linked to whoever is signed in. */
export function NativePushSync({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    listen();
    if (!signedIn) {
      // Signing out deletes the token on the server (it belongs to the session); the next sign-in reports it again.
      reportedToken = null;
      return;
    }
    PushNotifications.checkPermissions().then(({ receive }) => { if (receive === "granted") return PushNotifications.register(); }).catch(() => {});
  }, [signedIn]);
  return null;
}

function useNativePermission() {
  const [permission, setPermission] = useState<Permission | null>(null);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) PushNotifications.checkPermissions().then(({ receive }) => setPermission(receive)).catch(() => {});
  }, []);
  async function enable() {
    listen();
    const { receive } = await PushNotifications.requestPermissions();
    setPermission(receive);
    if (receive === "granted") await PushNotifications.register();
  }
  return { permission, enable };
}

/** Profile › Settings inside the app: the iPhone's own permission, asked only when the member taps. */
export function NativePushSettings() {
  const { permission, enable } = useNativePermission();
  if (!permission) return null;
  if (permission === "granted") return <p className="muted-note">Bildirimler açık. Onay, iptal ve ders hatırlatmaları bu telefona gelir.</p>;
  if (permission === "denied") return <p className="muted-note">Bildirimler kapalı. Açmak için iPhone&apos;da Ayarlar › Flowly › Bildirimler yolunu izle.</p>;
  return <>
    <p className="muted-note">Talebin onaylandığında, bir ders iptal olduğunda ve dersten bir gün önce haber verelim.</p>
    <button type="button" className="flowly-button is-outline" onClick={() => { enable().catch(() => {}); }}>Bildirimleri Aç</button>
  </>;
}

/** After a booking request: the natural moment to ask, with the reason in plain words. */
export function NativePushPrompt() {
  const { permission, enable } = useNativePermission();
  if (permission !== "prompt" && permission !== "prompt-with-rationale") return null;
  return <div className="whatsapp-card">
    <span className="whatsapp-card-icon"><FlowlyIcon name="bell" size={22}/></span>
    <div><strong>Onaylanınca haber verelim mi?</strong><p>Eğitmenin talebini onayladığında ve dersten bir gün önce telefonuna bildirim gönderelim.</p></div>
    <button type="button" className="flowly-button whatsapp-button" onClick={() => { enable().catch(() => {}); }}>Bildirimleri Aç</button>
  </div>;
}
