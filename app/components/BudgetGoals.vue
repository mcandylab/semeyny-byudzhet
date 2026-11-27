<script setup>
import { money } from "../utils/budget";

defineProps({
  goals: { type: Array, required: true },
  calc: { type: Object, required: true }
});
defineEmits(["add", "update", "remove", "close"]);

const amounts = [
  { field: "target", label: "Нужно, ₽", description: "Нужно для цели" },
  { field: "saved", label: "Уже отложено, ₽", description: "Уже отложено" },
  { field: "planned", label: "Отложить с этой ЗП, ₽", description: "Сколько отложить с выбранной зарплаты" }
];
</script>

<template>
  <section>
    <div class="stats">
      <BudgetStat label="На активные цели" :value="calc.goalTarget" :note="calc.goalCount + ' целей'" class="accent" />
      <BudgetStat label="Уже отложено" :value="calc.goalSaved" note="Деньги уже есть" />
      <BudgetStat label="Выделяем сейчас" :value="calc.goalAllocated" note="Из свободного остатка" />
      <BudgetStat label="Ещё нужно собрать" :value="calc.goalRemaining" note="После всех выделений" />
    </div>
    <div class="notice" :class="{ negative: calc.unassigned < 0 }">
      <span class="notice-dot"></span>
      <div>
        <strong>Свободно после расходов и десятины: {{ money(calc.free) }}.</strong>
        {{ calc.unassigned >= 0
          ? 'После выделения на цели останется нераспределёнными ' + money(calc.unassigned) + '.'
          : 'Распределено на ' + money(Math.abs(calc.unassigned)) + ' больше, чем есть свободных денег.' }}
        <template v-if="calc.goalWithoutPayday > 0"><br>На {{ money(calc.goalWithoutPayday) }} ещё не выбрана зарплата.</template>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Планы и накопления</p><h2>На что нужны деньги</h2><p class="card-subtitle">Колонка «Отложить с этой ЗП» уменьшает выбранную выплату. Закрытая цель не учитывается в активных суммах.</p></div><span class="pill">{{ calc.goalCount }} активных</span></div>
      <div class="table-wrap">
        <table class="goals-table">
          <thead><tr><th>Цель</th><th>Дата</th><th>С какой ЗП</th><th v-for="amount in amounts" :key="amount.field">{{ amount.label }}</th><th>Остаётся собрать</th><th></th></tr></thead>
          <tbody>
            <tr v-if="!goals.length"><td colspan="8"><div class="empty">Пока нет ни одной цели.</div></td></tr>
            <tr v-for="goal in goals" :key="goal.id" :class="{ 'goal-closed-row': goal.closed }">
              <td><input class="name-input" :data-item-id="goal.id" aria-label="Название цели" :value="goal.name" @change="$emit('update', 'goals', goal.id, 'name', $event.target.value)"></td>
              <td><input class="settings-input" type="date" aria-label="Дата цели" :value="goal.dueDate" @change="$emit('update', 'goals', goal.id, 'dueDate', $event.target.value)"></td>
              <td><GoalPaydaySelect class="category-select" :value="goal.payday" @change="$emit('update', 'goals', goal.id, 'payday', $event)" /></td>
              <td v-for="amount in amounts" :key="amount.field"><input class="amount-input" type="number" min="0" step="1" :aria-label="amount.description" :value="goal[amount.field]" @change="$emit('update', 'goals', goal.id, amount.field, $event.target.value)"></td>
              <td class="goal-remaining"><GoalStatus :goal="goal" /></td>
              <td><div class="row-actions">
                <button class="button ghost small" @click="$emit('close', goal.id)">{{ goal.closed ? 'Открыть' : 'Закрыть' }}</button>
                <button class="icon-button delete-button" :aria-label="'Удалить ' + goal.name" @click="$emit('remove', 'goals', goal.id)">×</button>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="goal-cards">
        <div v-if="!goals.length" class="empty">Добавьте первую цель.</div>
        <article v-for="goal in goals" :key="goal.id" class="goal-mobile-card" :class="{ 'goal-closed-row': goal.closed }">
          <label class="field"><span class="field-label">Цель</span><input class="settings-input" :data-item-id="goal.id" aria-label="Название цели" :value="goal.name" @change="$emit('update', 'goals', goal.id, 'name', $event.target.value)"></label>
          <div class="goal-mobile-grid">
            <label class="field"><span class="field-label">Дата</span><input class="settings-input" type="date" aria-label="Дата цели" :value="goal.dueDate" @change="$emit('update', 'goals', goal.id, 'dueDate', $event.target.value)"></label>
            <label class="field"><span class="field-label">С какой ЗП</span><GoalPaydaySelect class="settings-input" :value="goal.payday" @change="$emit('update', 'goals', goal.id, 'payday', $event)" /></label>
            <label v-for="amount in amounts" :key="amount.field" class="field"><span class="field-label">{{ amount.label }}</span><input class="amount-input settings-input" type="number" min="0" step="1" :aria-label="amount.description" :value="goal[amount.field]" @change="$emit('update', 'goals', goal.id, amount.field, $event.target.value)"></label>
          </div>
          <div class="goal-mobile-footer">
            <div class="goal-remaining"><span class="field-label">Остаётся собрать</span><GoalStatus :goal="goal" /></div>
            <div class="row-actions">
              <button class="button secondary small" @click="$emit('close', goal.id)">{{ goal.closed ? 'Открыть' : 'Закрыть' }}</button>
              <button class="button danger small" @click="$emit('remove', 'goals', goal.id)">Удалить</button>
            </div>
          </div>
        </article>
      </div>
      <div class="table-footer">
        <button class="button secondary small" @click="$emit('add', 'goals')">+ Добавить цель</button>
        <div class="table-total">Сумма активных целей<strong>{{ money(calc.goalTarget) }}</strong></div>
      </div>
    </div>
  </section>
</template>
