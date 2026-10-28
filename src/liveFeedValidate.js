/**
 * Проверка публичного контракта LIVE. Неизвестное поле отклоняет снимок.
 * PAPER-фид сюда не подставляется.
 */

import { findLiveCatalogItem, indexLiveCatalog, liveSeriesKey, LIVE_CATALOG } from "./liveCatalog.js";

export const LIVE_SCHEMA_LATEST = "portfolio_live.v1";
export const LIVE_SCHEMA_HISTORY = "portfolio_live_history.v1";
export const LIVE_MODE = "live";
export const LIVE_STALE_AFTER_MS = 40 * 60 * 1000;
export const LIVE_FUTURE_SLACK_MS = 5 * 60 * 1000;
export const LIVE_POINT_AHEAD_MS = 5 * 60 * 1000;
export const LIVE_TZ = "Asia/Krasnoyarsk";
export const LIVE_TZ_LABEL = "Красноярск, UTC+7";
export const LIVE_SOURCE_NAME = "лента реальных счетов";

export const LIVE_NOT_CONFIGURED_RU =
  "Реальные роботы пока не подключены. В этом разделе появятся результаты после подключения публичных данных";
export const LIVE_FEED_EMPTY_RU = "В разделе пока нет опубликованных реальных счетов";
export const LIVE_LOAD_ERROR_RU = "Не удалось загрузить данные реальных счетов";
export const LIVE_SEARCH_EMPTY_RU = "По заданным условиям ничего не найдено";
export const LIVE_RESET_FILTERS_RU = "Сбросить фильтры";
export const LIVE_NO_EQUITY_RU = "Нет данных о стоимости счёта";
export const LIVE_UNKNOWN_BASIS_RU = "Метод оценки счёта не подтверждён";
export const LIVE_NO_TWR_RU = "Доходность без влияния пополнений и выводов пока не рассчитана";
export const LIVE_STALE_LABEL_RU = "Данные устарели";
export const LIVE_CLOCK_ERROR_RU = "Ошибка времени снимка";
export const LIVE_BADGE_RU = "LIVE · реальный счёт";
export const LIVE_HEADING_RU = "БОТЫ LIVE";
export const PAPER_HEADING_RU = "БОТЫ PAPER";
export const LIVE_MODE_HINT_RU = "Результаты роботов на реальных счетах. Эта страница не управляет торговлей";
export const PAPER_MODE_HINT_RU = "Бумажная торговля. Сделки не исполняются на реальном счёте";
export const PORTAL_TITLE_RU = "Портфель стратегий";
export const PORTAL_KICKER_RU = "Результаты торговых роботов";

const LATEST_KEYS = new Set([
  "schema_version",
  "mode",
  "snapshot_id",
  "generated_at",
  "accounts",
]);
const ACCOUNT_KEYS = new Set([
  "bot_id",
  "account_id",
  "title",
  "currency",
  "venue",
  "updated_utc",
  "equity",
  "valuation_basis",
]);
const HISTORY_KEYS = new Set([
  "schema_version",
  "mode",
  "snapshot_id",
  "generated_at",
  "series",
]);
const SERIES_KEYS = new Set(["currency", "points"]);
const POINT_KEYS = new Set(["t", "equity"]);
const VALUATION = new Set(["broker_mark_to_market", "unknown"]);

