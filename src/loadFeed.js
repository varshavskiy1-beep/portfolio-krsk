/**
 * Согласованная загрузка latest / history / backtests.
 * Битый кадр целиком отклоняется; вызывающий держит последнюю исправную версию.
 */
import { normalizeHistory, normalizeLatest } from "./cashCurrency.js";
import { EQUITY_LIVE_DATA_BASE, normalizeDataBase } from "./equityLiveData.js";
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

function equityCacheBust() {
  return `?t=${Math.floor(Date.now() / 60_000)}`;
}

async function readEquityJson(liveBase, fallbackBase, relPath, { signal, optional = false } = {}) {
  const liveUrl = `${normalizeDataBase(liveBase)}${relPath}${equityCacheBust()}`;
  const live = await readJson(liveUrl, { signal, optional: false });
  if (live.ok) return live;
  const fallbackUrl = `${normalizeDataBase(fallbackBase)}${relPath}`;
  return readJson(fallbackUrl, { signal, optional });
}

export async function fetchCabinetSnapshot(base, { signal, liveBase = EQUITY_LIVE_DATA_BASE } = {}) {
  const fallbackBase = base || "/";
  const [latest, history, backtests] = await Promise.all([
    readEquityJson(liveBase, fallbackBase, "data/latest.json", { signal }),
    readEquityJson(liveBase, fallbackBase, "data/history.json", { signal, optional: true }),
    readJson(`${normalizeDataBase(fallbackBase)}data/backtests.json`, { signal, optional: true }),
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
