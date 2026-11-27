<script setup>
import { creditNote } from "~/utils/mobile-mock";

defineEmits(["close", "done"]);

const text = ref(creditNote.text);
</script>

<template>
  <MobileSheet :title="creditNote.title" eyebrow="Для мужа · важно" @close="$emit('close')">
    <textarea v-model="text" class="m-input m-textarea" rows="7" aria-label="Текст памятки" />
    <p class="m-hint m-hint--flush">Текст можно редактировать. Изменения автоматически появятся на обоих устройствах.</p>
    <template #footer>
      <button class="m-btn m-btn--primary" type="button" @click="$emit('done', 'Памятка сохранена')">Сохранить</button>
    </template>
  </MobileSheet>
</template>
