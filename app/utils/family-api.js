// Access to the family budget in PocketBase (pocketbase/pb_migrations, pb_hooks).
// The store (composables/useFamilyBudget.js) talks only to this interface;
// utils/family-demo.js implements the same one in memory for the design pages.

import PocketBase from "pocketbase";

export const COLLECTIONS = [
  "households", "users", "categories", "expenses", "expense_payments",
  "envelopes", "operations", "goals", "workday_overrides", "invites"
];
// Categories are fixed by the schema; everything else can change on another device.
const LIVE_COLLECTIONS = COLLECTIONS.filter(name => name !== "categories");

export function createPocketbaseApi(baseUrl) {
  const pb = new PocketBase(baseUrl);
  // Several edits of one record in a row must all reach the server.
  pb.autoCancellation(false);
  const signedIn = () => (pb.authStore.isValid ? pb.authStore.record : null);

  return {
    currentUser: signedIn,

    async login(username, password) {
      const { record } = await pb.collection("users").authWithPassword(username.trim().toLowerCase(), password);
      return record;
    },

    async join(form) {
      const { token, record } = await pb.send("/api/family/join", { method: "POST", body: form });
      pb.authStore.save(token, record);
      return record;
    },

    // Checks the saved session and extends it; fails with 401 when it is no longer valid.
    async refresh() {
      const { record } = await pb.collection("users").authRefresh();
      return record;
    },

    async logout() {
      await this.unsubscribe();
      pb.authStore.clear();
    },

    async load(user) {
      const lists = await Promise.all(COLLECTIONS.map(name => (
        name === "invites" && user.role !== "owner" ? [] : pb.collection(name).getFullList({ batch: 500 })
      )));
      return Object.fromEntries(COLLECTIONS.map((name, index) => [name, lists[index]]));
    },

    create: (name, data) => pb.collection(name).create(data),
    update: (name, id, data) => pb.collection(name).update(id, data),
    remove: (name, id) => pb.collection(name).delete(id),

    // Operations change envelope balances on the server in one transaction.
    recordOperation: body => pb.send("/api/family/operations", { method: "POST", body }),
    undoOperation: id => pb.send(`/api/family/operations/${encodeURIComponent(id)}`, { method: "DELETE" }),

    async changePassword(user, oldPassword, password) {
      await pb.collection("users").update(user.id, { oldPassword, password, passwordConfirm: password });
      // PocketBase ends every session of the account after a password change.
      const { record } = await pb.collection("users").authWithPassword(user.username, password);
      return record;
    },

    async subscribe({ onRecord, onConnect, onDisconnect }) {
      pb.realtime.onDisconnect = (subscriptions = []) => {
        if (subscriptions.length) onDisconnect();
      };
      await pb.realtime.subscribe("PB_CONNECT", () => onConnect());
      await Promise.all(LIVE_COLLECTIONS.map(name => (
        pb.collection(name).subscribe("*", event => onRecord(name, event.action, event.record))
      )));
    },

    async unsubscribe() {
      pb.realtime.onDisconnect = undefined;
      try {
        await pb.realtime.unsubscribe();
      } catch {}
    }
  };
}

// A message for the person, in Russian. Server hooks already answer in Russian;
// PocketBase's own validation messages are English, so they get a general text.
export function errorMessage(error, fallback = "Не удалось сохранить. Попробуйте ещё раз") {
  if (error?.friendly) return error.message;
  if (!error || typeof error.status !== "number" || !("response" in error)) {
    console.error(error);
    return fallback;
  }
  if (error.isAbort) return "";
  if (!error.status) return "Нет связи с сервером. Проверьте интернет";
  if (error.status === 429) return "Слишком много попыток. Подождите минуту";
  if (error.status === 401) return "Сессия закончилась. Войдите заново";
  if (error.status === 403) return "Нет доступа к этому действию";
  const message = String(error.response?.message || "");
  return /[а-яё]/i.test(message) ? message : fallback;
}
