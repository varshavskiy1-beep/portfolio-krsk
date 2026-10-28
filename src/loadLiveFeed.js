/**
 * Загрузка публичной LIVE-ленты. Без резерва PAPER и без локальной копии.
 * VITE_LIVE_DATA_BASE пустая → раздел не настроен, запросов нет.
 */

import { LIVE_CATALOG } from "./liveCatalog.js";
import {
  assembleLivePair,
  isLiveSnapshotInFuture,
  LIVE_CLOCK_ERROR_RU,
} from "./liveFeedValidate.js";

export const LIVE_BASE_ENV = "VITE_LIVE_DATA_BASE";

function envLiveBase(override) {
  if (override !== undefined) return override;
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.VITE_LIVE_DATA_BASE;
  }
  return undefined;
}

/**
 * Абсолютный HTTPS без логина, пароля, query и fragment.
 * @param {string} url
 */
export function parseLiveDataBase(url) {
  const raw = String(url || "").trim();
  if (!raw) return { ok: false, reason: "live_base_empty" };
  if (/^\s*javascript:/i.test(raw) || raw.startsWith("/") || raw.startsWith(".")) {
    return { ok: false, reason: "live_base_invalid" };
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "live_base_invalid" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "live_base_not_https" };
  if (u.username || u.password) return { ok: false, reason: "live_base_credentials" };
  if (u.search) return { ok: false, reason: "live_base_query" };
  if (u.hash) return { ok: false, reason: "live_base_fragment" };
  const base = u.href.endsWith("/") ? u.href : `${u.href}/`;
  return { ok: true, base, host: u.host };
}

export function readLiveDataBase(raw) {
  const value = envLiveBase(raw);
  if (value == null || String(value).trim() === "") {
    return { configured: false, base: null, host: "" };
  }
  const parsed = parseLiveDataBase(String(value));
  if (!parsed.ok) {
    return { configured: true, ok: false, reason: parsed.reason, base: null, host: "" };
  }
  return { configured: true, ok: true, base: parsed.base, host: parsed.host };
}

export async function readLiveJson(url, { signal, fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { signal, cache: "no-store" });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    return { ok: false, reason: "fetch" };
  }
  if (!res.ok) return { ok: false, reason: "http", status: res.status };
  try {
    return { ok: true, value: await res.json() };
  } catch {
    return { ok: false, reason: "json" };
  }
}

async function fetchLivePair(base, { signal, fetchImpl }) {
  const latestUrl = `${base}data/live/latest.json`;
  const historyUrl = `${base}data/live/history.json`;
  const [latest, history] = await Promise.all([
    readLiveJson(latestUrl, { signal, fetchImpl }),
    readLiveJson(historyUrl, { signal, fetchImpl }),
  ]);
  return { latest, history };
}

/**
 * @param {string} base
 * @param {{ signal?: AbortSignal, catalog?: readonly object[], fetchImpl?: typeof fetch, nowMs?: number }} [opts]
 */
export async function fetchLiveSnapshot(base, opts = {}) {
  const {
    signal,
    catalog = LIVE_CATALOG,
    fetchImpl = fetch,
    nowMs = Date.now(),
  } = opts;
  const normalized = parseLiveDataBase(base);
  if (!normalized.ok) return { ok: false, reason: normalized.reason };

  let pair = await fetchLivePair(normalized.base, { signal, fetchImpl });
  if (!pair.latest.ok) return { ok: false, reason: pair.latest.reason, status: pair.latest.status };
  if (!pair.history.ok) return { ok: false, reason: pair.history.reason, status: pair.history.status };

  let assembled = assembleLivePair(pair.latest.value, pair.history.value, catalog);
  if (!assembled.ok && assembled.reason === "snapshot_mismatch") {
    pair = await fetchLivePair(normalized.base, { signal, fetchImpl });
    if (!pair.latest.ok) return { ok: false, reason: pair.latest.reason, status: pair.latest.status };
    if (!pair.history.ok) return { ok: false, reason: pair.history.reason, status: pair.history.status };
    assembled = assembleLivePair(pair.latest.value, pair.history.value, catalog);
    if (!assembled.ok) return assembled;
  } else if (!assembled.ok) {
    return assembled;
  }

  if (isLiveSnapshotInFuture(assembled.latest.generated_at, nowMs)) {
    return { ok: false, reason: "generated_at_future", message: LIVE_CLOCK_ERROR_RU };
  }

  return {
    ok: true,
    latest: assembled.latest,
    history: assembled.history,
    fetchedAt: Date.now(),
    host: normalized.host,
  };
}

/**
 * Если база не задана — запросов нет.
 */
export async function loadLiveMode(rawBase, opts = {}) {
  const cfg = readLiveDataBase(rawBase);
  if (!cfg.configured) {
    return { ok: true, configured: false, latest: null, history: null };
  }
  if (cfg.ok === false) {
    return { ok: false, configured: true, reason: cfg.reason };
  }
  const snap = await fetchLiveSnapshot(cfg.base, opts);
  if (!snap.ok) return { ...snap, configured: true };
  return { ...snap, configured: true };
}
