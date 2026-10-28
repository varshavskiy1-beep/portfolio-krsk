/**
 * Согласованный публичный каталог LIVE.
 * Пустой, пока владелец не утвердит роботов и псевдонимы.
 * Не копировать сюда PAPER excluded / PORTAL_SHELLS.
 */

/** @typedef {{ botId: string, accountId: string, title: string, accountLabel: string, currency: string }} LiveCatalogItem */

export const LIVE_ID_RE = /^[a-z0-9_-]+$/;

/** @type {readonly LiveCatalogItem[]} */
export const LIVE_CATALOG = Object.freeze([]);

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isValidLiveId(id) {
  if (typeof id !== "string" || id === "") return false;
  if (id.includes("::") || id.includes("/")) return false;
  for (let i = 0; i < id.length; i += 1) {
    const code = id.charCodeAt(i);
    if (code < 32) return false;
  }
  return LIVE_ID_RE.test(id);
}

/** @param {string} botId @param {string} accountId */
export function liveSeriesKey(botId, accountId) {
  return `${botId}::${accountId}`;
}

/**
 * @param {readonly LiveCatalogItem[]} [catalog]
 * @returns {{ ok: true, byKey: Map<string, LiveCatalogItem> } | { ok: false, reason: string }}
 */
export function indexLiveCatalog(catalog = LIVE_CATALOG) {
  const byKey = new Map();
  if (!Array.isArray(catalog)) return { ok: false, reason: "catalog_not_array" };
  for (const item of catalog) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: "catalog_item" };
    }
    if (!isValidLiveId(item.botId) || !isValidLiveId(item.accountId)) {
      return { ok: false, reason: "catalog_id" };
    }
    if (typeof item.title !== "string" || item.title.trim() === "") {
      return { ok: false, reason: "catalog_title" };
    }
    if (typeof item.accountLabel !== "string" || item.accountLabel.trim() === "") {
      return { ok: false, reason: "catalog_account_label" };
    }
    if (typeof item.currency !== "string" || item.currency.trim() === "") {
      return { ok: false, reason: "catalog_currency" };
    }
    const key = liveSeriesKey(item.botId, item.accountId);
    if (byKey.has(key)) return { ok: false, reason: "catalog_duplicate" };
    byKey.set(key, item);
  }
  return { ok: true, byKey };
}

/** @param {string} botId @param {string} accountId @param {readonly LiveCatalogItem[]} [catalog] */
export function findLiveCatalogItem(botId, accountId, catalog = LIVE_CATALOG) {
  const indexed = indexLiveCatalog(catalog);
  if (!indexed.ok) return null;
  return indexed.byKey.get(liveSeriesKey(botId, accountId)) || null;
}

/** @param {string} botId @param {readonly LiveCatalogItem[]} [catalog] */
export function liveCatalogByBot(botId, catalog = LIVE_CATALOG) {
  return (catalog || []).filter((item) => item.botId === botId);
}

export function liveCatalogIsEmpty(catalog = LIVE_CATALOG) {
  return !catalog || catalog.length === 0;
}
