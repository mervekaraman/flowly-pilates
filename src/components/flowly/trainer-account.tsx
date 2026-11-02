"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions/account";
import { Field, SubmitButton } from "./forms";
import { Notice } from "./ui";

/** A trainer deletes their own account; spells out what happens to their classes first. */
export function TrainerDeleteAccountForm({ upcomingLessons, bookedSeats }: { upcomingLessons: number; bookedSeats: number }) {
  const [state, action] = useActionState(deleteAccount, undefined);
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="danger-link" onClick={() => setOpen(true)}>Hesabımı sil</button>;
  return <form action={action} className="settings-form delete-account" noValidate>
    {state?.error && <Notice tone="error">{state.error}</Notice>}
    <p>Adın, e-postan, telefonun, fotoğrafın ve bildirimlerin kalıcı olarak silinir; bu işlem geri alınamaz.</p>
    {upcomingLessons > 0
      ? <p><strong>{upcomingLessons} yaklaşan dersin iptal edilecek.</strong>{bookedSeats > 0 ? ` Bu derslerdeki ${bookedSeats} rezervasyonun sahiplerine iptal bildirimi gidecek.` : ""}</p>
      : <p>Yaklaşan bir dersin yok.</p>}
    <p>Geçmiş derslerin üyelerin ders geçmişinde kalır; orada adın yerine &quot;Eski eğitmen&quot; görünür.</p>
    <Field label="Şifren" name="deletePassword" type="password" autoComplete="current-password" placeholder="Onay için şifreni gir" error={state?.fieldErrors?.deletePassword}/>
    <label className="check-row"><input type="checkbox" name="confirm"/>Hesabımın silineceğini ve yaklaşan derslerimin iptal edileceğini anladım.</label>
    {state?.fieldErrors?.confirm && <small className="check-error">{state.fieldErrors.confirm}</small>}
    <div className="delete-actions"><SubmitButton variant="outline" icon={false} pendingLabel="Siliniyor…">Hesabımı Kalıcı Olarak Sil</SubmitButton><button type="button" className="text-button" onClick={() => setOpen(false)}>Vazgeç</button></div>
  </form>;
}
