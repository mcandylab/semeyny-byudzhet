<script setup>
import { formatUpdatedAt, money, monthFormatter, parseMonth, sumItems } from "../utils/budget";

definePageMeta({ alias: ["/index.html"] });

const {
  state, calc, loading, errorMessage, activeTab, shared, syncStatus, recovery, toast, showToast,
  selectTab, createBlank, setMonth, changeMonth, setCreditNote, updateSetting, updateWorkday,
  resetWorkdays, updateItem, addItem, deleteItem, closeGoal, recordPurchase, undoPurchase,
  makeShareLink, exportBudget, importBudget, dismissRecovery, restoreLocal
} = useBudget();

const tabs = [
  ["overview", "Обзор"], ["pay5", "Выплата 5-го"], ["pay20", "Выплата 20-го"],
  ["balances", "Сейчас отложено"], ["goals", "Цели"], ["settings", "Настройки"]
];
const payment = computed(() => {
  if (activeTab.value === "pay5") return calc.value.p5;
  if (activeTab.value === "pay20") return calc.value.p20;
  return null;
});
const paymentItems = computed(() => state.value.expenses.filter(item => item.payday === payment.value.payday));
const monthTitle = computed(() => {
  const { year, month } = parseMonth(state.value.month);
  return monthFormatter.format(new Date(year, month - 1, 1));
});

const shareDialog = ref(null);
const shareInput = ref(null);
const shareUrl = ref("");
const canShare = ref(false);
const importFile = ref(null);

async function addAndFocus(kind, payday) {
  const id = addItem(kind, payday);
  await nextTick();
  const inputs = [...document.querySelectorAll(`[data-item-id="${id}"]`)];
  const input = inputs.find(element => element.getClientRects().length);
  if (input) {
    input.focus();
    input.select();
  }
}

async function shareBudget() {
  try {
    shareUrl.value = await makeShareLink();
    canShare.value = Boolean(navigator.share);
    shareDialog.value.showModal();
  } catch {
    showToast("Не удалось создать ссылку. Скачайте резервную копию.");
  }
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
  } catch {
    shareInput.value.focus();
    shareInput.value.select();
    document.execCommand("copy");
  }
  showToast("Ссылка скопирована");
}

async function nativeShare() {
  try {
    await navigator.share({ title: "Семейный бюджет", text: "Актуальная версия семейного бюджета", url: shareUrl.value });
  } catch (error) {
    if (error.name !== "AbortError") showToast("Не удалось открыть меню отправки");
  }
}

async function readFile(event) {
  await importBudget(event.target.files?.[0]);
  event.target.value = "";
}

