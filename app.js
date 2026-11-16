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
  return {
    workdays,
    salary: firstSalary + secondSalary,
    balances: sumItems(state.balances),
    expenses: expenseSum5 + expenseSum20,
    tithe: tithe5 + tithe20,
    free: firstSalary + secondSalary - expenseSum5 - expenseSum20 - tithe5 - tithe20,
    p5: {
      payday: 5,
      salary: secondSalary,
      days: workdays.second,
      expenses: expenseSum5,
      tithe: tithe5,
      free: secondSalary - expenseSum5 - tithe5,
      date: pay5,
      nominalDate: date5,
      period: `16–${workdays.days} ${MONTHS_GENITIVE[monthNumber - 1]}`
    },
    p20: {
      payday: 20,
      salary: firstSalary,
      days: workdays.first,
      expenses: expenseSum20,
      tithe: tithe20,
      free: firstSalary - expenseSum20 - tithe20,
      date: pay20,
      nominalDate: date20,
      period: `1–15 ${MONTHS_GENITIVE[monthNumber - 1]}`
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
  const spent = payment.expenses + payment.tithe;
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
      <div class="breakdown-row total ${payment.free < 0 ? "negative" : ""}"><span>Остаётся</span><strong>${money(payment.free)}</strong></div>
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
      ${renderStat("Свободный остаток", calc.free, "После расходов и десятины", calc.free < 0 ? "negative" : "")}
    </div>
    <div class="notice"><span class="notice-dot"></span><div><strong>Сейчас в конвертах и на целях: ${money(calc.balances)}.</strong> Это уже имеющиеся деньги, они не прибавляются к свободному остатку от будущей зарплаты.</div></div>
    <div class="grid-two">${renderPaydayCard(calc.p5, calc.workdays.total)}${renderPaydayCard(calc.p20, calc.workdays.total)}</div>
    <div class="section-heading"><div><h2>Куда уходит зарплата</h2><p>Регулярные расходы по категориям, без десятины</p></div><span class="pill gold">Всего ${money(calc.expenses)}</span></div>
    <div class="card">
      ${categories.length ? `<div class="category-list">${categories.map(([category, amount]) => `<div class="category-row"><span>${CATEGORIES[category]}</span><div class="category-track"><span style="width:${amount / max * 100}%"></span></div><strong>${money(amount)}</strong></div>`).join("")}</div>` : `<div class="empty">Добавьте расходы, чтобы увидеть распределение по категориям.</div>`}
    </div>
  </section>`;
}

function categoryOptions(selected) {
  return Object.entries(CATEGORIES).map(([key, label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
}

function renderRows(items, kind) {
  if (!items.length) return `<tr><td colspan="4"><div class="empty">Пока нет ни одной позиции.</div></td></tr>`;
  return items.map(item => `<tr>
    <td><input class="name-input" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-field="name" value="${escapeHtml(item.name)}" aria-label="Название"></td>
    <td><input class="amount-input" type="number" min="0" step="1" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-field="amount" value="${Number(item.amount) || 0}" aria-label="Сумма в рублях"></td>
    <td><select class="category-select" data-kind="${kind}" data-id="${escapeHtml(item.id)}" data-field="category" aria-label="Категория">${categoryOptions(item.category)}</select></td>
    <td><button class="icon-button delete-button" data-action="delete" data-kind="${kind}" data-id="${escapeHtml(item.id)}" aria-label="Удалить ${escapeHtml(item.name)}">×</button></td>
  </tr>`).join("");
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
    <div class="table-wrap"><table><thead><tr><th>Название</th><th>Сумма, ₽</th><th>Категория</th><th></th></tr></thead><tbody>${renderRows(items, kind)}</tbody></table></div>
    <div class="table-footer"><button class="button secondary small" data-action="add" data-kind="${kind}" ${payday ? `data-payday="${payday}"` : ""}>+ Добавить позицию</button><div class="table-total">Итого<strong>${money(sumItems(items))}</strong></div></div>
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
    ["settings", "Настройки"]
  ];
  let content;
  if (activeTab === "pay5") content = renderItemsCard(state.expenses.filter(item => item.payday === 5), "expenses", calc, 5);
  else if (activeTab === "pay20") content = renderItemsCard(state.expenses.filter(item => item.payday === 20), "expenses", calc, 20);
  else if (activeTab === "balances") content = renderItemsCard(state.balances, "balances", calc);
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
  if (field === "amount") item.amount = Math.max(0, Number(target.value) || 0);
  else if (field === "category" && CATEGORIES[target.value]) item.category = target.value;
  else if (field === "name") item.name = target.value.trim() || "Без названия";
  saveState();
  render();
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
  else if (action === "reset-workdays") {
    delete state.workdays[state.month];
    saveState();
    render();
  } else if (action === "add") {
    const kind = button.dataset.kind;
    const item = { id: `${kind === "expenses" ? "e" : "b"}${Date.now()}`, name: "Новая позиция", amount: 0, category: "other" };
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
