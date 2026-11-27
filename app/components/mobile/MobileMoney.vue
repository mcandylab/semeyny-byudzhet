<script setup>
import { fmt } from "~/utils/family";

defineProps({
  value: { type: Number, required: true },
  sign: { type: String, default: "" }
});
</script>

<template>
  <span class="m-money"><span v-if="sign" class="m-money-sign">{{ sign }}</span>{{ fmt(value) }}<span class="m-money-cur">₽</span></span>
</template>
