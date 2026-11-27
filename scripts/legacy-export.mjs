// Reads the legacy end-to-end encrypted budget from Supabase (read-only),
// decrypts it with the key from the family link and writes two local files:
//   pocketbase/import/legacy-state.json   the decrypted state exactly as the old app sees it
//   pocketbase/import/legacy-import.json  the same data split into PocketBase collections
//
// Usage: node --env-file=.env scripts/legacy-export.mjs [--backup path/to/backup.json]
// Needs NUXT_SUPABASE_URL, NUXT_SUPABASE_KEY and LEGACY_BUDGET_LINK, or only --backup.

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { automaticWorkdays, base64UrlToBytes, CATEGORIES, normalizeState } from "../app/utils/budget.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "pocketbase/import");
// Small pages with retries keep each Supabase response short.
const PAGE_SIZE = 25;
const ATTEMPTS = 6;

const clone = value => JSON.parse(JSON.stringify(value));

// The sync reducer of the old app (applyAction in its budget-sync.js).
function applyAction(state, action) {
  const result = clone(state);
  if (action.kind === "set") {
    if (action.path.length === 1) result[action.path[0]] = clone(action.value);
    else result[action.path[0]][action.path[1]] = clone(action.value);
  } else if (action.kind === "textPart") {
    if (action.path.length === 1) result[action.path[0]] = (result[action.path[0]] || "") + action.part;
    else result[action.path[0]][action.path[1]] = (result[action.path[0]][action.path[1]] || "") + action.part;
  } else if (action.kind === "item") {
    const items = clone(result[action.collection]);
    const index = items.findIndex(item => item.id === action.item.id);
    if (index >= 0) items[index] = clone(action.item);
    else items.push(clone(action.item));
    result[action.collection] = items;
  } else if (action.kind === "delete") {
    result[action.collection] = result[action.collection].filter(item => item.id !== action.id);
  }
  if (action.updatedAt) result.updatedAt = action.updatedAt;
  return result;
}

// GET through curl: it speaks HTTP/2, while Node's fetch (HTTP/1.1) stalls on some networks.
// The API key goes to curl's stdin config, so it never shows up in the process list.
function curlJson(target, key) {
  const config = [`url = "${target}"`, `header = "apikey: ${key}"`];
  if (key.startsWith("eyJ")) config.push(`header = "Authorization: Bearer ${key}"`);
  return new Promise((done, fail) => {
    const child = execFile("curl", ["-sS", "--fail", "--http2", "--max-time", "15", "-K", "-"], { maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
      if (error) fail(new Error(`Supabase request failed: ${error.message.split("\n").at(-2) || error.code}`));
      else done(JSON.parse(stdout));
    });
    child.stdin.end(`${config.join("\n")}\n`);
  });
}

