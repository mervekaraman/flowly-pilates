"use client";

import Link from "next/link";

// `retry` fetches the page from the server again, which is what clears a temporary server error.
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return <main className="flowly-app status-screen"><div className="flowly-phone">
    <section>
      <p className="eyebrow">Bir sorun oluştu</p>
      <h1>Şu an bunu<br/>yükleyemedik.</h1>
      <p>Geçici bir sorun olabilir. Birkaç saniye sonra tekrar dene; devam ederse stüdyoya haber ver.</p>
      <button type="button" className="flowly-button" onClick={retry}>Tekrar Dene</button>
      <Link href="/" className="center-link">Ana sayfaya dön</Link>
    </section>
  </div></main>;
}
