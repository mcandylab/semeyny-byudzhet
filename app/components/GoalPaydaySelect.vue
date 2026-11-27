<script setup>
defineProps({ value: { type: Number, required: true } });
defineEmits(["change"]);
</script>

<template>
  <select aria-label="С какой зарплаты отложить" :value="value" @change="$emit('change', $event.target.value)">
    <option value="0">Не выбрано</option><option value="5">ЗП 5-го</option><option value="20">ЗП 20-го</option>
  </select>
</template>