const ISO_Z_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function extraKeys(obj, allowed) {
  return Object.keys(obj).filter((k) => !allowed.has(k));
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function calendarUtcValid(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidUtcIsoZ(value) {
  if (typeof value !== "string") return false;
  const m = value.match(ISO_Z_RE);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const se = Number(m[6]);
  if (h > 23 || mi > 59 || se > 59) return false;
  return calendarUtcValid(y, mo, d);
}

export function isValidDateOnly(value) {
  if (typeof value !== "string") return false;
  const m = value.match(DATE_ONLY_RE);
  if (!m) return false;
  return calendarUtcValid(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function isValidLivePointTime(value) {
  return isValidDateOnly(value) || isValidUtcIsoZ(value);
}

export function livePointMs(t) {
  if (isValidDateOnly(t)) return Date.parse(`${t}T00:00:00Z`);
  if (isValidUtcIsoZ(t)) return Date.parse(t);
  return NaN;
}

function fail(reason, extra = {}) {
  return { ok: false, reason, ...extra };
}

function rejectUnknown(obj, allowed, reason) {
  const extra = extraKeys(obj, allowed);
  if (extra.length) return fail(reason, { fields: extra });
  return null;
}

export function validateLiveLatest(raw, catalog = LIVE_CATALOG) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("latest_not_object");
  }
  const unknown = rejectUnknown(raw, LATEST_KEYS, "latest_unknown_field");
  if (unknown) return unknown;
  if (raw.schema_version !== LIVE_SCHEMA_LATEST) return fail("latest_schema");
  if (raw.mode !== LIVE_MODE) return fail("latest_mode");
  if (typeof raw.snapshot_id !== "string" || raw.snapshot_id.trim() === "") {
    return fail("latest_snapshot_id");
  }
  if (!isValidUtcIsoZ(raw.generated_at)) return fail("latest_generated_at");
  if (!Array.isArray(raw.accounts)) return fail("accounts_not_array");

  const indexed = indexLiveCatalog(catalog);
  if (!indexed.ok) return fail(indexed.reason);
  const seen = new Set();
  const accounts = [];

  for (let i = 0; i < raw.accounts.length; i += 1) {
    const a = raw.accounts[i];
    if (!isPlainObject(a)) return fail("account_not_object", { index: i });
    const extra = rejectUnknown(a, ACCOUNT_KEYS, "account_unknown_field");
    if (extra) return { ...extra, index: i };
    if (typeof a.bot_id !== "string" || typeof a.account_id !== "string") {
      return fail("account_ids", { index: i });
    }
    const item = findLiveCatalogItem(a.bot_id, a.account_id, catalog);
    if (!item) return fail("account_not_in_catalog", { index: i });
    if (typeof a.title !== "string" || a.title.trim() === "") return fail("account_title", { index: i });
    if (typeof a.currency !== "string" || a.currency !== item.currency) {
      return fail("account_currency", { index: i });
    }
    if (a.venue != null && typeof a.venue !== "string") return fail("account_venue", { index: i });
    if (a.updated_utc != null && !isValidUtcIsoZ(a.updated_utc)) {
      return fail("account_updated_utc", { index: i });
    }
    if (a.equity != null) {
      if (typeof a.equity !== "number" || !Number.isFinite(a.equity)) {
        return fail("account_equity", { index: i });
      }
    }
    if (!VALUATION.has(a.valuation_basis)) return fail("account_valuation_basis", { index: i });
    const key = liveSeriesKey(a.bot_id, a.account_id);
    if (seen.has(key)) return fail("account_duplicate", { index: i });
    seen.add(key);
    accounts.push({
      bot_id: a.bot_id,
      account_id: a.account_id,
      title: a.title,
      accountLabel: item.accountLabel,
      currency: a.currency,
      venue: a.venue,
      updated_utc: a.updated_utc ?? null,
      equity: a.equity ?? null,
      valuation_basis: a.valuation_basis,
    });
  }

  return {
    ok: true,
    value: {
      schema_version: raw.schema_version,
      mode: raw.mode,
      snapshot_id: raw.snapshot_id,
      generated_at: raw.generated_at,
      accounts,
    },
  };
}

function normalizeSeriesPoints(points, generatedAt) {
  if (!Array.isArray(points)) return fail("series_points");
  const snapMs = Date.parse(generatedAt);
  const snapDay = new Date(snapMs).toISOString().slice(0, 10);
  const kept = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (!isPlainObject(p)) return fail("point_not_object", { index: i });
    const extra = rejectUnknown(p, POINT_KEYS, "point_unknown_field");
    if (extra) return extra;
    if (!isValidLivePointTime(p.t)) return fail("point_time", { index: i });
    if (typeof p.equity !== "number" || !Number.isFinite(p.equity)) {
      return fail("point_equity", { index: i });
    }
    if (isValidDateOnly(p.t)) {
      if (p.t > snapDay) return fail("point_after_snapshot", { index: i });
    } else {
      const ms = livePointMs(p.t);
      if (ms - snapMs > LIVE_POINT_AHEAD_MS) return fail("point_after_snapshot", { index: i });
    }
    kept.push({ t: p.t, equity: p.equity, _i: i, _ms: livePointMs(p.t) });
  }
  kept.sort((a, b) => a._ms - b._ms || a._i - b._i);
  const dedup = [];
  for (const row of kept) {
    if (dedup.length && dedup[dedup.length - 1]._ms === row._ms) {
      dedup[dedup.length - 1] = row;
    } else {
      dedup.push(row);
    }
  }
  return {
    ok: true,
    value: dedup.map(({ t, equity }) => ({ t, equity })),
  };
}

export function validateLiveHistory(raw, catalog = LIVE_CATALOG, latestAccounts = null) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("history_not_object");
  }
  const unknown = rejectUnknown(raw, HISTORY_KEYS, "history_unknown_field");
  if (unknown) return unknown;
  if (raw.schema_version !== LIVE_SCHEMA_HISTORY) return fail("history_schema");
  if (raw.mode !== LIVE_MODE) return fail("history_mode");
  if (typeof raw.snapshot_id !== "string" || raw.snapshot_id.trim() === "") {
    return fail("history_snapshot_id");
  }
  if (!isValidUtcIsoZ(raw.generated_at)) return fail("history_generated_at");
  if (!isPlainObject(raw.series)) return fail("history_series");

  const indexed = indexLiveCatalog(catalog);
  if (!indexed.ok) return fail(indexed.reason);
  const allowedKeys = latestAccounts
    ? new Set(latestAccounts.map((a) => liveSeriesKey(a.bot_id, a.account_id)))
    : indexed.byKey;

  const series = {};
  for (const [key, row] of Object.entries(raw.series)) {
    const item = indexed.byKey.get(key);
    if (!item) return fail("series_foreign_key", { key });
    if (latestAccounts && !allowedKeys.has(key)) return fail("series_foreign_key", { key });
    if (!isPlainObject(row)) return fail("series_row", { key });
    const extra = rejectUnknown(row, SERIES_KEYS, "series_unknown_field");
    if (extra) return { ...extra, key };
    if (row.currency !== item.currency) return fail("series_currency", { key });
    const points = normalizeSeriesPoints(row.points, raw.generated_at);
    if (!points.ok) return { ...points, key };
    series[key] = { currency: row.currency, points: points.value };
  }

  return {
    ok: true,
    value: {
      schema_version: raw.schema_version,
      mode: raw.mode,
      snapshot_id: raw.snapshot_id,
      generated_at: raw.generated_at,
      series,
    },
  };
}

