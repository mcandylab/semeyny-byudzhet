<script setup>
import { CATEGORY_META, expenses, fmt, month } from "~/utils/mobile-mock";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const isNew = Boolean(props.data?.isNew);
const item = isNew
  ? { name: "", amount: 0, category: "other", payday: props.data.payday || 20, paid: false }
  : props.data || expenses[0];
const form = reactive({
  name: item.name,
  amount: item.amount ? fmt(item.amount) : "",
  category: item.category,
  payday: item.payday,
  paid: item.paid
});
const confirming = ref(false);

function remove() {
  if (!confirming.value) {
    confirming.value = true;
    return;
  }
  emit("done", `«${item.name}» удалён`);
}
</script>

<template>
  <MobileSheet :title="isNew ? 'Новый расход' : 'Расход'" :eyebrow="`Каждый месяц · с выплаты ${form.payday}-го`" @close="$emit('close')">
    <label class="m-amount-field">
      <span class="m-field-label">Сумма в месяц</span>
      <span class="m-amount-input"><input v-model="form.amount" inputmode="numeric" placeholder="0" aria-label="Сумма в рублях"><span>₽</span></span>
    </label>
    <label class="m-field">
      <span class="m-field-label">Название</span>
      <input v-model="form.name" class="m-input" placeholder="Например, интернет">
    </label>
    <div class="m-field">
      <span class="m-field-label">Категория</span>
      <div class="m-cat-scroll">
        <button
          v-for="(meta, key) in CATEGORY_META"
          :key="key"
          type="button"
          class="m-cat"
          :class="{ on: form.category === key }"
          :aria-pressed="form.category === key"
          :style="{ '--c': meta.color }"
          @click="form.category = key"
        >
          <MobileIcon :name="meta.icon" :size="20" />{{ meta.label }}
        </button>
      </div>
    </div>
    <div class="m-field">
      <span class="m-field-label">С какой выплаты</span>
      <div class="m-segment">
        <button v-for="key in [20, 5]" :key="key" type="button" :class="{ on: form.payday === key }" :aria-pressed="form.payday === key" @click="form.payday = key">{{ key }}-го числа</button>
      </div>
    </div>
    <label class="m-switch-row">
      <span><b>Оплачено в {{ month.prepositional }}</b><small>Отметка только для этого месяца</small></span>
      <input v-model="form.paid" class="m-switch" type="checkbox" role="switch">
    </label>
    <template #footer>
      <button
        v-if="!isNew"
        class="m-btn m-btn--danger"
        :class="{ 'm-btn--square': !confirming }"
        type="button"
        :aria-label="confirming ? undefined : 'Удалить расход'"
        @click="remove"
      >
        <MobileIcon name="trash" :size="20" /><template v-if="confirming">Точно удалить?</template>
      </button>
      <button class="m-btn m-btn--primary" type="button" @click="$emit('done', isNew ? 'Расход добавлен' : 'Изменения сохранены')">Сохранить</button>
    </template>
  </MobileSheet>
</template>
