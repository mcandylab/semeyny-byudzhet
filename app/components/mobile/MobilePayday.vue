<script setup>
import { CATEGORY_META, expenses, fmt, goals, month, paydays, summary } from "~/utils/mobile-mock";

const props = defineProps({ payday: { type: Number, default: 20 } });
defineEmits(["go", "open"]);

const pay = computed(() => paydays[props.payday]);
const items = computed(() => expenses.filter(item => item.payday === props.payday));
const savings = computed(() => goals.filter(goal => goal.payday === props.payday));
const paid = reactive(new Set(expenses.filter(item => item.paid).map(item => item.id)));
const paidCount = computed(() => items.value.filter(item => paid.has(item.id)).length);
const bar = computed(() => [
  { key: "expenses", label: "Расходы", value: pay.value.expenses, color: "var(--m-purple)" },
  { key: "tithe", label: `Десятина ${summary.titheRate}%`, value: pay.value.tithe, color: "var(--m-white)" },
  { key: "goals", label: "На цели", value: pay.value.goals, color: "var(--m-cyan)" }
]);

function toggle(id) {
  if (paid.has(id)) paid.delete(id);
  else paid.add(id);
}
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

    <section class="m-pay-hero m-pattern" :class="'m-pay-hero--' + pay.tone">
      <div class="m-pay-hero-top">
        <span>{{ pay.date }}, {{ pay.weekday }}</span>
        <span class="m-pay-hero-chip">{{ pay.days }} раб. дней</span>
      </div>
      <p class="m-pay-hero-amount"><MobileMoney :value="pay.salary" /></p>
      <p class="m-pay-hero-period">За {{ pay.period }}</p>
      <span class="m-pay-hero-chip m-pay-hero-formula">{{ fmt(summary.salary) }} ÷ {{ summary.workdays }} × {{ pay.days }}</span>
      <p v-if="pay.moved" class="m-pay-hero-note"><MobileIcon name="info" :size="16" />{{ pay.moved }}</p>
    </section>

    <section class="m-card m-mt">
      <div class="m-card-row">
        <span class="m-label"><b>Распределено</b></span>
        <span class="m-muted">{{ fmt(pay.salary - pay.after) }} из {{ fmt(pay.salary) }} ₽</span>
      </div>
      <div class="m-bar m-bar--lg">
        <i v-for="part in bar" :key="part.key" :style="{ flexGrow: part.value, background: part.color }" />
        <i class="m-bar-rest" :style="{ flexGrow: pay.after }" />
      </div>
      <ul class="m-legend">
        <li v-for="part in bar" :key="part.key">
          <i class="m-legend-dot" :style="{ background: part.color }" />{{ part.label }}
          <span><MobileMoney :value="part.value" sign="−" /></span>
        </li>
        <li class="m-legend-total">Остаётся после целей<span class="m-plus"><MobileMoney :value="pay.after" /></span></li>
      </ul>
    </section>

    <div class="m-section-head">
      <h2 class="m-h2"><b>Расходы</b> · {{ items.length }}</h2>
      <span class="m-muted">Оплачено {{ paidCount }} из {{ items.length }}</span>
    </div>
    <ul class="m-list m-list--card">
      <li v-for="item in items" :key="item.id" class="m-row" :class="{ 'is-done': paid.has(item.id) }">
        <button
          class="m-check"
          type="button"
          role="checkbox"
          :aria-checked="paid.has(item.id)"
          :aria-label="'Оплачено: ' + item.name"
          @click="toggle(item.id)"
        >
          <span><MobileIcon name="check" :size="16" /></span>
        </button>
        <button class="m-row-main" type="button" @click="$emit('open', 'expense', item)">
          <span class="m-row-title">{{ item.name }}</span>
          <span class="m-row-meta"><i class="m-cat-dot" :style="{ background: CATEGORY_META[item.category].color }" />{{ CATEGORY_META[item.category].label }}</span>
        </button>
        <span class="m-row-amount"><MobileMoney :value="item.amount" /></span>
      </li>
    </ul>

    <template v-if="savings.length">
      <div class="m-section-head">
        <h2 class="m-h2">Откладываем <b>на цели</b></h2>
        <button class="m-link" type="button" @click="$emit('go', 'goals')">Все цели<MobileIcon name="chevron-right" :size="18" /></button>
      </div>
      <ul class="m-list m-list--card">
        <li v-for="goal in savings" :key="goal.id" class="m-row">
          <span class="m-row-icon m-row-icon--sm" style="color: var(--m-cyan)"><MobileIcon :name="goal.icon" :size="20" /></span>
          <button class="m-row-main" type="button" @click="$emit('open', 'goal', goal)">
            <span class="m-row-title">{{ goal.name }}</span>
            <span class="m-row-meta">{{ goal.due }}</span>
          </button>
          <span class="m-row-amount"><MobileMoney :value="goal.planned" /></span>
        </li>
      </ul>
    </template>

    <button class="m-add-row" type="button" @click="$emit('open', 'expense', { isNew: true, payday })">
      <MobileIcon name="plus" :size="20" />Добавить расход
    </button>
    <div class="m-total"><span>Итого с выплаты</span><b><MobileMoney :value="pay.expenses + pay.goals" /></b></div>
  </div>
</template>
