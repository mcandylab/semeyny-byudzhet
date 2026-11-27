<script setup>
import { money } from "../utils/budget";

defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  note: { type: String, required: true }
});
</script>

<template>
  <article class="stat">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value">{{ money(value) }}</div>
    <div class="stat-note">{{ note }}</div>
  </article>
</template>
