<script setup>
// Demo data in memory: the real app over PocketBase is at /.
const SCREENS = ["welcome", "home", "payday", "envelopes", "goals", "analytics", "settings"];
const SHEETS = ["month", "expense", "operation", "envelope", "goal", "note", "salary", "family", "account"];

const route = useRoute();
const screen = SCREENS.includes(route.query.screen) ? route.query.screen : "home";
const signedOut = screen === "welcome";
const sheet = SHEETS.includes(route.query.sheet) ? route.query.sheet : "";
const payday = route.query.payday === "5" ? 5 : 20;

useMobileDesign("m-html", "#121212");
useHead({ title: "Семейный бюджет — прототип" });
</script>

<template>
  <div class="proto">
    <NuxtLink to="/mobile" class="proto-back">← Все экраны</NuxtLink>
    <div class="proto-device"><MobileApp :signed-out="signedOut" :screen="signedOut ? 'home' : screen" :sheet="sheet" :payday="payday" /></div>
  </div>
</template>

<style scoped>
.proto {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: 32px;
  background: radial-gradient(60% 50% at 50% 0%, rgba(114, 63, 235, .18), transparent 70%), #0b0b0c;
}
.proto-device {
  width: 390px;
  height: min(844px, calc(100dvh - 64px));
  overflow: hidden;
  border-radius: 52px;
  box-shadow: 0 0 0 10px #000, 0 0 0 11px #2a2a2c, 0 40px 100px rgba(0, 0, 0, .6);
  transform: translateZ(0);
}
.proto-back {
  position: fixed;
  top: 20px;
  left: 24px;
  color: rgba(252, 252, 252, .6);
  font: 600 14px "Manrope", sans-serif;
  text-decoration: none;
}
.proto-back:hover { color: #fcfcfc; }

@media (max-width: 520px) {
  .proto { display: block; padding: 0; }
  .proto-device { width: 100%; height: 100dvh; border-radius: 0; box-shadow: none; }
  .proto-back { display: none; }
}
</style>
