import { budgetId, isSnapshotId, readManifest, snapshots } from "../../utils/budget-storage";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const BASE64URL = /^[a-zA-Z0-9_-]+$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function validAction(action) {
  return typeof action?.id === "string" && UUID.test(action.id)
    && typeof action.iv === "string" && action.iv.length === 16 && BASE64URL.test(action.iv)
    && typeof action.payload === "string" && BASE64URL.test(action.payload)
    && typeof action.updatedAt === "string" && TIMESTAMP.test(action.updatedAt);
}

export default defineEventHandler(async event => {
  const id = budgetId(event);
  const { headId, deviceId, actions } = await readBody(event) || {};
  if ((headId !== null && !isSnapshotId(headId)) || typeof deviceId !== "string" || !UUID.test(deviceId)
    || !Array.isArray(actions) || !actions.length || !actions.every(validAction)
    || new Set(actions.map(action => action.id)).size !== actions.length
    || actions.some(action => action.id === id || action.id === headId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid budget changes" });
  }
  const manifest = await readManifest(event, id);
  const last = actions.at(-1);
  if (manifest.headId === last.id) return { headId: last.id, updatedAt: last.updatedAt };
  if (manifest.headId !== headId) {
    throw createError({ statusCode: 409, statusMessage: "Budget changed" });
  }

  const rows = actions.map(({ id, iv, payload, updatedAt }, index) => ({
    id,
    payload: { iv, payload, previous: index ? actions[index - 1].id : headId, updatedAt, deviceId },
    updated_at: updatedAt,
    device_id: deviceId
  }));
  const inserted = await snapshots(event, { on_conflict: "id", select: "id" }, {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: rows
  });
  const insertedIds = new Set(inserted.map(row => row.id));
  for (const row of rows.filter(row => !insertedIds.has(row.id))) {
    const [existing] = await snapshots(event, { id: `eq.${row.id}`, select: "payload" });
    if (!existing || !Object.entries(row.payload).every(([key, value]) => existing.payload?.[key] === value)) {
      throw createError({ statusCode: 409, statusMessage: "Budget action ID already used" });
    }
  }
  const updated = await snapshots(event, {
    id: `eq.${id}`,
    "payload->>headId": headId === null ? "is.null" : `eq.${headId}`,
    select: "id"
  }, {
    method: "PATCH",
    prefer: "return=representation",
    body: {
      payload: { ...manifest, headId: last.id, updatedAt: last.updatedAt, deviceId },
      updated_at: last.updatedAt,
      device_id: deviceId
    }
  });
  if (!updated.length) throw createError({ statusCode: 409, statusMessage: "Budget changed" });
  return { headId: last.id, updatedAt: last.updatedAt };
});
