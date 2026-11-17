"use strict";

const CATEGORIES = {
  housing: "Жильё и связь",
  bank: "Банки и переводы",
  auto: "Автомобиль",
  personal: "Личное и подписки",
  food: "Продукты и дом",
  family: "Семья",
  pets: "Питомцы",
  obligations: "Обязательное",
  plans: "Планы и покупки",
  other: "Другое"
};

const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const HOLIDAYS = new Set([
  "2025-12-31",
  "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
  "2026-02-23", "2026-03-09", "2026-05-01", "2026-05-11", "2026-06-12", "2026-11-04", "2026-12-31",
  "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08",
  "2027-02-22", "2027-02-23", "2027-03-08", "2027-05-03", "2027-05-10", "2027-06-14", "2027-11-04", "2027-11-05", "2027-12-31"
]);
const EXTRA_WORKDAYS = new Set(["2027-02-20"]);

const moneyFormatter = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const app = document.querySelector("#app");
const shareDialog = document.querySelector("#share-dialog");
const shareUrlInput = document.querySelector("#share-url");
const importFile = document.querySelector("#import-file");

let state = null;
let activeTab = "overview";
let storageKey = "";
let toastTimer;

function money(value) {
  return moneyFormatter.format(Math.round(Number(value) || 0));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return { year, month: number };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function blankState() {
  return {
    version: 1,
    month: currentMonth(),
    settings: { salary: 0, titheRate: 10 },
    workdays: {},
    expenses: [],
    balances: [],
    goals: [],
    purchases: [],
    creditNote: "",
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(value) {
  if (!value || typeof value !== "object") throw new Error("Некорректные данные");
  const normalized = {
    version: 1,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ? value.month : currentMonth(),
    settings: {
      salary: Math.max(0, Number(value.settings?.salary) || 0),
      titheRate: Math.max(0, Number(value.settings?.titheRate) || 0)
    },
    workdays: value.workdays && typeof value.workdays === "object" ? value.workdays : {},
    expenses: Array.isArray(value.expenses) ? value.expenses.map((item, index) => ({
      id: String(item.id || `e${Date.now()}-${index}`),
      name: String(item.name || "Без названия"),
      amount: Math.max(0, Number(item.amount) || 0),
      payday: Number(item.payday) === 20 ? 20 : 5,
      category: CATEGORIES[item.category] ? item.category : "other"
    })) : [],
    balances: Array.isArray(value.balances) ? value.balances.map((item, index) => ({
      id: String(item.id || `b${Date.now()}-${index}`),
      name: String(item.name || "Без названия"),
      amount: Math.max(0, Number(item.amount) || 0),
      category: CATEGORIES[item.category] ? item.category : "other"
    })) : [],
    goals: Array.isArray(value.goals) ? value.goals.map((item, index) => ({
      id: String(item.id || `g${Date.now()}-${index}`),
      name: String(item.name || "Новая цель"),
      target: Math.max(0, Number(item.target) || 0),
      saved: Math.max(0, Number(item.saved) || 0),
      planned: Math.max(0, Number(item.planned) || 0),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : "",
      payday: [5, 20].includes(Number(item.payday)) ? Number(item.payday) : 0
    })) : [],
    purchases: Array.isArray(value.purchases) ? value.purchases.map((item, index) => ({
      id: String(item.id || `p${Date.now()}-${index}`),
      name: String(item.name || "Покупка"),
      amount: Math.max(0, Number(item.amount) || 0),
      balanceId: String(item.balanceId || ""),
      balanceName: String(item.balanceName || "Конверт"),
      days: Math.max(0, Math.round(Number(item.days) || 0)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : dateKey(new Date())
    })) : [],
    creditNote: String(value.creditNote || ""),
    updatedAt: value.updatedAt || new Date().toISOString()
  };
  return normalized;
}

function isWorkingDay(date) {
  const key = dateKey(date);
  if (EXTRA_WORKDAYS.has(key)) return true;
  return date.getDay() !== 0 && date.getDay() !== 6 && !HOLIDAYS.has(key);
}

function automaticWorkdays(month) {
  const { year, month: monthNumber } = parseMonth(month);
  const days = new Date(year, monthNumber, 0).getDate();
  let first = 0;
  let second = 0;
  for (let day = 1; day <= days; day += 1) {
    if (!isWorkingDay(new Date(year, monthNumber - 1, day))) continue;
    if (day <= 15) first += 1;
    else second += 1;
  }
  return { first, second, total: first + second, days };
}

function getWorkdays(month) {
  const automatic = automaticWorkdays(month);
  const override = state.workdays?.[month] || {};
  const first = Number.isFinite(Number(override.first)) && override.first !== "" && override.first != null ? Math.max(0, Number(override.first)) : automatic.first;
  const second = Number.isFinite(Number(override.second)) && override.second !== "" && override.second != null ? Math.max(0, Number(override.second)) : automatic.second;
  return { ...automatic, first, second, total: first + second };
}

function adjustedPayday(date) {
  const result = new Date(date);
  const weekday = result.getDay();
  if (weekday >= 1 && weekday <= 5 && !HOLIDAYS.has(dateKey(result))) return result;
  do {
    result.setDate(result.getDate() - 1);
  } while (result.getDay() !== 5 || HOLIDAYS.has(dateKey(result)));
  return result;
}

function sumItems(items) {
  return items.reduce((total, item) => total + (Number(item.amount) || 0), 0);
}

function foodCalculation(payday, expenses, year, monthNumber) {
  const budget = sumItems(expenses.filter(item => ["продукты", "еда"].includes(item.name.trim().toLowerCase())));
  const start = payday === 5 ? new Date(year, monthNumber, 6) : new Date(year, monthNumber - 1, 21);
  const end = payday === 5 ? new Date(year, monthNumber, 20) : new Date(year, monthNumber, 5);
  const days = Math.round((end - start) / 86400000) + 1;
  const nextMonthName = MONTHS_GENITIVE[monthNumber % 12];
  return {
    foodBudget: budget,
    foodDays: days,
    foodDaily: days ? Math.round(budget / days) : 0,
    foodPeriod: payday === 5 ? `6–20 ${nextMonthName}` : `21 ${MONTHS_GENITIVE[monthNumber - 1]}–5 ${nextMonthName}`
  };
}

function calculate() {
  const { year, month: monthNumber } = parseMonth(state.month);
  const workdays = getWorkdays(state.month);
  const salary = Number(state.settings.salary) || 0;
  const titheRate = Number(state.settings.titheRate) || 0;
  const firstSalary = workdays.total ? Math.round(salary / workdays.total * workdays.first) : 0;
  const secondSalary = workdays.total ? Math.round(salary / workdays.total * workdays.second) : 0;
  const expenses5 = state.expenses.filter(item => item.payday === 5);
  const expenses20 = state.expenses.filter(item => item.payday === 20);
  const expenseSum5 = sumItems(expenses5);
  const expenseSum20 = sumItems(expenses20);
  const tithe5 = Math.round(secondSalary * titheRate / 100);
  const tithe20 = Math.round(firstSalary * titheRate / 100);
  const date5 = new Date(year, monthNumber, 5);
  const date20 = new Date(year, monthNumber - 1, 20);
  const pay5 = adjustedPayday(date5);
  const pay20 = adjustedPayday(date20);
  const goalTarget = state.goals.reduce((total, goal) => total + goal.target, 0);
  const goalSaved = state.goals.reduce((total, goal) => total + goal.saved, 0);
  const goalAllocated = state.goals.reduce((total, goal) => total + goal.planned, 0);
  const goalAllocated5 = state.goals.filter(goal => goal.payday === 5).reduce((total, goal) => total + goal.planned, 0);
  const goalAllocated20 = state.goals.filter(goal => goal.payday === 20).reduce((total, goal) => total + goal.planned, 0);
  const goalWithoutPayday = state.goals.filter(goal => !goal.payday).reduce((total, goal) => total + goal.planned, 0);
  const goalRemaining = state.goals.reduce((total, goal) => total + Math.max(0, goal.target - goal.saved - goal.planned), 0);
  const free = firstSalary + secondSalary - expenseSum5 - expenseSum20 - tithe5 - tithe20;
  const food5 = foodCalculation(5, expenses5, year, monthNumber);
  const food20 = foodCalculation(20, expenses20, year, monthNumber);
  return {
    workdays,
    salary: firstSalary + secondSalary,
    balances: sumItems(state.balances),
    expenses: expenseSum5 + expenseSum20,
    tithe: tithe5 + tithe20,
    free,
    goalTarget,
    goalSaved,
    goalAllocated,
    goalAllocated5,
    goalAllocated20,
    goalWithoutPayday,
    goalRemaining,
    unassigned: free - goalAllocated,
    p5: {
      payday: 5,
      salary: secondSalary,
      days: workdays.second,
      expenses: expenseSum5,
      tithe: tithe5,
      free: secondSalary - expenseSum5 - tithe5,
      goalAllocated: goalAllocated5,
      afterGoals: secondSalary - expenseSum5 - tithe5 - goalAllocated5,
      date: pay5,
      nominalDate: date5,
      period: `16–${workdays.days} ${MONTHS_GENITIVE[monthNumber - 1]}`,
      ...food5
    },
    p20: {
      payday: 20,
      salary: firstSalary,
      days: workdays.first,
      expenses: expenseSum20,
      tithe: tithe20,
      free: firstSalary - expenseSum20 - tithe20,
      goalAllocated: goalAllocated20,
      afterGoals: firstSalary - expenseSum20 - tithe20 - goalAllocated20,
      date: pay20,
      nominalDate: date20,
      period: `1–15 ${MONTHS_GENITIVE[monthNumber - 1]}`,
      ...food20
    }
  };
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  if (storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      showToast("Не удалось сохранить на устройстве. Скачайте резервную копию.");
    }
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

function brand() {
  return `<div class="brand"><div class="brand-mark">СБ</div><div><h1>Семейный бюджет</h1><p>Общая финансовая картина семьи</p></div></div>`;
}

function renderWelcome(errorMessage = "") {
  app.innerHTML = `<main class="shell">
    <div class="topbar">${brand()}</div>
    <section class="card" style="max-width:680px;margin:70px auto;text-align:center">
      <p class="eyebrow">Бюджет всегда под рукой</p>
      <h2 style="font-size:30px">Откройте семейную ссылку</h2>
      <p class="card-subtitle" style="max-width:480px;margin:12px auto 24px">Если у вас есть ссылка на бюджет, откройте её целиком вместе с частью после #. Здесь также можно начать с чистого листа или восстановить резервную копию.</p>
      ${errorMessage ? `<p style="color:var(--red)">${escapeHtml(errorMessage)}</p>` : ""}
      <div class="actions-list" style="justify-content:center">
        <button class="button primary" data-action="create-blank">Создать пустой бюджет</button>
        <button class="button secondary" data-action="import">Восстановить копию</button>
      </div>
    </section>
  </main>`;
}

function renderStat(label, value, note, className = "") {
  return `<article class="stat ${className}"><div class="stat-label">${label}</div><div class="stat-value">${money(value)}</div><div class="stat-note">${note}</div></article>`;
}

function renderPaydayCard(payment, totalWorkdays) {
  const spent = payment.expenses + payment.tithe + payment.goalAllocated;
  const percent = payment.salary > 0 ? Math.min(100, spent / payment.salary * 100) : 0;
  const moved = dateKey(payment.date) !== dateKey(payment.nominalDate);
  return `<article class="card">
    <div class="card-head">
      <div><p class="eyebrow">${escapeHtml(payment.period)}</p><h2>${dateFormatter.format(payment.date)}</h2></div>
      <span class="pill">${payment.days} раб. дн.</span>
    </div>
    <div class="big-money">${money(payment.salary)}</div>
    <div class="card-subtitle">Формула: ${money(state.settings.salary)} ÷ ${totalWorkdays} × ${payment.days}${moved ? `<br>Оплата перенесена на пятницу перед ${payment.payday}-м числом.` : ""}</div>
    <div class="meter ${spent > payment.salary ? "over" : ""}"><span style="width:${percent}%"></span></div>
    <div class="meter-note">Распределено ${money(spent)} из ${money(payment.salary)}</div>
    <div class="breakdown" style="margin-top:18px">
      <div class="breakdown-row"><span>Расходы</span><strong>− ${money(payment.expenses)}</strong></div>
      <div class="breakdown-row"><span>Десятина (${state.settings.titheRate}%)</span><strong>− ${money(payment.tithe)}</strong></div>
      <div class="breakdown-row"><span>Откладываем на цели</span><strong>− ${money(payment.goalAllocated)}</strong></div>
      <div class="breakdown-row total ${payment.afterGoals < 0 ? "negative" : ""}"><span>Остаётся после целей</span><strong>${money(payment.afterGoals)}</strong></div>
    </div>
    <button class="button ghost small" style="margin-top:18px" data-tab="pay${payment.payday}">Открыть список расходов</button>
  </article>`;
}

function categoryTotals() {
  const totals = {};
  state.expenses.forEach(item => {
    totals[item.category] = (totals[item.category] || 0) + Number(item.amount || 0);
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function renderOverview(calc) {
  const categories = categoryTotals();
  const max = categories[0]?.[1] || 1;
  return `<section>
    <div class="stats">
      ${renderStat("Зарплата за месяц", calc.salary, `${calc.workdays.total} рабочих дней`, "accent")}
      ${renderStat("Постоянные расходы", calc.expenses, "Обе выплаты вместе")}
      ${renderStat("Десятина", calc.tithe, `${state.settings.titheRate}% от каждой выплаты`)}
      ${renderStat("Свободный остаток", calc.free, "Можно распределить на цели", calc.free < 0 ? "negative" : "")}
    </div>
    <div class="notice"><span class="notice-dot"></span><div><strong>Сейчас в конвертах и на целях: ${money(calc.balances)}.</strong> Это уже имеющиеся деньги, они не прибавляются к свободному остатку от будущей зарплаты.</div></div>
    ${state.creditNote ? `<div class="section-heading"><div><h2>Мужу: порядок действий с кредитками</h2><p>Долги, лимиты и схема беспроцентного погашения</p></div><span class="pill gold">Важно</span></div><div class="card credit-note-card"><textarea class="comment-input" data-credit-note aria-label="Комментарий для мужа о кредитках">${escapeHtml(state.creditNote)}</textarea><p class="comment-hint">Текст можно редактировать. Чтобы передать изменение, создайте новую ссылку.</p></div>` : ""}
    <div class="grid-two">${renderPaydayCard(calc.p20, calc.workdays.total)}${renderPaydayCard(calc.p5, calc.workdays.total)}</div>
    <div class="section-heading"><div><h2>На что нужны деньги</h2><p>Цели, накопления и распределение свободного остатка</p></div><button class="button ghost small" data-tab="goals">Открыть цели</button></div>
    <div class="card goal-summary">
      <div><span>Общая сумма целей</span><strong>${money(calc.goalTarget)}</strong></div>
      <div><span>Уже отложено</span><strong>${money(calc.goalSaved)}</strong></div>
      <div><span>Выделяем из свободных</span><strong>${money(calc.goalAllocated)}</strong></div>
      <div><span>Ещё нужно собрать</span><strong>${money(calc.goalRemaining)}</strong></div>
    </div>
    <div class="section-heading"><div><h2>Куда уходит зарплата</h2><p>Регулярные расходы по категориям, без десятины</p></div><span class="pill gold">Всего ${money(calc.expenses)}</span></div>
    <div class="card">
      ${categories.length ? `<div class="category-list">${categories.map(([category, amount]) => `<div class="category-row"><span>${CATEGORIES[category]}</span><div class="category-track"><span style="width:${amount / max * 100}%"></span></div><strong>${money(amount)}</strong></div>`).join("")}</div>` : `<div class="empty">Добавьте расходы, чтобы увидеть распределение по категориям.</div>`}
    </div>
  </section>`;
}

function categoryOptions(selected) {
  return Object.entries(CATEGORIES).map(([key, label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
}

function currentFoodDaily(balance) {
  if (!["еда", "продукты"].includes(balance.name.trim().toLowerCase())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  let start;
  let end;
  if (day <= 5) {
    start = new Date(year, month - 1, 21, 12);
    end = new Date(year, month, 5, 12);
  } else if (day <= 20) {
    start = new Date(year, month, 6, 12);
    end = new Date(year, month, 20, 12);
  } else {
    start = new Date(year, month, 21, 12);
    end = new Date(year, month + 1, 5, 12);
  }
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const periodDays = Math.max(0, Math.round((end - today) / 86400000) + 1);
  const coveredDays = state.purchases
    .filter(purchase => purchase.balanceId === balance.id && purchase.date >= startKey && purchase.date <= endKey)
    .reduce((total, purchase) => total + purchase.days, 0);
  const remainingDays = Math.max(0, periodDays - coveredDays);
  return {
    remainingDays,
    coveredDays,
    daily: remainingDays > 0 ? Math.round(balance.amount / remainingDays) : 0
  };
}

function renderRows(items, kind) {
  const columns = kind === "balances" ? 5 : 4;
  if (!items.length) return `<tr><td colspan="${columns}"><div class="empty">Пока нет ни одной позиции.</div></td></tr>`;
  return items.map(item => {
    const daily = kind === "balances" ? currentFoodDaily(item) : null;
    return `<tr>
      <td><input class="name-input" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-field="name" value="${escapeHtml(item.name)}" aria-label="Название"></td>
      <td><input class="amount-input" type="number" min="0" step="1" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-field="amount" value="${Number(item.amount) || 0}" aria-label="Сумма в рублях"></td>
      <td><select class="category-select" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-field="category" aria-label="Категория">${categoryOptions(item.category)}</select></td>
      ${kind === "balances" ? `<td>${daily ? `<div class="balance-daily"><strong>${daily.remainingDays > 0 ? `${money(daily.daily)} / день` : "Дни закрыты"}</strong><span>${daily.remainingDays > 0 ? `осталось ${daily.remainingDays} дн.` : `покрыто ${daily.coveredDays} дн.`}${daily.coveredDays > 0 && daily.remainingDays > 0 ? ` · закрыто ${daily.coveredDays}` : ""}</span></div>` : "—"}</td>` : ""}
      <td><button class="icon-button delete-button" data-action="delete" data-kind="${kind}" data-id="${escapeHtml(item.id)}" aria-label="Удалить ${escapeHtml(item.name)}">×</button></td>
    </tr>`;
  }).join("");
}

function renderItemsCard(items, kind, calc, payday = null) {
  const payment = payday === 5 ? calc.p5 : payday === 20 ? calc.p20 : null;
  const title = payment ? `Расходы с выплаты ${payment.payday}-го` : "Сейчас есть и на что";
  const subtitle = payment ? `${escapeHtml(payment.period)} · выплата ${dateFormatter.format(payment.date)}` : "Текущие остатки по конвертам и целям";
  return `<section class="card">
    <div class="card-head"><div><p class="eyebrow">Можно редактировать</p><h2>${title}</h2><p class="card-subtitle">${subtitle}</p></div><span class="pill">${items.length} поз.</span></div>
    ${payment ? `<div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:20px">
      ${renderStat("Выплата", payment.salary, `${payment.days} рабочих дней`)}
      ${renderStat("Десятина", payment.tithe, `${state.settings.titheRate}% от выплаты`)}
      ${renderStat("После всех вычетов", payment.free, "Свободный остаток", payment.free < 0 ? "negative" : "")}
    </div>` : ""}
    <div class="table-wrap"><table><thead><tr><th>Название</th><th>Сумма, ₽</th><th>Категория</th>${kind === "balances" ? "<th>На каждый день</th>" : ""}<th></th></tr></thead><tbody>${renderRows(items, kind)}</tbody></table></div>
    <div class="table-footer"><button class="button secondary small" data-action="add" data-kind="${kind}" ${payday ? `data-payday="${payday}"` : ""}>+ Добавить позицию</button><div class="table-total">Итого<strong>${money(sumItems(items))}</strong></div></div>
  </section>`;
}

function renderBalancesSection(calc) {
  const food = state.balances.find(item => item.name.trim().toLowerCase() === "еда") || state.balances[0];
  const options = state.balances.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === food?.id ? "selected" : ""}>${escapeHtml(item.name)} — ${money(item.amount)}</option>`).join("");
  const purchases = [...state.purchases].reverse();
  const history = purchases.length ? purchases.map(purchase => `<div class="purchase-row">
    <div><div class="purchase-name">${escapeHtml(purchase.name)}</div><div class="purchase-meta">${new Date(`${purchase.date}T12:00:00`).toLocaleDateString("ru-RU")} · из «${escapeHtml(purchase.balanceName)}»${purchase.days > 0 ? ` · на ${purchase.days} дн.` : ""}</div></div>
    <strong class="purchase-amount">− ${money(purchase.amount)}</strong>
    <button class="button ghost small" data-action="undo-purchase" data-id="${escapeHtml(purchase.id)}">Отменить</button>
  </div>`).join("") : `<div class="empty">Записанных покупок пока нет.</div>`;
  return `${renderItemsCard(state.balances, "balances", calc)}
    <div class="grid-two purchase-section">
      <section class="card">
        <div class="card-head"><div><p class="eyebrow">Списать трату</p><h2>Записать покупку</h2><p class="card-subtitle">Сумма автоматически вычитается из выбранного конверта</p></div></div>
        <div class="purchase-form">
          <label class="field"><span class="field-label">Что купили</span><input id="purchase-name" class="settings-input" value="Продукты" autocomplete="off"></label>
          <div class="purchase-form-grid">
            <label class="field"><span class="field-label">Сумма</span><span class="input-with-suffix"><input id="purchase-amount" class="settings-input" type="number" min="0.01" step="0.01" placeholder="500"><span class="input-suffix">₽</span></span></label>
            <label class="field"><span class="field-label">Дата</span><input id="purchase-date" class="settings-input" type="date" value="${dateKey(new Date())}"></label>
          </div>
          <label class="field"><span class="field-label">На сколько дней покупка</span><input id="purchase-days" class="settings-input" type="number" min="0" step="1" value="1"></label>
          <p class="field-hint">Для еды: 1 — только сегодня, 2 — продукты на два дня, 0 — не вычитать дни из расчёта.</p>
          <label class="field"><span class="field-label">Откуда списать</span><select id="purchase-balance" class="settings-input">${options}</select></label>
          <button class="button primary" data-action="record-purchase" ${state.balances.length ? "" : "disabled"}>Записать покупку</button>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><div><p class="eyebrow">Последние траты</p><h2>История покупок</h2><p class="card-subtitle">Отмена вернёт деньги в тот же конверт</p></div><span class="pill">${purchases.length}</span></div>
        <div class="purchase-list">${history}</div>
      </section>
    </div>`;
}

function renderGoals(calc) {
  const rows = state.goals.length ? state.goals.map(goal => {
    const covered = goal.saved + goal.planned;
    const remaining = goal.target - covered;
    const progress = goal.target > 0 ? Math.min(100, covered / goal.target * 100) : 0;
    return `<tr>
      <td><input class="name-input" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="name" value="${escapeHtml(goal.name)}" aria-label="Название цели"></td>
      <td><input class="settings-input" type="date" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="dueDate" value="${goal.dueDate}" aria-label="Дата цели"></td>
      <td><select class="category-select" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="payday" aria-label="С какой зарплаты отложить"><option value="0" ${goal.payday === 0 ? "selected" : ""}>Не выбрано</option><option value="5" ${goal.payday === 5 ? "selected" : ""}>ЗП 5-го</option><option value="20" ${goal.payday === 20 ? "selected" : ""}>ЗП 20-го</option></select></td>
      <td><input class="amount-input" type="number" min="0" step="1" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="target" value="${goal.target}" aria-label="Нужно для цели"></td>
      <td><input class="amount-input" type="number" min="0" step="1" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="saved" value="${goal.saved}" aria-label="Уже отложено"></td>
      <td><input class="amount-input" type="number" min="0" step="1" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="planned" value="${goal.planned}" aria-label="Сколько отложить"></td>
      <td class="goal-remaining"><strong>${remaining > 0 ? money(remaining) : "Цель закрыта"}</strong><div class="meter"><span style="width:${progress}%"></span></div></td>
      <td><button class="icon-button delete-button" data-action="delete" data-kind="goals" data-id="${escapeHtml(goal.id)}" aria-label="Удалить ${escapeHtml(goal.name)}">×</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="8"><div class="empty">Добавьте первую цель.</div></td></tr>`;
  const cards = state.goals.length ? state.goals.map(goal => {
    const covered = goal.saved + goal.planned;
    const remaining = goal.target - covered;
    const progress = goal.target > 0 ? Math.min(100, covered / goal.target * 100) : 0;
    return `<article class="goal-mobile-card">
      <label class="field"><span class="field-label">Цель</span><input class="settings-input" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="name" value="${escapeHtml(goal.name)}" aria-label="Название цели"></label>
      <div class="goal-mobile-grid">
        <label class="field"><span class="field-label">Дата</span><input class="settings-input" type="date" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="dueDate" value="${goal.dueDate}" aria-label="Дата цели"></label>
        <label class="field"><span class="field-label">С какой ЗП</span><select class="settings-input" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="payday" aria-label="С какой зарплаты отложить"><option value="0" ${goal.payday === 0 ? "selected" : ""}>Не выбрано</option><option value="5" ${goal.payday === 5 ? "selected" : ""}>ЗП 5-го</option><option value="20" ${goal.payday === 20 ? "selected" : ""}>ЗП 20-го</option></select></label>
        <label class="field"><span class="field-label">Нужно, ₽</span><input class="amount-input settings-input" type="number" min="0" step="1" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="target" value="${goal.target}" aria-label="Нужно для цели"></label>
        <label class="field"><span class="field-label">Уже отложено, ₽</span><input class="amount-input settings-input" type="number" min="0" step="1" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="saved" value="${goal.saved}" aria-label="Уже отложено"></label>
        <label class="field"><span class="field-label">Отложить, ₽</span><input class="amount-input settings-input" type="number" min="0" step="1" data-kind="goals" data-id="${escapeHtml(goal.id)}" data-field="planned" value="${goal.planned}" aria-label="Сколько отложить"></label>
      </div>
      <div class="goal-mobile-footer"><div class="goal-remaining"><span class="field-label">Остаётся собрать</span><strong>${remaining > 0 ? money(remaining) : "Цель закрыта"}</strong><div class="meter"><span style="width:${progress}%"></span></div></div><button class="button danger small" data-action="delete" data-kind="goals" data-id="${escapeHtml(goal.id)}">Удалить</button></div>
    </article>`;
  }).join("") : `<div class="empty">Добавьте первую цель.</div>`;
  return `<section>
    <div class="stats">
      ${renderStat("На все цели", calc.goalTarget, `${state.goals.length} целей`, "accent")}
      ${renderStat("Уже отложено", calc.goalSaved, "Деньги уже есть")}
      ${renderStat("Выделяем сейчас", calc.goalAllocated, "Из свободного остатка")}
      ${renderStat("Ещё нужно собрать", calc.goalRemaining, "После всех выделений")}
    </div>
    <div class="notice ${calc.unassigned < 0 ? "negative" : ""}"><span class="notice-dot"></span><div><strong>Свободно после расходов и десятины: ${money(calc.free)}.</strong> ${calc.unassigned >= 0 ? `После выделения на цели останется нераспределёнными ${money(calc.unassigned)}.` : `Распределено на ${money(Math.abs(calc.unassigned))} больше, чем есть свободных денег.`}${calc.goalWithoutPayday > 0 ? `<br>На ${money(calc.goalWithoutPayday)} ещё не выбрана зарплата.` : ""}</div></div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Планы и накопления</p><h2>На что нужны деньги</h2><p class="card-subtitle">Укажите дату, с какой зарплаты и сколько отложить. Это уменьшит остаток выбранной выплаты.</p></div><span class="pill">${state.goals.length} целей</span></div>
      <div class="table-wrap"><table class="goals-table"><thead><tr><th>Цель</th><th>Дата</th><th>С какой ЗП</th><th>Нужно, ₽</th><th>Уже отложено, ₽</th><th>Отложить, ₽</th><th>Остаётся собрать</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="goal-cards">${cards}</div>
      <div class="table-footer"><button class="button secondary small" data-action="add" data-kind="goals">+ Добавить цель</button><div class="table-total">Общая сумма целей<strong>${money(calc.goalTarget)}</strong></div></div>
    </div>
  </section>`;
}

function renderSettings(calc) {
  const automatic = automaticWorkdays(state.month);
  const override = state.workdays?.[state.month] || {};
  const { year } = parseMonth(state.month);
  const calendarKnown = year === 2026 || year === 2027;
  return `<section class="settings-grid">
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Основные правила</p><h2>Зарплата и десятина</h2></div></div>
      <div class="settings-form">
        <label class="field"><span class="field-label">Зарплата за полный месяц</span><span class="input-with-suffix"><input class="settings-input" type="number" min="0" step="1" data-setting="salary" value="${state.settings.salary}"><span class="input-suffix">₽</span></span></label>
        <label class="field"><span class="field-label">Десятина от каждой выплаты</span><span class="input-with-suffix"><input class="settings-input" type="number" min="0" step="0.1" data-setting="titheRate" value="${state.settings.titheRate}"><span class="input-suffix">%</span></span></label>
        <div class="formula">Зарплата ÷ рабочие дни месяца × рабочие дни периода.<br>Периоды: с 1 по 15 число и с 16 по конец месяца.<br>Десятина рассчитывается отдельно от каждой выплаты.</div>
        <p class="field-hint">Расчёт ведётся по указанной формуле, без дополнительных налогов и удержаний.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Производственный календарь</p><h2>Рабочие дни</h2><p class="card-subtitle">Автоматически: ${automatic.first} + ${automatic.second} = ${automatic.total}</p></div></div>
      <div class="settings-form">
        <div class="workdays-inputs">
          <label class="field"><span class="field-label">С 1 по 15 число</span><input class="settings-input" type="number" min="0" max="15" data-workday="first" value="${calc.workdays.first}"></label>
          <label class="field"><span class="field-label">С 16 по конец месяца</span><input class="settings-input" type="number" min="0" max="16" data-workday="second" value="${calc.workdays.second}"></label>
        </div>
        <p class="field-hint">Можно изменить вручную, если график работы отличается от обычной пятидневной недели. Общее число дней пересчитается автоматически.</p>
        <button class="button ghost small" style="justify-self:start" data-action="reset-workdays" ${override.first == null && override.second == null ? "disabled" : ""}>Вернуть автоматический расчёт</button>
        <p class="field-hint">${calendarKnown ? "Официальные праздники и переносы на 2026–2027 годы учтены." : "Для этого года учтены стандартные праздники без будущих переносов. Проверьте число рабочих дней вручную."} Источник: <a href="https://www.consultant.ru/law/ref/calendar/proizvodstvennye/" target="_blank" rel="noopener">КонсультантПлюс</a>.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Сохранность данных</p><h2>Копия и восстановление</h2></div></div>
      <p class="card-subtitle" style="margin-bottom:16px">Скачайте копию после важных изменений. Файл можно открыть здесь же на другом устройстве.</p>
      <div class="actions-list"><button class="button secondary" data-action="export">Скачать копию</button><button class="button secondary" data-action="import">Восстановить из файла</button><button class="button secondary" data-action="print">Печать</button></div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Как работает ссылка</p><h2>Передача изменений</h2></div></div>
      <p class="card-subtitle">Изменения автоматически сохраняются на текущем устройстве. Чтобы второй человек увидел именно новую версию, нажмите «Поделиться версией» и отправьте новую ссылку. Автоматической синхронизации между устройствами нет.</p>
      <p class="privacy-note">Финансовые данные находятся в части ссылки после # и не отправляются на сервер страницы. Храните ссылку как личный документ.</p>
    </div>
  </section>`;
}

function render() {
  if (!state) {
    renderWelcome();
    return;
  }
  const calc = calculate();
  const { year, month: monthNumber } = parseMonth(state.month);
  const monthDate = new Date(year, monthNumber - 1, 1);
  const tabs = [
    ["overview", "Обзор"],
    ["pay5", "Выплата 5-го"],
    ["pay20", "Выплата 20-го"],
    ["balances", "Сейчас отложено"],
    ["goals", "Цели"],
    ["settings", "Настройки"]
  ];
  let content;
  if (activeTab === "pay5") content = renderItemsCard(state.expenses.filter(item => item.payday === 5), "expenses", calc, 5);
  else if (activeTab === "pay20") content = renderItemsCard(state.expenses.filter(item => item.payday === 20), "expenses", calc, 20);
  else if (activeTab === "balances") content = renderBalancesSection(calc);
  else if (activeTab === "goals") content = renderGoals(calc);
  else if (activeTab === "settings") content = renderSettings(calc);
  else content = renderOverview(calc);

  app.innerHTML = `<main class="shell">
    <header class="topbar">${brand()}<div class="top-actions"><button class="button secondary" data-action="export">Скачать копию</button><button class="button primary" data-action="share">Поделиться версией</button></div></header>
    <section class="monthbar"><div><h2>${monthFormatter.format(monthDate)}</h2><p>Зарплата, обязательные расходы и свободный остаток</p></div><div class="month-controls"><button class="icon-button" data-action="previous-month" aria-label="Предыдущий месяц">‹</button><input type="month" data-month value="${state.month}" aria-label="Месяц бюджета"><button class="icon-button" data-action="next-month" aria-label="Следующий месяц">›</button></div></section>
    <div class="notice"><span class="notice-dot"></span><div>Изменения сохраняются на этом устройстве. <strong>Чтобы передать их другому человеку, создайте новую ссылку</strong> кнопкой «Поделиться версией».</div></div>
    <nav class="tabs" aria-label="Разделы бюджета">${tabs.map(([key, label]) => `<button class="tab ${activeTab === key ? "active" : ""}" data-tab="${key}">${label}</button>`).join("")}</nav>
    ${content}
    <p class="updated">Последнее изменение на этом устройстве: ${new Date(state.updatedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  </main>`;
}

function changeMonth(offset) {
  const { year, month } = parseMonth(state.month);
  const date = new Date(year, month - 1 + offset, 1);
  state.month = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  saveState();
  render();
}

function updateItem(target) {
  const collection = state[target.dataset.kind];
  if (!Array.isArray(collection)) return;
  const item = collection.find(entry => entry.id === target.dataset.id);
  if (!item) return;
  const field = target.dataset.field;
  if (["amount", "target", "saved", "planned"].includes(field)) item[field] = Math.max(0, Number(target.value) || 0);
  else if (field === "dueDate") item.dueDate = target.value;
  else if (field === "payday") item.payday = [5, 20].includes(Number(target.value)) ? Number(target.value) : 0;
  else if (field === "category" && CATEGORIES[target.value]) item.category = target.value;
  else if (field === "name") item.name = target.value.trim() || "Без названия";
  saveState();
  render();
}

function recordPurchase() {
  const name = document.querySelector("#purchase-name").value.trim() || "Покупка";
  const amount = Math.round((Number(document.querySelector("#purchase-amount").value) || 0) * 100) / 100;
  const days = Math.max(0, Math.round(Number(document.querySelector("#purchase-days").value) || 0));
  const balanceId = document.querySelector("#purchase-balance").value;
  const balance = state.balances.find(item => item.id === balanceId);
  if (amount <= 0) {
    showToast("Укажите сумму покупки больше нуля");
    return;
  }
  if (!balance) {
    showToast("Выберите конверт, из которого списать покупку");
    return;
  }
  if (amount > balance.amount) {
    showToast(`В конверте «${balance.name}» недостаточно: есть ${money(balance.amount)}`);
    return;
  }
  balance.amount = Math.round((balance.amount - amount) * 100) / 100;
  state.purchases.push({
    id: `p${Date.now()}`,
    name,
    amount,
    balanceId,
    balanceName: balance.name,
    days,
    date: document.querySelector("#purchase-date").value || dateKey(new Date())
  });
  saveState();
  render();
  showToast(`${name}: − ${money(amount)} из «${balance.name}»`);
}

function undoPurchase(id) {
  const purchase = state.purchases.find(item => item.id === id);
  if (!purchase) return;
  const balance = state.balances.find(item => item.id === purchase.balanceId);
  if (!balance) {
    showToast("Конверт удалён. Сначала восстановите его, затем измените остаток вручную.");
    return;
  }
  balance.amount = Math.round((balance.amount + purchase.amount) * 100) / 100;
  state.purchases = state.purchases.filter(item => item.id !== id);
  saveState();
  render();
  showToast(`Покупка отменена, ${money(purchase.amount)} возвращены в «${balance.name}»`);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function encodeState(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream === "undefined") return `raw.${bytesToBase64Url(bytes)}`;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `v1.${bytesToBase64Url(compressed)}`;
}

async function decodeState(hash) {
  const [format, encoded] = hash.replace(/^#/, "").split(".");
  if (!encoded || !["v1", "raw"].includes(format)) throw new Error("Ссылка не содержит данных бюджета");
  const bytes = base64UrlToBytes(encoded);
  let unpacked = bytes;
  if (format === "v1") {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    unpacked = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return normalizeState(JSON.parse(new TextDecoder().decode(unpacked)));
}

async function shareBudget() {
  try {
    const encoded = await encodeState(state);
    const url = `${location.origin}${location.pathname}#${encoded}`;
    shareUrlInput.value = url;
    document.querySelector("#native-share").hidden = !navigator.share;
    shareDialog.showModal();
  } catch {
    showToast("Не удалось создать ссылку. Скачайте резервную копию.");
  }
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareUrlInput.value);
  } catch {
    shareUrlInput.focus();
    shareUrlInput.select();
    document.execCommand("copy");
  }
  showToast("Ссылка скопирована");
}

function exportBudget() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `semeiny-byudzhet-${state.month}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Резервная копия скачана");
}

async function initialize() {
  if (!location.hash) {
    renderWelcome();
    return;
  }
  storageKey = `semeiny-byudzhet:${location.hash}`;
  try {
    const linkedState = await decodeState(location.hash);
    try {
      const saved = localStorage.getItem(storageKey);
      state = saved ? normalizeState(JSON.parse(saved)) : linkedState;
    } catch {
      state = linkedState;
    }
    saveState();
    render();
  } catch (error) {
    renderWelcome(error.message || "Не удалось прочитать данные из ссылки");
  }
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    activeTab = tab.dataset.tab;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "create-blank") {
    state = blankState();
    storageKey = `semeiny-byudzhet:blank:${Date.now()}`;
    saveState();
    render();
  } else if (!state && action !== "import") {
    return;
  } else if (action === "previous-month") changeMonth(-1);
  else if (action === "next-month") changeMonth(1);
  else if (action === "share") shareBudget();
  else if (action === "export") exportBudget();
  else if (action === "print") window.print();
  else if (action === "import") importFile.click();
  else if (action === "record-purchase") recordPurchase();
  else if (action === "undo-purchase") undoPurchase(button.dataset.id);
  else if (action === "reset-workdays") {
    delete state.workdays[state.month];
    saveState();
    render();
  } else if (action === "add") {
    const kind = button.dataset.kind;
    const item = kind === "goals"
      ? { id: `g${Date.now()}`, name: "Новая цель", target: 0, saved: 0, planned: 0, dueDate: "", payday: 0 }
      : { id: `${kind === "expenses" ? "e" : "b"}${Date.now()}`, name: "Новая позиция", amount: 0, category: "other" };
    if (kind === "expenses") item.payday = Number(button.dataset.payday) === 20 ? 20 : 5;
    state[kind].push(item);
    saveState();
    render();
    const input = document.querySelector(`[data-kind="${kind}"][data-id="${item.id}"][data-field="name"]`);
    if (input) { input.focus(); input.select(); }
  } else if (action === "delete") {
    const kind = button.dataset.kind;
    const item = state[kind].find(entry => entry.id === button.dataset.id);
    if (!item || !window.confirm(`Удалить «${item.name}»?`)) return;
    state[kind] = state[kind].filter(entry => entry.id !== item.id);
    saveState();
    render();
  }
});

document.addEventListener("change", event => {
  const target = event.target;
  if (target.matches("[data-month]") && target.value) {
    state.month = target.value;
    saveState();
    render();
  } else if (target.matches("[data-credit-note]")) {
    state.creditNote = target.value;
    saveState();
    showToast("Комментарий сохранён");
  } else if (target.matches("[data-setting]")) {
    state.settings[target.dataset.setting] = Math.max(0, Number(target.value) || 0);
    saveState();
    render();
  } else if (target.matches("[data-workday]")) {
    const automatic = automaticWorkdays(state.month);
    const current = { first: automatic.first, second: automatic.second, ...(state.workdays[state.month] || {}) };
    current[target.dataset.workday] = Math.max(0, Number(target.value) || 0);
    state.workdays[state.month] = current;
    saveState();
    render();
  } else if (target.matches("[data-kind][data-id][data-field]")) {
    updateItem(target);
  }
});

document.querySelector("#copy-share").addEventListener("click", copyShareLink);
document.querySelector("#native-share").addEventListener("click", async () => {
  try {
    await navigator.share({ title: "Семейный бюджет", text: "Актуальная версия семейного бюджета", url: shareUrlInput.value });
  } catch (error) {
    if (error.name !== "AbortError") showToast("Не удалось открыть меню отправки");
  }
});

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    state = normalizeState(JSON.parse(await file.text()));
    storageKey = `semeiny-byudzhet:import:${Date.now()}`;
    saveState();
    activeTab = "overview";
    render();
    showToast("Данные восстановлены");
  } catch {
    showToast("Не удалось прочитать файл. Выберите резервную копию бюджета.");
  }
  importFile.value = "";
});

initialize();
