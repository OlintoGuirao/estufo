import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App Android carrega o site em produção (SSR/TanStack na Vercel).
 * webDir existe só para o sync nativo; o WebView usa server.url.
 */
const config: CapacitorConfig = {
  appId: "app.estufoo.android",
  appName: "Estufoo",
  webDir: "www",
  server: {
    url: "https://estufo.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0f172a",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0f172a",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f172a",
    },
  },
};

export default config;
