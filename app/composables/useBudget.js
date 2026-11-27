import {
  CATEGORIES, automaticWorkdays, blankState, calculate, dateKey, decodeState,
  encodeState, money, normalizeState, pad, parseMonth
} from "../utils/budget";
import { BudgetSync } from "../utils/budget-sync";

const STORAGE_PREFIX = "semeiny-byudzhet:";
const PENDING_PREFIX = "semeiny-byudzhet-pending:";
const RECOVERY_PREFIX = "semeiny-byudzhet-recovery:";

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function useBudget() {
  const { app: { baseURL } } = useRuntimeConfig();
  const state = ref(null);
  const loading = ref(true);
  const errorMessage = ref("");
  const activeTab = ref("overview");
  const shared = ref(false);
  const syncStatus = ref("Общая синхронизация включена");
  const recovery = ref(null);
  const toast = ref("");
  const calc = computed(() => state.value && calculate(state.value));

  let storageKey = "";
  let sync;
  let toastTimer;

  function showToast(message) {
    toast.value = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.value = ""; }, 3000);
  }

  function writeLocal(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      showToast("Не удалось сохранить на устройстве. Скачайте резервную копию.");
    }
  }

  function saveState() {
    state.value.updatedAt = new Date().toISOString();
    writeLocal(storageKey, state.value);
    sync?.save(state.value);
  }

  function findRecovery() {
    const savedCurrent = readLocal(RECOVERY_PREFIX + storageKey);
    if (savedCurrent) return savedCurrent;

    const candidates = [];
    try {
      const purchases = new Set(state.value.purchases.map(purchase => purchase.id));
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(STORAGE_PREFIX) || key === storageKey) continue;
        const saved = readLocal(key);
        if (saved?.purchases?.some?.(purchase => !purchases.has(purchase.id))) {
          candidates.push(normalizeState(saved));
        }
      }
    } catch {}
    return candidates.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
  }

  async function initialize() {
    try {
      const { hash } = location;
      if (!hash) return;
      storageKey = STORAGE_PREFIX + hash;
      const saved = readLocal(storageKey);
      const cached = saved && normalizeState(saved);
      if (!hash.startsWith("#sync.")) {
        const linked = await decodeState(hash);
        state.value = cached || linked;
        writeLocal(storageKey, state.value);
        return;
      }

      const pending = readLocal(PENDING_PREFIX + storageKey);
      let firstRemote = true;
      sync = new BudgetSync({
        baseURL,
        onState(incoming) {
          if (firstRemote && cached && !pending && String(cached.updatedAt) > String(incoming.updatedAt)) {
            writeLocal(RECOVERY_PREFIX + storageKey, cached);
            recovery.value = cached;
          }
          firstRemote = false;
          state.value = normalizeState(incoming);
          writeLocal(storageKey, state.value);
        },
        onStatus(message) { syncStatus.value = message; },
        onPending(value) { writeLocal(PENDING_PREFIX + storageKey, value); }
      });
      state.value = normalizeState(await sync.open(hash, cached, pending));
      shared.value = true;
      recovery.value ||= findRecovery();
    } catch (error) {
      sync?.close();
      sync = undefined;
      errorMessage.value = error.statusCode
        ? "Не удалось загрузить общий бюджет"
        : error.message || "Не удалось прочитать данные из ссылки";
    } finally {
      loading.value = false;
    }
  }

  function selectTab(tab) {
    activeTab.value = tab;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createBlank() {
    storageKey = `${STORAGE_PREFIX}blank:${Date.now()}`;
    state.value = blankState();
    saveState();
  }

  function setMonth(value) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
    state.value.month = value;
    saveState();
  }

  function changeMonth(offset) {
    const { year, month } = parseMonth(state.value.month);
    const date = new Date(year, month - 1 + offset, 1);
    setMonth(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
  }

  function setCreditNote(value) {
    state.value.creditNote = value;
    saveState();
    showToast("Комментарий сохранён");
  }

  function updateSetting(field, value) {
    state.value.settings[field] = Math.max(0, Number(value) || 0);
    saveState();
  }

  function updateWorkday(field, value) {
    const { month, workdays } = state.value;
    const { first, second } = automaticWorkdays(month);
    workdays[month] = { first, second, ...workdays[month], [field]: Math.max(0, Number(value) || 0) };
    saveState();
  }

  function resetWorkdays() {
    delete state.value.workdays[state.value.month];
    saveState();
  }

  function updateItem(kind, id, field, value) {
    const item = state.value[kind].find(entry => entry.id === id);
    if (!item) return;
    if (field === "paid") {
      const months = new Set(item.paidMonths);
      if (value) months.add(state.value.month);
      else months.delete(state.value.month);
      item.paidMonths = [...months];
    } else if (["amount", "target", "saved", "planned"].includes(field)) {
      item[field] = Math.max(0, Number(value) || 0);
    } else if (field === "payday") {
      item.payday = [5, 20].includes(Number(value)) ? Number(value) : 0;
    } else if (field === "name") {
      item.name = value.trim() || "Без названия";
    } else if (field === "dueDate" || (field === "category" && Object.hasOwn(CATEGORIES, value))) {
      item[field] = value;
    }
    saveState();
  }

  function addItem(kind, payday) {
    const id = crypto.randomUUID();
    const item = kind === "goals"
      ? { id, name: "Новая цель", target: 0, saved: 0, planned: 0, dueDate: "", payday: 0, closed: false }
      : { id, name: "Новая позиция", amount: 0, category: "other" };
    if (kind === "expenses") Object.assign(item, { payday, paidMonths: [] });
    state.value[kind].push(item);
    saveState();
    return id;
  }

  function deleteItem(kind, id) {
    const item = state.value[kind].find(entry => entry.id === id);
    if (!item || !window.confirm(`Удалить «${item.name}»?`)) return;
    state.value[kind] = state.value[kind].filter(entry => entry.id !== id);
    saveState();
  }

  function closeGoal(id) {
    const goal = state.value.goals.find(item => item.id === id);
    if (!goal) return;
    const closing = !goal.closed;
    const message = closing
      ? `Закрыть цель «${goal.name}»? Она перестанет учитываться в планах накопления.`
      : `Снова открыть цель «${goal.name}»?`;
    if (!window.confirm(message)) return;
    goal.closed = closing;
    if (closing) goal.planned = 0;
    saveState();
    showToast(closing ? "Цель закрыта" : "Цель снова активна");
  }

  function recordPurchase(form) {
    const type = form.type === "deposit" ? "deposit" : "purchase";
    const deposit = type === "deposit";
    const name = form.name.trim() || (deposit ? "Пополнение" : "Покупка");
    const amount = Math.round((Number(form.amount) || 0) * 100) / 100;
    const days = deposit ? 0 : Math.max(0, Math.round(Number(form.days) || 0));
    const balance = state.value.balances.find(item => item.id === form.balanceId);
    if (amount <= 0) {
      showToast("Укажите сумму больше нуля");
      return false;
    }
    if (!balance) {
      showToast("Выберите конверт");
      return false;
    }
    if (!deposit && amount > balance.amount) {
      showToast(`В конверте «${balance.name}» недостаточно: есть ${money(balance.amount)}`);
      return false;
    }
    balance.amount = Math.round((balance.amount + (deposit ? amount : -amount)) * 100) / 100;
    state.value.purchases.push({
      id: crypto.randomUUID(), type, name, amount, balanceId: balance.id,
      balanceName: balance.name, days, date: form.date || dateKey(new Date())
    });
    saveState();
    showToast(deposit ? `${name}: + ${money(amount)} в «${balance.name}»` : `${name}: − ${money(amount)} из «${balance.name}»`);
    return true;
  }

  function undoPurchase(id) {
    const purchase = state.value.purchases.find(item => item.id === id);
    if (!purchase) return;
    const balance = state.value.balances.find(item => item.id === purchase.balanceId);
    if (!balance) {
      showToast("Конверт удалён. Сначала восстановите его, затем измените остаток вручную.");
      return;
    }
    const deposit = purchase.type === "deposit";
    if (deposit && purchase.amount > balance.amount) {
      showToast(`Нельзя отменить пополнение: в «${balance.name}» осталось только ${money(balance.amount)}`);
      return;
    }
    balance.amount = Math.round((balance.amount + (deposit ? -purchase.amount : purchase.amount)) * 100) / 100;
    state.value.purchases = state.value.purchases.filter(item => item.id !== id);
    saveState();
    showToast(deposit ? `Пополнение отменено, ${money(purchase.amount)} вычтены из «${balance.name}»` : `Покупка отменена, ${money(purchase.amount)} возвращены в «${balance.name}»`);
  }

  async function makeShareLink() {
    if (sync) return sync.url;
    return `${location.origin}${location.pathname}#${await encodeState(state.value)}`;
  }

  function exportBudget() {
    const blob = new Blob([JSON.stringify(state.value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `semeiny-byudzhet-${state.value.month}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Резервная копия скачана");
  }

  async function importBudget(file) {
    if (!file) return;
    try {
      const imported = normalizeState(JSON.parse(await file.text()));
      if (!sync) storageKey = `${STORAGE_PREFIX}import:${Date.now()}`;
      state.value = imported;
      saveState();
      activeTab.value = "overview";
      showToast("Данные восстановлены");
    } catch {
      showToast("Не удалось прочитать файл. Выберите резервную копию бюджета.");
    }
  }

  function dismissRecovery() {
    recovery.value = null;
    writeLocal(RECOVERY_PREFIX + storageKey, null);
  }

  function restoreLocal() {
    state.value = normalizeState(recovery.value);
    saveState();
    dismissRecovery();
    showToast("Прежние записи восстановлены и отправляются в общий бюджет");
  }

  onMounted(initialize);
  onBeforeUnmount(() => {
    sync?.close();
    clearTimeout(toastTimer);
  });

  return {
    state, calc, loading, errorMessage, activeTab, shared, syncStatus, recovery, toast, showToast,
    selectTab, createBlank, setMonth, changeMonth, setCreditNote, updateSetting, updateWorkday,
    resetWorkdays, updateItem, addItem, deleteItem, closeGoal, recordPurchase, undoPurchase,
    makeShareLink, exportBudget, importBudget, dismissRecovery, restoreLocal
  };
}
