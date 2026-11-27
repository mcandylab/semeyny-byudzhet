// State of the mobile family budget: a cache of PocketBase records, the views
// the screens read, and the actions that change records. The api is
// createPocketbaseApi (the real app) or createDemoApi (the design pages).

import { automaticWorkdays, calculate } from "~/utils/budget";
import { COLLECTIONS, errorMessage } from "~/utils/family-api";
import {
  byPosition, categoryMeta, dayFromPb, dayLabel, dayToPb, monthKey, nextPosition
} from "~/utils/family";

const BUDGET_KEY = Symbol("family-budget");
const emptyDb = () => Object.fromEntries(COLLECTIONS.map(name => [name, []]));

export function provideFamilyBudget(budget) {
  provide(BUDGET_KEY, budget);
}

export function useFamilyBudget() {
  const budget = inject(BUDGET_KEY, null);
  if (!budget) throw new Error("useFamilyBudget() вызван вне MobileApp");
  return budget;
}

export function createFamilyBudget(api) {
  const db = reactive(emptyDb());
  const user = ref(api.currentUser());
  // signed-out → loading → ready, or error when the budget could not be loaded.
  const phase = ref(user.value ? "loading" : "signed-out");
  const loadError = ref("");
  const online = ref(true);
  const saving = ref(0);
  const month = ref(monthKey());
  const toast = ref(null);
  let toastTimer;
  let connectedBefore = false;

  // The design pages render on the server, so the demo data is there from the start.
  if (api.snapshot) {
    Object.assign(db, api.snapshot());
    if (user.value) phase.value = "ready";
  }

  /* ---------- Views ---------- */

  const household = computed(() => db.households[0] || null);
  const isOwner = computed(() => user.value?.role === "owner");
  const codeById = computed(() => Object.fromEntries(db.categories.map(item => [item.id, item.code])));
  const idByCode = computed(() => Object.fromEntries(db.categories.map(item => [item.code, item.id])));
  const paidKeys = computed(() => new Set(db.expense_payments.map(item => `${item.expense}:${item.month}`)));
  const categoryOf = record => codeById.value[record.category] || "other";

  const expenses = computed(() => [...db.expenses].sort(byPosition).map(record => {
    const category = categoryOf(record);
    return {
      id: record.id,
      name: record.name,
      amount: record.amount || 0,
      payday: Number(record.payday) === 20 ? 20 : 5,
      category,
      meta: categoryMeta(category),
      paid: paidKeys.value.has(`${record.id}:${month.value}`)
    };
  }));

  const allEnvelopes = computed(() => [...db.envelopes].sort(byPosition).map(record => {
    const category = categoryOf(record);
    const meta = categoryMeta(category);
    return { id: record.id, name: record.name, amount: record.balance || 0, category, icon: meta.icon, color: meta.color, archived: Boolean(record.archived) };
  }));
  const envelopes = computed(() => allEnvelopes.value.filter(item => !item.archived));
  const archivedEnvelopes = computed(() => allEnvelopes.value.filter(item => item.archived));
  const envelopeById = computed(() => Object.fromEntries(allEnvelopes.value.map(item => [item.id, item])));

  const operations = computed(() => db.operations.map(record => {
    const envelope = envelopeById.value[record.envelope];
    return {
      id: record.id,
      type: record.type === "deposit" ? "deposit" : "purchase",
      name: record.name,
      amount: record.amount || 0,
      days: record.days || 0,
      date: dayFromPb(record.date),
      created: record.created,
      envelopeId: record.envelope,
      // The name the envelope had when the operation was recorded.
      envelope: record.envelope_name,
      icon: envelope?.icon || "cart",
      color: envelope?.color || "var(--m-muted)"
    };
  }).sort((a, b) => b.date.localeCompare(a.date) || String(b.created).localeCompare(String(a.created))));

  const operationGroups = computed(() => {
    const groups = [];
    for (const item of operations.value) {
      const last = groups[groups.length - 1];
      if (last?.day === item.date) last.items.push(item);
      else groups.push({ day: item.date, label: dayLabel(item.date), items: [item] });
    }
    return groups;
  });

  // Envelopes for one-tap purchases: the most recently used first.
  const quickEnvelopes = computed(() => {
    const lastUse = {};
    for (const item of operations.value) lastUse[item.envelopeId] ||= item.date;
    return [...envelopes.value]
      .sort((a, b) => String(lastUse[b.id] || "").localeCompare(String(lastUse[a.id] || "")))
      .slice(0, 4);
  });

  const allGoals = computed(() => [...db.goals].sort(byPosition).map(record => ({
    id: record.id,
    name: record.name,
    target: record.target || 0,
    saved: record.saved || 0,
    planned: record.planned || 0,
    payday: Number(record.payday) || 0,
    dueDate: dayFromPb(record.due_date),
    closed: Boolean(record.closed),
    closedAt: record.closed ? dayFromPb(record.updated) : ""
  })));
  const goals = computed(() => allGoals.value.filter(goal => !goal.closed));
  const closedGoals = computed(() => allGoals.value.filter(goal => goal.closed));

  // The old app's state shape, so calculate() gives exactly the same totals.
  const calc = computed(() => calculate({
    month: month.value,
    settings: { salary: household.value?.salary || 0, titheRate: household.value?.tithe_rate || 0 },
    workdays: Object.fromEntries(db.workday_overrides.map(item => [item.month, { first: item.first_days, second: item.second_days }])),
    expenses: expenses.value,
    balances: envelopes.value,
    goals: allGoals.value
  }));
  const autoWorkdays = computed(() => automaticWorkdays(month.value));
  const workdaysManual = computed(() => db.workday_overrides.some(item => item.month === month.value));

  const categoryTotals = computed(() => {
    const totals = {};
    for (const item of expenses.value) {
      totals[item.category] ||= { key: item.category, amount: 0, count: 0, ...item.meta };
      totals[item.category].amount += item.amount;
      totals[item.category].count += 1;
    }
    return Object.values(totals).sort((a, b) => b.amount - a.amount);
  });

  // Deposits minus purchases in the selected month.
  const monthFlow = computed(() => operations.value
    .filter(item => item.date.startsWith(month.value))
    .reduce((total, item) => total + (item.type === "deposit" ? item.amount : -item.amount), 0));

  const members = computed(() => [...db.users].sort((a, b) => (
    (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1) || String(a.created).localeCompare(String(b.created))
  )));
  const invites = computed(() => {
    const now = new Date().toISOString().replace("T", " ");
    return db.invites.filter(item => !item.used_by && item.expires_at > now).sort((a, b) => String(b.created).localeCompare(String(a.created)));
  });

  const lastChange = computed(() => ["households", "expenses", "expense_payments", "envelopes", "operations", "goals", "workday_overrides"]
    .flatMap(name => db[name].map(record => record.updated || record.created || ""))
    .sort()
    .pop() || "");

  const status = computed(() => (!online.value ? "offline" : saving.value ? "saving" : "saved"));

  /* ---------- Cache ---------- */

  function put(name, record) {
    const list = db[name];
    const index = list.findIndex(item => item.id === record.id);
    if (index === -1) list.push(record);
    else list[index] = record;
    if (name === "users" && record.id === user.value?.id) user.value = { ...user.value, ...record };
  }

  function drop(name, id) {
    const index = db[name].findIndex(item => item.id === id);
    if (index !== -1) db[name].splice(index, 1);
    if (name === "expenses") db.expense_payments = db.expense_payments.filter(item => item.expense !== id);
    if (name === "users" && id === user.value?.id) signedOut("Вас удалили из семейного бюджета");
  }

  function onRecord(name, action, record) {
    if (action === "delete") drop(name, record.id);
    else put(name, record);
  }

  async function reload() {
    const data = await api.load(user.value);
    for (const name of COLLECTIONS) db[name] = data[name];
    online.value = true;
  }

  const live = {
    onRecord,
    onConnect() {
      online.value = true;
      // After a lost connection, catch up on what changed meanwhile.
      if (connectedBefore) reload().catch(() => {});
      connectedBefore = true;
    },
    onDisconnect() {
      online.value = false;
    }
  };

  /* ---------- Session ---------- */

  function notify(text, tone = "ok") {
    if (!text) return;
    toast.value = { text, tone, id: Date.now() };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.value = null; }, tone === "error" ? 4200 : 2600);
  }

  function signedOut(message = "") {
    api.logout().catch(() => {});
    user.value = null;
    Object.assign(db, emptyDb());
    phase.value = "signed-out";
    connectedBefore = false;
    if (message) notify(message, "error");
  }

  async function start() {
    if (!user.value) {
      phase.value = "signed-out";
      return;
    }
    if (api.snapshot) {
      Object.assign(db, api.snapshot());
      phase.value = "ready";
      return;
    }
    phase.value = "loading";
    loadError.value = "";
    try {
      user.value = await api.refresh();
      await reload();
      await api.subscribe(live);
      phase.value = "ready";
    } catch (error) {
      if ([401, 403, 404].includes(error?.status)) {
        signedOut("Войдите ещё раз");
        return;
      }
      loadError.value = errorMessage(error, "Не удалось загрузить бюджет");
      phase.value = "error";
    }
  }

  function onVisible() {
    // Phones pause background tabs and may drop the live connection silently.
    if (document.visibilityState === "visible" && phase.value === "ready" && !api.snapshot) reload().catch(() => {});
  }

  function attach() {
    document.addEventListener("visibilitychange", onVisible);
    return start();
  }

  function detach() {
    document.removeEventListener("visibilitychange", onVisible);
    clearTimeout(toastTimer);
    api.unsubscribe();
  }

  async function login(username, password) {
    try {
      user.value = await api.login(username, password);
    } catch (error) {
      return error?.status === 400 ? "Неверный логин или пароль" : errorMessage(error, "Не удалось войти");
    }
    await start();
    return "";
  }

  async function join(form) {
    try {
      user.value = await api.join(form);
    } catch (error) {
      return errorMessage(error, "Не удалось присоединиться к семье");
    }
    await start();
    return "";
  }

  async function logout() {
    signedOut();
  }

  /* ---------- Changes ---------- */

  // Runs a change, reports errors in a toast and tells whether it worked.
  async function run(task, fallback) {
    saving.value += 1;
    try {
      await task();
      return true;
    } catch (error) {
      notify(errorMessage(error, fallback), "error");
      if (error?.status === 401) signedOut();
      return false;
    } finally {
      saving.value -= 1;
    }
  }

  const householdId = () => household.value?.id || user.value?.household;

  function updateHousehold(patch) {
    return run(async () => put("households", await api.update("households", householdId(), patch)));
  }

  function saveWorkdays(key, first, second) {
    return run(async () => {
      const auto = automaticWorkdays(key);
      const existing = db.workday_overrides.find(item => item.month === key);
      if (first === auto.first && second === auto.second) {
        if (existing) {
          await api.remove("workday_overrides", existing.id);
          drop("workday_overrides", existing.id);
        }
        return;
      }
      const data = { first_days: first, second_days: second };
      put("workday_overrides", existing
        ? await api.update("workday_overrides", existing.id, data)
        : await api.create("workday_overrides", { household: householdId(), month: key, ...data }));
    });
  }

  async function switchPaid(expenseId) {
    const existing = db.expense_payments.find(item => item.expense === expenseId && item.month === month.value);
    if (existing?.id.startsWith("pending-")) return;
    if (existing) {
      // The check mark changes at once; the server catches up.
      drop("expense_payments", existing.id);
      try {
        await api.remove("expense_payments", existing.id);
      } catch (error) {
        if (error?.status !== 404) {
          put("expense_payments", existing);
          throw error;
        }
      }
      return;
    }
    const pending = { id: `pending-${expenseId}-${month.value}`, expense: expenseId, month: month.value };
    put("expense_payments", pending);
    try {
      const record = await api.create("expense_payments", { expense: expenseId, month: month.value });
      drop("expense_payments", pending.id);
      put("expense_payments", record);
    } catch (error) {
      drop("expense_payments", pending.id);
      throw error;
    }
  }

  const togglePaid = expenseId => run(() => switchPaid(expenseId));

  function saveExpense(form) {
    return run(async () => {
      const data = {
        name: form.name.trim() || "Без названия",
        amount: form.amount,
        category: idByCode.value[form.category] || idByCode.value.other,
        payday: String(form.payday)
      };
      const record = form.id
        ? await api.update("expenses", form.id, data)
        : await api.create("expenses", { ...data, household: householdId(), position: nextPosition(db.expenses) });
      put("expenses", record);
      if (Boolean(form.paid) !== paidKeys.value.has(`${record.id}:${month.value}`)) await switchPaid(record.id);
    });
  }

  function deleteExpense(id) {
    return run(async () => {
      await api.remove("expenses", id);
      drop("expenses", id);
    }, "Не удалось удалить расход");
  }

  function saveEnvelope(form) {
    return run(async () => {
      const data = {
        name: form.name.trim() || "Конверт",
        category: idByCode.value[form.category] || idByCode.value.other,
        balance: form.amount
      };
      put("envelopes", form.id
        ? await api.update("envelopes", form.id, data)
        : await api.create("envelopes", { ...data, household: householdId(), archived: false, position: nextPosition(db.envelopes) }));
    });
  }

  function setEnvelopeArchived(id, archived) {
    return run(async () => put("envelopes", await api.update("envelopes", id, { archived })));
  }

  function recordOperation(form) {
    return run(async () => {
      const { operation, envelope } = await api.recordOperation({
        envelope: form.envelope,
        type: form.type,
        name: form.name.trim(),
        amount: form.amount,
        days: form.type === "deposit" ? 0 : form.days,
        date: form.date
      });
      put("envelopes", envelope);
      put("operations", operation);
    }, "Не удалось записать операцию");
  }

  function undoOperation(id) {
    return run(async () => {
      const { envelope } = await api.undoOperation(id);
      put("envelopes", envelope);
      drop("operations", id);
    }, "Не удалось отменить операцию");
  }

  function saveGoal(form) {
    return run(async () => {
      const data = {
        name: form.name.trim() || "Новая цель",
        target: form.target,
        saved: form.saved,
        planned: form.planned,
        payday: form.payday ? String(form.payday) : "",
        due_date: dayToPb(form.dueDate)
      };
      put("goals", form.id
        ? await api.update("goals", form.id, data)
        : await api.create("goals", { ...data, household: householdId(), closed: false, position: nextPosition(db.goals) }));
    });
  }

  function setGoalClosed(id, closed) {
    // A closed goal no longer takes money from a payday.
    return run(async () => put("goals", await api.update("goals", id, closed ? { closed, planned: 0 } : { closed })));
  }

  function deleteGoal(id) {
    return run(async () => {
      await api.remove("goals", id);
      drop("goals", id);
    }, "Не удалось удалить цель");
  }

  async function createInvite() {
    let invite = null;
    await run(async () => {
      invite = await api.create("invites", { household: householdId() });
      put("invites", invite);
    }, "Не удалось создать приглашение");
    return invite;
  }

  function deleteInvite(id) {
    return run(async () => {
      await api.remove("invites", id);
      drop("invites", id);
    });
  }

  function removeMember(id) {
    return run(async () => {
      await api.remove("users", id);
      drop("users", id);
    }, "Не удалось удалить участника");
  }

  function renameMe(name) {
    return run(async () => put("users", await api.update("users", user.value.id, { name: name.trim() || user.value.username })));
  }

  function changePassword(oldPassword, password) {
    return run(async () => {
      user.value = await api.changePassword(user.value, oldPassword, password);
      // The old session is gone, so the live connection signs in again.
      await api.unsubscribe();
      connectedBefore = false;
      await api.subscribe(live);
    }, "Не удалось сменить пароль. Проверьте текущий пароль");
  }

  // The backup file of the old app (its "Скачать копию"), readable by both apps.
  function backup() {
    return {
      version: 1,
      month: month.value,
      settings: { salary: household.value?.salary || 0, titheRate: household.value?.tithe_rate || 0 },
      workdays: Object.fromEntries(db.workday_overrides.map(item => [item.month, { first: item.first_days, second: item.second_days }])),
      expenses: expenses.value.map(item => ({
        id: item.id, name: item.name, amount: item.amount, payday: item.payday, category: item.category,
        paidMonths: db.expense_payments.filter(payment => payment.expense === item.id).map(payment => payment.month).sort()
      })),
      balances: envelopes.value.map(item => ({ id: item.id, name: item.name, amount: item.amount, category: item.category })),
      goals: allGoals.value.map(({ closedAt, ...goal }) => goal),
      purchases: [...db.operations]
        .sort((a, b) => String(a.created).localeCompare(String(b.created)))
        .map(record => ({
          id: record.id, type: record.type, name: record.name, amount: record.amount, balanceId: record.envelope,
          balanceName: record.envelope_name, days: record.days, date: dayFromPb(record.date)
        })),
      creditNote: household.value?.credit_note || "",
      updatedAt: lastChange.value ? lastChange.value.replace(" ", "T") : new Date().toISOString()
    };
  }

  return reactive({
    demo: Boolean(api.demo),
    db, user, phase, loadError, online, saving, status, month, toast,
    household, isOwner, expenses, envelopes, archivedEnvelopes, envelopeById, operations, operationGroups,
    quickEnvelopes, goals, closedGoals, calc, autoWorkdays, workdaysManual, categoryTotals, monthFlow,
    members, invites, lastChange,
    attach, detach, start, login, join, logout, notify, backup,
    updateHousehold, saveWorkdays, togglePaid, saveExpense, deleteExpense, saveEnvelope, setEnvelopeArchived,
    recordOperation, undoOperation, saveGoal, setGoalClosed, deleteGoal,
    createInvite, deleteInvite, removeMember, renameMe, changePassword
  });
}
