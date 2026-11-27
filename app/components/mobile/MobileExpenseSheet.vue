<script setup>
import { CATEGORY_META, fmt, monthInfo, parseAmount } from "~/utils/family";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const month = computed(() => monthInfo(budget.month));
const item = props.data?.id ? props.data : null;
const form = reactive({
  name: item?.name || "",
  amount: item?.amount ? fmt(item.amount) : "",
  category: item?.category || "other",
  payday: item?.payday || props.data?.payday || 20,
  paid: Boolean(item?.paid)
});
const confirming = ref(false);
const busy = ref(false);
const canSave = computed(() => form.name.trim() && !busy.value);

async function save() {
  if (!canSave.value) return;
  busy.value = true;
  const done = await budget.saveExpense({ id: item?.id, ...form, amount: parseAmount(form.amount) });
  busy.value = false;
  if (done) emit("done", item ? "Изменения сохранены" : "Расход добавлен");
}

async function remove() {
  if (!confirming.value) {
    confirming.value = true;
    return;
  }
  busy.value = true;
  const done = await budget.deleteExpense(item.id);
  busy.value = false;
  if (done) emit("done", `«${item.name}» удалён`);
}
</script>

<template>
  <MobileSheet :title="item ? 'Расход' : 'Новый расход'" :eyebrow="`Каждый месяц · с выплаты ${form.payday}-го`" @close="$emit('close')">
    <label class="m-amount-field">
      <span class="m-field-label">Сумма в месяц</span>
      <span class="m-amount-input"><input v-model="form.amount" inputmode="decimal" placeholder="0" aria-label="Сумма в рублях" @keydown.enter="save"><span>₽</span></span>
    </label>
    <label class="m-field">
      <span class="m-field-label">Название</span>
      <input v-model="form.name" class="m-input" maxlength="200" placeholder="Например, интернет" @keydown.enter="save">
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
        v-if="item"
        class="m-btn m-btn--danger"
        :class="{ 'm-btn--square': !confirming }"
        type="button"
        :disabled="busy"
        :aria-label="confirming ? undefined : 'Удалить расход'"
        @click="remove"
      >
        <MobileIcon name="trash" :size="20" /><template v-if="confirming">Точно удалить?</template>
      </button>
      <button class="m-btn m-btn--primary" type="button" :disabled="!canSave" @click="save">Сохранить</button>
    </template>
  </MobileSheet>
</template>
