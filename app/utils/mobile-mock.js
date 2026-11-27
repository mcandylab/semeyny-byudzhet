// Демонстрационные данные для мобильного дизайна (/mobile).
// Здесь нет расчётов бюджета: только согласованные между собой цифры для макетов.

const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function fmt(value) {
  return numberFormatter.format(Math.round(Math.abs(Number(value) || 0)));
}

export function plural(count, [one, few, many]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

export const daysLabel = count => plural(count, ["день", "дня", "дней"]);

export const CATEGORY_META = {
  housing: { label: "Жильё и связь", icon: "home", color: "#723FEB" },
  food: { label: "Продукты и дом", icon: "cart", color: "#97E0F7" },
  bank: { label: "Банки и переводы", icon: "card", color: "#FCFCFC" },
  auto: { label: "Автомобиль", icon: "car", color: "#B49BFA" },
  family: { label: "Семья", icon: "family", color: "#5BBFE0" },
  pets: { label: "Питомцы", icon: "paw", color: "#8E8E93" },
  personal: { label: "Личное и подписки", icon: "star", color: "#D9CCFF" },
  obligations: { label: "Обязательное", icon: "receipt", color: "#C5EEFA" },
  plans: { label: "Планы и покупки", icon: "gift", color: "#F0DC78" },
  other: { label: "Другое", icon: "grid", color: "#636366" }
};

export const month = { title: "Ноябрь", year: 2026, index: 10, prepositional: "ноябре" };

// Зарплата 180 000 ₽, в ноябре 2026 года 9 + 11 = 20 рабочих дней, десятина 10 %.
export const summary = {
  salary: 180000,
  workdays: 20,
  titheRate: 10,
  expenses: 114000,
  tithe: 18000,
  goals: 38000,
  free: 48000,
  unassigned: 10000,
  balances: 306450
};

export const paydays = {
  20: {
    payday: 20, tone: "purple", date: "20 ноября", weekday: "пятница", short: "20 нояб",
    period: "1–15 ноября", days: 9, salary: 81000, expenses: 40000, tithe: 8100, goals: 25000, after: 7900, moved: ""
  },
  5: {
    payday: 5, tone: "cyan", date: "4 декабря", weekday: "пятница", short: "4 дек",
    period: "16–30 ноября", days: 11, salary: 99000, expenses: 74000, tithe: 9900, goals: 8000, after: 7100,
    moved: "5 декабря — суббота, поэтому деньги придут раньше"
  }
};

export const expenses = [
  { id: "e1", name: "Продукты", amount: 18000, payday: 20, category: "food", paid: true },
  { id: "e2", name: "Кредитная карта", amount: 8000, payday: 20, category: "bank", paid: true },
  { id: "e3", name: "Бензин", amount: 6000, payday: 20, category: "auto", paid: true },
  { id: "e4", name: "Секция для детей", amount: 4500, payday: 20, category: "family", paid: false },
  { id: "e5", name: "Корм и наполнитель", amount: 2200, payday: 20, category: "pets", paid: false },
  { id: "e6", name: "Интернет и связь", amount: 1300, payday: 20, category: "housing", paid: true },
  { id: "e7", name: "Ипотека", amount: 34500, payday: 5, category: "housing", paid: false },
  { id: "e8", name: "Продукты", amount: 18000, payday: 5, category: "food", paid: false },
  { id: "e9", name: "Потребительский кредит", amount: 9400, payday: 5, category: "bank", paid: false },
  { id: "e10", name: "Коммунальные услуги", amount: 7800, payday: 5, category: "housing", paid: false },
  { id: "e11", name: "Страховка авто", amount: 3200, payday: 5, category: "auto", paid: false },
  { id: "e12", name: "Подписки", amount: 1100, payday: 5, category: "personal", paid: false }
];

export const categoryTotals = Object.entries(expenses.reduce((totals, item) => {
  totals[item.category] ||= { amount: 0, count: 0 };
  totals[item.category].amount += item.amount;
  totals[item.category].count += 1;
  return totals;
}, {}))
  .map(([key, value]) => ({ key, ...value, ...CATEGORY_META[key] }))
  .sort((a, b) => b.amount - a.amount);

export const envelopes = [
  { id: "b6", name: "Подушка", amount: 182000, icon: "shield", color: "#723FEB" },
  { id: "b5", name: "Отпуск", amount: 96000, icon: "sun", color: "#97E0F7" },
  { id: "b1", name: "Еда", amount: 12450, icon: "cart", color: "#FCFCFC", daily: true },
  { id: "b3", name: "Подарки", amount: 7000, icon: "gift", color: "#B49BFA", daily: true },
  { id: "b4", name: "Детям", amount: 5200, icon: "family", color: "#5BBFE0", daily: true },
  { id: "b2", name: "Бензин", amount: 3800, icon: "car", color: "#8E8E93", daily: true }
];

export const envelopeByName = Object.fromEntries(envelopes.map(item => [item.name, item]));

export const operations = [
  { label: "Сегодня", date: "27 ноября", items: [
    { id: "o1", type: "purchase", name: "Продукты", amount: 2340, envelope: "Еда", days: 2 }
  ] },
  { label: "Вчера", date: "26 ноября", items: [
    { id: "o2", type: "deposit", name: "Пополнение", amount: 5000, envelope: "Подарки" },
    { id: "o3", type: "purchase", name: "Бензин", amount: 2200, envelope: "Бензин", days: 0 }
  ] },
  { label: "24 ноября", date: "24 ноября", items: [
    { id: "o4", type: "purchase", name: "Продукты", amount: 1870, envelope: "Еда", days: 1 },
    { id: "o5", type: "purchase", name: "Аптека", amount: 940, envelope: "Детям", days: 0 }
  ] },
  { label: "20 ноября", date: "20 ноября", items: [
    { id: "o6", type: "deposit", name: "Пополнение", amount: 18000, envelope: "Еда" }
  ] }
];

export const goals = [
  { id: "g1", name: "Отпуск на море", icon: "sun", target: 220000, saved: 96000, planned: 15000, payday: 20, due: "к 1 июня 2027", dueDate: "1 июня 2027" },
  { id: "g2", name: "Подушка безопасности", icon: "shield", target: 300000, saved: 182000, planned: 10000, payday: 20, due: "Без срока", dueDate: "" },
  { id: "g3", name: "Ремонт детской", icon: "home", target: 120000, saved: 41000, planned: 8000, payday: 5, due: "к 15 марта 2027", dueDate: "15 марта 2027" },
  { id: "g4", name: "Новый ноутбук", icon: "laptop", target: 90000, saved: 12000, planned: 5000, payday: 0, due: "к 1 сентября 2027", dueDate: "1 сентября 2027" }
];

export const closedGoals = [
  { id: "g5", name: "Зимняя резина", icon: "car", target: 48000, closedAt: "Закрыта 12 октября" }
];

export const goalSummary = { target: 730000, saved: 331000, planned: 38000, remaining: 361000, count: 4, withoutPayday: 5000 };

export const creditNote = {
  title: "Памятка по кредиткам",
  preview: "До 25-го закрываем долг по карте с льготным периодом…",
  text: "1. До 25-го закрываем весь долг по карте с льготным периодом — тогда без процентов.\n2. Вторую карту используем только для продуктов и бензина.\n3. Кредитный лимит не трогаем, пока в «Подушке» меньше 150 000 ₽."
};
