/**
 * Согласованная загрузка latest / history / backtests.
 * Битый кадр целиком отклоняется; вызывающий держит последнюю исправную версию.
 */
import { normalizeHistory, normalizeLatest } from "./cashCurrency.js";
import { assembleSnapshot } from "./feedValidate.js";

export async function readJson(url, { signal, optional = false } = {}) {
  let res;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    if (optional) return { ok: true, value: null };
    return { ok: false, reason: "fetch" };
  }
  if (!res.ok) {
    if (optional) return { ok: true, value: null };
    return { ok: false, reason: "http" };
  }
  try {
    return { ok: true, value: await res.json() };
  } catch {
    return { ok: false, reason: "json" };
  }
}

export async function fetchCabinetSnapshot(base, { signal } = {}) {
  const prefix = base || "/";
  const [latest, history, backtests] = await Promise.all([
    readJson(`${prefix}data/latest.json`, { signal }),
    readJson(`${prefix}data/history.json`, { signal, optional: true }),
    readJson(`${prefix}data/backtests.json`, { signal, optional: true }),
  ]);
  if (!latest.ok) return { ok: false, reason: latest.reason };
  if (!history.ok) return { ok: false, reason: history.reason };
  if (!backtests.ok) return { ok: false, reason: backtests.reason };
  const snap = assembleSnapshot(latest.value, history.value, backtests.value);
  if (!snap.ok) return snap;
  const normalized = normalizeLatest(snap.latest);
  if (!normalized) return { ok: false, reason: "latest_normalize" };
  return {
    ok: true,
    latest: normalized,
    history: normalizeHistory(snap.history),
    backtests: snap.backtests,
    fetchedAt: Date.now(),
  };
}
