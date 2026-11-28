<script setup>
import { formatStamp, monthInfo, plural, todayKey } from "~/utils/family";

defineEmits(["go", "open"]);

const budget = useFamilyBudget();
const month = computed(() => monthInfo(budget.month));
const auto = computed(() => budget.autoWorkdays);

// Steppers change at once and save a moment after the last tap.
const tithe = ref(budget.household?.tithe_rate || 0);
const first = ref(budget.calc.workdays.first);
const second = ref(budget.calc.workdays.second);
let titheTimer = null;
let daysTimer = null;
let daysMonth = budget.month;

watch(() => budget.household?.tithe_rate, value => {
  if (!titheTimer) tithe.value = value || 0;
});
watch(() => [budget.month, budget.calc.workdays.first, budget.calc.workdays.second], ([key, a, b]) => {
  if (daysTimer && key === daysMonth) return;
  flushDays();
  first.value = a;
  second.value = b;
});

function saveTithe() {
  clearTimeout(titheTimer);
  titheTimer = null;
  if (tithe.value !== (budget.household?.tithe_rate || 0)) budget.updateHousehold({ tithe_rate: tithe.value });
}

function stepTithe(delta) {
  tithe.value = Math.min(100, Math.max(0, tithe.value + delta));
  clearTimeout(titheTimer);
  titheTimer = setTimeout(saveTithe, 700);
}

function flushDays() {
  if (!daysTimer) return;
  clearTimeout(daysTimer);
  daysTimer = null;
  budget.saveWorkdays(daysMonth, first.value, second.value);
}

function stepDays(key, delta) {
  const field = key === "first" ? first : second;
  const max = key === "first" ? 15 : 16;
  field.value = Math.min(max, Math.max(0, field.value + delta));
  daysMonth = budget.month;
  clearTimeout(daysTimer);
  daysTimer = setTimeout(flushDays, 700);
}

function resetDays() {
  clearTimeout(daysTimer);
  daysTimer = null;
  first.value = auto.value.first;
  second.value = auto.value.second;
  budget.saveWorkdays(budget.month, auto.value.first, auto.value.second);
}

const manual = computed(() => first.value !== auto.value.first || second.value !== auto.value.second);
const me = computed(() => budget.user);
const { choice: theme, setTheme } = useTheme();
const themes = [
  { value: "dark", label: "Тёмная" },
  { value: "light", label: "Светлая" },
  { value: "system", label: "Авто" }
];

