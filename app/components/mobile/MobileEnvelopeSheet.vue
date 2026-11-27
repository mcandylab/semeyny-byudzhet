<script setup>
import { CATEGORY_META, fmt, parseAmount } from "~/utils/family";

const props = defineProps({ data: { type: Object, default: null } });
const emit = defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const item = props.data?.id ? props.data : null;
const form = reactive({
  name: item?.name || "",
  amount: item?.amount ? fmt(item.amount) : "",
  category: item?.category || "other"
});
const confirming = ref(false);
const busy = ref(false);
const canSave = computed(() => form.name.trim() && !busy.value);
const balanceChanged = computed(() => item && parseAmount(form.amount) !== item.amount);

async function save() {
  if (!canSave.value) return;
  busy.value = true;
  const done = await budget.saveEnvelope({ id: item?.id, name: form.name, category: form.category, amount: parseAmount(form.amount) });
  busy.value = false;
  if (done) emit("done", item ? "Конверт сохранён" : `Конверт «${form.name.trim()}» создан`);
}

async function archive() {
  if (!item.archived && !confirming.value) {
    confirming.value = true;
    return;
  }
  busy.value = true;
  const done = await budget.setEnvelopeArchived(item.id, !item.archived);
  busy.value = false;
  if (done) emit("done", item.archived ? `«${item.name}» снова в конвертах` : `«${item.name}» убран в архив`);
}
</script>

<template>
  <MobileSheet :title="item ? item.name : 'Новый конверт'" :eyebrow="item?.archived ? 'В архиве' : 'Деньги, отложенные на дело'" @close="$emit('close')">
    <label class="m-amount-field">
      <span class="m-field-label">{{ item ? 'Сейчас в конверте' : 'Сколько кладём сейчас' }}</span>
      <span class="m-amount-input"><input v-model="form.amount" inputmode="decimal" placeholder="0" aria-label="Остаток в рублях"><span>₽</span></span>
    </label>
    <p v-if="balanceChanged" class="m-hint m-hint--flush m-hint--warn">Ручное изменение остатка не попадает в историю. Для покупок и пополнений есть кнопка «+».</p>
    <label class="m-field">
      <span class="m-field-label">Название</span>
      <input v-model="form.name" class="m-input" maxlength="120" placeholder="Например, еда" @keydown.enter="save">
    </label>
    <div class="m-field">
      <span class="m-field-label">Категория — от неё зависит значок</span>
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
    <div v-if="item" class="m-sheet-links">
      <button class="m-text-btn" type="button" :disabled="busy" @click="archive">
        <MobileIcon name="archive" :size="20" />{{ item.archived ? 'Вернуть из архива' : confirming ? 'Нажмите ещё раз: конверт пропадёт из списка и сумм, история останется' : 'Убрать в архив' }}
      </button>
    </div>
    <template #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="!canSave" @click="save">Сохранить</button>
    </template>
  </MobileSheet>
</template>
