<script setup>
import { categoryTotals, creditNote, envelopes, fmt, month, operations, summary } from "~/utils/mobile-mock";

defineEmits(["go", "open"]);

const R = 46;
const C = 2 * Math.PI * R;
const parts = [
  { key: "expenses", value: summary.expenses, color: "#723FEB", width: 24 },
  { key: "goals", value: summary.goals, color: "#97E0F7", width: 16 },
  { key: "tithe", value: summary.tithe, color: "#FCFCFC", width: 16 },
  { key: "free", value: summary.unassigned, color: "#3A3A3C", width: 16 }
];
let offset = 0;
const segments = parts.map(part => {
  const length = part.value / summary.salary * C;
  const segment = { ...part, dash: `${Math.max(length - 3, 0)} ${C}`, offset: -offset };
  offset += length;
  return segment;
});
const expensesShare = Math.round(summary.expenses / summary.salary * 100);

const cards = [
  { key: "p20", tone: "purple", title: "Выплата 20-го", amount: 81000, chip: "20 ноября", screen: "payday", options: { payday: 20 } },
  { key: "p5", tone: "cyan", title: "Выплата 5-го", amount: 99000, chip: "4 декабря", screen: "payday", options: { payday: 5 } },
  { key: "goals", tone: "white", title: "На цели", amount: summary.goals, chip: "4 цели", screen: "goals", options: {} }
];
const topShare = Math.round(categoryTotals[0].amount / summary.expenses * 100);
const daily = envelopes.filter(item => item.daily);
const recent = operations.flatMap(group => group.items.map(item => ({ ...item, date: group.date }))).slice(0, 3);
</script>

<template>
  <div class="m-page">
    <div class="m-home-head">
      <header class="m-top">
        <button class="m-avatar" type="button" aria-label="Настройки" @click="$emit('go', 'settings')">
          <MobileIcon name="family" :size="24" />
        </button>
        <button class="m-top-title" type="button" @click="$emit('open', 'month')">
          <span class="m-top-hello">Семейный бюджет</span>
          <span class="m-top-main">{{ month.title }} <b>{{ month.year }}</b><MobileIcon name="chevron-down" :size="18" /></span>
        </button>
        <span class="m-chip"><i class="m-dot" />Сохранено</span>
      </header>

      <section class="m-hero">
        <div class="m-hero-text">
          <p class="m-label"><b>Свободный</b> остаток</p>
          <p class="m-display"><MobileMoney :value="summary.free" /></p>
          <span class="m-chip m-chip--yellow">{{ fmt(summary.unassigned) }} ₽ не распределено</span>
        </div>
        <div class="m-donut">
          <svg viewBox="0 0 124 124" role="img" aria-label="Расходы 63 %, цели 21 %, десятина 10 %, свободно 6 %">
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
          <span class="m-donut-tag">Расходы {{ expensesShare }}%</span>
        </div>
      </section>
      <p class="m-hero-foot">Зарплата {{ fmt(summary.salary) }} ₽ · {{ summary.workdays }} рабочих дней</p>

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
      <button class="m-link" type="button" @click="$emit('go', 'envelopes')"><MobileMoney :value="summary.balances" /><MobileIcon name="chevron-right" :size="18" /></button>
    </div>
    <div class="m-tiles">
      <button v-for="item in daily" :key="item.id" type="button" class="m-tile" @click="$emit('open', 'operation', { envelope: item.id })">
        <span class="m-tile-icon" :style="{ color: item.color }"><MobileIcon :name="item.icon" /></span>
        <MobileIcon class="m-tile-more" name="dots" />
        <span class="m-tile-name">{{ item.name }}</span>
        <span class="m-tile-amount"><MobileMoney :value="item.amount" /></span>
      </button>
    </div>

    <button class="m-card m-insight" type="button" @click="$emit('go', 'analytics')">
      <span class="m-card-row">
        <span class="m-label">Куда уходит <b>зарплата</b></span>
        <span class="m-insight-value"><MobileMoney :value="summary.expenses" /></span>
      </span>
      <span class="m-bar">
        <i v-for="item in categoryTotals" :key="item.key" :style="{ flexGrow: item.amount, background: item.color }" />
      </span>
      <span class="m-insight-foot">Больше всего — {{ categoryTotals[0].label.toLowerCase() }}, {{ topShare }}%<MobileIcon name="chevron-right" :size="18" /></span>
    </button>

    <button class="m-note" type="button" @click="$emit('open', 'note')">
      <span class="m-note-icon"><MobileIcon name="note" /></span>
      <span class="m-note-body">
        <span class="m-note-title">{{ creditNote.title }}</span>
        <span class="m-note-text">{{ creditNote.preview }}</span>
      </span>
      <MobileIcon name="chevron-right" :size="18" />
    </button>

    <div class="m-section-head">
      <h2 class="m-h2">Последние <b>операции</b></h2>
      <button class="m-link" type="button" @click="$emit('go', 'envelopes')">Все<MobileIcon name="chevron-right" :size="18" /></button>
    </div>
    <ul class="m-list">
      <li v-for="item in recent" :key="item.id"><MobileOperation :item="item" with-date /></li>
    </ul>
  </div>
</template>
