"use client";

import { useActionState, useState } from "react";
import { addPackage, deletePackage } from "@/app/actions/packages";
import { addDays, atStudioTime, formatDayMonth } from "@/lib/format";
import { remainingOf, type PackageUsage } from "@/lib/package-rules";
import { Field, SubmitButton } from "./forms";
import { Notice } from "./ui";

const day = (key: string) => formatDayMonth(atStudioTime(key, "12:00"));

/**
 * Trainer's package panel on a member card: the member's packages so far and a form to enter a new
 * one (lessons, first day, last day). `today` comes from the server so the defaults match the studio day.
 */
export function PackageEditor({ memberId, memberName, packages, today }: { memberId: string; memberName: string; packages: PackageUsage[]; today: string }) {
  const [state, action] = useActionState(addPackage, undefined);
  return <details className="package-editor">
    <summary>Paket{packages.length ? `ler (${packages.length})` : " tanımla"}</summary>
    {packages.length > 0 && <ul className="package-history">{[...packages].reverse().map((pkg) => <li key={pkg.id}>
      <span><strong>{pkg.lessonCount} ders</strong> · {day(pkg.startsOn)} – {day(pkg.endsOn)}<small>{pkg.used} kullanıldı · {remainingOf(pkg)} kaldı</small></span>
      <DeletePackageForm packageId={pkg.id}/>
    </li>)}</ul>}
    <form action={action} className="package-form" noValidate>
      <input type="hidden" name="memberId" value={memberId}/>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message} {memberName.split(" ")[0]} uygulamada görecek.</Notice>}
      <div className="package-fields">
        <Field label="Ders sayısı" name="lessonCount" type="number" inputMode="numeric" defaultValue={state?.values?.lessonCount ?? "8"} error={state?.fieldErrors?.lessonCount}/>
        <Field label="Başlangıç" name="startsOn" type="date" defaultValue={state?.values?.startsOn ?? today} error={state?.fieldErrors?.startsOn}/>
        <Field label="Son gün" name="endsOn" type="date" defaultValue={state?.values?.endsOn ?? addDays(today, 30)} error={state?.fieldErrors?.endsOn}/>
      </div>
      <SubmitButton variant="outline" icon={false} pendingLabel="Kaydediliyor…">Paketi Kaydet</SubmitButton>
    </form>
  </details>;
}

function DeletePackageForm({ packageId }: { packageId: string }) {
  const [state, action] = useActionState(deletePackage, undefined);
  const [confirming, setConfirming] = useState(false);
  if (state?.error) return <small className="check-error">{state.error}</small>;
  return <form action={action}>
    <input type="hidden" name="packageId" value={packageId}/>
    {confirming
      ? <span className="package-confirm"><button type="submit" className="danger-link">Evet, sil</button><button type="button" className="text-button" onClick={() => setConfirming(false)}>Vazgeç</button></span>
      : <button type="button" className="text-button" onClick={() => setConfirming(true)}>Sil</button>}
  </form>;
}
