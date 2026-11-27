<script setup>
import { dayLabel, daysLabel, fmt, todayKey } from "~/utils/family";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const DEFAULTS = {
  purchase: ["Продукты", "Кафе", "Аптека", "Бензин", "Подарок"],
  deposit: ["Пополнение", "С зарплаты", "Кэшбэк", "Возврат"]
};
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

const budget = useFamilyBudget();
const type = ref(props.data?.type || "purchase");
const deposit = computed(() => type.value === "deposit");
const digits = ref("");
const name = ref("");
const days = ref(1);
const date = ref(todayKey());
const busy = ref(false);

// The envelope passed in, else the last one used, else «Еда», else the first.
function initialEnvelope() {
  const ids = budget.envelopes.map(item => item.id);
  if (ids.includes(props.data?.envelope)) return props.data.envelope;
  const last = budget.operations.find(item => ids.includes(item.envelopeId));
  if (last) return last.envelopeId;
  return budget.envelopes.find(item => item.name.trim().toLowerCase() === "еда")?.id || ids[0] || "";
}
const envelopeId = ref(initialEnvelope());
const envelope = computed(() => budget.envelopeById[envelopeId.value]);

// Names used recently come first, then the usual ones.
const suggestions = computed(() => {
  const recent = budget.operations.filter(item => item.type === type.value).map(item => item.name);
  return [...new Set([...recent, ...DEFAULTS[type.value]])].slice(0, 8);
});

function reset() {
  name.value = suggestions.value[0] || "";
  days.value = deposit.value ? 0 : 1;
}
reset();
watch(type, reset);

const chips = ref(null);
// The chosen envelope may be far down the row: bring it into view.
// Only the row scrolls: scrollIntoView would also move the page around the sheet.
onMounted(() => {
  const row = chips.value;
  const chosen = row?.querySelector(".on");
  if (!chosen) return;
  const offset = chosen.getBoundingClientRect().left - row.getBoundingClientRect().left;
  row.scrollLeft += offset - (row.clientWidth - chosen.offsetWidth) / 2;
});

const amount = computed(() => Number(digits.value) || 0);
const shortage = computed(() => !deposit.value && envelope.value && amount.value > envelope.value.amount);
const canSubmit = computed(() => amount.value > 0 && envelope.value && !shortage.value && !busy.value);

function press(key) {
  if (key === "back") digits.value = digits.value.slice(0, -1);
  else if ((digits.value + key).length <= 9) digits.value = (digits.value + key).replace(/^0+/, "");
}

function openPicker(event) {
  try {
    event.target.showPicker?.();
  } catch {}
}

async function submit() {
  if (!canSubmit.value) return;
  busy.value = true;
  const target = envelope.value.name;
  const done = await budget.recordOperation({ type: type.value, envelope: envelopeId.value, name: name.value, amount: amount.value, days: days.value, date: date.value || todayKey() });
  busy.value = false;
  if (!done) return;
  const title = name.value.trim() || (deposit.value ? "Пополнение" : "Покупка");
  emit("done", deposit.value ? `${title}: +${fmt(amount.value)} ₽ в «${target}»` : `${title}: −${fmt(amount.value)} ₽ из «${target}»`);
}
</script>

<template>
  <MobileSheet title="Новая операция" tall @close="$emit('close')">
    <div class="m-segment">
      <button type="button" :class="{ on: !deposit }" :aria-pressed="!deposit" @click="type = 'purchase'">Покупка</button>
      <button type="button" :class="{ on: deposit }" :aria-pressed="deposit" @click="type = 'deposit'">Пополнение</button>
    </div>

    <div class="m-amount" :class="{ 'm-amount--plus': deposit, 'm-amount--short': shortage }" aria-live="polite">
      <span class="m-amount-sign">{{ deposit ? '+' : '−' }}</span>{{ fmt(amount) }}<span class="m-amount-cur">₽</span><i class="m-caret" aria-hidden="true" />
    </div>
    <p v-if="shortage" class="m-hint m-hint--flush m-hint--warn">В «{{ envelope.name }}» только {{ fmt(envelope.amount) }} ₽</p>

    <template v-if="budget.envelopes.length">
      <div class="m-suggest">
        <input v-model="name" class="m-chip m-chip-input" maxlength="200" :placeholder="deposit ? 'Пополнение' : 'Своё название'" aria-label="Название операции">
        <button v-for="item in suggestions" :key="item" type="button" class="m-chip m-chip--button" :class="{ 'm-chip--on': name === item }" @click="name = item">{{ item }}</button>
      </div>

      <div class="m-field">
        <span class="m-field-label">{{ deposit ? 'В конверт' : 'Из конверта' }}</span>
        <div ref="chips" class="m-env-chips">
          <button
            v-for="item in budget.envelopes"
            :key="item.id"
            type="button"
            class="m-env-chip"
            :class="{ on: envelopeId === item.id }"
            :aria-pressed="envelopeId === item.id"
            :style="{ '--c': item.color }"
            @click="envelopeId = item.id"
          >
            <MobileIcon :name="item.icon" :size="18" /><span><b>{{ item.name }}</b><small>{{ fmt(item.amount) }} ₽</small></span>
          </button>
        </div>
      </div>

      <div class="m-inline">
        <label class="m-mini m-mini--date">
          <MobileIcon name="calendar" :size="18" />{{ dayLabel(date || todayKey()) }}
          <input v-model="date" class="m-date-input" type="date" :max="todayKey()" aria-label="Дата операции" @click="openPicker">
        </label>
        <div v-if="!deposit" class="m-stepper" role="group" aria-label="На сколько дней покупка">
          <button type="button" aria-label="Меньше дней" :disabled="days <= 0" @click="days = Math.max(0, days - 1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ days ? 'на ' + daysLabel(days) : 'без дней' }}</b>
          <button type="button" aria-label="Больше дней" @click="days += 1"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
    </template>
    <p v-else class="m-callout"><MobileIcon name="info" :size="20" />Сначала создайте конверт на вкладке «Конверты».</p>

    <div class="m-keypad">
      <button v-for="key in KEYS" :key="key" type="button" class="m-key" :aria-label="key === 'back' ? 'Стереть' : undefined" @click="press(key)">
        <MobileIcon v-if="key === 'back'" name="backspace" :size="24" /><template v-else>{{ key }}</template>
      </button>
    </div>

    <template #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="!canSubmit" @click="submit">{{ busy ? 'Записываю…' : deposit ? 'Пополнить конверт' : 'Записать покупку' }}</button>
    </template>
  </MobileSheet>
</template>