async function supabaseRows(query) {
  const { NUXT_SUPABASE_URL: url, NUXT_SUPABASE_KEY: key } = process.env;
  if (!url || !key) throw new Error("NUXT_SUPABASE_URL and NUXT_SUPABASE_KEY are required");
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const target = new URL("/rest/v1/budget_snapshots", url);
    target.search = new URLSearchParams({ ...query, order: "id.asc", limit: PAGE_SIZE, offset }).toString();
    let page;
    for (let attempt = 1; !page; attempt += 1) {
      try {
        page = await curlJson(target, key);
      } catch (error) {
        if (attempt >= ATTEMPTS) throw error;
        await new Promise(done => setTimeout(done, 500 * attempt));
      }
    }
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function readRemoteState(link) {
  const hash = new URL(link).hash;
  const [prefix, manifestId, rawKey, encoded] = hash.slice(1).split(".");
  if (prefix !== "sync" || !manifestId || !rawKey) throw new Error("LEGACY_BUDGET_LINK is not a family sync link");
  const key = await crypto.subtle.importKey("raw", base64UrlToBytes(rawKey), "AES-GCM", false, ["decrypt"]);
  const decrypt = async ({ iv, payload }) => JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(iv) }, key, base64UrlToBytes(payload)
  )));

  const rows = await supabaseRows({ select: "id,payload,updated_at" });
  const byId = new Map(rows.map(row => [row.id, row.payload]));
  const manifest = byId.get(manifestId);
  if (!manifest || !Object.hasOwn(manifest, "headId")) throw new Error("Budget manifest not found in Supabase");

  let initial;
  if (encoded) {
    const stream = new Blob([base64UrlToBytes(encoded)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    initial = JSON.parse(await new Response(stream).text());
  } else {
    const row = byId.get(`initial-${manifestId}`);
    if (!row?.iv) throw new Error("Initial snapshot not found in Supabase");
    initial = await decrypt(row);
  }

  const chain = [];
  const seen = new Set();
  for (let id = manifest.headId; id; id = byId.get(id).previous || null) {
    if (!byId.get(id)?.iv || seen.has(id)) throw new Error(`Broken history at ${id}`);
    seen.add(id);
    chain.push(id);
  }
  chain.reverse();
  const actions = await Promise.all(chain.map(id => decrypt(byId.get(id))));
  const base = normalizeState(initial);
  const state = normalizeState({ ...actions.reduce(applyAction, base), updatedAt: manifest.updatedAt || base.updatedAt });

  const actionRows = rows.filter(row => row.payload?.iv && row.id !== `initial-${manifestId}`);
  return {
    state,
    source: {
      kind: "supabase",
      manifestId,
      headId: manifest.headId,
      updatedAt: manifest.updatedAt,
      appliedActions: chain.length,
      unlinkedActions: actionRows.filter(row => !seen.has(row.id)).map(row => row.id),
      devices: new Set(actionRows.map(row => row.payload.deviceId)).size
    }
  };
}

// Legacy IDs made by the old app look like "p1794896536873": a letter and Date.now().
// They keep the real creation time, which PocketBase stores in `created`.
function createdFromId(id) {
  const match = /^[a-z](\d{13})$/.exec(id);
  const time = match && Number(match[1]);
  return time && time > Date.UTC(2020, 0) && time < Date.now() ? new Date(time).toISOString() : "";
}

function toImport(state, source) {
  const envelopeKeys = new Set(state.balances.map(balance => balance.id));
  const archived = new Map();
  for (const purchase of state.purchases) {
    if (envelopeKeys.has(purchase.balanceId) || archived.has(purchase.balanceId)) continue;
    archived.set(purchase.balanceId, {
      key: purchase.balanceId || `deleted:${purchase.balanceName}`,
      name: purchase.balanceName,
      balance: 0,
      category: "other",
      position: state.balances.length + archived.size,
      archived: true
    });
  }

  const renamed = state.purchases.filter(purchase => {
    const balance = state.balances.find(item => item.id === purchase.balanceId);
    return balance && balance.name !== purchase.balanceName;
  });

  return {
    format: "semeyny-byudzhet/pocketbase-import@1",
    source: { ...source, exportedAt: new Date().toISOString(), viewedMonth: state.month },
    household: {
      name: "Семейный бюджет",
      salary: state.settings.salary,
      tithe_rate: state.settings.titheRate,
      credit_note: state.creditNote
    },
    categories: Object.keys(CATEGORIES),
    expenses: state.expenses.map((expense, position) => ({
      key: expense.id,
      name: expense.name,
      amount: expense.amount,
      payday: String(expense.payday),
      category: expense.category,
      position,
      created: createdFromId(expense.id),
      paid_months: [...new Set(expense.paidMonths)].sort()
    })),
    envelopes: [
      ...state.balances.map((balance, position) => ({
        key: balance.id,
        name: balance.name,
        balance: balance.amount,
        category: balance.category,
        position,
        archived: false,
        created: createdFromId(balance.id)
      })),
      ...archived.values()
    ],
    operations: state.purchases.map((purchase, position) => ({
      key: purchase.id,
      envelope: envelopeKeys.has(purchase.balanceId) ? purchase.balanceId : archived.get(purchase.balanceId).key,
      envelope_name: purchase.balanceName,
      type: purchase.type,
      name: purchase.name,
      amount: purchase.amount,
      days: purchase.days,
      date: purchase.date,
      position,
      created: createdFromId(purchase.id)
    })),
    goals: state.goals.map((goal, position) => ({
      key: goal.id,
      name: goal.name,
      target: goal.target,
      saved: goal.saved,
      planned: goal.planned,
      due_date: goal.dueDate,
      payday: goal.payday ? String(goal.payday) : "",
      closed: goal.closed,
      position,
      created: createdFromId(goal.id)
    })),
    workday_overrides: Object.entries(state.workdays)
      .filter(([month]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, override]) => {
        const automatic = automaticWorkdays(month);
        const pick = (value, fallback) => value === "" || value == null || !Number.isFinite(Number(value))
          ? fallback : Math.max(0, Number(value));
        return { month, first_days: pick(override?.first, automatic.first), second_days: pick(override?.second, automatic.second) };
      }),
    notes: {
      archivedEnvelopes: archived.size,
      operationsWithRenamedEnvelope: renamed.map(purchase => ({ key: purchase.id, recordedAs: purchase.balanceName }))
    }
  };
}

const backupIndex = process.argv.indexOf("--backup");
const { state, source } = backupIndex > 0
  ? { state: normalizeState(JSON.parse(await readFile(resolve(process.argv[backupIndex + 1]), "utf8"))), source: { kind: "backup", file: process.argv[backupIndex + 1] } }
  : await readRemoteState(process.env.LEGACY_BUDGET_LINK || "");

const data = toImport(state, source);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(resolve(OUT_DIR, "legacy-state.json"), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
await writeFile(resolve(OUT_DIR, "legacy-import.json"), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });

const sum = items => items.reduce((total, item) => total + item, 0);
console.log(JSON.stringify({
  source: data.source,
  counts: {
    expenses: data.expenses.length,
    expensePayments: sum(data.expenses.map(item => item.paid_months.length)),
    envelopes: data.envelopes.length,
    operations: data.operations.length,
    goals: data.goals.length,
    workdayOverrides: data.workday_overrides.length
  },
  notes: { archivedEnvelopes: data.notes.archivedEnvelopes, operationsWithRenamedEnvelope: data.notes.operationsWithRenamedEnvelope.length },
  files: ["pocketbase/import/legacy-state.json", "pocketbase/import/legacy-import.json"]
}, null, 2));
