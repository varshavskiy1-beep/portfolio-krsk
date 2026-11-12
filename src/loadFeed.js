/**
 * Согласованная загрузка latest / history / backtests.
 * Живая лента: сначала same-origin /equity-live (Vercel rewrite на Pages),
 * иначе github.io. Запасной bundled JSON не подмешивается к живому latest
 * и не выдаётся за свежий кадр.
 * Битый кадр целиком отклоняется; вызывающий держит последнюю исправную версию.
 */
import { normalizeHistory, normalizeLatest } from "./cashCurrency.js";
import { EQUITY_LIVE_DATA_BASE, normalizeDataBase, sameOriginLiveBase } from "./equityLiveData.js";
import {
  FEED_SOURCE_FALLBACK,
  FEED_SOURCE_LIVE,
  assembleSnapshot,
} from "./feedValidate.js";
import { sanitizeCabinetSnapshot } from "./equitySanitize.js";

/** Живой github.io без ответа не должен висеть вечно (как соседний macromonitor). */
export const LIVE_FETCH_TIMEOUT_MS = 8_000;

export { FEED_SOURCE_LIVE, FEED_SOURCE_FALLBACK };

function timeoutSignal(parent, timeoutMs) {
  if (timeoutMs == null) return { signal: parent, cancel() {} };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const cancel = () => clearTimeout(timer);
  if (parent) {
    if (parent.aborted) {
      cancel();
      ctrl.abort();
    } else {
      parent.addEventListener("abort", () => {
        cancel();
        ctrl.abort();
      }, { once: true });
    }
  }
  return { signal: ctrl.signal, cancel };
}

export async function readJson(url, { signal, optional = false, timeoutMs } = {}) {
  const gate = timeoutSignal(signal, timeoutMs);
  try {
    const res = await fetch(url, { signal: gate.signal, cache: "no-store" });
    if (!res.ok) {
      if (optional) return { ok: true, value: null };
      return { ok: false, reason: "http" };
    }
    // Keep the abort gate until the body is parsed: hung CDN headers+stuck body
    // used to wait forever after fetch() resolved.
    const value = await res.json();
    return { ok: true, value };
  } catch (e) {
    if (e && e.name === "AbortError") {
      if (signal?.aborted) throw e;
      if (optional) return { ok: true, value: null, reason: "timeout" };
      return { ok: false, reason: "timeout" };
    }
    if (e instanceof SyntaxError) return { ok: false, reason: "json" };
    if (optional) return { ok: true, value: null };
    return { ok: false, reason: "fetch" };
  } finally {
    gate.cancel();
  }
}

function equityCacheBust() {
  return `?t=${Math.floor(Date.now() / 60_000)}`;
}

function emptyHistory() {
  return { schema: "equity_history.v1", series: {} };
}

async function readLivePair(root, { signal, timeoutMs }) {
  const bust = equityCacheBust();
  const [latest, history] = await Promise.all([
    readJson(`${root}data/latest.json${bust}`, { signal, timeoutMs }),
    readJson(`${root}data/history.json${bust}`, { signal, timeoutMs }),
  ]);
  if (latest.ok && history.ok) return { ok: true, latest, history };
  return { ok: false };
}

export async function fetchCabinetSnapshot(
  base,
  {
    signal,
    liveBase = EQUITY_LIVE_DATA_BASE,
    proxyBase,
    liveTimeoutMs = LIVE_FETCH_TIMEOUT_MS,
  } = {},
) {
  const fallbackBase = base || "/";
  const proxyRoot =
    proxyBase === null ? null : normalizeDataBase(proxyBase ?? sameOriginLiveBase(fallbackBase));
  const liveRoot = normalizeDataBase(liveBase);

  // 1) same-origin Vercel rewrite → existing Pages data (browser never talks to github.io).
  // 2) direct Pages. 3) bundled /data last-resort, tagged fallback — not a quiet Oct 24 live frame.
  let pair = proxyRoot ? await readLivePair(proxyRoot, { signal, timeoutMs: liveTimeoutMs }) : { ok: false };
  if (!pair.ok) pair = await readLivePair(liveRoot, { signal, timeoutMs: liveTimeoutMs });

  let source = FEED_SOURCE_LIVE;
  let latest = pair.ok ? pair.latest : { ok: false };
  let history = pair.ok ? pair.history : { ok: false };

  if (!pair.ok) {
    source = FEED_SOURCE_FALLBACK;
    latest = await readJson(`${normalizeDataBase(fallbackBase)}data/latest.json`, { signal });
    history = await readJson(`${normalizeDataBase(fallbackBase)}data/history.json`, {
      signal,
      optional: true,
    });
    if (history.ok && history.value == null) {
      history = { ok: true, value: emptyHistory() };
    }
  }

  const backtests = await readJson(`${normalizeDataBase(fallbackBase)}data/backtests.json`, {
    signal,
    optional: true,
  });
  if (!latest.ok) return { ok: false, reason: latest.reason, source };
  if (!history.ok) return { ok: false, reason: history.reason, source };
  if (!backtests.ok) return { ok: false, reason: backtests.reason, source };
  const snap = assembleSnapshot(latest.value, history.value, backtests.value);
  if (!snap.ok) return snap;
  sanitizeCabinetSnapshot(snap.latest, snap.history);
  const normalized = normalizeLatest(snap.latest);
  if (!normalized) return { ok: false, reason: "latest_normalize", source };
  return {
    ok: true,
    latest: normalized,
    history: normalizeHistory(snap.history),
    backtests: snap.backtests,
    fetchedAt: Date.now(),
    source,
  };
}
