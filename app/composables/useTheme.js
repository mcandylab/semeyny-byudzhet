// Light or dark look of the app, chosen per device and kept in localStorage.
// "system" follows the phone's own setting. nuxt.config.js applies the saved
// choice to <html> before the app starts, so a light page never flashes dark.

export const THEME_KEY = "semeyny-byudzhet:theme";
const CHOICES = ["dark", "light", "system"];

// Shared by every MobileApp on the page. On the server they stay at the defaults.
const choice = ref("dark");
const systemLight = ref(false);
let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (CHOICES.includes(saved)) choice.value = saved;
  } catch {}
  const media = window.matchMedia("(prefers-color-scheme: light)");
  systemLight.value = media.matches;
  media.addEventListener("change", event => { systemLight.value = event.matches; });
}

export function useTheme() {
  // After mount, so the server-rendered gallery and the first client render agree.
  onMounted(start);
  const light = computed(() => choice.value === "light" || (choice.value === "system" && systemLight.value));

  function setTheme(value) {
    if (!CHOICES.includes(value)) return;
    choice.value = value;
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {}
  }

  return { choice, light, setTheme };
}
