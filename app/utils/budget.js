export const CATEGORIES = {
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
export const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
export const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

export function money(value) {
  return moneyFormatter.format(Math.round(Number(value) || 0));
}

export function pad(number) {
  return String(number).padStart(2, "0");
}

export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return { year, month: number };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function blankState() {
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

export function normalizeState(value) {
  if (!value || typeof value !== "object") throw new Error("Некорректные данные");
  const normalized = {
    version: 1,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ? value.month : currentMonth(),
    settings: {
      salary: Math.max(0, Number(value.settings?.salary) || 0),
      titheRate: Math.max(0, Number(value.settings?.titheRate) || 0)
    },
    workdays: value.workdays && typeof value.workdays === "object" ? JSON.parse(JSON.stringify(value.workdays)) : {},
    expenses: Array.isArray(value.expenses) ? value.expenses.map((item, index) => ({
      id: String(item.id || `e${Date.now()}-${index}`),
      name: String(item.name || "Без названия"),
      amount: Math.max(0, Number(item.amount) || 0),
      payday: Number(item.payday) === 20 ? 20 : 5,
      category: Object.hasOwn(CATEGORIES, item.category) ? item.category : "other",
      paidMonths: Array.isArray(item.paidMonths) ? item.paidMonths.filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) : []
    })) : [],
    balances: Array.isArray(value.balances) ? value.balances.map((item, index) => ({
      id: String(item.id || `b${Date.now()}-${index}`),
      name: String(item.name || "Без названия"),
      amount: Math.max(0, Number(item.amount) || 0),
      category: Object.hasOwn(CATEGORIES, item.category) ? item.category : "other"
    })) : [],
    goals: Array.isArray(value.goals) ? value.goals.map((item, index) => ({
      id: String(item.id || `g${Date.now()}-${index}`),
      name: String(item.name || "Новая цель"),
      target: Math.max(0, Number(item.target) || 0),
      saved: Math.max(0, Number(item.saved) || 0),
      planned: Math.max(0, Number(item.planned) || 0),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : "",
      payday: [5, 20].includes(Number(item.payday)) ? Number(item.payday) : 0,
      closed: item.closed === true
    })) : [],
    purchases: Array.isArray(value.purchases) ? value.purchases.map((item, index) => ({
      id: String(item.id || `p${Date.now()}-${index}`),
      type: item.type === "deposit" ? "deposit" : "purchase",
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

export function automaticWorkdays(month) {
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

function getWorkdays(state, month) {
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
  } while (!isWorkingDay(result));
  return result;
}

export function sumItems(items) {
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

export function calculate(state) {
  const { year, month: monthNumber } = parseMonth(state.month);
  const workdays = getWorkdays(state, state.month);
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
  const activeGoals = state.goals.filter(goal => !goal.closed);
  const goalTarget = activeGoals.reduce((total, goal) => total + goal.target, 0);
  const goalSaved = state.goals.reduce((total, goal) => total + goal.saved, 0);
  const goalAllocated = activeGoals.reduce((total, goal) => total + goal.planned, 0);
  const goalAllocated5 = activeGoals.filter(goal => goal.payday === 5).reduce((total, goal) => total + goal.planned, 0);
  const goalAllocated20 = activeGoals.filter(goal => goal.payday === 20).reduce((total, goal) => total + goal.planned, 0);
  const goalWithoutPayday = activeGoals.filter(goal => !goal.payday).reduce((total, goal) => total + goal.planned, 0);
  const goalRemaining = activeGoals.reduce((total, goal) => total + Math.max(0, goal.target - goal.saved - goal.planned), 0);
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
    goalCount: activeGoals.length,
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

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function encodeState(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream === "undefined") return `raw.${bytesToBase64Url(bytes)}`;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `v1.${bytesToBase64Url(compressed)}`;
}

export async function decodeState(hash) {
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

export function formatUpdatedAt(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export function formatShortDate(value) {
  return new Date(value + "T12:00:00").toLocaleDateString("ru-RU");
}