function printBudget() {
  window.print();
}
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">СБ</div><div><h1>Семейный бюджет</h1><p>Общая финансовая картина семьи</p></div></div>
      <div v-if="state" class="top-actions">
        <button class="button secondary" @click="exportBudget">Скачать копию</button>
        <button class="button primary" @click="shareBudget">{{ shared ? 'Поделиться ссылкой' : 'Поделиться версией' }}</button>
      </div>
    </header>
    <section v-if="loading" class="card" role="status">
      <p>Загрузка бюджета…</p>
      <noscript>Для работы с бюджетом включите JavaScript в браузере.</noscript>
    </section>
    <section v-else-if="!state" class="card" style="max-width:680px;margin:70px auto;text-align:center">
      <p class="eyebrow">Бюджет всегда под рукой</p>
      <h2 style="font-size:30px">Откройте семейную ссылку</h2>
      <p class="card-subtitle" style="max-width:480px;margin:12px auto 24px">Если у вас есть ссылка на бюджет, откройте её целиком вместе с частью после #. Здесь также можно начать с чистого листа или восстановить резервную копию.</p>
      <p v-if="errorMessage" style="color:var(--red)" role="alert">{{ errorMessage }}</p>
      <div class="actions-list" style="justify-content:center">
        <button class="button primary" @click="createBlank">Создать пустой бюджет</button>
        <button class="button secondary" @click="importFile.click()">Восстановить копию</button>
      </div>
    </section>
    <template v-else>
      <section class="monthbar">
        <div><h2>{{ monthTitle }}</h2><p>Зарплата, обязательные расходы и свободный остаток</p></div>
        <div class="month-controls">
          <button class="icon-button" aria-label="Предыдущий месяц" @click="changeMonth(-1)">‹</button>
          <input type="month" :value="state.month" aria-label="Месяц бюджета" @change="setMonth($event.target.value)">
          <button class="icon-button" aria-label="Следующий месяц" @click="changeMonth(1)">›</button>
        </div>
      </section>
      <div class="notice">
        <span class="notice-dot"></span>
        <div v-if="shared"><strong aria-live="polite">{{ syncStatus }}</strong> Изменения автоматически сохраняются в общем зашифрованном хранилище и на этом устройстве.</div>
        <div v-else>Изменения сохраняются на этом устройстве. <strong>Чтобы передать их другому человеку, создайте новую ссылку</strong> кнопкой «Поделиться версией».</div>
      </div>
      <div v-if="recovery" class="notice">
        <span class="notice-dot"></span>
        <div>
          <strong>На этом устройстве найдена прежняя версия бюджета.</strong><br>
          Покупок: {{ recovery.purchases.length }}; остаток: {{ money(sumItems(recovery.balances)) }}; изменена: {{ formatUpdatedAt(recovery.updatedAt) }}.
          <div class="actions-list" style="margin-top:12px">
            <button class="button primary small" @click="restoreLocal">Восстановить эту версию</button>
            <button class="button ghost small" @click="dismissRecovery">Не восстанавливать</button>
          </div>
        </div>
      </div>
      <nav class="tabs" aria-label="Разделы бюджета">
        <button v-for="[key, label] in tabs" :key="key" class="tab" :class="{ active: activeTab === key }" @click="selectTab(key)">{{ label }}</button>
      </nav>
      <BudgetItems v-if="payment" :key="activeTab" kind="expenses" :items="paymentItems" :state="state" :payment="payment" @add="addAndFocus" @update="updateItem" @remove="deleteItem" />
      <template v-else-if="activeTab === 'balances'">
        <BudgetItems key="balances" kind="balances" :items="state.balances" :state="state" @add="addAndFocus" @update="updateItem" @remove="deleteItem" />
        <BudgetBalances :balances="state.balances" :purchases="state.purchases" :record="recordPurchase" @undo="undoPurchase" />
      </template>
      <BudgetGoals v-else-if="activeTab === 'goals'" :goals="state.goals" :calc="calc" @add="addAndFocus" @update="updateItem" @remove="deleteItem" @close="closeGoal" />
      <BudgetSettings v-else-if="activeTab === 'settings'" :state="state" :workdays="calc.workdays" :shared="shared" @setting="updateSetting" @workday="updateWorkday" @reset="resetWorkdays" @export="exportBudget" @import="importFile.click()" @print="printBudget" />
      <BudgetOverview v-else :state="state" :calc="calc" :shared="shared" @select-tab="selectTab" @update-note="setCreditNote" />
      <p class="updated">Последнее изменение на этом устройстве: {{ formatUpdatedAt(state.updatedAt) }}</p>
    </template>
  </main>

  <div class="toast" :class="{ visible: toast }" role="status" aria-live="polite">{{ toast }}</div>
  <dialog ref="shareDialog" class="dialog">
    <form method="dialog" class="dialog-head">
      <div><p class="eyebrow">Передать актуальную версию</p><h2>Ссылка на бюджет</h2></div>
      <button class="icon-button" value="cancel" aria-label="Закрыть">×</button>
    </form>
    <p>{{ shared ? 'Это постоянная ссылка на общий бюджет. Отправьте её мужу или жене один раз. Новые изменения будут появляться автоматически, новую ссылку создавать не нужно.' : 'В ссылке уже содержатся все текущие суммы и названия. Отправьте её мужу или жене. После новых изменений создайте и отправьте новую ссылку.' }}</p>
    <label class="field-label" for="share-url">Ссылка</label>
    <textarea id="share-url" ref="shareInput" rows="5" :value="shareUrl" readonly></textarea>
    <div class="dialog-actions">
      <button class="button primary" type="button" @click="copyShareLink">Скопировать ссылку</button>
      <button v-if="canShare" class="button secondary" type="button" @click="nativeShare">Поделиться</button>
    </div>
    <p class="privacy-note">Ссылка открывает доступ к финансовым данным. Отправляйте её только членам семьи.</p>
  </dialog>
  <input ref="importFile" type="file" accept="application/json,.json" hidden @change="readFile">
</template>
