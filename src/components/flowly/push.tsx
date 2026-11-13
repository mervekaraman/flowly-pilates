"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/actions/auth";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { FlowlyIcon } from "./icons";
import { PushAskSheet } from "./push-ask";

type PushState = "loading" | "insecure" | "install" | "unsupported" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/** Works out what this device can do, and keeps an existing subscription linked to the signed-in account. */
async function detect(): Promise<PushState> {
  if (!window.isSecureContext) return "insecure";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isInstalled()) return "install";
  if (!supported) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const existing = await (await registration()).pushManager.getSubscription();
  if (!existing) return "off";
  await savePushSubscription(existing.toJSON());
  return "on";
}

function usePush(publicKey: string) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    detect().then((next) => active && setState(next), () => active && setState("unsupported"));
    return () => { active = false; };
  }, []);

  async function enable() {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const { ok } = await savePushSubscription(subscription.toJSON());
      if (!ok) {
        await subscription.unsubscribe();
        setNote("Bu tarayıcı desteklenmiyor; bildirimler açılamadı.");
        return;
      }
      setState("on");
    } catch {
      setNote("Bildirimler açılamadı. Sayfayı yenileyip tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote(null);
    try {
      const subscription = await (await registration()).pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setNote(null);
    await sendTestPush();
    setNote("Deneme bildirimi gönderildi; birkaç saniye içinde gelmeli.");
  }

  return { state, busy, note, enable, disable, test };
}

const explanations: Record<Exclude<PushState, "loading" | "on" | "off">, string> = {
  insecure: "Telefon bildirimleri yalnızca güvenli (https) bağlantıda açılabilir. Site yayına alındığında burada açabileceksin.",
  install: "iPhone'da bildirim alabilmek için önce siteyi ana ekrana ekle: Safari'de Paylaş simgesine, ardından \"Ana Ekrana Ekle\"ye dokun. Uygulamayı ana ekrandan açınca bildirimleri buradan açabilirsin.",
  unsupported: "Bu tarayıcı bildirimleri desteklemiyor. Telefonunda Chrome ya da Safari ile dene.",
  denied: "Bu sitenin bildirimleri tarayıcı ayarlarında engellenmiş. İzin verdiğinde buradan açabilirsin.",
};

/** Settings row: switch notifications on/off for this device. */
export function PushSettings({ publicKey }: { publicKey: string }) {
  const { state, busy, note, enable, disable, test } = usePush(publicKey);
  const switchable = state === "on" || state === "off";
  return <div className="push-settings">
    <label className={`preference-row${switchable ? "" : " is-disabled"}`}>
      <FlowlyIcon name="phone"/>
      <p><strong>Telefon bildirimleri</strong><span>Onay, ret ve iptal haberleri bu cihaza anında gelsin. Ücretsizdir.</span></p>
      <input className="toggle" type="checkbox" checked={state === "on"} disabled={!switchable || busy} aria-busy={busy} onChange={(event) => (event.target.checked ? enable() : disable())}/>
    </label>
    {state !== "loading" && state !== "on" && state !== "off" && <p className="push-note">{explanations[state]}</p>}
    {state === "on" && <button type="button" className="text-button" onClick={test}>Deneme bildirimi gönder</button>}
    {note && <p className="push-note" role="status">{note}</p>}
  </div>;
}

/** Right after a booking request: a sheet explaining what notifications are for; gone once the device is subscribed. */
export function PushPrompt({ publicKey }: { publicKey: string }) {
  const { state, busy, note, enable } = usePush(publicKey);
  if (state === "on") return <p className="push-prompt is-done" role="status"><FlowlyIcon name="check" size={18}/>Telefon bildirimleri açık; onay gelince haber vereceğiz.</p>;
  // iPhone Safari can only notify once the site is on the home screen, so there we explain that instead.
  if (state === "install") return <div className="push-prompt"><p><strong>Onay telefonuna da gelsin mi?</strong>{explanations.install}</p></div>;
  if (state !== "off") return null;
  return <PushAskSheet onEnable={enable} busy={busy} note={note}/>;
}

/** Sign-out that also stops this device's notifications, so a shared phone stays private. */
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : undefined;
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } catch {
      // The server drops the subscription with the session anyway.
    }
    await logout();
  }
  return <button type="button" className="logout-link" onClick={signOut} disabled={busy}>{busy ? "Çıkış yapılıyor…" : "Çıkış yap"}</button>;
}
