/**
 * Presentation model for the unified StitchedCharts (two panes, one time scale).
 * Does not recompute stitch / EMA100 / YoY / SMA36 — those stay in stitchEquity.js.
 */

const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS_SHORT = [
  "янв.",
  "февр.",
  "март",
  "апр.",
  "мая",
  "июня",
  "июля",
  "авг.",
  "сент.",
  "окт.",
  "нояб.",
  "дек.",
];
const MONTHS_LONG = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const NO_POSITIVE_BASE = "нет данных: нет положительной базы";
export const NO_PREV_MONTH = "нет данных: нет предыдущего календарного месяца";
export const NO_MONTH_PRINT = "нет данных: нет наблюдения в этом месяце";
export const NO_YOY = "нет данных: нет изменения за 12 месяцев";
export const NO_SMA36 = "нет данных: нет средней за 3 года";
export const NO_EMA100 = "нет данных: нет EMA100";
export const YOY_PANE_EMPTY = "Недостаточно данных для изменения за 12 месяцев";
export const LAST_AVAILABLE_MONTH = "Последний доступный месяц";
export const CHANGE_TRACK_LABEL = "Изменение эквити в шкале трека";

/**
 * @param {unknown} month
 * @returns {boolean}
 */
export function isValidMonth(month) {
  if (typeof month !== "string") return false;
  const m = MONTH_RE.exec(month);
  if (!m) return false;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return false;
  const dt = new Date(Date.UTC(year, mo - 1, 1));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === mo - 1;
}

/**
 * @param {unknown} day
 * @returns {boolean}
 */
