// PocketBase serves the API at /api and the admin UI at /_ on the same origin as the app:
// in the cluster it also serves the static build (scripts/deploy-k8s.sh), and in development
// Nuxt proxies /api to the local PocketBase.
const pocketbase = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

export default defineNuxtConfig({
  compatibilityDate: "2026-11-27",
  css: ["~/assets/mobile.css"],
  runtimeConfig: {
    public: {
      // Where the browser reaches PocketBase; override with NUXT_PUBLIC_POCKETBASE_URL.
      pocketbaseUrl: "/"
    }
  },
  routeRules: {
    // The app keeps its session in the browser, so it is rendered only there.
    "/": { ssr: false },
    // The prototype reads its screen from the query string.
    "/mobile/app": { ssr: false }
  },
  nitro: {
    devProxy: {
      "/api": { target: `${pocketbase}/api`, changeOrigin: true }
    },
    prerender: {
      routes: ["/mobile"]
    }
  },
  app: {
    head: {
      title: "Семейный бюджет",
      htmlAttrs: { lang: "ru" },
      // These must be in the HTML the phone loads first: an app on the iPhone home screen
      // reads them at launch, before any script runs. No zooming: the screens are drawn
      // for the phone, and Safari would otherwise zoom on a double tap or into small inputs.
      viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      meta: [
        { name: "theme-color", content: "#121212" },
        { name: "robots", content: "noindex, nofollow, noarchive" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: "Бюджет" },
        // The page runs under the status bar and keeps clear of it with safe-area insets.
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }
      ],
      // Applies the saved light theme before the app starts (composables/useTheme.js)
      // and marks a launch from the home screen (assets/mobile.css).
      script: [{
        tagPosition: "head",
        innerHTML: "try{var d=document.documentElement;if(navigator.standalone||matchMedia('(display-mode: standalone)').matches)d.setAttribute('data-standalone','');var t=localStorage.getItem('semeyny-byudzhet:theme');if(t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches))d.classList.add('m-html--light')}catch(e){}"
      }]
    }
  }
});
