/// <reference path="../pb_data/types.d.ts" />

// Shared helpers for family.pb.js. PocketBase runs every hook handler in its
// own context, so handlers load this module with require() instead of closures.

const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_HOURS = 72;
const IMPORT_FORMAT = "semeyny-byudzhet/pocketbase-import@1";
const BUDGET_COLLECTIONS = ["expenses", "envelopes", "goals", "workday_overrides"];

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function generatePassword() {
  return $security.randomStringWithAlphabet(16, PASSWORD_ALPHABET);
}

function inHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

// PocketBase date strings ("2026-11-20 00:00:00.000Z") as a calendar date.
function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function households(app) {
  return app.findAllRecords("households");
}

// The app serves one family: every command works with the only household.
function singleHousehold(app, createIfMissing) {
  const list = households(app);
  if (list.length > 1) throw new Error("В базе больше одной семьи, команда рассчитана на одну");
  if (list.length) return list[0];
  if (!createIfMissing) throw new Error("Семья ещё не создана. Запустите family:owner или family:import");
  const record = new Record(app.findCollectionByNameOrId("households"));
  record.set("name", "Семейный бюджет");
  record.set("tithe_rate", 10);
  app.save(record);
  return record;
}

function findUser(app, username) {
  try {
    return app.findFirstRecordByData("users", "username", normalizeUsername(username));
  } catch {
    return null;
  }
}

function ownerOf(app, household) {
  const owners = app.findRecordsByFilter("users", "household = {:household} && role = 'owner'", "created", 1, 0, { household: household.id });
  return owners[0] || null;
}

function createInvite(app, household, author, hours) {
  const invite = new Record(app.findCollectionByNameOrId("invites"));
  invite.set("household", household.id);
  if (author) invite.set("created_by", author.id);
  invite.set("expires_at", inHours(hours || INVITE_HOURS));
  app.save(invite);
  return invite;
}

// Creates a member from a valid invite in one transaction and marks the invite used.
function joinByInvite(app, body) {
  const code = normalizeCode(body.code);
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  if (code.length !== 8) throw new BadRequestError("Введите код приглашения из 8 символов");
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new BadRequestError("Логин: 3–32 символа, латиница, цифры, точка, дефис или подчёркивание");
  }
  if (password.length < 8) throw new BadRequestError("Пароль должен быть не короче 8 символов");
  if (body.passwordConfirm !== undefined && body.passwordConfirm !== password) {
    throw new BadRequestError("Пароли не совпадают");
  }

  let user;
  app.runInTransaction((txApp) => {
    let invite;
    try {
      invite = txApp.findFirstRecordByData("invites", "code", code);
    } catch {
      throw new BadRequestError("Код приглашения не найден");
    }
    if (invite.getString("used_by") || invite.getString("used_at")) throw new BadRequestError("Этот код уже использован");
    if (invite.getString("expires_at") <= new DateTime().string()) throw new BadRequestError("Срок действия кода истёк");
    if (findUser(txApp, username)) throw new BadRequestError("Этот логин уже занят");

    user = new Record(txApp.findCollectionByNameOrId("users"));
    user.set("username", username);
    user.set("name", name || username);
    user.set("household", invite.getString("household"));
    user.set("role", "member");
    user.set("verified", true);
    user.setPassword(password);
    txApp.save(user);

    invite.set("used_by", user.id);
    invite.set("used_at", nowIso());
    txApp.save(invite);
  });
  return user;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// "12 450 ₽" without Intl, which the JS runtime of PocketBase does not localize.
