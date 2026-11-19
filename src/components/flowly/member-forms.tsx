"use client";

import { useActionState, useRef, useState } from "react";
import { addPlaceholderMember, decideMember, deleteMember, mergeMember } from "@/app/actions/members";
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
      {/* Same full-width picker as the reschedule page: the card is narrow, so the label sits above. */}
      <label className="flowly-field select-field">
        <span>Üyenin uygulamadaki hesabı</span>
        <div>
          <FlowlyIcon name="user" size={21}/>
          <select name="memberId" value={chosen} onChange={(event) => { setChosen(event.target.value); setConfirming(false); }} required>
            <option value="" disabled>Hesap seç</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.phone ? ` · …${member.phone.replace(/\D/g, "").slice(-4)}` : ""}</option>)}
          </select>
          <FlowlyIcon name="chevron-down" size={18}/>
        </div>
      </label>
      {confirming && target
        ? <div className="confirm-box"><p>{placeholderName} adına girilen dersler, paketler ve sabit saatler <strong>{target.name}</strong> hesabına taşınacak ve hesapsız kayıt silinecek. Bu geri alınamaz.</p><div><SubmitButton variant="outline" icon={false} pendingLabel="Birleştiriliyor…">Evet, birleştir</SubmitButton><button type="button" className="text-button" onClick={() => setConfirming(false)}>Vazgeç</button></div></div>
        : <button type="button" className="flowly-button is-outline" disabled={!target} onClick={() => setConfirming(true)}>Birleştir</button>}
    </form>
  </details>;
}

/** On a self sign-up's card: confirm they are a studio member, or reject (the account is deleted). */
export function MemberDecisionForm({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [state, action] = useActionState(decideMember, undefined);
  const [confirming, setConfirming] = useState(false);
  return <form action={action} className="member-decision">
    <input type="hidden" name="memberId" value={memberId}/>
    {state?.error && <Notice tone="error">{state.error}</Notice>}
    {confirming
      ? <div className="confirm-box"><p><strong>{memberName}</strong> reddedilecek ve hesabı silinecek. Bu geri alınamaz.</p><div><SubmitButton name="decision" value="reject" variant="outline" icon={false} pendingLabel="Reddediliyor…">Evet, reddet</SubmitButton><button type="button" className="text-button" onClick={() => setConfirming(false)}>Vazgeç</button></div></div>
      : <div className="member-decision-actions"><SubmitButton name="decision" value="approve" icon={false} pendingLabel="Onaylanıyor…">Onayla</SubmitButton><button type="button" className="text-button" onClick={() => setConfirming(true)}>Reddet</button></div>}
  </form>;
}

const SWIPE_OPEN = 96;

/**
 * A row of the members list. On a phone, swiping it left reveals "Sil"; on a computer a "Üyeyi sil"
 * link sits under the row. Either way a confirmation step comes before the member and everything
 * stored about them is deleted.
 */
export function SwipeMemberRow({ memberId, memberName, upcoming, search, children }: { memberId: string; memberName: string; upcoming: number; search: string; children: React.ReactNode }) {
  const [state, action] = useActionState(deleteMember, undefined);
  const [confirming, setConfirming] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; base: number; horizontal: boolean | null; moved: boolean } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || confirming) return;
    drag.current = { x: event.clientX, y: event.clientY, base: offset, horizontal: null, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    // Decide once whether this is a sideways swipe or the page scrolling.
    if (d.horizontal === null && Math.hypot(dx, dy) > 8) {
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      if (d.horizontal) {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone */ }
        setDragging(true);
      }
    }
    if (!d.horizontal) return;
    d.moved = true;
    setOffset(Math.max(-SWIPE_OPEN, Math.min(0, d.base + dx)));
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.horizontal) setOffset((current) => current < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0);
  };
  // A swipe must not also open a link, and tapping an open row just closes it.
  const onClickCapture = (event: React.MouseEvent) => {
    if (dragging || offset !== 0) { event.preventDefault(); event.stopPropagation(); setOffset(0); }
  };

  return <article className="swipe-row" data-member-search={search}>
    <button type="button" className="swipe-delete" tabIndex={offset ? 0 : -1} aria-hidden={offset ? undefined : true} onClick={() => { setOffset(0); setConfirming(true); }}>Sil</button>
    <div className={`swipe-front${dragging ? " is-dragging" : ""}`} style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onClickCapture={onClickCapture}>
      {children}
    </div>
    {confirming
      ? <form action={action} className="member-decision member-delete">
        <input type="hidden" name="memberId" value={memberId}/>
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <div className="confirm-box"><p><strong>{memberName}</strong> silinecek: hesabı, geçmiş dersleri, paketleri ve sabit saatleri kalıcı olarak kaldırılır.{upcoming > 0 && ` Yaklaşan ${upcoming} dersindeki yeri de boşalır.`} Bu geri alınamaz.</p><div><SubmitButton variant="outline" icon={false} pendingLabel="Siliniyor…">Evet, sil</SubmitButton><button type="button" className="text-button" onClick={() => setConfirming(false)}>Vazgeç</button></div></div>
      </form>
      : <button type="button" className="text-button member-delete-toggle" onClick={() => setConfirming(true)}>Üyeyi sil</button>}
  </article>;
}
