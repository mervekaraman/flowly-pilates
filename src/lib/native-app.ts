// The iOS app (Capacitor, see capacitor.config.ts) appends this word to its browser user agent.
// Pages use it only to leave out things that cannot work inside the app (Google's sign-in page
// refuses embedded web views; Web Push only exists for home-screen web apps in Safari). It is a
// display hint, never a security decision: anyone can send any user agent.
export const NATIVE_APP_MARKER = "FlowlyApp";

export const isNativeAppUserAgent = (userAgent: string | null | undefined) =>
  Boolean(userAgent && new RegExp(`(^|\\s)${NATIVE_APP_MARKER}(/|\\s|$)`).test(userAgent));
