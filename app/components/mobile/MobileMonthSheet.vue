<script setup>
defineEmits(["close"]);

const SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const FULL = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const TODAY = { year: 2026, month: 10 };

const year = ref(TODAY.year);
const selected = reactive({ ...TODAY });

function pick(index) {
  selected.year = year.value;
  selected.month = index;
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
        :class="{ on: selected.year === year && selected.month === index, now: TODAY.year === year && TODAY.month === index }"
        :aria-pressed="selected.year === year && selected.month === index"
        @click="pick(index)"
      >
        {{ label }}
      </button>
    </div>
    <p class="m-hint m-hint--flush">Расходы и цели общие для всех месяцев. Рабочие дни и отметки «оплачено» у каждого месяца свои.</p>
    <template #footer>
      <button class="m-btn m-btn--primary" type="button" @click="$emit('close')">Показать {{ FULL[selected.month] }} {{ selected.year }}</button>
    </template>
  </MobileSheet>
</template>
