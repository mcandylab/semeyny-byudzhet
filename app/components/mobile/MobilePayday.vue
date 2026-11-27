<script setup>
import { fmt, longDate, monthInfo, paydayDates } from "~/utils/family";

const props = defineProps({ payday: { type: Number, default: 20 } });
defineEmits(["go", "open"]);

const budget = useFamilyBudget();
const month = computed(() => monthInfo(budget.month));
const pay = computed(() => (props.payday === 5 ? budget.calc.p5 : budget.calc.p20));
const dates = computed(() => paydayDates(pay.value));
const tone = computed(() => (props.payday === 5 ? "cyan" : "purple"));
const items = computed(() => budget.expenses.filter(item => item.payday === props.payday));
const savings = computed(() => budget.goals.filter(goal => goal.payday === props.payday && goal.planned > 0));
const paidCount = computed(() => items.value.filter(item => item.paid).length);
const distributed = computed(() => pay.value.expenses + pay.value.tithe + pay.value.goalAllocated);
const bar = computed(() => [
  { key: "expenses", label: "Расходы", value: pay.value.expenses, color: "var(--m-purple)" },
  { key: "tithe", label: `Десятина ${budget.household?.tithe_rate || 0}%`, value: pay.value.tithe, color: "var(--m-white)" },
  { key: "goals", label: "На цели", value: pay.value.goalAllocated, color: "var(--m-cyan)" }
]);
const due = goal => (goal.dueDate ? `к ${longDate(goal.dueDate)}` : "Без срока");
</script>

<template>
  <div class="m-page">
    <header class="m-top m-top--simple">
      <h1 class="m-h1"><b>Выплаты</b></h1>
      <button class="m-chip m-chip--button" type="button" @click="$emit('open', 'month')">{{ month.title }} {{ month.year }}<MobileIcon name="chevron-down" :size="16" /></button>
    </header>

    <div class="m-segment" role="tablist" aria-label="Выплата">
      <button
        v-for="key in [20, 5]"
        :key="key"
        type="button"
        role="tab"
        :aria-selected="payday === key"
        :class="{ on: payday === key }"
        @click="$emit('go', 'payday', { payday: key })"
      >
        Выплата {{ key }}-го
      </button>
    </div>

    <section class="m-pay-hero m-pattern" :class="'m-pay-hero--' + tone">
      <div class="m-pay-hero-top">
        <span>{{ dates.date }}, {{ dates.weekday }}</span>
        <span class="m-pay-hero-chip">{{ pay.days }} раб. дней</span>
      </div>
      <p class="m-pay-hero-amount"><MobileMoney :value="pay.salary" /></p>
      <p class="m-pay-hero-period">За {{ pay.period }}</p>
      <span class="m-pay-hero-chip m-pay-hero-formula">{{ fmt(budget.calc.salary) }} ÷ {{ budget.calc.workdays.total }} × {{ pay.days }}</span>
      <p v-if="dates.moved" class="m-pay-hero-note"><MobileIcon name="info" :size="16" />{{ dates.moved }}</p>
    </section>

    <section class="m-card m-mt">
      <div class="m-card-row">
        <span class="m-label"><b>Распределено</b></span>
        <span class="m-muted">{{ fmt(distributed) }} из {{ fmt(pay.salary) }} ₽</span>
      </div>
      <div class="m-bar m-bar--lg">
        <i v-for="part in bar.filter(item => item.value > 0)" :key="part.key" :style="{ flexGrow: part.value, background: part.color }" />
        <i class="m-bar-rest" :style="{ flexGrow: Math.max(0, pay.afterGoals) }" />
      </div>
      <ul class="m-legend">
        <li v-for="part in bar" :key="part.key">
          <i class="m-legend-dot" :style="{ background: part.color }" />{{ part.label }}
          <span><MobileMoney :value="part.value" :sign="part.value ? '−' : ''" /></span>
        </li>
        <li class="m-legend-total">
          {{ pay.afterGoals >= 0 ? 'Остаётся после целей' : 'Не хватает' }}
          <span :class="pay.afterGoals >= 0 ? 'm-plus' : 'm-minus'"><MobileMoney :value="pay.afterGoals" :sign="pay.afterGoals < 0 ? '−' : ''" /></span>
        </li>
      </ul>
    </section>

    <div class="m-section-head">
      <h2 class="m-h2"><b>Расходы</b> · {{ items.length }}</h2>
      <span class="m-muted">Оплачено {{ paidCount }} из {{ items.length }}</span>
    </div>
    <ul v-if="items.length" class="m-list m-list--card">
      <li v-for="item in items" :key="item.id" class="m-row" :class="{ 'is-done': item.paid }">
        <button
          class="m-check"
          type="button"
          role="checkbox"
          :aria-checked="item.paid"
          :aria-label="'Оплачено: ' + item.name"
          @click="budget.togglePaid(item.id)"
        >
          <span><MobileIcon name="check" :size="16" /></span>
        </button>
        <button class="m-row-main" type="button" @click="$emit('open', 'expense', item)">
          <span class="m-row-title">{{ item.name }}</span>
          <span class="m-row-meta"><i class="m-cat-dot" :style="{ background: item.meta.color }" />{{ item.meta.label }}</span>
        </button>
        <span class="m-row-amount"><MobileMoney :value="item.amount" /></span>
      </li>
    </ul>
    <p v-else class="m-empty">С этой выплаты расходов нет.</p>

    <template v-if="savings.length">
      <div class="m-section-head">
        <h2 class="m-h2">Откладываем <b>на цели</b></h2>
        <button class="m-link" type="button" @click="$emit('go', 'goals')">Все цели<MobileIcon name="chevron-right" :size="18" /></button>
      </div>
      <ul class="m-list m-list--card">
        <li v-for="goal in savings" :key="goal.id" class="m-row">
          <span class="m-row-icon m-row-icon--sm" style="color: var(--m-cyan)"><MobileIcon name="target" :size="20" /></span>
          <button class="m-row-main" type="button" @click="$emit('open', 'goal', goal)">
            <span class="m-row-title">{{ goal.name }}</span>
            <span class="m-row-meta">{{ due(goal) }}</span>
          </button>
          <span class="m-row-amount"><MobileMoney :value="goal.planned" /></span>
        </li>
      </ul>
    </template>

    <button class="m-add-row" type="button" @click="$emit('open', 'expense', { isNew: true, payday })">
      <MobileIcon name="plus" :size="20" />Добавить расход
    </button>
    <div class="m-total"><span>Итого с выплаты</span><b><MobileMoney :value="pay.expenses + pay.goalAllocated" /></b></div>
  </div>
</template>
