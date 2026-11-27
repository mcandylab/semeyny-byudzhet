// A made-up family budget kept in memory, with the same interface as
// createPocketbaseApi. The design pages (/mobile) use it, so they show every
// screen without a server, and nothing typed there is saved anywhere.

import { dateKey } from "./budget";
import { CATEGORY_META, dayToPb, monthKey } from "./family";

const clone = value => JSON.parse(JSON.stringify(value));
const stamp = (date = new Date()) => date.toISOString().replace("T", " ");
const newId = () => Math.random().toString(36).slice(2, 17).padEnd(15, "0");

function daysAgo(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return dayToPb(dateKey(date));
}

function fail(message) {
  const error = new Error(message);
  error.friendly = true;
  throw error;
}

function snapshot() {
  const household = "demohousehold01";
  const month = monthKey();
  const categories = Object.entries(CATEGORY_META).map(([code, meta], position) => ({ id: `cat_${code}`, code, name: meta.label, position }));
  const rows = (list, extra) => list.map((item, position) => ({ id: item.id, household, position, created: stamp(), updated: stamp(), ...extra(item) }));

  const expenses = rows([
    { id: "demoexpense0001", name: "Продукты", amount: 18000, payday: "20", category: "food" },
    { id: "demoexpense0002", name: "Кредитная карта", amount: 8000, payday: "20", category: "bank" },
    { id: "demoexpense0003", name: "Бензин", amount: 6000, payday: "20", category: "auto" },
    { id: "demoexpense0004", name: "Секция для детей", amount: 4500, payday: "20", category: "family" },
    { id: "demoexpense0005", name: "Корм и наполнитель", amount: 2200, payday: "20", category: "pets" },
    { id: "demoexpense0006", name: "Интернет и связь", amount: 1300, payday: "20", category: "housing" },
    { id: "demoexpense0007", name: "Ипотека", amount: 34500, payday: "5", category: "housing" },
    { id: "demoexpense0008", name: "Продукты", amount: 18000, payday: "5", category: "food" },
    { id: "demoexpense0009", name: "Потребительский кредит", amount: 9400, payday: "5", category: "bank" },
    { id: "demoexpense0010", name: "Коммунальные услуги", amount: 7800, payday: "5", category: "housing" },
    { id: "demoexpense0011", name: "Страховка авто", amount: 3200, payday: "5", category: "auto" },
    { id: "demoexpense0012", name: "Подписки", amount: 1100, payday: "5", category: "personal" }
  ], item => ({ ...item, category: `cat_${item.category}` }));

  const envelopes = rows([
    { id: "demoenvelope001", name: "Подушка", balance: 182000, category: "plans" },
    { id: "demoenvelope002", name: "Отпуск", balance: 96000, category: "personal" },
    { id: "demoenvelope003", name: "Еда", balance: 12450, category: "food" },
    { id: "demoenvelope004", name: "Подарки", balance: 7000, category: "obligations" },
    { id: "demoenvelope005", name: "Детям", balance: 5200, category: "family" },
    { id: "demoenvelope006", name: "Бензин", balance: 3800, category: "auto" }
  ], item => ({ ...item, archived: false, category: `cat_${item.category}` }));

  const operation = (id, envelope, type, name, amount, days, ago) => {
    const target = envelopes.find(item => item.id === envelope);
    const created = new Date(Date.now() - ago * 86400000 - Number(id.slice(-2)) * 60000);
    return { id, envelope, envelope_name: target.name, type, name, amount, days, date: daysAgo(ago), created_by: "demouserowner01", created: stamp(created), updated: stamp(created) };
  };

  return {
    households: [{ id: household, name: "Семейный бюджет", salary: 180000, tithe_rate: 10, credit_note: "1. До 25-го закрываем весь долг по карте с льготным периодом — тогда без процентов.\n2. Вторую карту используем только для продуктов и бензина.\n3. Кредитный лимит не трогаем, пока в «Подушке» меньше 150 000 ₽.", created: stamp(), updated: stamp() }],
    users: [
      { id: "demouserowner01", username: "anna", name: "Анна", role: "owner", household, created: stamp(), updated: stamp() },
      { id: "demousermember1", username: "sergey", name: "Сергей", role: "member", household, created: stamp(), updated: stamp() }
    ],
    categories,
    expenses,
    expense_payments: ["demoexpense0001", "demoexpense0002", "demoexpense0003", "demoexpense0006"].map((expense, index) => ({ id: `demopayment000${index}`, expense, month, created: stamp() })),
    envelopes,
    operations: [
      operation("demooperation01", "demoenvelope003", "purchase", "Продукты", 2340, 2, 0),
      operation("demooperation02", "demoenvelope004", "deposit", "Пополнение", 5000, 0, 1),
      operation("demooperation03", "demoenvelope006", "purchase", "Бензин", 2200, 0, 1),
      operation("demooperation04", "demoenvelope003", "purchase", "Продукты", 1870, 1, 3),
      operation("demooperation05", "demoenvelope005", "purchase", "Аптека", 940, 0, 3),
      operation("demooperation06", "demoenvelope003", "deposit", "Пополнение", 18000, 0, 7)
    ],
    goals: rows([
      { id: "demogoal0000001", name: "Отпуск на море", target: 220000, saved: 96000, planned: 15000, payday: "20", due_date: "2027-06-01" },
      { id: "demogoal0000002", name: "Подушка безопасности", target: 300000, saved: 182000, planned: 10000, payday: "20", due_date: "" },
      { id: "demogoal0000003", name: "Ремонт детской", target: 120000, saved: 41000, planned: 8000, payday: "5", due_date: "2027-03-15" },
      { id: "demogoal0000004", name: "Новый ноутбук", target: 90000, saved: 12000, planned: 5000, payday: "", due_date: "2027-09-01" },
      { id: "demogoal0000005", name: "Зимняя резина", target: 48000, saved: 48000, planned: 0, payday: "", due_date: "", closed: true }
    ], item => ({ closed: false, ...item, due_date: dayToPb(item.due_date) })),
    workday_overrides: [],
    invites: []
  };
}

