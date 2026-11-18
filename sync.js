"use strict";

const SUPABASE_URL = "https://jmuzskycijdaxzigevlr.supabase.co";
const SUPABASE_KEY = "sb_publishable_V3r640Wir_pva69OVEzkYw_QEQv2lMv";

class BudgetSync {
  constructor({ onState, onStatus }) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.active = false;
    this.base = null;
    this.latestState = null;
    this.manifestId = "";
    this.key = "";
    this.keyMaterial = null;
    this.headId = null;
    this.updatedAt = "";
    this.saving = false;
    this.pending = false;
    this.deviceId = this.getDeviceId();
  }

  get url() {
    const initialState = location.hash.replace(/^#/, "").split(".")[3];
    return `${location.origin}${location.pathname}#sync.${this.manifestId}.${this.key}.${initialState}`;
  }

  getDeviceId() {
    let id = sessionStorage.getItem("family-budget-device");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("family-budget-device", id);
    }
    return id;
  }

  status(text) {
    if (this.onStatus) this.onStatus(text);
  }

  clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  bytesToBase64Url(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  base64UrlToBytes(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  async open(hash) {
    const [prefix, manifestId, key] = hash.replace(/^#/, "").split(".");
    if (prefix !== "sync" || !manifestId || !key) throw new Error("Ссылка общего бюджета повреждена");
    this.manifestId = manifestId;
    this.key = key;
    this.keyMaterial = await crypto.subtle.importKey("raw", this.base64UrlToBytes(key), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    this.active = true;
    const manifest = await this.fetchManifest();
    this.headId = manifest.headId || null;
    this.updatedAt = manifest.updatedAt;
    const initialState = await this.decodeInitialState(hash);
    const actions = await this.readActions(this.headId, null);
    this.base = actions.reduce((current, action) => this.applyAction(current, action), normalizeState(initialState));
    this.base.updatedAt = manifest.updatedAt;
    this.latestState = this.clone(this.base);
    this.status("Общая синхронизация включена");
    this.timer = setInterval(() => this.refresh(), 10 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.refresh();
    });
    window.addEventListener("focus", () => this.refresh());
    return this.base;
  }

  async decodeInitialState(hash) {
    const encoded = hash.replace(/^#/, "").split(".")[3];
    if (!encoded) throw new Error("В ссылке нет начальных данных");
    const compressed = this.base64UrlToBytes(encoded);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  async fetchJson(url, options = {}) {
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(10000),
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
          }
        });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`Ошибка хранилища: ${response.status} ${text}`);
    return text ? JSON.parse(text) : {};
  }

  async encryptText(text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.keyMaterial, new TextEncoder().encode(text));
    return { iv: this.bytesToBase64Url(iv), payload: this.bytesToBase64Url(new Uint8Array(encrypted)) };
  }

  async decryptText(iv, payload) {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: this.base64UrlToBytes(iv) }, this.keyMaterial, this.base64UrlToBytes(payload));
    return new TextDecoder().decode(decrypted);
  }

  async fetchManifest() {
    const rows = await this.fetchJson(`${SUPABASE_URL}/rest/v1/budget_snapshots?id=eq.${this.manifestId}`);
    return rows[0]?.payload || {};
  }

  async readActions(headId, stopId) {
    const rows = await this.fetchJson(`${SUPABASE_URL}/rest/v1/budget_snapshots?select=id,payload`);
    const rowsById = new Map(rows.map(row => [row.id, row.payload]));
    const actions = [];
    const seen = new Set();
    let id = headId;
    while (id && id !== stopId) {
      if (seen.has(id)) throw new Error("История общего бюджета повреждена");
      seen.add(id);
      const data = rowsById.get(id);
      if (!data) throw new Error("Не удалось прочитать историю общего бюджета");
      const plain = await this.decryptText(data.iv, data.payload);
      const action = { ...JSON.parse(plain), previous: data.previous || null, updatedAt: data.updatedAt };
      actions.unshift(action);
      id = action.previous;
    }
    return actions;
  }

  applyAction(state, action) {
    const result = this.clone(state);
    if (action.kind === "set") {
      if (action.path.length === 1) result[action.path[0]] = this.clone(action.value);
      else result[action.path[0]][action.path[1]] = this.clone(action.value);
    } else if (action.kind === "textPart") {
      if (action.path.length === 1) result[action.path[0]] = (result[action.path[0]] || "") + action.part;
      else result[action.path[0]][action.path[1]] = (result[action.path[0]][action.path[1]] || "") + action.part;
    } else if (action.kind === "item") {
      const items = result[action.collection].filter(item => item.id !== action.item.id);
      items.push(this.clone(action.item));
      result[action.collection] = items;
    } else if (action.kind === "delete") {
      result[action.collection] = result[action.collection].filter(item => item.id !== action.id);
    }
    if (action.updatedAt) result.updatedAt = action.updatedAt;
    return result;
  }

  diffActions(base, local) {
    const actions = [];
    const set = (path, value) => actions.push({ kind: "set", path, value: this.clone(value) });
    if (JSON.stringify(base.month) !== JSON.stringify(local.month)) set(["month"], local.month);
    if (JSON.stringify(base.creditNote) !== JSON.stringify(local.creditNote)) set(["creditNote"], local.creditNote);
    ["salary", "titheRate"].forEach(key => {
      if (base.settings[key] !== local.settings[key]) set(["settings", key], local.settings[key]);
    });
    if (JSON.stringify(base.workdays) !== JSON.stringify(local.workdays)) set(["workdays"], this.clone(local.workdays));
    ["expenses", "balances", "goals", "purchases"].forEach(collection => {
      const baseItems = new Map(base[collection].map(item => [item.id, item]));
      const localItems = new Map(local[collection].map(item => [item.id, item]));
      local[collection].forEach(item => {
        if (!baseItems.has(item.id) || JSON.stringify(baseItems.get(item.id)) !== JSON.stringify(item)) {
          actions.push({ kind: "item", collection, item: this.clone(item) });
        }
      });
      base[collection].forEach(item => {
        if (!localItems.has(item.id)) actions.push({ kind: "delete", collection, id: item.id });
      });
    });
    return actions;
  }

  splitAction(action) {
    if (action.kind === "set" && typeof action.value === "string" && JSON.stringify(action).length > 300) {
      const parts = [];
      for (let index = 0; index < action.value.length; index += 200) {
        parts.push({ kind: "textPart", path: action.path, part: action.value.slice(index, index + 200) });
      }
      return [{ kind: "set", path: action.path, value: "" }, ...parts];
    }
    return [action];
  }

  async save(state) {
    if (!this.active || !this.base) return;
    this.latestState = this.clone(state);
    if (this.saving) {
      this.pending = true;
      return;
    }
    this.saving = true;
    this.pending = false;
    this.status("Сохраняю изменения…");
    let completed = false;
    try {
      const actions = this.diffActions(this.base, this.latestState).flatMap(action => this.splitAction(action));
      for (const action of actions) {
        const timestamp = new Date().toISOString();
        action.updatedAt = timestamp;
        const encrypted = await this.encryptText(JSON.stringify(action));
        const created = await this.fetchJson(`${SUPABASE_URL}/rest/v1/budget_snapshots`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            payload: { ...encrypted, previous: this.headId, updatedAt: timestamp, deviceId: this.deviceId },
            updated_at: timestamp,
            device_id: this.deviceId
          })
        });
        this.headId = created[0].id;
        this.base = this.applyAction(this.base, action);
        this.updatedAt = timestamp;
      }
      if (actions.length) {
        await this.fetchJson(`${SUPABASE_URL}/rest/v1/budget_snapshots?id=eq.${this.manifestId}`, {
          method: "PATCH",
          body: JSON.stringify({ payload: { headId: this.headId, updatedAt: this.updatedAt, deviceId: this.deviceId }, updated_at: this.updatedAt, device_id: this.deviceId })
        });
      }
      this.latestState = this.clone(this.base);
      this.onState(this.base);
      this.status(actions.length ? "Изменения синхронизированы" : "Общая синхронизация включена");
      completed = true;
    } catch (error) {
      this.pending = true;
      this.status("Нет связи. Изменения сохранены на устройстве и будут отправлены позже");
    } finally {
      this.saving = false;
      if (completed && this.pending) {
        this.pending = false;
        setTimeout(() => this.save(this.latestState), 400);
      }
    }
  }

  async refresh() {
    if (!this.active || this.saving) return;
    if (this.pending) {
      this.save(this.latestState);
      return;
    }
    try {
      const manifest = await this.fetchManifest();
      if ((manifest.headId || null) !== this.headId) {
        const actions = await this.readActions(manifest.headId, this.headId);
        actions.forEach(action => {
          this.base = this.applyAction(this.base, action);
        });
        this.headId = manifest.headId || null;
        this.updatedAt = manifest.updatedAt;
        this.latestState = this.clone(this.base);
        this.onState(this.base);
        this.status("Обновлено из общего хранилища");
      } else {
        this.status("Общая синхронизация включена");
      }
    } catch (error) {
      this.status("Нет связи. Показываются данные на устройстве");
    }
  }
}
