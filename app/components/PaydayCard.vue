<script setup>
import { dateFormatter, dateKey, money } from "../utils/budget";

const props = defineProps({
  payment: { type: Object, required: true },
  settings: { type: Object, required: true },
  totalWorkdays: { type: Number, required: true }
});
defineEmits(["open"]);

const spent = computed(() => props.payment.expenses + props.payment.tithe + props.payment.goalAllocated);
const percent = computed(() => props.payment.salary > 0 ? Math.min(100, spent.value / props.payment.salary * 100) : 0);
const moved = computed(() => dateKey(props.payment.date) !== dateKey(props.payment.nominalDate));
</script>

<template>
  <article class="card">
    <div class="card-head">
      <div><p class="eyebrow">{{ payment.period }}</p><h2>{{ dateFormatter.format(payment.date) }}</h2></div>
      <span class="pill">{{ payment.days }} раб. дн.</span>
    </div>
    <div class="big-money">{{ money(payment.salary) }}</div>
    <div class="card-subtitle">
      Формула: {{ money(settings.salary) }} ÷ {{ totalWorkdays }} × {{ payment.days }}
      <template v-if="moved"><br>Оплата перенесена на последний рабочий день перед {{ payment.payday }}-м числом.</template>
    </div>
    <div class="meter" :class="{ over: spent > payment.salary }"><span :style="{ width: percent + '%' }"></span></div>
    <div class="meter-note">Распределено {{ money(spent) }} из {{ money(payment.salary) }}</div>
    <div class="breakdown" style="margin-top:18px">
      <div class="breakdown-row"><span>Расходы</span><strong>− {{ money(payment.expenses) }}</strong></div>
      <div class="breakdown-row"><span>Десятина ({{ settings.titheRate }}%)</span><strong>− {{ money(payment.tithe) }}</strong></div>
      <div class="breakdown-row"><span>Откладываем на цели</span><strong>− {{ money(payment.goalAllocated) }}</strong></div>
      <div class="breakdown-row total" :class="{ negative: payment.afterGoals < 0 }"><span>Остаётся после целей</span><strong>{{ money(payment.afterGoals) }}</strong></div>
    </div>
    <button class="button ghost small" style="margin-top:18px" @click="$emit('open', 'pay' + payment.payday)">Открыть список расходов</button>
  </article>
</template>
