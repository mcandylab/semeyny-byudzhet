<script setup>
import { daysLabel, envelopeByName } from "~/utils/mobile-mock";

const props = defineProps({
  item: { type: Object, required: true },
  withDate: Boolean
});

const deposit = computed(() => props.item.type === "deposit");
const envelope = computed(() => envelopeByName[props.item.envelope]);
const meta = computed(() => {
  const parts = [];
  if (props.withDate) parts.push(props.item.date);
  parts.push(`${deposit.value ? "в" : "из"} «${props.item.envelope}»`);
  if (!deposit.value && props.item.days) parts.push(`на ${daysLabel(props.item.days)}`);
  return parts.join(" · ");
});
</script>

<template>
  <span class="m-row">
    <span class="m-row-icon" :style="{ color: deposit ? 'var(--m-green)' : envelope?.color }">
      <MobileIcon :name="deposit ? 'deposit' : envelope?.icon || 'cart'" />
    </span>
    <span class="m-row-main">
      <span class="m-row-title">{{ item.name }}</span>
      <span class="m-row-meta">{{ meta }}</span>
    </span>
    <span class="m-row-amount" :class="{ 'm-row-amount--plus': deposit }">
      <MobileMoney :value="item.amount" :sign="deposit ? '+' : '−'" />
    </span>
  </span>
</template>
