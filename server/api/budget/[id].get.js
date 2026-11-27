import { budgetId, isSnapshotId, readHistory, readManifest, snapshots } from "../../utils/budget-storage";

export default defineEventHandler(async event => {
  const id = budgetId(event);
  const { after = null, initial } = getQuery(event);
  if (after !== null && !isSnapshotId(after)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid history ID" });
  }
  const { headId, updatedAt } = await readManifest(event, id);
  const [history, initialRows] = await Promise.all([
    readHistory(event, headId, after),
    initial === "1" ? snapshots(event, { id: `eq.initial-${id}`, select: "payload" }) : []
  ]);
  return { headId, updatedAt, ...history, initial: initialRows[0]?.payload };
});
