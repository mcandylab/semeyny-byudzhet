import { base64UrlToBytes, bytesToBase64Url, normalizeState } from "./budget";

const clone = value => JSON.parse(JSON.stringify(value));

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

function diffActions(base, local) {
  const actions = [];
  const set = (path, value) => actions.push({ kind: "set", path, value: clone(value) });
  if (JSON.stringify(base.month) !== JSON.stringify(local.month)) set(["month"], local.month);
  if (JSON.stringify(base.creditNote) !== JSON.stringify(local.creditNote)) set(["creditNote"], local.creditNote);
  ["salary", "titheRate"].forEach(key => {
    if (base.settings[key] !== local.settings[key]) set(["settings", key], local.settings[key]);
  });
  if (JSON.stringify(base.workdays) !== JSON.stringify(local.workdays)) set(["workdays"], clone(local.workdays));
  ["expenses", "balances", "goals", "purchases"].forEach(collection => {
    const baseItems = new Map(base[collection].map(item => [item.id, item]));
    const localItems = new Map(local[collection].map(item => [item.id, item]));
    local[collection].forEach(item => {
      if (!baseItems.has(item.id) || JSON.stringify(baseItems.get(item.id)) !== JSON.stringify(item)) {
        actions.push({ kind: "item", collection, item: clone(item) });
      }
    });
    base[collection].forEach(item => {
      if (!localItems.has(item.id)) actions.push({ kind: "delete", collection, id: item.id });
    });
  });
  return actions;
}

export class BudgetSync {
  constructor({ baseURL, onState, onStatus, onPending }) {
    Object.assign(this, { baseURL, onState, onStatus, onPending });
  }

  get url() {
    return `${location.origin}${location.pathname}${this.hash}`;
  }

  async open(hash, cached, pending) {
    const [prefix, manifestId, key, encoded] = hash.slice(1).split(".");
    if (prefix !== "sync" || !manifestId || !key) throw new Error("Ссылка общего бюджета повреждена");
    this.hash = hash;
    this.encoded = encoded;
    this.urlPath = `${this.baseURL.replace(/\/$/, "")}/api/budget/${encodeURIComponent(manifestId)}`;
    this.key = await crypto.subtle.importKey("raw", base64UrlToBytes(key), "AES-GCM", false, ["encrypt", "decrypt"]);
    this.deviceId = this.getDeviceId();
    this.latestState = cached;
    this.queue = pending?.queue ?? [];
    this.batch = pending?.batch ?? null;

    try {
      await this.sync();
    } catch (error) {
      if (!this.latestState || error.statusCode === 404) throw error;
      this.offline();
    }

    this.timer = setInterval(() => this.refresh(), 10000);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("focus", this.refresh);
    return this.latestState;
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    clearTimeout(this.retryTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("focus", this.refresh);
  }

  onVisibility = () => {
    if (!document.hidden) this.refresh();
  };

  refresh = () => {
    this.sync().catch(() => this.offline());
  };

  getDeviceId() {
    const id = crypto.randomUUID();
    try {
      const saved = sessionStorage.getItem("family-budget-device");
      if (saved) return saved;
      sessionStorage.setItem("family-budget-device", id);
    } catch {}
    return id;
  }

  offline() {
    if (this.closed) return;
    this.onStatus(this.queue.length
      ? "Нет связи. Изменения сохранены на устройстве и будут отправлены позже"
      : "Нет связи. Показываются данные на устройстве");
  }

  async request(options) {
    return $fetch(this.urlPath, { signal: AbortSignal.timeout(65000), retry: 0, ...options });
  }

  async readInitial(initial) {
    if (this.encoded) {
      const buffer = base64UrlToBytes(this.encoded);
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return JSON.parse(await new Response(stream).text());
    }
    if (!initial?.iv) throw new Error("Не удалось загрузить начальные данные общего бюджета");
    return this.decrypt(initial);
  }

  async decrypt({ iv, payload }) {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(iv) }, this.key, base64UrlToBytes(payload)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async encrypt(action) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(action));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key, plain);
    return { id: crypto.randomUUID(), iv: bytesToBase64Url(iv), payload: bytesToBase64Url(new Uint8Array(encrypted)), updatedAt: action.updatedAt };
  }

  async readRemote() {
    const remote = await this.request({
      query: { after: this.headId ?? undefined, initial: this.initial || this.encoded ? undefined : "1" }
    });
    this.initial ??= normalizeState(await this.readInitial(remote.initial));
    const actions = await Promise.all(remote.actions.map(row => this.decrypt(row)));
    const base = !this.base || remote.reset ? this.initial : this.base;
    this.base = { ...actions.reduce(applyAction, base), updatedAt: remote.updatedAt || base.updatedAt };
    this.headId = remote.headId;
    return remote.actions;
  }

  save(state) {
    const changes = diffActions(this.latestState, state);
    if (!changes.length) return;
    this.latestState = clone(state);
    this.queue.push(...changes.map(action => ({ ...action, updatedAt: state.updatedAt })));
    this.persistPending();
    this.refresh();
  }

  persistPending() {
    if (!this.closed) this.onPending(this.queue.length ? { queue: this.queue, batch: this.batch } : null);
  }

  publishState() {
    this.latestState = this.queue.reduce(applyAction, this.base);
    if (!this.closed) this.onState(this.latestState);
  }

  async sync() {
    if (this.closed || this.syncing) return;
    this.syncing = true;
    let retry = false;
    try {
      const previousHead = this.headId;
      const remoteActions = await this.readRemote();
      if (this.closed) return;

      if (this.batch) {
        const lastId = this.batch.actions.at(-1).id;
        if (lastId === this.headId || remoteActions.some(action => action.id === lastId)) {
          this.queue.splice(0, this.batch.actions.length);
          this.batch = null;
        } else if (this.batch.headId !== this.headId) {
          this.batch = null;
        }
        this.persistPending();
      }
      if (this.headId !== previousHead || !this.latestState) this.publishState();

      if (this.queue.length) {
        this.onStatus("Сохраняю изменения…");
        const changes = this.queue.slice();
        if (!this.batch) {
          this.batch = { headId: this.headId, deviceId: this.deviceId, actions: await Promise.all(changes.map(action => this.encrypt(action))) };
          this.persistPending();
        }
        if (this.closed) return;

        const result = await this.request({ method: "POST", body: this.batch });
        if (this.closed) return;
        const committed = this.queue.splice(0, this.batch.actions.length);
        this.batch = null;
        this.headId = result.headId;
        this.base = { ...committed.reduce(applyAction, this.base), updatedAt: result.updatedAt };
        this.persistPending();
        this.publishState();
        this.onStatus("Изменения синхронизированы");
        retry = this.queue.length > 0;
      } else {
        this.onStatus(previousHead !== undefined && previousHead !== this.headId
          ? "Обновлено из общего хранилища"
          : "Общая синхронизация включена");
      }
    } catch (error) {
      if (error.statusCode === 409) retry = true;
      else throw error;
    } finally {
      this.syncing = false;
      if (retry && !this.closed) this.retryTimer = setTimeout(this.refresh, 400);
    }
  }
}
