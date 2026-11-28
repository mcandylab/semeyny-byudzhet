// Formatting and dates of the mobile family budget.
// Budget math stays in budget.js (calculate), so the totals match the old app.

import { dateKey, pad, parseMonth } from "./budget";

// Colours are CSS variables, so they follow the light or dark theme (assets/mobile.css).
export const CATEGORY_META = {
  housing: { label: "Жильё и связь", icon: "home", color: "var(--m-cat-housing)" },
  food: { label: "Продукты и дом", icon: "cart", color: "var(--m-cat-food)" },
  bank: { label: "Банки и переводы", icon: "card", color: "var(--m-cat-bank)" },
  auto: { label: "Автомобиль", icon: "car", color: "var(--m-cat-auto)" },
  family: { label: "Семья", icon: "family", color: "var(--m-cat-family)" },
  pets: { label: "Питомцы", icon: "paw", color: "var(--m-cat-pets)" },
  personal: { label: "Личное и подписки", icon: "star", color: "var(--m-cat-personal)" },
  obligations: { label: "Обязательное", icon: "receipt", color: "var(--m-cat-obligations)" },
  plans: { label: "Планы и покупки", icon: "gift", color: "var(--m-cat-plans)" },
  other: { label: "Другое", icon: "grid", color: "var(--m-cat-other)" }
};

export const categoryMeta = code => CATEGORY_META[code] || CATEGORY_META.other;

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

// "12 450", "12 450 ₽", "12450.50" → number; anything else → 0.
export function parseAmount(text) {
  const value = Number(String(text ?? "").replace(/[\s ₽]/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_PREPOSITIONAL = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "нояб", "дек"];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export const MONTH_TITLES = MONTHS;

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function shiftMonth(key, offset) {
  const { year, month } = parseMonth(key);
  return monthKey(new Date(year, month - 1 + offset, 1));
}

export function monthInfo(key) {
  const { year, month } = parseMonth(key);
  return { key, year, index: month - 1, title: MONTHS[month - 1], prepositional: MONTHS_PREPOSITIONAL[month - 1] };
}

export const todayKey = () => dateKey(new Date());

// PocketBase keeps calendar dates as midnight UTC: "2026-11-27 00:00:00.000Z".
export const dayFromPb = value => String(value || "").slice(0, 10);
export const dayToPb = day => (day ? `${day} 00:00:00.000Z` : "");

function dayDate(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function longDate(day) {
  if (!day) return "";
  const date = dayDate(day);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

export function shortDate(day) {
  const date = dayDate(day);
  const label = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

export function dayLabel(day) {
  const today = new Date();
  if (day === dateKey(today)) return "Сегодня";
  if (day === dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))) return "Вчера";
  return shortDate(day);
}

// A payday from calculate(): when the money comes and why it moved.
export function paydayDates(payment) {
  const { date, nominalDate } = payment;
  const moved = dateKey(date) !== dateKey(nominalDate);
  return {
    date: `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`,
    weekday: WEEKDAYS[date.getDay()],
    short: `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`,
    moved: moved
      ? `${nominalDate.getDate()} ${MONTHS_GENITIVE[nominalDate.getMonth()]} — ${WEEKDAYS[nominalDate.getDay()]}, поэтому деньги придут раньше`
      : ""
  };
}

export function formatStamp(value) {
  if (!value) return "";
  return new Date(String(value).replace(" ", "T")).toLocaleString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export const formatCode = code => `${code.slice(0, 4)}-${code.slice(4)}`;

export function byPosition(a, b) {
  return (a.position || 0) - (b.position || 0) || String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id);
}

export function nextPosition(records) {
  return records.reduce((max, record) => Math.max(max, (record.position || 0) + 1), 0);
}