function rubles(value) {
  const [whole, cents] = String(round2(Math.abs(value))).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${cents ? `,${cents.padEnd(2, "0")}` : ""} ₽`;
}

// An envelope of the signed-in user's household, or 404 for anything else.
function ownEnvelope(app, auth, id) {
  let envelope;
  try {
    envelope = app.findRecordById("envelopes", String(id || ""));
  } catch {
    throw new NotFoundError("Конверт не найден");
  }
  if (envelope.getString("household") !== auth.getString("household")) throw new NotFoundError("Конверт не найден");
  return envelope;
}

// A purchase takes money out of an envelope, a deposit puts it in. The operation
// and the new balance are saved in one transaction, so they can never disagree.
function recordOperation(app, auth, body) {
  const type = body.type === "deposit" || body.type === "purchase" ? body.type : "";
  if (!type) throw new BadRequestError("Выберите покупку или пополнение");
  const deposit = type === "deposit";
  const amount = round2(Number(body.amount));
  if (!(amount > 0)) throw new BadRequestError("Укажите сумму больше нуля");
  if (amount > 100000000) throw new BadRequestError("Слишком большая сумма");
  const date = String(body.date || "");
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) throw new BadRequestError("Укажите дату операции");
  const days = deposit ? 0 : Math.round(Number(body.days) || 0);
  if (days < 0 || days > 366) throw new BadRequestError("Дней покупки: от 0 до 366");
  const name = String(body.name || "").trim().slice(0, 200) || (deposit ? "Пополнение" : "Покупка");

  let operation;
  let envelope;
  app.runInTransaction((txApp) => {
    envelope = ownEnvelope(txApp, auth, body.envelope);
    const title = envelope.getString("name");
    if (envelope.getBool("archived")) throw new BadRequestError(`Конверт «${title}» в архиве`);
    const balance = envelope.getFloat("balance");
    if (!deposit && amount > balance) throw new BadRequestError(`В конверте «${title}» недостаточно: есть ${rubles(balance)}`);
    envelope.set("balance", round2(balance + (deposit ? amount : -amount)));
    txApp.save(envelope);

    operation = new Record(txApp.findCollectionByNameOrId("operations"));
    operation.set("envelope", envelope.id);
    operation.set("envelope_name", title);
    operation.set("type", type);
    operation.set("name", name);
    operation.set("amount", amount);
    operation.set("days", days);
    operation.set("date", `${date} 00:00:00.000Z`);
    operation.set("created_by", auth.id);
    txApp.save(operation);
  });
  return { operation, envelope };
}

// Undo returns the money of a purchase to its envelope or takes a deposit back out.
function undoOperation(app, auth, id) {
  let envelope;
  app.runInTransaction((txApp) => {
    let operation;
    try {
      operation = txApp.findRecordById("operations", String(id || ""));
    } catch {
      throw new NotFoundError("Операция не найдена");
    }
    envelope = ownEnvelope(txApp, auth, operation.getString("envelope"));
    const title = envelope.getString("name");
    if (envelope.getBool("archived")) throw new BadRequestError(`Конверт «${title}» в архиве. Верните его, чтобы отменить операцию`);
    const deposit = operation.getString("type") === "deposit";
    const amount = operation.getFloat("amount");
    const balance = envelope.getFloat("balance");
    if (deposit && amount > balance) throw new BadRequestError(`Нельзя отменить пополнение: в «${title}» осталось ${rubles(balance)}`);
    envelope.set("balance", round2(balance + (deposit ? -amount : amount)));
    txApp.save(envelope);
    txApp.delete(operation);
  });
  return { envelope };
}

function categoryIds(app) {
  const ids = {};
  app.findAllRecords("categories").forEach((record) => { ids[record.getString("code")] = record.id; });
  return ids;
}

function householdRecords(app, collection, household, sort) {
  return app.findRecordsByFilter(collection, "household = {:household}", sort || "", 0, 0, { household: household.id });
}

function countBudgetRecords(app, household) {
  return BUDGET_COLLECTIONS.reduce((total, name) => total + householdRecords(app, name, household).length, 0);
}

function deleteBudgetRecords(app, household) {
  // Operations first: their required envelope relation blocks deleting envelopes.
  householdRecords(app, "envelopes", household, "position,created").forEach((envelope) => {
    app.findRecordsByFilter("operations", "envelope = {:envelope}", "", 0, 0, { envelope: envelope.id }).forEach((operation) => app.delete(operation));
  });
  BUDGET_COLLECTIONS.forEach((name) => householdRecords(app, name, household).forEach((record) => app.delete(record)));
}

function saveNew(app, collectionName, values, created) {
  const record = new Record(app.findCollectionByNameOrId(collectionName));
  Object.keys(values).forEach((key) => record.set(key, values[key]));
  if (created) {
    const stamp = new DateTime(created).string();
    record.setRaw("created", stamp);
    record.setRaw("updated", stamp);
  }
  app.save(record);
  return record;
}

// Imports the file written by scripts/legacy-export.mjs into the only household.
function importBudget(app, data, replace) {
  if (data.format !== IMPORT_FORMAT) throw new Error(`Ожидался файл формата ${IMPORT_FORMAT}`);
  const counts = { expenses: 0, expense_payments: 0, envelopes: 0, operations: 0, goals: 0, workday_overrides: 0 };

  app.runInTransaction((txApp) => {
    const household = singleHousehold(txApp, true);
    const existing = countBudgetRecords(txApp, household);
    if (existing && !replace) {
      throw new Error(`В семье уже есть ${existing} записей бюджета. Для повторного переноса добавьте --replace`);
    }
    if (existing) deleteBudgetRecords(txApp, household);

    household.set("salary", data.household.salary);
    household.set("tithe_rate", data.household.tithe_rate);
    household.set("credit_note", data.household.credit_note);
    txApp.save(household);

    const categories = categoryIds(txApp);
    const category = (code) => {
      if (!categories[code]) throw new Error(`Неизвестная категория: ${code}`);
      return categories[code];
    };

    data.expenses.forEach((item) => {
      const expense = saveNew(txApp, "expenses", {
        household: household.id,
        category: category(item.category),
        name: item.name,
        amount: item.amount,
        payday: item.payday,
        position: item.position
      }, item.created);
      counts.expenses += 1;
      item.paid_months.forEach((month) => {
        saveNew(txApp, "expense_payments", { expense: expense.id, month });
        counts.expense_payments += 1;
      });
    });

    const envelopes = {};
    data.envelopes.forEach((item) => {
      envelopes[item.key] = saveNew(txApp, "envelopes", {
        household: household.id,
        category: category(item.category),
        name: item.name,
        balance: item.balance,
        archived: item.archived,
        position: item.position
      }, item.created).id;
      counts.envelopes += 1;
    });

    data.operations.forEach((item, index) => {
      if (!envelopes[item.envelope]) throw new Error(`Операция ${item.key} ссылается на неизвестный конверт`);
      // Without a legacy timestamp keep the original order with millisecond steps.
      const created = item.created || new Date(Date.now() - (data.operations.length - index)).toISOString();
      saveNew(txApp, "operations", {
        envelope: envelopes[item.envelope],
        envelope_name: item.envelope_name,
        type: item.type,
        name: item.name,
        amount: item.amount,
        days: item.days,
        date: `${item.date} 00:00:00.000Z`
      }, created);
      counts.operations += 1;
    });

    data.goals.forEach((item) => {
      saveNew(txApp, "goals", {
        household: household.id,
        name: item.name,
        target: item.target,
        saved: item.saved,
        planned: item.planned,
        due_date: item.due_date ? `${item.due_date} 00:00:00.000Z` : "",
        payday: item.payday,
        closed: item.closed,
        position: item.position
      }, item.created);
      counts.goals += 1;
    });

    data.workday_overrides.forEach((item) => {
      saveNew(txApp, "workday_overrides", {
        household: household.id,
        month: item.month,
        first_days: item.first_days,
        second_days: item.second_days
      });
      counts.workday_overrides += 1;
    });
  });
  return counts;
}

// Rebuilds the state in the old app's backup format (the file "Скачать копию"
// produces), so a migration can be compared with the source or rolled back.
function exportBudget(app) {
  const household = singleHousehold(app, false);
  const codes = {};
  app.findAllRecords("categories").forEach((record) => { codes[record.id] = record.getString("code"); });

  const paid = {};
  const expenses = householdRecords(app, "expenses", household, "position,created");
  expenses.forEach((expense) => {
    paid[expense.id] = app.findRecordsByFilter("expense_payments", "expense = {:expense}", "month", 0, 0, { expense: expense.id })
      .map((payment) => payment.getString("month"));
  });

  const envelopes = householdRecords(app, "envelopes", household, "position,created");
  const operations = [];
  envelopes.forEach((envelope) => {
    app.findRecordsByFilter("operations", "envelope = {:envelope}", "", 0, 0, { envelope: envelope.id }).forEach((operation) => operations.push(operation));
  });
  operations.sort((a, b) => a.getString("created").localeCompare(b.getString("created")) || a.id.localeCompare(b.id));

  const workdays = {};
  householdRecords(app, "workday_overrides", household, "month").forEach((record) => {
    workdays[record.getString("month")] = { first: record.getInt("first_days"), second: record.getInt("second_days") };
  });

  const all = [household, ...expenses, ...envelopes, ...operations];
  const updatedAt = all.map((record) => record.getString("updated")).filter(Boolean).sort().pop() || "";
  const now = new Date();

  return {
    version: 1,
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    settings: { salary: household.getFloat("salary"), titheRate: household.getFloat("tithe_rate") },
    workdays,
    expenses: expenses.map((expense) => ({
      id: expense.id,
      name: expense.getString("name"),
      amount: expense.getFloat("amount"),
      payday: Number(expense.getString("payday")),
      category: codes[expense.getString("category")],
      paidMonths: paid[expense.id]
    })),
    balances: envelopes.filter((envelope) => !envelope.getBool("archived")).map((envelope) => ({
      id: envelope.id,
      name: envelope.getString("name"),
      amount: envelope.getFloat("balance"),
      category: codes[envelope.getString("category")]
    })),
    goals: householdRecords(app, "goals", household, "position,created").map((goal) => ({
      id: goal.id,
      name: goal.getString("name"),
      target: goal.getFloat("target"),
      saved: goal.getFloat("saved"),
      planned: goal.getFloat("planned"),
      dueDate: dateOnly(goal.getString("due_date")),
      payday: Number(goal.getString("payday")) || 0,
      closed: goal.getBool("closed")
    })),
    purchases: operations.map((operation) => ({
      id: operation.id,
      type: operation.getString("type"),
      name: operation.getString("name"),
      amount: operation.getFloat("amount"),
      balanceId: operation.getString("envelope"),
      balanceName: operation.getString("envelope_name"),
      days: operation.getInt("days"),
      date: dateOnly(operation.getString("date"))
    })),
    creditNote: household.getString("credit_note"),
    updatedAt: updatedAt ? updatedAt.replace(" ", "T") : now.toISOString()
  };
}

module.exports = {
  INVITE_HOURS,
  createInvite,
  exportBudget,
  findUser,
  formatCode,
  generatePassword,
  importBudget,
  joinByInvite,
  normalizeUsername,
  ownerOf,
  recordOperation,
  singleHousehold,
  undoOperation
};
