"use client";

import { useState } from "react";
import { FlowlyIcon } from "./icons";

const fold = (value: string) => value.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Filters the member list in the browser. The search text never leaves the page, so phone numbers
 * and e-mail addresses typed here do not end up in URLs, browser history or server logs.
 */
export function MemberFilter({ total }: { total: number }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(total);

  // Runs in the input's event handler (not an effect), so each keystroke filters once.
  const search = (value: string) => {
    setQuery(value);
    const term = fold(value.trim());
    const digits = term.replace(/\D/g, "");
    let count = 0;
    for (const row of document.querySelectorAll<HTMLElement>("[data-member-search]")) {
      const haystack = row.dataset.memberSearch ?? "";
      const match = !term || haystack.includes(term) || (digits.length >= 3 && haystack.replace(/\D/g, "").includes(digits));
      row.hidden = !match;
      if (match) count += 1;
    }
    setShown(count);
  };

  return <>
    <div className="member-search" role="search">
      <label><FlowlyIcon name="search" size={20}/><input type="search" value={query} onChange={(event) => search(event.target.value)} placeholder="Ad, telefon ya da e-posta" aria-label="Üye ara" autoComplete="off"/></label>
      {query && <button type="button" className="text-link" onClick={() => search("")}>Temizle</button>}
    </div>
    <p className="muted-note" aria-live="polite">{query ? `${shown} / ${total} üye` : `${total} üye`}</p>
    {query && shown === 0 && <p className="muted-note">Bu aramayla eşleşen üye yok.</p>}
  </>;
}
