<script setup>
import { CATEGORIES, dateFormatter, formatShortDate, money, sumItems } from "../utils/budget";

const props = defineProps({
  items: { type: Array, required: true },
  kind: { type: String, required: true },
  state: { type: Object, required: true },
  payment: { type: Object, default: null }
});
defineEmits(["add", "update", "remove"]);

const savingsGoals = computed(() => props.payment
  ? props.state.goals.filter(goal => !goal.closed && goal.payday === props.payment.payday)
  : []);
const total = computed(() => sumItems(props.items) + (props.payment?.goalAllocated || 0));
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div>
        <p class="eyebrow">Можно редактировать</p>
        <h2>{{ payment ? 'Расходы с выплаты ' + payment.payday + '-го' : 'Сейчас есть и на что' }}</h2>
        <p class="card-subtitle">{{ payment ? payment.period + ' · выплата ' + dateFormatter.format(payment.date) : 'Текущие остатки по конвертам и целям' }}</p>
      </div>
      <span class="pill">{{ items.length + savingsGoals.length }} поз.</span>
    </div>
    <div v-if="payment" class="stats" style="margin-bottom:20px">
      <BudgetStat label="Выплата" :value="payment.salary" :note="payment.days + ' рабочих дней'" />
      <BudgetStat label="Десятина" :value="payment.tithe" :note="state.settings.titheRate + '% от выплаты'" />
      <BudgetStat label="На цели с этой выплаты" :value="payment.goalAllocated" note="Выделено из зарплаты" />
      <BudgetStat label="После всех вычетов" :value="payment.afterGoals" note="Включая накопления на цели" :class="{ negative: payment.afterGoals < 0 }" />
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Название</th><th>Сумма, ₽</th><th>Категория</th><th></th></tr></thead>
        <tbody>
          <tr v-if="!items.length"><td colspan="4"><div class="empty">Пока нет ни одной позиции.</div></td></tr>
          <tr v-for="item in items" :key="item.id">
            <td><div class="name-with-check">
              <input v-if="kind === 'expenses'" class="paid-checkbox" type="checkbox" :aria-label="'Оплачено: ' + item.name" title="Оплачено" :checked="item.paidMonths?.includes(state.month)" @change="$emit('update', kind, item.id, 'paid', $event.target.checked)">
              <input class="name-input" :data-item-id="item.id" aria-label="Название" :value="item.name" @change="$emit('update', kind, item.id, 'name', $event.target.value)">
            </div></td>
            <td><input class="amount-input" type="number" min="0" step="1" aria-label="Сумма в рублях" :value="item.amount" @change="$emit('update', kind, item.id, 'amount', $event.target.value)"></td>
            <td><select class="category-select" aria-label="Категория" :value="item.category" @change="$emit('update', kind, item.id, 'category', $event.target.value)">
              <option v-for="(label, category) in CATEGORIES" :key="category" :value="category">{{ label }}</option>
            </select></td>
            <td><button class="icon-button delete-button" :aria-label="'Удалить ' + item.name" @click="$emit('remove', kind, item.id)">×</button></td>
          </tr>
          <tr v-for="goal in savingsGoals" :key="'goal-' + goal.id" class="planned-saving-row">
            <td><strong>Накопление: {{ goal.name }}</strong><small v-if="goal.dueDate">к {{ formatShortDate(goal.dueDate) }}</small></td>
            <td><input class="amount-input" type="number" min="0" step="1" :value="goal.planned" :aria-label="'Сколько отложить на ' + goal.name + ' с этой зарплаты'" @change="$emit('update', 'goals', goal.id, 'planned', $event.target.value)"></td>
            <td><span class="pill">Из целей</span></td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-footer">
      <button class="button secondary small" @click="$emit('add', kind, payment?.payday)">+ Добавить позицию</button>
      <div class="table-total">Итого<strong>{{ money(total) }}</strong></div>
    </div>
  </section>
</template>
