<script setup>
import { fmt, monthInfo, paydayDates, plural } from "~/utils/family";

defineEmits(["go", "open"]);

const budget = useFamilyBudget();
const calc = computed(() => budget.calc);
const month = computed(() => monthInfo(budget.month));

const R = 46;
const C = 2 * Math.PI * R;
const parts = computed(() => [
  { key: "expenses", label: "расходы", value: calc.value.expenses, color: "#723FEB", width: 24 },
  { key: "goals", label: "цели", value: calc.value.goalAllocated, color: "#97E0F7", width: 16 },
  { key: "tithe", label: "десятина", value: calc.value.tithe, color: "#FCFCFC", width: 16 },
  { key: "free", label: "свободно", value: Math.max(0, calc.value.unassigned), color: "#3A3A3C", width: 16 }
]);
const whole = computed(() => Math.max(calc.value.salary, parts.value.reduce((total, part) => total + part.value, 0)));
const percent = value => (whole.value ? Math.round(value / whole.value * 100) : 0);
const segments = computed(() => {
  let offset = 0;
  return parts.value.filter(part => part.value > 0).map(part => {
    const length = part.value / whole.value * C;
    const segment = { ...part, dash: `${Math.max(length - 3, 0)} ${C}`, offset: -offset };
    offset += length;
    return segment;
  });
});
const donutLabel = computed(() => parts.value.map(part => `${part.label} ${percent(part.value)} %`).join(", "));

const statusChip = computed(() => ({
  saved: { text: "Сохранено", tone: "" },
  saving: { text: "Сохраняю…", tone: "m-dot--busy" },
  offline: { text: "Нет связи", tone: "m-dot--off" }
}[budget.status]));

const cards = computed(() => [
  { key: "p20", tone: "purple", title: "Выплата 20-го", amount: calc.value.p20.salary, chip: paydayDates(calc.value.p20).date, screen: "payday", options: { payday: 20 } },
  { key: "p5", tone: "cyan", title: "Выплата 5-го", amount: calc.value.p5.salary, chip: paydayDates(calc.value.p5).date, screen: "payday", options: { payday: 5 } },
  { key: "goals", tone: "white", title: "На цели", amount: calc.value.goalAllocated, chip: plural(calc.value.goalCount, ["цель", "цели", "целей"]), screen: "goals", options: {} }
]);
const top = computed(() => budget.categoryTotals[0]);
const topShare = computed(() => (calc.value.expenses ? Math.round(top.value.amount / calc.value.expenses * 100) : 0));
const note = computed(() => (budget.household?.credit_note || "").trim());
const recent = computed(() => budget.operations.slice(0, 3));
</script>

