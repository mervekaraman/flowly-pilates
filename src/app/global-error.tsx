"use client";

/**
 * Last-resort screen when the root layout itself fails. It replaces the whole document, so it carries
 * its own markup and inline styles (globals.css and the fonts are not loaded here). Error details stay
 * in the server logs; the visitor only sees a short Turkish message and a retry button.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return <html lang="tr">
    <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f8f5e8", color: "#1d1b1b", fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <title>Bir sorun oluştu · Flowly Pilates</title>
      <main style={{ maxWidth: 360, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#7b2d3b", fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase" }}>Bir sorun oluştu</p>
        <h1 style={{ margin: "14px 0 10px", fontSize: 34, lineHeight: 1.05, letterSpacing: "-.03em" }}>Şu an açamadık.</h1>
        <p style={{ margin: "0 0 26px", color: "#77716c", fontSize: 15, lineHeight: 1.5 }}>Geçici bir sorun olabilir. Birkaç saniye sonra tekrar dene; devam ederse stüdyoya haber ver.</p>
        <button type="button" onClick={retry} style={{ width: "100%", minHeight: 52, border: 0, borderRadius: 8, background: "#38070e", color: "#f8f5e8", fontSize: 16, cursor: "pointer" }}>Tekrar Dene</button>
      </main>
    </body>
  </html>;
}
