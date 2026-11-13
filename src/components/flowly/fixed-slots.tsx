"use client";

import { useActionState, useState } from "react";
import { assignFixedSlots, decideFixedSlot, requestFixedSlot, requestFixedSlotChange, stopFixedSlot } from "@/app/actions/fixed-slots";
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
function PickerRow({ icon, label, name, options, placeholder, error, onChange }: { icon: FlowlyIconName; label: string; name: string; options: [string, string][]; placeholder: string; error?: string; onChange?: (value: string) => void }) {
  return <label className={`form-row${error ? " has-error" : ""}`}>
    <FlowlyIcon name={icon}/><strong>{label}</strong>
    <span className="select-control">
      <select name={name} defaultValue="" required onChange={(event) => onChange?.(event.target.value)}>
        <option value="" disabled hidden>{placeholder}</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      <FlowlyIcon name="chevron-down" size={18}/>
    </span>
  </label>;
}

export type SlotAvailability = Record<string, { lessons: number; open: number }>;

/** Under the pickers: how many classes at the chosen time still have room in the coming weeks. */
function AvailabilityHint({ weekday, time, availability, weeks }: { weekday: string; time: string; availability: SlotAvailability; weeks: number }) {
  if (!weekday || !time) return null;
  const entry = availability[`${weekday}-${time}`];
  if (!entry) return <p className="slot-availability">Önümüzdeki {weeks} haftada bu saatte henüz ders açılmamış. Ders açıldıkça otomatik eklenirsin.</p>;
  const tone = entry.open === entry.lessons ? "is-open" : entry.open === 0 ? "is-full" : "is-partial";
  return <p className={`slot-availability ${tone}`}>Önümüzdeki {weeks} haftada bu saatte {entry.lessons} ders var; {entry.open === entry.lessons ? "hepsinde yer var." : entry.open === 0 ? "hepsi dolu. Dolu haftalarda bekleme listesine alınırsın." : `${entry.open} tanesinde yer var. Dolu haftalarda bekleme listesine alınırsın.`}</p>;
}

/** Day and hour pickers with the free-seat hint, shared by the request and change forms. */
function SlotPickers({ weekdays, times, availability, weeks, errors }: { weekdays: [string, string][]; times: string[]; availability: SlotAvailability; weeks: number; errors?: Record<string, string> }) {
  const [weekday, setWeekday] = useState("");
  const [time, setTime] = useState("");
  return <>
    <div className="new-class-list">
      <PickerRow icon="calendar" label="Gün" name="weekday" options={weekdays} placeholder="Gün seç" error={errors?.weekday} onChange={setWeekday}/>
      <PickerRow icon="clock" label="Saat" name="startTime" options={times.map((value) => [value, value])} placeholder="Saat seç" error={errors?.startTime} onChange={setTime}/>
    </div>
    <AvailabilityHint weekday={weekday} time={time} availability={availability} weeks={weeks}/>
  </>;
}

/** Member picks a weekday and hour they come to every week. */
export function FixedSlotRequestForm({ weekdays, times, availability, weeks }: { weekdays: [string, string][]; times: string[]; availability: SlotAvailability; weeks: number }) {
  const [state, action] = useActionState(requestFixedSlot, undefined);
  return <form action={action} noValidate>
    <FormMessage state={state}/>
    <SlotPickers weekdays={weekdays} times={times} availability={availability} weeks={weeks} errors={state?.fieldErrors}/>
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

/** Member asks to move one of their active times for good; the current time keeps going until a trainer approves. */
export function FixedSlotChangeForm({ slotId, label, weekdays, times, availability, weeks }: { slotId: string; label: string; weekdays: [string, string][]; times: string[]; availability: SlotAvailability; weeks: number }) {
  const [state, action] = useActionState(requestFixedSlotChange, undefined);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return <details className="package-editor slot-change">
    <summary>Sabit saatimi değiştir</summary>
    <form action={action} noValidate>
      <input type="hidden" name="slotId" value={slotId}/>
      <FormMessage state={state}/>
      <SlotPickers weekdays={weekdays} times={times} availability={availability} weeks={weeks} errors={state?.fieldErrors}/>
      <small className="form-hint">Her hafta {label} yerine geçecek yeni gün ve saati seç. Eğitmenin onaylayınca eski saatteki ileri tarihli yerlerin boşalır, yeni saate her hafta eklenirsin; o zamana kadar şimdiki saatin devam eder.</small>
      <SubmitButton variant="outline" icon={false} pendingLabel="Gönderiliyor…">Değişiklik İste</SubmitButton>
    </form>
  </details>;
}

/** Trainer fixes a member (with or without an app account) to one hour on one or more weekdays. */
export function AssignFixedSlotForm({ members, weekdays, times }: { members: { id: string; name: string; placeholder: boolean }[]; weekdays: [string, string][]; times: string[] }) {
  const [state, action] = useActionState(assignFixedSlots, undefined);
  return <form action={action} noValidate className="assign-slot-form" key={state?.ok ? state.message : "form"}>
    <FormMessage state={state}/>
    <div className="new-class-list">
      <PickerRow icon="user" label="Üye" name="memberId" options={members.map((member) => [member.id, member.placeholder ? `${member.name} (hesapsız)` : member.name])} placeholder="Üye seç" error={state?.fieldErrors?.memberId}/>
      <PickerRow icon="clock" label="Saat" name="startTime" options={times.map((value) => [value, value])} placeholder="Saat seç" error={state?.fieldErrors?.startTime}/>
    </div>
    <fieldset className={`weekday-picks${state?.fieldErrors?.weekdays ? " has-error" : ""}`}>
      <legend>Günler</legend>
      {weekdays.map(([value, text]) => <label key={value}><input type="checkbox" name="weekdays" value={value}/><span>{text}</span></label>)}
    </fieldset>
    {Object.values(state?.fieldErrors ?? {}).map((message) => <small key={message} className="check-error">{message}</small>)}
    <small className="form-hint">Üye seçtiğin günlerde bu saatteki derslere her hafta otomatik ve onaylı eklenir; bitiş tarihi yoktur.</small>
    <SubmitButton pendingLabel="Sabitleniyor…">Sabitle</SubmitButton>
  </form>;
}
