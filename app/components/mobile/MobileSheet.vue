<script setup>
defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, default: "" },
  tall: Boolean
});
defineEmits(["close"]);
</script>

<template>
  <section class="m-sheet" :class="{ 'm-sheet--tall': tall }" role="dialog" aria-modal="true" :aria-label="title">
    <div class="m-sheet-handle" aria-hidden="true" />
    <header class="m-sheet-head">
      <div>
        <p v-if="eyebrow" class="m-eyebrow">{{ eyebrow }}</p>
        <h2 class="m-sheet-title">{{ title }}</h2>
      </div>
      <button class="m-icon-btn" type="button" aria-label="Закрыть" @click="$emit('close')"><MobileIcon name="close" :size="20" /></button>
    </header>
    <div class="m-sheet-body"><slot /></div>
    <footer v-if="$slots.footer" class="m-sheet-foot"><slot name="footer" /></footer>
  </section>
</template>
