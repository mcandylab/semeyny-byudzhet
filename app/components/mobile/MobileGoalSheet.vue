<script setup>
import { fmt, goals, month } from "~/utils/mobile-mock";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const isNew = Boolean(props.data?.isNew);
const goal = isNew
  ? { name: "", target: 0, saved: 0, planned: 0, payday: 0, due: "", dueDate: "" }
  : props.data || goals[0];
const form = reactive({
  name: goal.name,
  target: goal.target ? fmt(goal.target) : "",
  saved: goal.saved ? fmt(goal.saved) : "",
  planned: goal.planned,
  payday: goal.payday
});
const confirming = ref("");
const covered = computed(() => goal.saved + form.planned);
const percent = computed(() => goal.target ? Math.min(100, Math.round(covered.value / goal.target * 100)) : 0);
const savedWidth = computed(() => goal.target ? Math.min(100, goal.saved / goal.target * 100) : 0);
const plannedWidth = computed(() => goal.target ? Math.min(100 - savedWidth.value, form.planned / goal.target * 100) : 0);
const paydayOptions = [{ value: 0, label: "Не выбрано" }, { value: 20, label: "20-го" }, { value: 5, label: "5-го" }];

function step(delta) {
  form.planned = Math.max(0, form.planned + delta);
}

function act(kind) {
  if (confirming.value !== kind) {
    confirming.value = kind;
    return;
  }
  emit("done", kind === "close" ? `Цель «${goal.name}» закрыта` : `Цель «${goal.name}» удалена`);
}
</script>

<template>
  <MobileSheet :title="isNew ? 'Новая цель' : goal.name" :eyebrow="isNew ? 'Планы и накопления' : goal.due" tall @close="$emit('close')">
    <div v-if="!isNew" class="m-goal-sheet-head">
      <div class="m-goal-sheet-amount">
        <b><MobileMoney :value="covered" /></b><span>из {{ fmt(goal.target) }} ₽</span><em>{{ percent }}%</em>
      </div>
      <span class="m-goal-bar m-goal-bar--lg">
        <i class="m-goal-saved" :style="{ width: savedWidth + '%' }" />
        <i class="m-goal-planned" :style="{ width: plannedWidth + '%' }" />
      </span>
      <div class="m-goal-legend">
        <span><i class="m-legend-dot" style="background: var(--m-purple-light)" />Отложено {{ fmt(goal.saved) }} ₽</span>
        <span><i class="m-legend-dot" style="background: var(--m-cyan)" />В {{ month.prepositional }} {{ fmt(form.planned) }} ₽</span>
      </div>
    </div>

    <label class="m-field">
      <span class="m-field-label">Название</span>
      <input v-model="form.name" class="m-input" placeholder="Например, отпуск">
    </label>
    <div class="m-field-grid">
      <label class="m-field">
        <span class="m-field-label">Нужно всего</span>
        <span class="m-input-suffix"><input v-model="form.target" class="m-input" inputmode="numeric" placeholder="0"><span>₽</span></span>
      </label>
      <label class="m-field">
        <span class="m-field-label">Уже отложено</span>
        <span class="m-input-suffix"><input v-model="form.saved" class="m-input" inputmode="numeric" placeholder="0"><span>₽</span></span>
      </label>
    </div>

    <div class="m-field">
      <span class="m-field-label">Отложить в {{ month.prepositional }}</span>
      <div class="m-big-stepper">
        <button type="button" aria-label="Уменьшить на 1 000 ₽" @click="step(-1000)"><MobileIcon name="minus" /></button>
        <b><MobileMoney :value="form.planned" /></b>
        <button type="button" aria-label="Увеличить на 1 000 ₽" @click="step(1000)"><MobileIcon name="plus" /></button>
      </div>
      <div class="m-quick">
        <button v-for="value in [1000, 5000, 10000]" :key="value" type="button" class="m-chip m-chip--button" @click="step(value)">+{{ fmt(value) }} ₽</button>
      </div>
    </div>

    <div class="m-field">
      <span class="m-field-label">С какой выплаты откладывать</span>
      <div class="m-segment">
        <button v-for="option in paydayOptions" :key="option.value" type="button" :class="{ on: form.payday === option.value }" :aria-pressed="form.payday === option.value" @click="form.payday = option.value">{{ option.label }}</button>
      </div>
    </div>

    <div class="m-field">
      <span class="m-field-label">Срок</span>
      <button class="m-input m-input--button" type="button">
        <MobileIcon name="calendar" :size="20" /><span>{{ goal.dueDate || 'Без срока' }}</span><MobileIcon name="chevron-right" :size="18" />
      </button>
    </div>

    <div v-if="!isNew" class="m-sheet-links">
      <button class="m-text-btn" type="button" @click="act('close')">
        <MobileIcon name="archive" :size="20" />{{ confirming === 'close' ? 'Нажмите ещё раз: цель перестанет учитываться в планах' : 'Закрыть цель' }}
      </button>
      <button class="m-text-btn m-text-btn--danger" type="button" @click="act('delete')">
        <MobileIcon name="trash" :size="20" />{{ confirming === 'delete' ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить цель' }}
      </button>
    </div>

    <template #footer>
      <button class="m-btn m-btn--primary" type="button" @click="$emit('done', isNew ? 'Цель добавлена' : 'Цель сохранена')">Сохранить</button>
    </template>
  </MobileSheet>
</template>
