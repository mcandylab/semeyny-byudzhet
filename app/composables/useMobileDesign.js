const FONT_URL = "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap";

// Общие настройки страниц мобильного дизайна: шрифт Manrope, фон и цвет панели браузера.
export function useMobileDesign(htmlClass, themeColor) {
  useHead({
    htmlAttrs: { class: htmlClass },
    meta: [{ name: "theme-color", content: themeColor }],
    link: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
      { rel: "stylesheet", href: FONT_URL }
    ]
  });
}