export function assembleLivePair(latestRaw, historyRaw, catalog = LIVE_CATALOG) {
  const latest = validateLiveLatest(latestRaw, catalog);
  if (!latest.ok) return latest;
  const history = validateLiveHistory(historyRaw, catalog, latest.value.accounts);
  if (!history.ok) return history;
  if (
    latest.value.snapshot_id !== history.value.snapshot_id ||
    latest.value.generated_at !== history.value.generated_at
  ) {
    return fail("snapshot_mismatch");
  }
  return { ok: true, latest: latest.value, history: history.value };
}

export function isLiveSnapshotStale(generatedAt, nowMs = Date.now()) {
  const ms = Date.parse(generatedAt);
  if (!Number.isFinite(ms)) return false;
  return nowMs - ms > LIVE_STALE_AFTER_MS;
}

export function isLiveSnapshotInFuture(generatedAt, nowMs = Date.now()) {
  const ms = Date.parse(generatedAt);
  if (!Number.isFinite(ms)) return true;
  return ms - nowMs > LIVE_FUTURE_SLACK_MS;
}

/** YYYY-MM-DD как отчётная дата, без сдвига часового пояса. */
export function formatLiveReportDate(value) {
  if (!isValidDateOnly(value)) return "";
  const [y, mo, d] = value.split("-");
  return `${d}.${mo}.${y}`;
}

export function formatLiveDateTime(iso, nowMs) {
  if (isValidDateOnly(iso)) return `${formatLiveReportDate(iso)} · отчётная дата`;
  if (!isValidUtcIsoZ(iso)) return "";
  try {
    const txt = new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: LIVE_TZ,
    }).format(new Date(iso));
    return `${txt} · ${LIVE_TZ_LABEL}`;
  } catch {
    return `${iso} · ${LIVE_TZ_LABEL}`;
  }
}

export function liveSourceLine(generatedAt, sourceHost = "") {
  const when = generatedAt ? formatLiveDateTime(generatedAt) : "";
  const host = sourceHost ? ` (${sourceHost})` : "";
  const stamp = when ? `, снимок ${when}` : "";
  return `Источник: ${LIVE_SOURCE_NAME}${host}${stamp}. HTTP-успех не подтверждает актуальность и не означает, что робот сейчас торгует.`;
}

export function liveKrasnoyarskDay(iso) {
  if (!isValidUtcIsoZ(iso) && !isValidDateOnly(iso)) return "";
  if (isValidDateOnly(iso)) return iso;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: LIVE_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
