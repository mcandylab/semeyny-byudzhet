<script setup>
defineEmits(["close", "done"]);

const rows = [
  { label: "Записано операций", value: "14" },
  { label: "Остаток в конвертах", value: "298 120 ₽" },
  { label: "Изменена", value: "26 ноября, 22:05" }
];
</script>

<template>
  <MobileSheet title="Найдена прежняя версия" eyebrow="На этом устройстве" @close="$emit('close')">
    <div class="m-share-hero">
      <span class="m-share-icon m-share-icon--cyan"><MobileIcon name="refresh" :size="28" /></span>
      <p>На телефоне сохранились записи, которых нет в общем бюджете. Можно вернуть их и отправить обоим.</p>
    </div>
    <dl class="m-facts">
      <div v-for="row in rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
    </dl>
    <template #footer>
      <button class="m-btn m-btn--ghost" type="button" @click="$emit('close')">Не нужно</button>
      <button class="m-btn m-btn--primary" type="button" @click="$emit('done', 'Прежние записи восстановлены')">Восстановить</button>
    </template>
  </MobileSheet>
</template>
