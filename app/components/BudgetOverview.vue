<script setup>
import { CATEGORIES, money } from "../utils/budget";

const props = defineProps({
  state: { type: Object, required: true },
  calc: { type: Object, required: true },
  shared: Boolean
});
defineEmits(["select-tab", "update-note"]);

const categories = computed(() => {
  const totals = {};
  for (const item of props.state.expenses) {
    totals[item.category] = (totals[item.category] || 0) + Number(item.amount || 0);
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
});
const max = computed(() => categories.value[0]?.[1] || 1);
</script>

<template>
  <section>
    <div class="stats">
      <BudgetStat label="Зарплата за месяц" :value="calc.salary" :note="calc.workdays.total + ' рабочих дней'" class="accent" />
      <BudgetStat label="Постоянные расходы" :value="calc.expenses" note="Обе выплаты вместе" />
      <BudgetStat label="Десятина" :value="calc.tithe" :note="state.settings.titheRate + '% от каждой выплаты'" />
      <BudgetStat label="Свободный остаток" :value="calc.free" note="Можно распределить на цели" :class="{ negative: calc.free < 0 }" />
    </div>
    <div class="notice"><span class="notice-dot"></span><div><strong>Сейчас в конвертах и на целях: {{ money(calc.balances) }}.</strong> Это уже имеющиеся деньги, они не прибавляются к свободному остатку от будущей зарплаты.</div></div>
    <template v-if="state.creditNote">
      <div class="section-heading"><div><h2>Мужу: порядок действий с кредитками</h2><p>Долги, лимиты и схема беспроцентного погашения</p></div><span class="pill gold">Важно</span></div>
      <div class="card credit-note-card">
        <textarea class="comment-input" aria-label="Комментарий для мужа о кредитках" :value="state.creditNote" @change="$emit('update-note', $event.target.value)"></textarea>
        <p class="comment-hint">{{ shared ? "Текст можно редактировать. Изменения автоматически появятся на обоих устройствах." : "Текст можно редактировать. Чтобы передать изменение, создайте новую ссылку." }}</p>
      </div>
    </template>
    <div class="grid-two">
      <PaydayCard v-for="payment in [calc.p20, calc.p5]" :key="payment.payday" :payment="payment" :settings="state.settings" :total-workdays="calc.workdays.total" @open="$emit('select-tab', $event)" />
    </div>
    <div class="section-heading"><div><h2>На что нужны деньги</h2><p>Цели, накопления и распределение свободного остатка</p></div><button class="button ghost small" @click="$emit('select-tab', 'goals')">Открыть цели</button></div>
    <div class="card goal-summary">
      <div><span>Общая сумма целей</span><strong>{{ money(calc.goalTarget) }}</strong></div>
      <div><span>Уже отложено</span><strong>{{ money(calc.goalSaved) }}</strong></div>
      <div><span>Выделяем из свободных</span><strong>{{ money(calc.goalAllocated) }}</strong></div>
      <div><span>Ещё нужно собрать</span><strong>{{ money(calc.goalRemaining) }}</strong></div>
    </div>
    <div class="section-heading"><div><h2>Куда уходит зарплата</h2><p>Регулярные расходы по категориям, без десятины</p></div><span class="pill gold">Всего {{ money(calc.expenses) }}</span></div>
    <div class="card">
      <div v-if="categories.length" class="category-list">
        <div v-for="[category, amount] in categories" :key="category" class="category-row">
          <span>{{ CATEGORIES[category] }}</span><div class="category-track"><span :style="{ width: amount / max * 100 + '%' }"></span></div><strong>{{ money(amount) }}</strong>
        </div>
      </div>
      <div v-else class="empty">Добавьте расходы, чтобы увидеть распределение по категориям.</div>
    </div>
  </section>
</template>
