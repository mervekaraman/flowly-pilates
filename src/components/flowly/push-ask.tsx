"use client";

import { useEffect, useRef } from "react";
import { FlowlyIcon } from "./icons";

// "Şimdi değil" is remembered on this device; after the third one we stop asking (Settings › Bildirimler still works).
const DECLINED_KEY = "flowly-push-ask-declined";
const MAX_ASKS = 3;

function timesDeclined() {
  try { return Number(localStorage.getItem(DECLINED_KEY)) || 0; } catch { return 0; }
}
function rememberDecline() {
  try { localStorage.setItem(DECLINED_KEY, String(timesDeclined() + 1)); } catch { /* private mode: we just ask again next time */ }
}

/**
 * Bottom sheet shown a moment after a booking request, explaining what notifications are for.
 * The iPhone/browser permission question only appears after "Bildirimleri Aç": the system asks
 * once, and a "Don't Allow" there can only be undone in the phone's settings.
 */
export function PushAskSheet({ onEnable, busy = false, note }: { onEnable: () => Promise<void>; busy?: boolean; note?: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (timesDeclined() >= MAX_ASKS) return;
    const timer = setTimeout(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  function later() {
    rememberDecline();
    dialog.current?.close();
  }

  async function enable() {
    try {
      await onEnable();
    } catch {
      // The parent shows its own message; the sheet just stays open so the member can try again or close it.
    }
  }

  return <dialog
    ref={dialog}
    className="push-sheet"
    aria-labelledby="push-sheet-title"
    onCancel={(event) => { event.preventDefault(); later(); }}
    onClick={(event) => { if (event.target === event.currentTarget) later(); }}
  >
    <span className="push-sheet-icon"><FlowlyIcon name="bell" size={24}/></span>
    <h2 id="push-sheet-title">Onaylanınca haber verelim mi?</h2>
    <p>Bildirimlere izin verirsen telefonuna şu durumlarda haber veririz:</p>
    <ul>
      <li><FlowlyIcon name="check" size={18}/>Eğitmen talebini onayladığında</li>
      <li><FlowlyIcon name="check" size={18}/>Dersin iptal olduğunda ya da değiştiğinde</li>
      <li><FlowlyIcon name="check" size={18}/>Dersinden bir gün önce, hatırlatma olarak</li>
      <li><FlowlyIcon name="check" size={18}/>Beklediğin derste yer açıldığında</li>
    </ul>
    <p className="push-sheet-small">Reklam ya da kampanya göndermeyiz. İstediğin zaman Profil › Ayarlar › Bildirimler&apos;den kapatabilirsin.</p>
    {note && <p className="push-sheet-small" role="status">{note}</p>}
    <button type="button" className="flowly-button" onClick={enable} disabled={busy} aria-busy={busy}>{busy ? "Açılıyor…" : "Bildirimleri Aç"}</button>
    <button type="button" className="push-sheet-later" onClick={later}>Şimdi değil</button>
  </dialog>;
}
