<script setup>
import { dateKey, formatShortDate, money } from "../utils/budget";

const props = defineProps({
  balances: { type: Array, required: true },
  purchases: { type: Array, required: true },
  record: { type: Function, required: true }
});
defineEmits(["undo"]);

const transactions = computed(() => [...props.purchases].reverse());
const form = reactive({});

function resetForm() {
  const food = props.balances.find(item => item.name.trim().toLowerCase() === "еда");
  Object.assign(form, {
    type: "purchase", name: "", amount: "", date: dateKey(new Date()), days: 1,
    balanceId: food?.id || props.balances[0]?.id || ""
  });
  changeType();
}

function changeType() {
  const deposit = form.type === "deposit";
  form.name = deposit ? "Пополнение" : "Продукты";
  form.days = deposit ? 0 : 1;
}

watch(() => props.balances.map(item => item.id), ids => {
  if (!ids.includes(form.balanceId)) form.balanceId = ids[0] || "";
});

resetForm();

function submit() {
  if (props.record(form)) resetForm();
}
</script>

<template>
  <div class="grid-two purchase-section">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow">Деньги в конвертах</p><h2>Записать операцию</h2><p class="card-subtitle">Покупка вычитает деньги, пополнение прибавляет</p></div></div>
      <div class="purchase-form">
        <label class="field"><span class="field-label">Тип операции</span>
          <select v-model="form.type" class="settings-input" @change="changeType">
            <option value="purchase">Покупка — вычесть</option><option value="deposit">Пополнение — прибавить</option>
          </select>
        </label>
        <label class="field"><span class="field-label">Название</span><input v-model="form.name" class="settings-input" autocomplete="off"></label>
        <div class="purchase-form-grid">
          <label class="field"><span class="field-label">Сумма</span><span class="input-with-suffix"><input v-model="form.amount" class="settings-input" type="number" min="0.01" step="0.01" placeholder="500"><span class="input-suffix">₽</span></span></label>
          <label class="field"><span class="field-label">Дата</span><input v-model="form.date" class="settings-input" type="date"></label>
        </div>
        <template v-if="form.type === 'purchase'">
          <label class="field"><span class="field-label">На сколько дней покупка</span><input v-model="form.days" class="settings-input" type="number" min="0" step="1"></label>
          <p class="field-hint">Для еды: 1 — только сегодня, 2 — продукты на два дня, 0 — не вычитать дни из расчёта.</p>
        </template>
        <label class="field"><span class="field-label">Конверт</span><select v-model="form.balanceId" class="settings-input"><option v-for="item in balances" :key="item.id" :value="item.id">{{ item.name }} — {{ money(item.amount) }}</option></select></label>
        <button class="button primary" :disabled="!balances.length" @click="submit">{{ form.type === 'deposit' ? 'Пополнить конверт' : 'Записать покупку' }}</button>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><div><p class="eyebrow">Движение денег</p><h2>История операций</h2><p class="card-subtitle">Отмена изменит остаток в том же конверте</p></div><span class="pill">{{ purchases.length }}</span></div>
      <div class="purchase-list">
        <div v-if="!transactions.length" class="empty">Записанных операций пока нет.</div>
        <div v-for="purchase in transactions" :key="purchase.id" class="purchase-row">
          <div>
            <div class="purchase-name">{{ purchase.name }}</div>
            <div class="purchase-meta">
              {{ formatShortDate(purchase.date) }} · {{ purchase.type === 'deposit' ? 'в' : 'из' }} «{{ purchase.balanceName }}»
              <template v-if="purchase.type !== 'deposit' && purchase.days > 0"> · на {{ purchase.days }} дн.</template>
            </div>
          </div>
          <strong class="purchase-amount">{{ purchase.type === 'deposit' ? '+' : '−' }} {{ money(purchase.amount) }}</strong>
          <button class="button ghost small" @click="$emit('undo', purchase.id)">Отменить</button>
        </div>
      </div>
    </section>
  </div>
</template>