export function isValidDay(day) {
  if (typeof day !== "string" || !DAY_RE.test(day)) return false;
  const [year, mo, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(year, mo - 1, d));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * @param {string} month YYYY-MM
 * @returns {string} YYYY-MM-01
 */
export function monthToTime(month) {
  return `${month}-01`;
}

/**
 * Library Time → YYYY-MM without a local timezone shift.
 * @param {unknown} time
 * @returns {string|null}
 */
export function timeToMonth(time) {
  if (time == null) return null;
  if (typeof time === "string") {
    if (time.length >= 7 && time[4] === "-") {
      const month = time.slice(0, 7);
      return isValidMonth(month) ? month : null;
    }
    return null;
  }
  if (typeof time === "number") {
    if (!Number.isFinite(time)) return null;
    const ms = time < 1e12 ? time * 1000 : time;
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return null;
    const month = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    return isValidMonth(month) ? month : null;
  }
  if (typeof time === "object") {
    const year = time.year;
    const mo = time.month;
    if (!Number.isInteger(year) || !Number.isInteger(mo)) return null;
    const month = `${year}-${String(mo).padStart(2, "0")}`;
    return isValidMonth(month) ? month : null;
  }
  return null;
}

/**
 * @param {string} month
 * @returns {number|null}
 */
export function monthIndex(month) {
  if (!isValidMonth(month)) return null;
  const [year, mo] = month.split("-").map(Number);
  return year * 12 + (mo - 1);
}

/**
 * @param {number} index
 * @returns {string}
 */
export function indexToMonth(index) {
  const year = Math.floor(index / 12);
  const mo = (index % 12) + 1;
  return `${year}-${String(mo).padStart(2, "0")}`;
}

/**
 * UTC calendar day of generated_at. Null if missing/unparseable.
 * @param {unknown} generatedAt
 * @returns {string|null}
 */
export function asOfDayFromGeneratedAt(generatedAt) {
  if (generatedAt == null || generatedAt === "") return null;
  const ms = Date.parse(String(generatedAt));
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @param {string} month
 * @returns {string}
 */
export function formatMonthLong(month) {
  const [, mo] = month.split("-").map(Number);
  const year = month.slice(0, 4);
  return `${MONTHS_LONG[mo - 1]} ${year}`;
}

/**
 * Crosshair label: «сент. 2026».
 * @param {string} month
 * @returns {string}
 */
export function formatMonthShort(month) {
  const [, mo] = month.split("-").map(Number);
  const year = month.slice(0, 4);
  return `${MONTHS_SHORT[mo - 1]} ${year}`;
}

/**
 * @param {string} day YYYY-MM-DD
 * @returns {string} DD.MM.YYYY
 */
export function formatDayRu(day) {
  const [year, mo, d] = day.split("-");
  return `${d}.${mo}.${year}`;
}

/**
 * Axis ticks. Year → year; Month → short month; else short month+year.
 * Never formats the technical day as 01.09.2026.
 * @param {unknown} time
 * @param {number} tickMarkType
 * @returns {string}
 */
export function formatTickMark(time, tickMarkType) {
  const month = timeToMonth(time);
  if (!month) return "";
  const year = month.slice(0, 4);
  const mo = Number(month.slice(5, 7));
  if (tickMarkType === 0) return year;
  if (tickMarkType === 1) {
    if (mo === 1) return year;
    return MONTHS_SHORT[mo - 1];
  }
  return formatMonthShort(month);
}

/**
 * Crosshair time label.
 * @param {unknown} time
 * @returns {string}
 */
export function formatTimeLabel(time) {
  const month = timeToMonth(time);
  return month ? formatMonthShort(month) : "";
}

function finiteNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fail(reason) {
  return { ok: false, reason };
}

/**
 * @typedef {object} ChartMonthRow
 * @property {string} month
 * @property {string} time
 * @property {string|null} observedDay
 * @property {number|null} equity
 * @property {number|null} ema100
 * @property {number|null} change
 * @property {number|null} mom
 * @property {number|null} yoy
 * @property {number|null} sma36
 * @property {"backtest"|"paper"|null} segment
 * @property {"historical"|"provisional"|"unknown"} periodState
 */

/**
 * @param {{monthly?: unknown, yoy?: unknown, asOfDay?: unknown}} input
 * @returns {{ok:true, rows: ChartMonthRow[], byMonth: Map<string, ChartMonthRow>} | {ok:false, reason:string}}
 */
export function buildStitchedChartModel(input) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return fail("invalid_input");
  }
  const { monthly, yoy, asOfDay } = input;
  if (!Array.isArray(monthly) || !Array.isArray(yoy)) return fail("invalid_input");
  if (asOfDay != null && asOfDay !== "") {
    if (typeof asOfDay !== "string" || !isValidDay(asOfDay)) return fail("invalid_input");
  }
  if (monthly.length === 0) {
    return { ok: true, rows: [], byMonth: new Map() };
  }

  const monthlyByMonth = new Map();
  for (const row of monthly) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return fail("invalid_row");
    if (!isValidMonth(row.month)) return fail("invalid_row");
    if (monthlyByMonth.has(row.month)) return fail("duplicate_month");
    const equity = finiteNumber(row.equity);
    if (equity == null) return fail("invalid_row");
    const observedDay = row.observedDay ?? row.day ?? null;
    if (observedDay != null) {
      if (!isValidDay(observedDay)) return fail("invalid_row");
      if (observedDay.slice(0, 7) !== row.month) return fail("invalid_row");
    }
    const emaRaw = row.ema100;
    const ema100 = emaRaw == null || emaRaw === "" ? null : finiteNumber(emaRaw);
    if (emaRaw != null && emaRaw !== "" && ema100 == null) return fail("invalid_row");
    const segment = row.segment == null || row.segment === "" ? null : row.segment;
    if (segment != null && segment !== "backtest" && segment !== "paper") return fail("invalid_row");
    monthlyByMonth.set(row.month, { equity, observedDay, ema100, segment });
  }

  const yoyByMonth = new Map();
  for (const row of yoy) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return fail("invalid_row");
    if (!isValidMonth(row.month)) return fail("invalid_row");
    if (yoyByMonth.has(row.month)) return fail("duplicate_month");
    const yoyN = finiteNumber(row.yoy);
    if (yoyN == null) return fail("invalid_row");
    const smaRaw = row.sma36;
    const sma36 = smaRaw == null || smaRaw === "" ? null : finiteNumber(smaRaw);
    if (smaRaw != null && smaRaw !== "" && sma36 == null) return fail("invalid_row");
    yoyByMonth.set(row.month, { yoy: yoyN, sma36 });
  }

  const asOf = asOfDay != null && asOfDay !== "" ? asOfDay : null;
  if (asOf) {
    for (const src of monthlyByMonth.values()) {
      if (src.observedDay && src.observedDay > asOf) return fail("future_observation");
    }
  }

  const months = [...monthlyByMonth.keys()].sort();
  const start = monthIndex(months[0]);
  const end = monthIndex(months[months.length - 1]);
  const asOfMonth = asOf ? asOf.slice(0, 7) : null;
  /** @type {ChartMonthRow[]} */
  const rows = [];
  const byMonth = new Map();

  for (let idx = start; idx <= end; idx += 1) {
    const month = indexToMonth(idx);
    const src = monthlyByMonth.get(month);
    const yoySrc = yoyByMonth.get(month);
    const prev = monthlyByMonth.get(indexToMonth(idx - 1));
    let change = null;
    let mom = null;
    if (src && prev) {
      change = src.equity - prev.equity;
      if (prev.equity > 0) mom = src.equity / prev.equity - 1;
    }
    let periodState = "unknown";
    if (asOfMonth) {
      periodState = month >= asOfMonth ? "provisional" : "historical";
    }
    const row = {
      month,
      time: monthToTime(month),
      observedDay: src?.observedDay ?? null,
      equity: src ? src.equity : null,
      ema100: src ? src.ema100 : null,
      change: src && prev ? change : null,
      mom: src && prev && prev.equity > 0 ? mom : null,
      yoy: yoySrc ? yoySrc.yoy : null,
      sma36: yoySrc ? yoySrc.sma36 : null,
      segment: src ? src.segment : null,
      periodState,
    };
    rows.push(row);
    byMonth.set(month, row);
  }

  return { ok: true, rows, byMonth };
}

/**
 * Map library Time to a row. Undefined / invalid / out of range → null (never the last point).
 * @param {{ok?: boolean, byMonth?: Map<string, ChartMonthRow>}|null|undefined} model
 * @param {unknown} time
 * @returns {ChartMonthRow|null}
 */
