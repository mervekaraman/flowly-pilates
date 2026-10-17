// Content-Security-Policy, built per request with a fresh nonce: only scripts Next.js itself marks
// with that nonce (and what they load) may run, so injected markup cannot execute script or send
// data elsewhere. Styles stay 'unsafe-inline' for React style attributes; that cannot run code.
export function contentSecurityPolicy(nonce: string, isDev = process.env.NODE_ENV === "development") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://open.spotify.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export const newNonce = () => Buffer.from(crypto.randomUUID()).toString("base64");
