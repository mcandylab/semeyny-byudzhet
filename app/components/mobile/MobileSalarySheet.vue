<script setup>
import { fmt, parseAmount } from "~/utils/family";

const emit = defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const salary = ref(budget.household?.salary ? fmt(budget.household.salary) : "");
const name = ref(budget.household?.name || "");
const busy = ref(false);

async function save() {
  busy.value = true;
  const done = await budget.updateHousehold({ salary: parseAmount(salary.value), name: name.value.trim() || "Семейный бюджет" });
  busy.value = false;
  if (done) emit("done", "Зарплата сохранена");
}
</script>

<template>
  <MobileSheet title="Зарплата" eyebrow="За полный месяц, до вычета десятины" @close="$emit('close')">
    <label class="m-amount-field">
      <span class="m-field-label">Сумма в месяц</span>
      <span class="m-amount-input"><input v-model="salary" inputmode="decimal" placeholder="0" aria-label="Зарплата в рублях" @keydown.enter="save"><span>₽</span></span>
    </label>
    <p class="m-hint m-hint--flush">Выплаты 20-го и 5-го считаются по рабочим дням каждой половины месяца.</p>
    <label class="m-field">
      <span class="m-field-label">Название бюджета</span>
      <input v-model="name" class="m-input" maxlength="120" placeholder="Семейный бюджет">
    </label>
    <template #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="busy" @click="save">Сохранить</button>
    </template>
  </MobileSheet>
</template>