function download() {
  const blob = new Blob([`${JSON.stringify(budget.backup(), null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `semeyny-byudzhet-${todayKey()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  budget.notify("Резервная копия скачана");
}

onBeforeUnmount(() => {
  if (titheTimer) saveTithe();
  flushDays();
});
</script>

<template>
  <div class="m-page">
    <header class="m-top">
      <button class="m-icon-btn" type="button" aria-label="Назад" @click="$emit('go', 'home')"><MobileIcon name="arrow-left" /></button>
      <h1 class="m-top-heading"><b>Настройки</b></h1>
    </header>

    <button class="m-profile" type="button" @click="$emit('open', 'account')">
      <span class="m-avatar m-avatar--lg"><MobileIcon name="family" :size="30" /></span>
      <span class="m-profile-body">
        <span class="m-profile-title">{{ me?.name || me?.username }}</span>
        <span class="m-profile-meta"><i class="m-dot" />@{{ me?.username }} · {{ budget.isOwner ? 'владелец' : 'участник' }}</span>
      </span>
      <MobileIcon name="chevron-right" :size="18" class="m-faint" />
    </button>

    <p class="m-group-title">Оформление</p>
    <div class="m-segment m-segment--theme" role="radiogroup" aria-label="Тема оформления">
      <button
        v-for="item in themes"
        :key="item.value"
        type="button"
        role="radio"
        :aria-checked="theme === item.value"
        :class="{ on: theme === item.value }"
        @click="setTheme(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
    <p class="m-hint">«Авто» — как в настройках телефона. Выбор хранится на этом устройстве.</p>

    <p class="m-group-title">Зарплата</p>
    <div class="m-group">
      <button class="m-set-row" type="button" @click="$emit('open', 'salary')">
        <span class="m-set-icon" style="--c: var(--m-purple-light)"><MobileIcon name="ruble" :size="20" /></span>
        <span class="m-set-label"><small>Зарплата за полный месяц</small><span class="m-set-big"><MobileMoney :value="budget.household?.salary || 0" /></span></span>
        <MobileIcon name="edit" :size="20" class="m-faint" />
      </button>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: var(--m-contrast)"><MobileIcon name="heart" :size="20" /></span>
        <span class="m-set-label">Десятина<small>От каждой выплаты</small></span>
        <div class="m-stepper">
          <button type="button" aria-label="Уменьшить десятину" :disabled="tithe <= 0" @click="stepTithe(-1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ tithe }}%</b>
          <button type="button" aria-label="Увеличить десятину" :disabled="tithe >= 100" @click="stepTithe(1)"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
    </div>
    <p class="m-hint">Зарплата ÷ рабочие дни месяца × рабочие дни периода. Периоды: с 1 по 15 число и с 16 по конец месяца.</p>

    <p class="m-group-title">Рабочие дни · {{ month.title.toLowerCase() }} {{ month.year }}</p>
    <div class="m-group">
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: var(--m-purple)"><MobileIcon name="calendar" :size="20" /></span>
        <span class="m-set-label">С 1 по 15 число<small>Выплата 20-го</small></span>
        <div class="m-stepper">
          <button type="button" aria-label="Меньше дней в первой половине" :disabled="first <= 0" @click="stepDays('first', -1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ first }}</b>
          <button type="button" aria-label="Больше дней в первой половине" :disabled="first >= 15" @click="stepDays('first', 1)"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: var(--m-cyan-text)"><MobileIcon name="calendar" :size="20" /></span>
        <span class="m-set-label">С 16 по {{ auto.days }} число<small>Выплата 5-го</small></span>
        <div class="m-stepper">
          <button type="button" aria-label="Меньше дней во второй половине" :disabled="second <= 0" @click="stepDays('second', -1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ second }}</b>
          <button type="button" aria-label="Больше дней во второй половине" :disabled="second >= 16" @click="stepDays('second', 1)"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: var(--m-cat-pets)"><MobileIcon name="clock" :size="20" /></span>
        <span class="m-set-label">Всего {{ plural(first + second, ['день', 'дня', 'дней']) }}<small>{{ manual ? 'Изменено вручную' : 'По календарю' }}</small></span>
        <button v-if="manual" class="m-chip m-chip--button m-chip--sm" type="button" @click="resetDays">Сбросить</button>
        <span v-else class="m-chip m-chip--green m-chip--sm"><MobileIcon name="check" :size="14" />Авто</span>
      </div>
    </div>
    <p class="m-hint">Праздники и переносы на 2026–2027 годы учтены. Источник: КонсультантПлюс.</p>

    <p class="m-group-title">Семья</p>
    <div class="m-group">
      <button class="m-set-row" type="button" @click="$emit('open', 'family')">
        <span class="m-set-icon" style="--c: var(--m-cyan-text)"><MobileIcon name="family" :size="20" /></span>
        <span class="m-set-label">{{ plural(budget.members.length, ['участник', 'участника', 'участников']) }}<small>{{ budget.isOwner ? 'Пригласить по коду, управлять доступом' : budget.members.map(item => item.name || item.username).join(', ') }}</small></span>
        <MobileIcon name="chevron-right" :size="18" class="m-faint" />
      </button>
      <div class="m-set-row">
        <span class="m-set-icon" :style="{ '--c': budget.online ? 'var(--m-green)' : 'var(--m-warn)' }"><MobileIcon name="cloud" :size="20" /></span>
        <span class="m-set-label">Синхронизация<small>Изменения сразу видны всей семье</small></span>
        <span class="m-set-value" :class="{ 'm-set-value--ok': budget.online }">{{ budget.demo ? 'Демо' : budget.online ? 'Включена' : 'Нет связи' }}</span>
      </div>
    </div>

    <p class="m-group-title">Данные</p>
    <div class="m-group">
      <button class="m-set-row" type="button" @click="download">
        <span class="m-set-icon" style="--c: var(--m-contrast)"><MobileIcon name="download" :size="20" /></span>
        <span class="m-set-label">Скачать копию<small>Файл .json со всем бюджетом</small></span>
        <MobileIcon name="chevron-right" :size="18" class="m-faint" />
      </button>
      <button class="m-set-row m-set-row--danger" type="button" @click="budget.logout()">
        <span class="m-set-icon" style="--c: var(--m-red)"><MobileIcon name="logout" :size="20" /></span>
        <span class="m-set-label">Выйти<small>На этом устройстве</small></span>
      </button>
    </div>

    <p v-if="budget.lastChange" class="m-foot-note">Последнее изменение: {{ formatStamp(budget.lastChange) }}</p>
  </div>
</template>
