import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app is a native shell around the live site: every screen still comes from the
// Next.js server, so web and app share one codebase and one database. When the site
// cannot be reached, the shell shows the local page in mobil/www instead.
// Move APP_URL to the studio's own domain once it has one; it is baked into each app release.
const APP_URL = "https://flowlypilates.vercel.app";

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
  ios: {
    contentInset: "automatic",
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
  },
};

export default config;
