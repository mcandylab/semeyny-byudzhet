<script setup>
import { daysLabel, envelopes, fmt } from "~/utils/mobile-mock";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const SUGGESTIONS = {
  purchase: ["Продукты", "Кафе", "Аптека", "Бензин", "Подарок"],
  deposit: ["Пополнение", "С зарплаты", "Кэшбэк", "Возврат"]
};
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

const type = ref(props.data?.type || "purchase");
const deposit = computed(() => type.value === "deposit");
const digits = ref(props.data ? "" : "2340");
const envelopeId = ref(props.data?.envelope || "b1");
const name = ref(SUGGESTIONS[type.value][0]);
const days = ref(deposit.value ? 0 : 2);
const amount = computed(() => digits.value ? fmt(Number(digits.value)) : "0");

watch(type, value => {
  name.value = SUGGESTIONS[value][0];
  days.value = value === "deposit" ? 0 : 1;
});

function press(key) {
  if (key === "back") digits.value = digits.value.slice(0, -1);
  else if ((digits.value + key).length <= 7) digits.value = (digits.value + key).replace(/^0+/, "");
}

function submit() {
  const envelope = envelopes.find(item => item.id === envelopeId.value);
  emit("done", deposit.value
    ? `${name.value}: +${amount.value} ₽ в «${envelope.name}»`
    : `${name.value}: −${amount.value} ₽ из «${envelope.name}»`);
}
</script>

<template>
  <MobileSheet title="Новая операция" tall @close="$emit('close')">
    <div class="m-segment">
      <button type="button" :class="{ on: !deposit }" :aria-pressed="!deposit" @click="type = 'purchase'">Покупка</button>
      <button type="button" :class="{ on: deposit }" :aria-pressed="deposit" @click="type = 'deposit'">Пополнение</button>
    </div>

    <div class="m-amount" :class="{ 'm-amount--plus': deposit }" aria-live="polite">
      <span class="m-amount-sign">{{ deposit ? '+' : '−' }}</span>{{ amount }}<span class="m-amount-cur">₽</span><i class="m-caret" aria-hidden="true" />
    </div>

    <div class="m-suggest">
      <button v-for="item in SUGGESTIONS[type]" :key="item" type="button" class="m-chip m-chip--button" :class="{ 'm-chip--on': name === item }" @click="name = item">{{ item }}</button>
    </div>

    <div class="m-field">
      <span class="m-field-label">{{ deposit ? 'В конверт' : 'Из конверта' }}</span>
      <div class="m-env-chips">
        <button
          v-for="item in envelopes"
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
      <button class="m-mini" type="button"><MobileIcon name="calendar" :size="18" />Сегодня</button>
      <div v-if="!deposit" class="m-stepper" role="group" aria-label="На сколько дней покупка">
        <button type="button" aria-label="Меньше дней" @click="days = Math.max(0, days - 1)"><MobileIcon name="minus" :size="16" /></button>
        <b>{{ days ? 'на ' + daysLabel(days) : 'без дней' }}</b>
        <button type="button" aria-label="Больше дней" @click="days += 1"><MobileIcon name="plus" :size="16" /></button>
      </div>
    </div>

    <div class="m-keypad">
      <button v-for="key in KEYS" :key="key" type="button" class="m-key" :aria-label="key === 'back' ? 'Стереть' : undefined" @click="press(key)">
        <MobileIcon v-if="key === 'back'" name="backspace" :size="24" /><template v-else>{{ key }}</template>
      </button>
    </div>

    <template #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="!digits" @click="submit">{{ deposit ? 'Пополнить конверт' : 'Записать покупку' }}</button>
    </template>
  </MobileSheet>
</template>
