<script setup>
import { pad } from "~/utils/budget";
import { MONTH_TITLES, monthInfo, monthKey } from "~/utils/family";

defineEmits(["close"]);

const SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const budget = useFamilyBudget();
const today = monthInfo(monthKey());
const start = monthInfo(budget.month);
const year = ref(start.year);
const selected = reactive({ year: start.year, month: start.index });

function pick(index) {
  selected.year = year.value;
  selected.month = index;
}

function show() {
  budget.month = `${selected.year}-${pad(selected.month + 1)}`;
}
</script>

<template>
  <MobileSheet title="Месяц бюджета" @close="$emit('close')">
    <div class="m-year">
      <button class="m-icon-btn" type="button" aria-label="Предыдущий год" @click="year -= 1"><MobileIcon name="chevron-left" :size="20" /></button>
      <b>{{ year }}</b>
      <button class="m-icon-btn" type="button" aria-label="Следующий год" @click="year += 1"><MobileIcon name="chevron-right" :size="20" /></button>
    </div>
    <div class="m-months">
      <button
        v-for="(label, index) in SHORT"
        :key="label"
        type="button"
        :class="{ on: selected.year === year && selected.month === index, now: today.year === year && today.index === index }"
        :aria-pressed="selected.year === year && selected.month === index"
        @click="pick(index)"
      >
        {{ label }}
      </button>
    </div>
    <p class="m-hint m-hint--flush">Расходы и цели общие для всех месяцев. Рабочие дни и отметки «оплачено» у каждого месяца свои.</p>
    <template #footer>
      <button v-if="selected.year !== today.year || selected.month !== today.index" class="m-btn m-btn--ghost" type="button" @click="budget.month = today.key; $emit('close')">Сейчас</button>
      <button class="m-btn m-btn--primary" type="button" @click="show(); $emit('close')">Показать {{ MONTH_TITLES[selected.month].toLowerCase() }} {{ selected.year }}</button>
    </template>
  </MobileSheet>
</template>
