"use client";

import { useActionState, useState } from "react";
import { decideFixedSlot, requestFixedSlot, stopFixedSlot } from "@/app/actions/fixed-slots";
import type { FormState } from "@/lib/forms";
import { SubmitButton } from "./forms";
import { FlowlyIcon, type FlowlyIconName } from "./icons";
import { Notice } from "./ui";

function FormMessage({ state }: { state: FormState }) {
  if (state?.error) return <Notice tone="error">{state.error}</Notice>;
  if (state?.ok && state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

/** Same look as the new-class form rows: icon, label, native select on the right. */
function PickerRow({ icon, label, name, options, placeholder, error }: { icon: FlowlyIconName; label: string; name: string; options: [string, string][]; placeholder: string; error?: string }) {
  return <label className={`form-row${error ? " has-error" : ""}`}>
    <FlowlyIcon name={icon}/><strong>{label}</strong>
    <span className="select-control">
      <select name={name} defaultValue="" required>
        <option value="" disabled hidden>{placeholder}</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      <FlowlyIcon name="chevron-down" size={18}/>
    </span>
  </label>;
}

/** Member picks a weekday and hour they come to every week. */
export function FixedSlotRequestForm({ weekdays, times }: { weekdays: [string, string][]; times: string[] }) {
  const [state, action] = useActionState(requestFixedSlot, undefined);
  return <form action={action} noValidate>
    <FormMessage state={state}/>
    <div className="new-class-list">
      <PickerRow icon="calendar" label="Gün" name="weekday" options={weekdays} placeholder="Gün seç" error={state?.fieldErrors?.weekday}/>
      <PickerRow icon="clock" label="Saat" name="startTime" options={times.map((time) => [time, time])} placeholder="Saat seç" error={state?.fieldErrors?.startTime}/>
    </div>
    {Object.values(state?.fieldErrors ?? {}).map((message) => <small key={message} className="check-error">{message}</small>)}
    <small className="form-hint">Eğitmenin bir kez onaylar. Sonra bu saatteki derslere her hafta otomatik eklenirsin.</small>
    <SubmitButton pendingLabel="Gönderiliyor…">Sabit Saat İste</SubmitButton>
  </form>;
}

/** Member withdraws their own time, or a trainer ends one; asks once before doing it. */
export function StopFixedSlotForm({ slotId, label, asTrainer = false }: { slotId: string; label: string; asTrainer?: boolean }) {
  const [state, action] = useActionState(stopFixedSlot, undefined);
  const [confirming, setConfirming] = useState(false);
  return <form action={action} className="confirm-form">
    <input type="hidden" name="slotId" value={slotId}/>
    <FormMessage state={state}/>
    {confirming
      ? <div className="confirm-box"><p>{asTrainer ? `${label} sabit saati sonlandırılsın mı? Üye bu saate artık otomatik eklenmez.` : `${label} sabit saatini kaldırmak istediğine emin misin?`} İleri tarihli otomatik rezervasyonlar da iptal edilir.</p><div><SubmitButton variant="outline" icon={false} pendingLabel="Kaldırılıyor…">{asTrainer ? "Evet, sonlandır" : "Evet, kaldır"}</SubmitButton><button type="button" className="text-button" onClick={() => setConfirming(false)}>Vazgeç</button></div></div>
      : <button type="button" className="danger-link" onClick={() => setConfirming(true)}>{asTrainer ? "Sonlandır" : "Sabit saati kaldır"}</button>}
  </form>;
}

/** Trainer approves or rejects a fixed-time request. */
export function FixedSlotDecisionForm({ slotId }: { slotId: string }) {
  const [state, action] = useActionState(decideFixedSlot, undefined);
  return <form action={action} className="quick-approve">
    <input type="hidden" name="slotId" value={slotId}/>
    <SubmitButton name="decision" value="reject" variant="outline" icon={false} pendingLabel="…">Reddet</SubmitButton>
    <SubmitButton name="decision" value="approve" icon={false} pendingLabel="…">Onayla</SubmitButton>
    {state?.error && <small className="check-error">{state.error}</small>}
  </form>;
}
