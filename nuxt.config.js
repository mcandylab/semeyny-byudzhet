export default defineNuxtConfig({
  compatibilityDate: "2026-11-27",
  css: ["~/assets/styles.css"],
  runtimeConfig: {
    supabaseUrl: "",
    supabaseKey: "",
    public: {
      // Where the browser reaches PocketBase. In development /pb is proxied below;
      // override with NUXT_PUBLIC_POCKETBASE_URL when PocketBase lives elsewhere.
      pocketbaseUrl: "/pb"
    }
  },
  // The real app keeps its session in the browser, so it is rendered only there.
  routeRules: {
    "/app": { ssr: false }
  },
  nitro: {
    devProxy: {
      "/pb": { target: process.env.POCKETBASE_URL || "http://127.0.0.1:8090", changeOrigin: true }
    }
  },
  app: {
    head: {
      title: "Семейный бюджет",
      htmlAttrs: { lang: "ru" },
      meta: [
        { name: "theme-color", content: "#173f35" },
        { name: "robots", content: "noindex, nofollow, noarchive" }
      ]
    }
  }
});
