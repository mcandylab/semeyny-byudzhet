<script setup>
import { closedGoals, fmt, goals, goalSummary, summary } from "~/utils/mobile-mock";

defineEmits(["go", "open"]);

const R = 38;
const C = 2 * Math.PI * R;
const savedLength = goalSummary.saved / goalSummary.target * C;
const plannedLength = goalSummary.planned / goalSummary.target * C;
const percent = Math.round((goalSummary.saved + goalSummary.planned) / goalSummary.target * 100);
const showClosed = ref(false);
const withoutPayday = goals.find(goal => !goal.payday);

const width = (value, goal) => `${Math.min(100, value / goal.target * 100)}%`;
const rest = goal => Math.max(0, goal.target - goal.saved - goal.planned);
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
          <circle cx="46" cy="46" :r="R" fill="none" stroke="var(--m-purple)" stroke-width="10" stroke-linecap="round" :stroke-dasharray="`${savedLength} ${C}`" transform="rotate(-90 46 46)" />
          <circle cx="46" cy="46" :r="R" fill="none" stroke="var(--m-cyan)" stroke-width="10" stroke-linecap="round" :stroke-dasharray="`${plannedLength} ${C}`" :stroke-dashoffset="-savedLength - 4" transform="rotate(-90 46 46)" />
        </svg>
        <span class="m-ring-value">{{ percent }}%</span>
      </div>
      <div class="m-goal-hero-text">
        <p class="m-label">Ещё нужно <b>собрать</b></p>
        <p class="m-display m-display--md"><MobileMoney :value="goalSummary.remaining" /></p>
        <p class="m-muted">из {{ fmt(goalSummary.target) }} ₽ на {{ goalSummary.count }} цели</p>
      </div>
    </section>

    <div class="m-kpis">
      <div class="m-kpi"><span><i class="m-legend-dot" style="background: var(--m-purple)" />Уже отложено</span><b><MobileMoney :value="goalSummary.saved" /></b></div>
      <div class="m-kpi"><span><i class="m-legend-dot" style="background: var(--m-cyan)" />В ноябре</span><b><MobileMoney :value="goalSummary.planned" /></b></div>
    </div>

    <div class="m-callout">
      <MobileIcon name="info" :size="20" />
      <p><b>Свободно после расходов и десятины: {{ fmt(summary.free) }} ₽.</b> После целей останется нераспределёнными {{ fmt(summary.unassigned) }} ₽.</p>
    </div>
    <button class="m-callout m-callout--warn" type="button" @click="$emit('open', 'goal', withoutPayday)">
      <MobileIcon name="alert" :size="20" />
      <p><b>{{ fmt(goalSummary.withoutPayday) }} ₽ без выплаты.</b> Выберите, с какой зарплаты откладывать на «{{ withoutPayday.name }}».</p>
      <MobileIcon name="chevron-right" :size="18" />
    </button>

    <div class="m-section-head">
      <h2 class="m-h2">Активные <b>цели</b></h2>
      <span class="m-muted">{{ goals.length }}</span>
    </div>
    <ul class="m-goal-list">
      <li v-for="(goal, index) in goals" :key="goal.id">
        <button class="m-goal" :class="{ 'm-goal--featured m-pattern': index === 0 }" type="button" @click="$emit('open', 'goal', goal)">
          <span class="m-goal-top">
            <span class="m-goal-icon"><MobileIcon :name="goal.icon" /></span>
            <span class="m-goal-name">{{ goal.name }}<small>{{ goal.due }}</small></span>
            <span class="m-chip m-chip--sm" :class="{ 'm-chip--warn': !goal.payday }">{{ goal.payday ? `ЗП ${goal.payday}-го` : 'Без выплаты' }}</span>
          </span>
          <span class="m-goal-amounts"><b><MobileMoney :value="goal.saved + goal.planned" /></b><span>из {{ fmt(goal.target) }} ₽</span></span>
          <span class="m-goal-bar">
            <i class="m-goal-saved" :style="{ width: width(goal.saved, goal) }" />
            <i class="m-goal-planned" :style="{ width: width(goal.planned, goal) }" />
          </span>
          <span class="m-goal-foot"><span>+{{ fmt(goal.planned) }} ₽ в ноябре</span><span>Осталось {{ fmt(rest(goal)) }} ₽</span></span>
        </button>
      </li>
    </ul>

    <button class="m-disclosure" type="button" :aria-expanded="showClosed" @click="showClosed = !showClosed">
      <span>Закрытые цели · {{ closedGoals.length }}</span>
      <MobileIcon :name="showClosed ? 'chevron-up' : 'chevron-down'" :size="20" />
    </button>
    <ul v-if="showClosed" class="m-list m-list--card">
      <li v-for="goal in closedGoals" :key="goal.id" class="m-row is-done">
        <span class="m-row-icon m-row-icon--sm" style="color: var(--m-green)"><MobileIcon name="check" :size="20" /></span>
        <span class="m-row-main">
          <span class="m-row-title">{{ goal.name }}</span>
          <span class="m-row-meta">{{ goal.closedAt }} · <MobileMoney :value="goal.target" /></span>
        </span>
        <button class="m-chip m-chip--button m-chip--sm" type="button">Открыть</button>
      </li>
    </ul>
  </div>
</template>
