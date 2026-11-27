<script setup>
import { categoryTotals, month, paydays, plural, summary } from "~/utils/mobile-mock";

defineEmits(["go", "open"]);

const share = value => Math.round(value / summary.expenses * 100);
const salaryShare = Math.round(summary.expenses / summary.salary * 100);
const payShare = key => Math.round(paydays[key].expenses / paydays[key].salary * 100);
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
      <p class="m-display"><MobileMoney :value="summary.expenses" /></p>
      <p class="m-muted">{{ salaryShare }}% зарплаты · без десятины</p>
      <div class="m-bar m-bar--lg m-mt">
        <i v-for="item in categoryTotals" :key="item.key" :style="{ flexGrow: item.amount, background: item.color }" />
      </div>
    </section>

    <div class="m-split">
      <button v-for="key in [20, 5]" :key="key" class="m-split-card" type="button" @click="$emit('go', 'payday', { payday: key })">
        <span class="m-muted">С выплаты {{ key }}-го</span>
        <b><MobileMoney :value="paydays[key].expenses" /></b>
        <span class="m-mini-bar" :class="'m-mini-bar--' + paydays[key].tone"><i :style="{ width: payShare(key) + '%' }" /></span>
        <small>{{ payShare(key) }}% выплаты</small>
      </button>
    </div>

    <div class="m-section-head">
      <h2 class="m-h2">По <b>категориям</b></h2>
      <span class="m-muted">{{ categoryTotals.length }}</span>
    </div>
    <ul class="m-list">
      <li v-for="item in categoryTotals" :key="item.key" class="m-row">
        <span class="m-row-icon" :style="{ color: item.color }"><MobileIcon :name="item.icon" /></span>
        <span class="m-row-main">
          <span class="m-row-title">{{ item.label }}</span>
          <span class="m-row-meta">{{ plural(item.count, ['позиция', 'позиции', 'позиций']) }} · {{ share(item.amount) }}%</span>
        </span>
        <span class="m-row-amount"><MobileMoney :value="item.amount" /></span>
      </li>
    </ul>
  </div>
</template>
