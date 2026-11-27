<script setup>
import { createPocketbaseApi } from "~/utils/family-api";

// The family budget over PocketBase. The page renders only in the browser
// (routeRules in nuxt.config.ts): the session lives in this device's storage.
const { public: { pocketbaseUrl } } = useRuntimeConfig();
const budget = createFamilyBudget(createPocketbaseApi(pocketbaseUrl));

onMounted(() => budget.attach());
onBeforeUnmount(() => budget.detach());

useMobileDesign("m-html", "#121212");
useHead({
  title: "Семейный бюджет",
  meta: [
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-title", content: "Бюджет" },
    { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }
  ]
});
</script>

<template>
  <div class="m-standalone"><MobileApp :store="budget" /></div>
</template>
