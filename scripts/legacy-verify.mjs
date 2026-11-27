// Compares the budget exported from PocketBase (family:export) with the decrypted
// legacy state, field by field, and recomputes all totals with the old app's calculate().
//
// Usage: node scripts/legacy-verify.mjs pocketbase/import/legacy-state.json pocketbase/import/pocketbase-export.json

import { readFile } from "node:fs/promises";
import { calculate, normalizeState } from "../app/utils/budget.js";

const [legacyFile, exportFile] = process.argv.slice(2);
if (!legacyFile || !exportFile) {
  console.error("Usage: node scripts/legacy-verify.mjs <legacy-state.json> <pocketbase-export.json>");
  process.exit(2);
}

const legacy = normalizeState(JSON.parse(await readFile(legacyFile, "utf8")));
const migrated = normalizeState(JSON.parse(await readFile(exportFile, "utf8")));
const problems = [];
const same = (label, a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${label}: было ${JSON.stringify(a)}, стало ${JSON.stringify(b)}`);
};
const pick = (item, keys) => Object.fromEntries(keys.map(key => [key, item[key]]));

same("settings", legacy.settings, migrated.settings);
same("creditNote", legacy.creditNote, migrated.creditNote);
same("workdays", legacy.workdays, migrated.workdays);

const lists = {
  expenses: ["name", "amount", "payday", "category"],
  balances: ["name", "amount", "category"],
  goals: ["name", "target", "saved", "planned", "dueDate", "payday", "closed"],
  purchases: ["type", "name", "amount", "balanceName", "days", "date"]
};
for (const [list, keys] of Object.entries(lists)) {
  same(`${list}.length`, legacy[list].length, migrated[list].length);
  legacy[list].forEach((item, index) => {
    const other = migrated[list][index];
    if (!other) return;
    same(`${list}[${index}]`, pick(item, keys), pick(other, keys));
  });
}
legacy.expenses.forEach((item, index) => {
  same(`expenses[${index}].paidMonths`, [...item.paidMonths].sort(), [...(migrated.expenses[index]?.paidMonths || [])].sort());
});

// Each operation must point to the envelope at the same position (or to none, for deleted envelopes).
const position = (state, id) => state.balances.findIndex(balance => balance.id === id);
legacy.purchases.forEach((item, index) => {
  const other = migrated.purchases[index];
  if (other) same(`purchases[${index}].envelope`, position(legacy, item.balanceId), position(migrated, other.balanceId));
});

// Totals of the old app for the month the family was viewing, and the neighbours.
for (const offset of [-1, 0, 1]) {
  const [year, month] = legacy.month.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  same(`calculate(${key})`, calculate({ ...legacy, month: key }), calculate({ ...migrated, month: key }));
}

if (problems.length) {
  console.error(`Найдено расхождений: ${problems.length}`);
  problems.forEach(problem => console.error(`- ${problem}`));
  process.exit(1);
}
const totals = calculate(legacy);
console.log(`Совпадает: ${legacy.expenses.length} расходов, ${legacy.balances.length} конвертов, ${legacy.purchases.length} операций, ${legacy.goals.length} целей.`);
console.log(`Итоги ${legacy.month}: зарплата ${totals.salary}, расходы ${totals.expenses}, десятина ${totals.tithe}, в конвертах ${totals.balances}, свободно ${totals.free}.`);
