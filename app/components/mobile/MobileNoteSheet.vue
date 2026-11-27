<script setup>
const emit = defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const text = ref(budget.household?.credit_note || "");
const busy = ref(false);

async function save() {
  busy.value = true;
  const done = await budget.updateHousehold({ credit_note: text.value });
  busy.value = false;
  if (done) emit("done", "Памятка сохранена");
}
</script>

<template>
  <MobileSheet title="Памятка по кредиткам" eyebrow="Общая заметка семьи" @close="$emit('close')">
    <textarea v-model="text" class="m-input m-textarea" rows="9" maxlength="10000" placeholder="Например: до 25-го закрываем долг по карте с льготным периодом" aria-label="Текст памятки" />
    <p class="m-hint m-hint--flush">После сохранения текст сразу появится у всей семьи.</p>
    <template #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="busy || text === (budget.household?.credit_note || '')" @click="save">Сохранить</button>
    </template>
  </MobileSheet>
</template>