export function selectChartMonth(model, time) {
  if (!model?.ok || !model.byMonth) return null;
  const month = timeToMonth(time);
  if (!month) return null;
  return model.byMonth.get(month) ?? null;
}

/**
 * @param {{ok?: boolean, rows?: ChartMonthRow[]}|null|undefined} model
 * @returns {ChartMonthRow|null}
 */
export function lastObservedRow(model) {
  if (!model?.ok || !model.rows?.length) return null;
  for (let i = model.rows.length - 1; i >= 0; i -= 1) {
    if (model.rows[i].equity != null) return model.rows[i];
  }
  return null;
}

/**
 * @param {ChartMonthRow[]} rows
 * @param {"equity"|"ema100"} field
 */
export function lineSeriesData(rows, field) {
  return (rows || []).map((row) => {
    const value = row[field];
    if (value == null || !Number.isFinite(value)) return { time: row.time };
    return { time: row.time, value };
  });
}

/**
 * @param {ChartMonthRow[]} rows
 */
export function paperSeriesData(rows) {
  return (rows || []).map((row) => {
    if (row.segment !== "paper" || row.equity == null || !Number.isFinite(row.equity)) {
      return { time: row.time };
    }
    return { time: row.time, value: row.equity };
  });
}

/**
 * YoY histogram: ratio × 100 once. Gaps are whitespace, not 0.
 * @param {ChartMonthRow[]} rows
 * @param {string} up
 * @param {string} down
 */
export function yoyHistogramData(rows, up, down) {
  return (rows || []).map((row) => {
    if (row.yoy == null || !Number.isFinite(row.yoy)) return { time: row.time };
    return { time: row.time, value: row.yoy * 100, color: row.yoy >= 0 ? up : down };
  });
}

/**
 * @param {ChartMonthRow[]} rows
 */
export function smaSeriesData(rows) {
  return (rows || []).map((row) => {
    if (row.sma36 == null || !Number.isFinite(row.sma36)) return { time: row.time };
    return { time: row.time, value: row.sma36 * 100 };
  });
}

/**
 * @param {number|null|undefined} ratio
 * @returns {string|null}
 */
export function formatPctRu(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  const n = ratio * 100;
  const txt = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${n > 0 ? "+" : ""}${txt}%`;
}

/**
 * @param {number|null|undefined} change
 * @returns {string|null}
 */
export function formatChangeRu(change) {
  if (change == null || !Number.isFinite(change)) return null;
  const txt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(change);
  return change > 0 ? `+${txt}` : txt;
}

/**
 * @param {number|null|undefined} value
 * @returns {string|null}
 */
export function formatEquityRu(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

/**
 * @param {ChartMonthRow} row
 * @returns {string}
 */
export function momMissingReason(row) {
  if (!row || row.equity == null) return NO_MONTH_PRINT;
  const prev = monthIndex(row.month);
  if (prev == null) return NO_PREV_MONTH;
  if (row.change == null && row.mom == null) return NO_PREV_MONTH;
  if (row.mom == null) return NO_POSITIVE_BASE;
  return NO_PREV_MONTH;
}

/**
 * @param {ChartMonthRow} row
 * @returns {string|null}
 */
export function periodCaption(row, asOfDay) {
  if (!row) return null;
  if (row.periodState === "provisional" && asOfDay && isValidDay(asOfDay)) {
    return `С начала месяца по ${formatDayRu(asOfDay)}`;
  }
  if (row.periodState === "historical" && row.observedDay) {
    return `по последнему доступному наблюдению ${formatDayRu(row.observedDay)}`;
  }
  return null;
}

/**
 * @param {string} reason
 * @returns {string}
 */
export function modelFailMessage(reason) {
  if (reason === "duplicate_month") return "Не удалось построить помесячный график: повторяется месяц.";
  if (reason === "future_observation") {
    return "Не удалось построить помесячный график: наблюдение позже даты среза.";
  }
  if (reason === "invalid_row") return "Не удалось построить помесячный график: некорректная строка ряда.";
  return "Не удалось построить помесячный график: некорректные входные данные.";
}

/**
 * База для режима «В %» склейки: первая дневная точка склеенного ряда
 * (начало бэктеста). Не положительная — режим «В %» недоступен (null).
 * @param {{daily?: {eq:number}[]}} result — ответ stitchEquity
 */
export function stitchPctBase(result) {
  const first = result?.daily?.[0]?.eq;
  return Number.isFinite(first) && first > 0 ? first : null;
}

/**
 * Перевод точек верхней панели в % от базы. Пустые точки (дыры) остаются пустыми.
 * @param {{time:any, value?:number}[]} data
 * @param {number|null} base
 */
export function toPctSeriesData(data, base) {
  if (!(Number.isFinite(base) && base > 0)) return data || [];
  return (data || []).map((p) => {
    if (p.value == null || !Number.isFinite(p.value)) return { time: p.time };
    return { ...p, value: (p.value / base - 1) * 100 };
  });
}
