<script setup>
import { fmt, longDate, monthInfo, plural } from "~/utils/family";

defineEmits(["go", "open"]);

const budget = useFamilyBudget();
const calc = computed(() => budget.calc);
const month = computed(() => monthInfo(budget.month));
const showClosed = ref(false);

const R = 38;
const C = 2 * Math.PI * R;
const saved = computed(() => budget.goals.reduce((total, goal) => total + goal.saved, 0));
const part = value => (calc.value.goalTarget ? Math.min(1, value / calc.value.goalTarget) * C : 0);
const savedLength = computed(() => part(saved.value));
const plannedLength = computed(() => Math.min(part(calc.value.goalAllocated), C - savedLength.value));
const percent = computed(() => (calc.value.goalTarget ? Math.min(100, Math.round((saved.value + calc.value.goalAllocated) / calc.value.goalTarget * 100)) : 0));
const withoutPayday = computed(() => budget.goals.find(goal => !goal.payday && goal.planned > 0));

const width = (value, goal) => `${goal.target ? Math.min(100, value / goal.target * 100) : 0}%`;
const rest = goal => Math.max(0, goal.target - goal.saved - goal.planned);
const due = goal => (goal.dueDate ? `к ${longDate(goal.dueDate)}` : "Без срока");
</script>

<template>
  <div class="m-page">
    <header class="m-top m-top--simple">
      <h1 class="m-h1"><b>Цели</b></h1>
      <button class="m-icon-btn m-icon-btn--purple" type="button" aria-label="Новая цель" @click="$emit('open', 'goal', { isNew: true })"><MobileIcon name="plus" /></button>
    </header>

    <section class="m-goal-hero">
      <div class="m-ring">
        <svg viewBox="0 0 92 92" aria-hidden="true">
          <circle cx="46" cy="46" :r="R" fill="none" stroke="var(--m-surface-3)" stroke-width="10" />
          <circle v-if="savedLength" cx="46" cy="46" :r="R" fill="none" stroke="var(--m-purple)" stroke-width="10" stroke-linecap="round" :stroke-dasharray="`${savedLength} ${C}`" transform="rotate(-90 46 46)" />
          <circle v-if="plannedLength > 0" cx="46" cy="46" :r="R" fill="none" stroke="var(--m-cyan)" stroke-width="10" stroke-linecap="round" :stroke-dasharray="`${plannedLength} ${C}`" :stroke-dashoffset="-savedLength - 4" transform="rotate(-90 46 46)" />
        </svg>
        <span class="m-ring-value">{{ percent }}%</span>
      </div>
      <div class="m-goal-hero-text">
        <p class="m-label">Ещё нужно <b>собрать</b></p>
        <p class="m-display m-display--md"><MobileMoney :value="calc.goalRemaining" /></p>
        <p class="m-muted">из {{ fmt(calc.goalTarget) }} ₽ на {{ plural(calc.goalCount, ['цель', 'цели', 'целей']) }}</p>
      </div>
    </section>

    <div class="m-kpis">
      <div class="m-kpi"><span><i class="m-legend-dot" style="background: var(--m-purple)" />Уже отложено</span><b><MobileMoney :value="saved" /></b></div>
      <div class="m-kpi"><span><i class="m-legend-dot" style="background: var(--m-cyan)" />В {{ month.prepositional }}</span><b><MobileMoney :value="calc.goalAllocated" /></b></div>
    </div>

    <div class="m-callout" :class="{ 'm-callout--warn': calc.unassigned < 0 }">
      <MobileIcon :name="calc.unassigned < 0 ? 'alert' : 'info'" :size="20" />
      <p v-if="calc.unassigned >= 0"><b>Свободно после расходов и десятины: {{ fmt(calc.free) }} ₽.</b> После целей останется нераспределёнными {{ fmt(calc.unassigned) }} ₽.</p>
      <p v-else><b>Свободно после расходов и десятины: {{ fmt(calc.free) }} ₽.</b> На цели выделено на {{ fmt(calc.unassigned) }} ₽ больше, чем есть свободных денег.</p>
    </div>
    <button v-if="withoutPayday" class="m-callout m-callout--warn" type="button" @click="$emit('open', 'goal', withoutPayday)">
      <MobileIcon name="alert" :size="20" />
      <p><b>{{ fmt(calc.goalWithoutPayday) }} ₽ без выплаты.</b> Выберите, с какой зарплаты откладывать на «{{ withoutPayday.name }}».</p>
      <MobileIcon name="chevron-right" :size="18" />
    </button>

    <div class="m-section-head">
      <h2 class="m-h2">Активные <b>цели</b></h2>
      <span class="m-muted">{{ budget.goals.length }}</span>
    </div>
    <ul v-if="budget.goals.length" class="m-goal-list">
      <li v-for="(goal, index) in budget.goals" :key="goal.id">
        <button class="m-goal" :class="{ 'm-goal--featured m-pattern': index === 0 }" type="button" @click="$emit('open', 'goal', goal)">
          <span class="m-goal-top">
            <span class="m-goal-icon"><MobileIcon name="target" /></span>
            <span class="m-goal-name">{{ goal.name }}<small>{{ due(goal) }}</small></span>
            <span class="m-chip m-chip--sm" :class="{ 'm-chip--warn': !goal.payday && goal.planned }">{{ goal.payday ? `ЗП ${goal.payday}-го` : 'Без выплаты' }}</span>
          </span>
          <span class="m-goal-amounts"><b><MobileMoney :value="goal.saved + goal.planned" /></b><span>из {{ fmt(goal.target) }} ₽</span></span>
          <span class="m-goal-bar">
            <i class="m-goal-saved" :style="{ width: width(goal.saved, goal) }" />
            <i class="m-goal-planned" :style="{ width: width(goal.planned, goal) }" />
          </span>
          <span class="m-goal-foot"><span>+{{ fmt(goal.planned) }} ₽ в {{ month.prepositional }}</span><span>Осталось {{ fmt(rest(goal)) }} ₽</span></span>
        </button>
      </li>
    </ul>
    <p v-else class="m-empty">Активных целей нет. Плюс вверху добавляет новую.</p>

    <template v-if="budget.closedGoals.length">
      <button class="m-disclosure" type="button" :aria-expanded="showClosed" @click="showClosed = !showClosed">
        <span>Закрытые цели · {{ budget.closedGoals.length }}</span>
        <MobileIcon :name="showClosed ? 'chevron-up' : 'chevron-down'" :size="20" />
      </button>
      <ul v-if="showClosed" class="m-list m-list--card">
        <li v-for="goal in budget.closedGoals" :key="goal.id" class="m-row is-done">
          <span class="m-row-icon m-row-icon--sm" style="color: var(--m-green)"><MobileIcon name="check" :size="20" /></span>
          <button class="m-row-main" type="button" @click="$emit('open', 'goal', goal)">
            <span class="m-row-title">{{ goal.name }}</span>
            <span class="m-row-meta">Закрыта {{ longDate(goal.closedAt) }} · <MobileMoney :value="goal.target" /></span>
          </button>
          <button class="m-chip m-chip--button m-chip--sm" type="button" @click="budget.setGoalClosed(goal.id, false)">Открыть</button>
        </li>
      </ul>
    </template>
  </div>
</template>
