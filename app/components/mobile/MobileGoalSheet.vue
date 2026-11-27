<script setup>
import { fmt, longDate, monthInfo, parseAmount } from "~/utils/family";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const month = computed(() => monthInfo(budget.month));
const goal = props.data?.id ? props.data : null;
const form = reactive({
  name: goal?.name || "",
  target: goal?.target ? fmt(goal.target) : "",
  saved: goal?.saved ? fmt(goal.saved) : "",
  planned: goal?.planned || 0,
  payday: goal?.payday || 0,
  dueDate: goal?.dueDate || ""
});
const confirming = ref("");
const busy = ref(false);

const target = computed(() => parseAmount(form.target));
const saved = computed(() => parseAmount(form.saved));
const covered = computed(() => saved.value + form.planned);
const percent = computed(() => (target.value ? Math.min(100, Math.round(covered.value / target.value * 100)) : 0));
const savedWidth = computed(() => (target.value ? Math.min(100, saved.value / target.value * 100) : 0));
const plannedWidth = computed(() => (target.value ? Math.min(100 - savedWidth.value, form.planned / target.value * 100) : 0));
const paydayOptions = [{ value: 0, label: "Не выбрано" }, { value: 20, label: "20-го" }, { value: 5, label: "5-го" }];
const canSave = computed(() => form.name.trim() && !busy.value);

function step(delta) {
  form.planned = Math.max(0, form.planned + delta);
}

function openPicker(event) {
  try {
    event.target.showPicker?.();
  } catch {}
}

async function save() {
  if (!canSave.value) return;
  busy.value = true;
  const done = await budget.saveGoal({ id: goal?.id, ...form, target: target.value, saved: saved.value });
  busy.value = false;
  if (done) emit("done", goal ? "Цель сохранена" : "Цель добавлена");
}

async function act(kind) {
  if (kind !== "reopen" && confirming.value !== kind) {
    confirming.value = kind;
    return;
  }
  busy.value = true;
  const done = kind === "delete" ? await budget.deleteGoal(goal.id) : await budget.setGoalClosed(goal.id, kind === "close");
  busy.value = false;
  if (done) emit("done", { close: `Цель «${goal.name}» закрыта`, reopen: `Цель «${goal.name}» снова активна`, delete: `Цель «${goal.name}» удалена` }[kind]);
}
</script>

<template>
  <MobileSheet :title="goal ? goal.name : 'Новая цель'" :eyebrow="goal?.closed ? 'Закрытая цель' : goal ? (goal.dueDate ? `к ${longDate(goal.dueDate)}` : 'Без срока') : 'Планы и накопления'" tall @close="$emit('close')">
    <div v-if="target" class="m-goal-sheet-head">
      <div class="m-goal-sheet-amount">
        <b><MobileMoney :value="covered" /></b><span>из {{ fmt(target) }} ₽</span><em>{{ percent }}%</em>
      </div>
      <span class="m-goal-bar m-goal-bar--lg">
        <i class="m-goal-saved" :style="{ width: savedWidth + '%' }" />
        <i class="m-goal-planned" :style="{ width: plannedWidth + '%' }" />
      </span>
      <div class="m-goal-legend">
        <span><i class="m-legend-dot" style="background: var(--m-purple-light)" />Отложено {{ fmt(saved) }} ₽</span>
        <span><i class="m-legend-dot" style="background: var(--m-cyan)" />В {{ month.prepositional }} {{ fmt(form.planned) }} ₽</span>
      </div>
    </div>

    <label class="m-field">
      <span class="m-field-label">Название</span>
      <input v-model="form.name" class="m-input" maxlength="200" placeholder="Например, отпуск">
    </label>
    <div class="m-field-grid">
      <label class="m-field">
        <span class="m-field-label">Нужно всего</span>
        <span class="m-input-suffix"><input v-model="form.target" class="m-input" inputmode="decimal" placeholder="0"><span>₽</span></span>
      </label>
      <label class="m-field">
        <span class="m-field-label">Уже отложено</span>
        <span class="m-input-suffix"><input v-model="form.saved" class="m-input" inputmode="decimal" placeholder="0"><span>₽</span></span>
      </label>
    </div>

    <div v-if="!goal?.closed" class="m-field">
      <span class="m-field-label">Отложить в {{ month.prepositional }}</span>
      <div class="m-big-stepper">
        <button type="button" aria-label="Уменьшить на 1 000 ₽" :disabled="!form.planned" @click="step(-1000)"><MobileIcon name="minus" /></button>
        <b><MobileMoney :value="form.planned" /></b>
        <button type="button" aria-label="Увеличить на 1 000 ₽" @click="step(1000)"><MobileIcon name="plus" /></button>
      </div>
      <div class="m-quick">
        <button v-for="value in [1000, 5000, 10000]" :key="value" type="button" class="m-chip m-chip--button" @click="step(value)">+{{ fmt(value) }} ₽</button>
        <button v-if="form.planned" type="button" class="m-chip m-chip--button" @click="form.planned = 0">Обнулить</button>
      </div>
    </div>

    <div v-if="!goal?.closed" class="m-field">
      <span class="m-field-label">С какой выплаты откладывать</span>
      <div class="m-segment">
        <button v-for="option in paydayOptions" :key="option.value" type="button" :class="{ on: form.payday === option.value }" :aria-pressed="form.payday === option.value" @click="form.payday = option.value">{{ option.label }}</button>
      </div>
    </div>

    <div class="m-field">
      <span class="m-field-label">Срок</span>
      <div class="m-inline">
        <label class="m-input m-input--button m-input--date">
          <MobileIcon name="calendar" :size="20" /><span>{{ form.dueDate ? longDate(form.dueDate) : 'Без срока' }}</span><MobileIcon name="chevron-right" :size="18" />
          <input v-model="form.dueDate" class="m-date-input" type="date" aria-label="Срок цели" @click="openPicker">
        </label>
        <button v-if="form.dueDate" class="m-chip m-chip--button" type="button" @click="form.dueDate = ''">Без срока</button>
      </div>
    </div>

    <div v-if="goal" class="m-sheet-links">
      <button v-if="goal.closed" class="m-text-btn" type="button" :disabled="busy" @click="act('reopen')">
        <MobileIcon name="refresh" :size="20" />Снова открыть цель
      </button>
      <button v-else class="m-text-btn" type="button" :disabled="busy" @click="act('close')">
        <MobileIcon name="archive" :size="20" />{{ confirming === 'close' ? 'Нажмите ещё раз: цель перестанет учитываться в планах' : 'Закрыть цель' }}
      </button>
      <button class="m-text-btn m-text-btn--danger" type="button" :disabled="busy" @click="act('delete')">
        <MobileIcon name="trash" :size="20" />{{ confirming === 'delete' ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить цель' }}
      </button>
    </div>

    <template #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="!canSave" @click="save">Сохранить</button>
    </template>
  </MobileSheet>
</template>
