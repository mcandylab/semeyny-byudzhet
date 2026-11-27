export default defineNuxtConfig({
  compatibilityDate: "2026-11-27",
  css: ["~/assets/styles.css"],
  runtimeConfig: {
    supabaseUrl: "",
    supabaseKey: ""
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