<template>
  <div class="m-page">
    <div class="m-home-head">
      <header class="m-top">
        <button class="m-avatar" type="button" aria-label="Настройки" @click="$emit('go', 'settings')">
          <MobileIcon name="family" :size="24" />
        </button>
        <button class="m-top-title" type="button" @click="$emit('open', 'month')">
          <span class="m-top-hello">{{ budget.household?.name || 'Семейный бюджет' }}</span>
          <span class="m-top-main">{{ month.title }} <b>{{ month.year }}</b><MobileIcon name="chevron-down" :size="18" /></span>
        </button>
        <span class="m-chip"><i class="m-dot" :class="statusChip.tone" />{{ statusChip.text }}</span>
      </header>

      <section class="m-hero">
        <div class="m-hero-text">
          <p class="m-label"><b>Свободный</b> остаток</p>
          <p class="m-display" :class="{ 'm-minus': calc.free < 0 }"><MobileMoney :value="calc.free" :sign="calc.free < 0 ? '−' : ''" /></p>
          <span v-if="calc.unassigned >= 0" class="m-chip m-chip--yellow">{{ fmt(calc.unassigned) }} ₽ не распределено</span>
          <span v-else class="m-chip m-chip--warn">На цели выделено на {{ fmt(calc.unassigned) }} ₽ больше</span>
        </div>
        <div class="m-donut">
          <svg viewBox="0 0 124 124" role="img" :aria-label="donutLabel">
            <circle v-if="!segments.length" cx="62" cy="62" :r="R" fill="none" stroke="#3A3A3C" stroke-width="16" />
            <circle
              v-for="segment in segments"
              :key="segment.key"
              cx="62"
              cy="62"
              :r="R"
              fill="none"
              :stroke="segment.color"
              :stroke-width="segment.width"
              :stroke-dasharray="segment.dash"
              :stroke-dashoffset="segment.offset"
              transform="rotate(-90 62 62)"
            />
          </svg>
          <span class="m-donut-tag">Расходы {{ percent(calc.expenses) }}%</span>
        </div>
      </section>
      <p class="m-hero-foot">Зарплата {{ fmt(calc.salary) }} ₽ · {{ plural(calc.workdays.total, ['рабочий день', 'рабочих дня', 'рабочих дней']) }}</p>

      <div class="m-carousel">
        <button class="m-carousel-add" type="button" aria-label="Добавить расход" @click="$emit('open', 'expense', { isNew: true })">
          <MobileIcon name="plus" :size="26" />
        </button>
        <button
          v-for="card in cards"
          :key="card.key"
          type="button"
          class="m-pay-card m-pattern"
          :class="'m-pay-card--' + card.tone"
          @click="$emit('go', card.screen, card.options)"
        >
          <span class="m-pay-card-title">{{ card.title }}</span>
          <span class="m-pay-card-amount"><MobileMoney :value="card.amount" /></span>
          <span class="m-pay-card-chip">{{ card.chip }}</span>
        </button>
      </div>
      <div class="m-pager" aria-hidden="true"><i class="on" /><i /></div>
    </div>

    <div class="m-section-head">
      <h2 class="m-h2"><b>Конверты</b></h2>
      <button class="m-link" type="button" @click="$emit('go', 'envelopes')"><MobileMoney :value="calc.balances" /><MobileIcon name="chevron-right" :size="18" /></button>
    </div>
    <div class="m-tiles">
      <button v-for="item in budget.quickEnvelopes" :key="item.id" type="button" class="m-tile" @click="$emit('open', 'operation', { envelope: item.id })">
        <span class="m-tile-icon" :style="{ color: item.color }"><MobileIcon :name="item.icon" /></span>
        <MobileIcon class="m-tile-more" name="dots" />
        <span class="m-tile-name">{{ item.name }}</span>
        <span class="m-tile-amount"><MobileMoney :value="item.amount" /></span>
      </button>
      <button v-if="budget.quickEnvelopes.length < 2" type="button" class="m-tile m-tile--add" @click="$emit('open', 'envelope', { isNew: true })">
        <MobileIcon name="plus" /><span>Новый конверт</span>
      </button>
    </div>

    <button class="m-card m-insight" type="button" @click="$emit('go', 'analytics')">
      <span class="m-card-row">
        <span class="m-label">Куда уходит <b>зарплата</b></span>
        <span class="m-insight-value"><MobileMoney :value="calc.expenses" /></span>
      </span>
      <span class="m-bar">
        <i v-for="item in budget.categoryTotals" :key="item.key" :style="{ flexGrow: item.amount, background: item.color }" />
      </span>
      <span class="m-insight-foot">
        <template v-if="top">Больше всего — {{ top.label.toLowerCase() }}, {{ topShare }}%</template>
        <template v-else>Расходов пока нет</template>
        <MobileIcon name="chevron-right" :size="18" />
      </span>
    </button>

    <button class="m-note" type="button" @click="$emit('open', 'note')">
      <span class="m-note-icon"><MobileIcon name="note" /></span>
      <span class="m-note-body">
        <span class="m-note-title">Памятка по кредиткам</span>
        <span class="m-note-text">{{ note || 'Пока пусто — нажмите, чтобы написать' }}</span>
      </span>
      <MobileIcon name="chevron-right" :size="18" />
    </button>

    <div class="m-section-head">
      <h2 class="m-h2">Последние <b>операции</b></h2>
      <button class="m-link" type="button" @click="$emit('go', 'envelopes')">Все<MobileIcon name="chevron-right" :size="18" /></button>
    </div>
    <ul v-if="recent.length" class="m-list">
      <li v-for="item in recent" :key="item.id"><MobileOperation :item="item" with-date /></li>
    </ul>
    <p v-else class="m-empty">Операций пока нет. Кнопка «+» внизу записывает покупку или пополнение.</p>
  </div>
</template>
