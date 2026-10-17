// Small pure helpers that keep personal data where it belongs (unit-tested in tests/lib.test.mjs).

/** "Elif Yılmaz" → "Elif Y.": public pages show members by first name and initial only. */
export function publicName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toLocaleUpperCase("tr")}.` : first;
}

/** e-mail addresses in server logs are masked: "a***@gmail.com". */
export const maskEmail = (address: string) => address.replace(/^(.)[^@]*(@.*)$/, "$1***$2");

/**
 * Only same-site paths are accepted as post-login destinations. Browsers drop tabs/newlines in
 * URLs ("/\t/evil.com" becomes "//evil.com"), so control characters and anything that resolves
 * to another origin are refused.
 */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string | null {
  const sameSitePath = (path: string) => path.length <= 500 && /^\/(?![/\\])/.test(path) && !/[\u0000-\u001f\u007f\\]/.test(path);
  if (typeof value !== "string" || !sameSitePath(value)) return null;
  try {
    const base = "https://smeda.invalid";
    const url = new URL(value, base);
    const out = `${url.pathname}${url.search}${url.hash}`;
    // Check the normalised result too: "/.//evil.com" resolves to the protocol-relative "//evil.com".
    return url.origin === base && sameSitePath(out) ? out : null;
  } catch {
    return null;
  }
}
