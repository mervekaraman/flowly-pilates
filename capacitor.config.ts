import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app is a native shell around the live site: every screen still comes from the
// Next.js server, so web and app share one codebase and one database. When the site
// cannot be reached, the shell shows the local page in mobil/www instead.
// The studio's own domain: *.vercel.app is blocked on Turkish mobile networks, so builds that point
// there only work on Wi-Fi. LIVE_URL is baked into each app release (1.0 used flowlypilates.vercel.app,
// which keeps serving the same site for those installs).
const LIVE_URL = "https://flowlypilates.com";
// For testing against a local dev server only: `FLOWLY_APP_URL=http://localhost:3041 npm run ios:sync`.
// Never ship a build synced this way; a plain `npm run ios:sync` points back at the live site.
const APP_URL = process.env.FLOWLY_APP_URL || LIVE_URL;

const config: CapacitorConfig = {
  appId: "com.mervekaraman.flowly",
  appName: "Flowly",
  webDir: "mobil/www",
  backgroundColor: "#f8f5e8",
  // Lets the server tell app visitors apart from browser visitors.
  appendUserAgent: "FlowlyApp",
  server: {
    url: APP_URL,
    errorPath: "index.html",
  },
  // The web view reaches under the clock and the home bar; pages keep clear of them with
  // env(safe-area-inset-*) so full-screen photos (splash, booking success) fill the whole screen.
  ios: {
    contentInset: "never",
  },
  plugins: {
    // The logo stays up until the site has drawn its first page (NativeReady hides it), so nobody
    // stares at an empty screen while the app connects. After 10 s it goes away regardless.
    SplashScreen: {
      launchShowDuration: 10000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: "#f8f5e8",
      showSpinner: false,
    },
    // A notification that arrives while the app is open still shows as a banner (with sound).
    PushNotifications: {
      presentationOptions: ["banner", "list", "sound", "badge"],
    },
  },
};

export default config;
