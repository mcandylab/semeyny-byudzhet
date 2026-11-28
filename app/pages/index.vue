<script setup>
import { createPocketbaseApi } from "~/utils/family-api";

// The family budget over PocketBase. The page renders only in the browser
// (routeRules in nuxt.config.js): the session lives in this device's storage.
const { public: { pocketbaseUrl } } = useRuntimeConfig();
const budget = createFamilyBudget(createPocketbaseApi(pocketbaseUrl));

onMounted(() => budget.attach());
onBeforeUnmount(() => budget.detach());

// The page and the browser bar follow the chosen theme.
const { light } = useTheme();
useMobileDesign(
  computed(() => (light.value ? "m-html m-html--light" : "m-html")),
  computed(() => (light.value ? "#f2f2f5" : "#121212"))
);
// Viewport and home-screen tags live in nuxt.config.js: the phone reads them before the app starts.
useHead({ title: "Семейный бюджет" });
</script>

<template>
  <div class="m-standalone"><MobileApp :store="budget" /></div>
</template>
