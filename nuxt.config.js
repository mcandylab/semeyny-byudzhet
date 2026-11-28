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
      meta: [
        { name: "theme-color", content: "#121212" },
        { name: "robots", content: "noindex, nofollow, noarchive" }
      ],
      // Applies the saved light theme before the app starts (composables/useTheme.js).
      script: [{
        tagPosition: "head",
        innerHTML: "try{var t=localStorage.getItem('semeyny-byudzhet:theme');if(t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches))document.documentElement.classList.add('m-html--light')}catch(e){}"
      }]
    }
  }
});