export function createDemoApi({ signedIn = true } = {}) {
  const db = snapshot();
  let user = signedIn ? db.users[0] : null;
  const find = (name, id) => db[name].find(record => record.id === id) || fail("Запись не найдена");

  return {
    demo: true,
    currentUser: () => user,
    snapshot: () => clone(db),

    async login(username) {
      user = db.users.find(item => item.username === username.trim().toLowerCase()) || db.users[0];
      return clone(user);
    },
    async join(form) {
      if (!form.code) fail("Введите код приглашения из 8 символов");
      user = { id: newId(), username: form.username.trim().toLowerCase(), name: form.name || form.username, role: "member", household: db.households[0].id, created: stamp(), updated: stamp() };
      db.users.push(user);
      return clone(user);
    },
    refresh: async () => clone(user),
    async logout() {
      user = null;
    },
    load: async () => clone(db),

    async create(name, data) {
      const record = { id: newId(), created: stamp(), updated: stamp(), ...data };
      if (name === "invites") {
        const code = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
        Object.assign(record, { code, created_by: user.id, expires_at: stamp(new Date(Date.now() + 72 * 3600000)), used_by: "", used_at: "" });
      }
      db[name].push(record);
      return clone(record);
    },
    async update(name, id, data) {
      return clone(Object.assign(find(name, id), data, { updated: stamp() }));
    },
    async remove(name, id) {
      find(name, id);
      if (name === "envelopes" && db.operations.some(item => item.envelope === id)) fail("У конверта есть операции, его можно только убрать в архив");
      db[name] = db[name].filter(record => record.id !== id);
      if (name === "expenses") db.expense_payments = db.expense_payments.filter(record => record.expense !== id);
    },

    async recordOperation(body) {
      const envelope = find("envelopes", body.envelope);
      const deposit = body.type === "deposit";
      if (!deposit && body.amount > envelope.balance) fail(`В конверте «${envelope.name}» недостаточно денег`);
      envelope.balance += deposit ? body.amount : -body.amount;
      envelope.updated = stamp();
      const operation = {
        id: newId(), envelope: envelope.id, envelope_name: envelope.name, type: body.type, amount: body.amount,
        name: body.name || (deposit ? "Пополнение" : "Покупка"), days: deposit ? 0 : body.days,
        date: dayToPb(body.date), created_by: user.id, created: stamp(), updated: stamp()
      };
      db.operations.push(operation);
      return clone({ operation, envelope });
    },
    async undoOperation(id) {
      const operation = find("operations", id);
      const envelope = find("envelopes", operation.envelope);
      const deposit = operation.type === "deposit";
      if (deposit && operation.amount > envelope.balance) fail(`Нельзя отменить пополнение: в «${envelope.name}» осталось меньше`);
      envelope.balance += deposit ? -operation.amount : operation.amount;
      db.operations = db.operations.filter(record => record.id !== id);
      return clone({ envelope });
    },

    changePassword: async () => clone(user),
    subscribe: async () => {},
    unsubscribe: async () => {}
  };
}
