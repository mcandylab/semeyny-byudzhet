<script setup>
import { monthInfo, plural } from "~/utils/family";

defineEmits(["go", "open"]);

const budget = useFamilyBudget();
const calc = computed(() => budget.calc);
const month = computed(() => monthInfo(budget.month));
const ratio = (value, total) => (total ? Math.round(value / total * 100) : 0);
const paydays = computed(() => [
  { key: 20, tone: "purple", pay: calc.value.p20 },
  { key: 5, tone: "cyan", pay: calc.value.p5 }
]);
</script>

<template>
  <div class="m-page">
    <header class="m-top">
      <button class="m-icon-btn" type="button" aria-label="Назад" @click="$emit('go', 'home')"><MobileIcon name="arrow-left" /></button>
      <h1 class="m-top-heading">Куда уходит <b>зарплата</b></h1>
    </header>

    <section class="m-card">
      <div class="m-card-row">
        <p class="m-label">Расходы за <b>{{ month.title.toLowerCase() }}</b></p>
        <button class="m-chip m-chip--button m-chip--sm" type="button" @click="$emit('open', 'month')">{{ month.year }}<MobileIcon name="chevron-down" :size="14" /></button>
      </div>
      <p class="m-display"><MobileMoney :value="calc.expenses" /></p>
      <p class="m-muted">{{ ratio(calc.expenses, calc.salary) }}% зарплаты · без десятины</p>
      <div class="m-bar m-bar--lg m-mt">
        <i v-for="item in budget.categoryTotals" :key="item.key" :style="{ flexGrow: item.amount, background: item.color }" />
      </div>
    </section>

    <div class="m-split">
      <button v-for="item in paydays" :key="item.key" class="m-split-card" type="button" @click="$emit('go', 'payday', { payday: item.key })">
        <span class="m-muted">С выплаты {{ item.key }}-го</span>
        <b><MobileMoney :value="item.pay.expenses" /></b>
        <span class="m-mini-bar" :class="'m-mini-bar--' + item.tone"><i :style="{ width: Math.min(100, ratio(item.pay.expenses, item.pay.salary)) + '%' }" /></span>
        <small>{{ ratio(item.pay.expenses, item.pay.salary) }}% выплаты</small>
      </button>
    </div>

    <div class="m-section-head">
      <h2 class="m-h2">По <b>категориям</b></h2>
      <span class="m-muted">{{ budget.categoryTotals.length }}</span>
    </div>
    <ul v-if="budget.categoryTotals.length" class="m-list">
      <li v-for="item in budget.categoryTotals" :key="item.key" class="m-row">
        <span class="m-row-icon" :style="{ color: item.color }"><MobileIcon :name="item.icon" /></span>
        <span class="m-row-main">
          <span class="m-row-title">{{ item.label }}</span>
          <span class="m-row-meta">{{ plural(item.count, ['позиция', 'позиции', 'позиций']) }} · {{ ratio(item.amount, calc.expenses) }}%</span>
        </span>
        <span class="m-row-amount"><MobileMoney :value="item.amount" /></span>
      </li>
    </ul>
    <p v-else class="m-empty">Расходов пока нет.</p>
  </div>
</template>
