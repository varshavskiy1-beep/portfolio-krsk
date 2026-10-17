/**
 * Граница загрузки снимков кабинета: схема latest/history/backtests.
 * Битый ответ не считается новой версией данных.
 */

export const LOAD_ERROR_RU = "Не удалось загрузить данные снимка.";
export const LOAD_KEEP_LAST_RU = "Показана последняя исправная версия.";
export const RETRY_LABEL = "Повторить";
export const ONLY_PAPER_TRADE = "только бумажная торговля";
export const LIVE_FOOTER_LABEL = "Не на сайте (живые счета)";
export const PCT_NO_POSITIVE_SEED = "Доходность не рассчитана: нет положительного начального капитала";
export const STALE_LABEL = "снимок просрочен";
export const REFRESH_MS = 5 * 60 * 1000;
export const STALE_AFTER_MS = 40 * 60 * 1000;
export const FEED_SOURCE_NAME = "equity-ro latest.json";

export function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

export function validateLatest(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "latest_not_object" };
  }
  if (!Array.isArray(raw.accounts)) {
    return { ok: false, reason: "accounts_not_array" };
  }
  for (let i = 0; i < raw.accounts.length; i += 1) {
    const a = raw.accounts[i];
    if (a == null || typeof a !== "object" || Array.isArray(a)) {
      return { ok: false, reason: "account_not_object", index: i };
    }
    if (!isNonEmptyString(a.bot_id) || !isNonEmptyString(a.account_id)) {
      return { ok: false, reason: "account_ids", index: i };
    }
  }
  return { ok: true, value: raw };
}

export function validateHistory(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "history_not_object" };
  }
  if (raw.series != null && (typeof raw.series !== "object" || Array.isArray(raw.series))) {
    return { ok: false, reason: "history_series" };
  }
  return { ok: true, value: raw };
}

export function validateBacktests(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "backtests_not_object" };
  }
  if (raw.series != null && (typeof raw.series !== "object" || Array.isArray(raw.series))) {
    return { ok: false, reason: "backtests_series" };
  }
  return { ok: true, value: raw };
}

/** Собрать согласованный снимок. Неправильный latest — отказ всего кадра. */
export function assembleSnapshot(latestRaw, historyRaw, backtestsRaw) {
  const latest = validateLatest(latestRaw);
  if (!latest.ok) return { ok: false, reason: latest.reason };
  const history = validateHistory(historyRaw);
  if (!history.ok) return { ok: false, reason: history.reason };
  const backtests = validateBacktests(backtestsRaw);
  if (!backtests.ok) return { ok: false, reason: backtests.reason };
  return {
    ok: true,
    latest: latest.value,
    history: history.value,
    backtests: backtests.value,
  };
}

export function isFeedStale(fetchedAtMs, nowMs = Date.now()) {
  if (fetchedAtMs == null || !Number.isFinite(fetchedAtMs)) return false;
  return nowMs - fetchedAtMs > STALE_AFTER_MS;
}

export function formatFetchedAt(fetchedAtMs) {
  if (fetchedAtMs == null || !Number.isFinite(fetchedAtMs)) return "";
  const d = new Date(fetchedAtMs);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function feedSourceLine(generatedAt) {
  if (generatedAt == null || generatedAt === "") {
    return `Источник фида: ${FEED_SOURCE_NAME}. Первичные котировки этим кабинетом не проверялись.`;
  }
  return `Источник фида: ${FEED_SOURCE_NAME}, снимок ${generatedAt}. Первичные котировки этим кабинетом не проверялись.`;
}

export function backtestSourceLine(source) {
  const s = source == null ? "" : String(source).trim();
  if (!s) return "";
  return `Источник ряда: ${s}. Первичные котировки этим кабинетом не проверялись.`;
}
