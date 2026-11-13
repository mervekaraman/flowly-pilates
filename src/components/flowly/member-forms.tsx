"use client";

import { useActionState, useState } from "react";
import { addPlaceholderMember, mergeMember } from "@/app/actions/members";
import { Field, SubmitButton } from "./forms";
import { FlowlyIcon } from "./icons";
import { Notice } from "./ui";

/** Trainer adds a studio member who is not in the app yet: name only, no e-mail or phone. */
export function AddPlaceholderForm() {
  const [state, action] = useActionState(addPlaceholderMember, undefined);
  return <details className="package-editor placeholder-add" open={Boolean(state?.fieldErrors)}>
    <summary>Hesapsız üye ekle</summary>
    <form action={action} className="package-form" noValidate key={state?.ok ? state.message : "form"}>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <Field label="Ad soyad" name="name" defaultValue={state?.values?.name} placeholder="Ayşe Yılmaz" error={state?.fieldErrors?.name}/>
      <small className="form-hint">Uygulamayı henüz kullanmayan üyeler için. E-posta ya da telefon gerekmez; derslere ekleyebilir, paket ve sabit saat tanımlayabilirsin. Üye sonra kendisi kaydolunca iki hesabı birleştirirsin.</small>
      <SubmitButton variant="outline" icon={false} pendingLabel="Ekleniyor…">Üyeyi Ekle</SubmitButton>
    </form>
  </details>;
}

/** On a placeholder's card: move everything to the member's own account once they have joined. */
export function MergeMemberForm({ placeholderId, placeholderName, members }: { placeholderId: string; placeholderName: string; members: { id: string; name: string; phone: string | null }[] }) {
  const [state, action] = useActionState(mergeMember, undefined);
  const [chosen, setChosen] = useState("");
  const [confirming, setConfirming] = useState(false);
  const target = members.find((member) => member.id === chosen);
  return <details className="package-editor">
    <summary>Gerçek hesabıyla birleştir</summary>
    <form action={action} className="package-form">
      <input type="hidden" name="placeholderId" value={placeholderId}/>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <label className="form-row">
        <FlowlyIcon name="user"/><strong>Üyenin hesabı</strong>
        <span className="select-control">
          <select name="memberId" value={chosen} onChange={(event) => { setChosen(event.target.value); setConfirming(false); }} required>
            <option value="" disabled>Seç</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.phone ? ` · …${member.phone.replace(/\D/g, "").slice(-4)}` : ""}</option>)}
          </select>
          <FlowlyIcon name="chevron-down" size={18}/>
        </span>
      </label>
      {confirming && target
        ? <div className="confirm-box"><p>{placeholderName} adına girilen dersler, paketler ve sabit saatler <strong>{target.name}</strong> hesabına taşınacak ve hesapsız kayıt silinecek. Bu geri alınamaz.</p><div><SubmitButton variant="outline" icon={false} pendingLabel="Birleştiriliyor…">Evet, birleştir</SubmitButton><button type="button" className="text-button" onClick={() => setConfirming(false)}>Vazgeç</button></div></div>
        : <button type="button" className="flowly-button is-outline" disabled={!target} onClick={() => setConfirming(true)}>Birleştir</button>}
    </form>
  </details>;
}
