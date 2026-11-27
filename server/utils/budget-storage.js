const PAGE_SIZE = 100;
const SNAPSHOT_ID = /^[a-zA-Z0-9_-]{1,160}$/;

export function isSnapshotId(value) {
  return typeof value === "string" && SNAPSHOT_ID.test(value);
}

export function budgetId(event) {
  setResponseHeader(event, "Cache-Control", "no-store");
  const id = getRouterParam(event, "id");
  if (!isSnapshotId(id)) throw createError({ statusCode: 400, statusMessage: "Invalid budget ID" });
  return id;
}

export async function snapshots(event, query, options = {}) {
  const { supabaseUrl, supabaseKey } = useRuntimeConfig(event);
  if (!supabaseUrl || !supabaseKey) {
    throw createError({ statusCode: 503, statusMessage: "Budget storage is not configured" });
  }

  const url = new URL("/rest/v1/budget_snapshots", supabaseUrl);
  url.search = new URLSearchParams(query).toString();
  const headers = { apikey: supabaseKey, "Content-Type": "application/json" };
  if (supabaseKey.startsWith("eyJ")) headers.Authorization = `Bearer ${supabaseKey}`;
  if (options.prefer) headers.Prefer = options.prefer;

  try {
    const response = await fetch(url, {
      method: options.method,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}`);
    const body = await response.text();
    return body ? JSON.parse(body) : [];
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Budget storage unavailable" });
  }
}

export async function readManifest(event, id) {
  const [row] = await snapshots(event, { id: `eq.${id}`, select: "payload" });
  const manifest = row?.payload;
  if (!manifest || !Object.hasOwn(manifest, "headId")) {
    throw createError({ statusCode: 404, statusMessage: "Budget not found" });
  }
  if (manifest.headId !== null && !isSnapshotId(manifest.headId)) {
    throw createError({ statusCode: 502, statusMessage: "Invalid budget history" });
  }
  return manifest;
}

export async function readHistory(event, headId, after) {
  if (headId === after) return { actions: [], reset: false };
  if (!headId) return { actions: [], reset: true };
  const rowsById = new Map();
  let cursor;
  // Legacy rows are linked by ID and have no separate budget column.
  do {
    const rows = await snapshots(event, {
      select: "id,payload",
      "payload->>iv": "not.is.null",
      order: "id.asc",
      limit: PAGE_SIZE,
      ...(cursor ? { id: `gt.${cursor}` } : {})
    });
    for (const row of rows) rowsById.set(row.id, row.payload);
    cursor = rows.length === PAGE_SIZE ? rows.at(-1).id : null;
  } while (cursor);

  const actions = [];
  const seen = new Set();
  let id = headId;
  while (id && id !== after) {
    const data = rowsById.get(id);
    if (!data || seen.has(id)) {
      throw createError({ statusCode: 502, statusMessage: "Incomplete budget history" });
    }
    seen.add(id);
    actions.push({ id, iv: data.iv, payload: data.payload, updatedAt: data.updatedAt });
    id = data.previous || null;
  }
  return { actions: actions.reverse(), reset: after !== null && id !== after };
}
