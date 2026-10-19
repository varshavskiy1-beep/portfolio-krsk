/**
 * Склейка дневного бэктеста с бумажным треком и помесячные ряды.
 * Бумажная кривая кабинета не называется бэктестом.
 * Скачок на стыке не допускается: бумага продолжается с уровня бэктеста.
 */

import { filterResetPoints, seriesKey as resetSeriesKey } from "./historyReset.js";

export const GAP_DAYS = 7;
export const EMA_SPAN = 100;
export const YOY_MONTHS = 12;
export const SMA_YEARS = 3;
export const SMA_MONTHS = SMA_YEARS * 12;

function parseTime(t) {
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

export function dayKey(t) {
  const ms = parseTime(t);
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function monthKey(day) {
  return String(day).slice(0, 7);
}

function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/** Последняя точка каждых суток UTC. Ноль — это −100%, его не выбрасываем. */
export function collapseDays(points) {
  const rows = [];
  for (const p of points || []) {
    const day = dayKey(p?.t ?? p?.time ?? p?.day);
    const eq = Number(p?.equity ?? p?.eq);
    const ms = parseTime(p?.t ?? p?.time ?? `${day}T00:00:00Z`);
    if (!day || ms == null || !Number.isFinite(eq)) continue;
    rows.push({ day, eq, ms });
  }
  rows.sort((a, b) => a.ms - b.ms || a.day.localeCompare(b.day));
  const out = [];
  for (const row of rows) {
    if (out.length && out[out.length - 1].day === row.day) out[out.length - 1] = row;
    else out.push(row);
  }
  return out.map(({ day, eq }) => ({ day, eq }));
}

function monthIndex(key) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return null;
  return y * 12 + (m - 1);
}

/** EMA по дневной эквити. Первые span−1 дней без значения, дальше классическая EMA. */
export function emaSeries(values, span = EMA_SPAN) {
  const out = new Array(values.length).fill(null);
  if (!Number.isInteger(span) || span < 2 || values.length < span) return out;
  let sum = 0;
  for (let i = 0; i < span; i += 1) sum += values[i];
  let prev = sum / span;
  out[span - 1] = prev;
  const k = 2 / (span + 1);
  for (let i = span; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function toMonthly(daily) {
  const last = new Map();
  for (const row of daily) last.set(monthKey(row.day), row);
  return [...last.keys()]
    .sort()
    .map((key) => {
      const row = last.get(key);
      return {
        month: key,
        day: row.day,
        equity: row.eq,
        ema100: row.ema100,
        segment: row.segment,
      };
    });
}

function yoyAndSma(monthly) {
  const byMonth = new Map(monthly.map((row) => [row.month, row]));
  const yoy = [];
  for (const row of monthly) {
    const idx = monthIndex(row.month);
    if (idx == null) continue;
    const prevKey = indexToMonth(idx - YOY_MONTHS);
    const prev = byMonth.get(prevKey);
    if (!prev || prev.equity <= 0) continue;
    yoy.push({
      month: row.month,
      day: row.day,
      yoy: row.equity / prev.equity - 1,
    });
  }
  const sma = new Array(yoy.length).fill(null);
  for (let i = 0; i < yoy.length; i += 1) {
    if (i + 1 < SMA_MONTHS) continue;
    let ok = true;
    for (let j = i - SMA_MONTHS + 1; j < i; j += 1) {
      const a = monthIndex(yoy[j].month);
      const b = monthIndex(yoy[j + 1].month);
      if (a == null || b == null || b - a !== 1) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let sum = 0;
    for (let j = i - SMA_MONTHS + 1; j <= i; j += 1) sum += yoy[j].yoy;
    sma[i] = sum / SMA_MONTHS;
  }
  return yoy.map((row, i) => ({ ...row, sma36: sma[i] }));
}

function indexToMonth(index) {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * @returns {{ok:true, joinDay:string, daily:object[], monthly:object[], yoy:object[]}
 *   | {ok:false, reason:string, joinDay?:string, paperStart?:string, backtestEnd?:string}}
 */
export function stitchEquity(backtestPoints, paperPoints) {
  const backtest = collapseDays(backtestPoints);
  const paper = collapseDays(paperPoints);
  if (paper.length < 1) return { ok: false, reason: "no_paper" };
  if (backtest.length < 2) return { ok: false, reason: "no_backtest" };
  if (backtest.some((row) => row.eq < 0) || paper.some((row) => row.eq < 0)) {
    return { ok: false, reason: "negative_equity" };
  }
  const paperStart = paper[0].day;
  const paper0 = paper[0].eq;
  let join = null;
  for (const row of backtest) {
    if (row.day <= paperStart) join = row;
  }
  if (!join) {
    return {
      ok: false,
      reason: "backtest_after_paper",
      paperStart,
      backtestEnd: backtest[backtest.length - 1].day,
    };
  }
  const gap = daysBetween(join.day, paperStart);
  if (gap > GAP_DAYS) {
    return {
      ok: false,
      reason: "gap",
      joinDay: join.day,
      paperStart,
      backtestEnd: join.day,
    };
  }
  const head = backtest.filter((row) => row.day < paperStart).map((row) => ({
    day: row.day,
    eq: row.eq,
    segment: "backtest",
  }));
  const tail = paper.map((row) => ({
    day: row.day,
    eq: paper0 > 0 ? (join.eq * row.eq) / paper0 : row.eq,
    segment: "paper",
  }));
  const dailyRaw = [...head, ...tail];
  const emas = emaSeries(dailyRaw.map((row) => row.eq), EMA_SPAN);
  const daily = dailyRaw.map((row, i) => ({ ...row, ema100: emas[i] }));
  const monthly = toMonthly(daily);
  const yoy = yoyAndSma(monthly);
  return { ok: true, joinDay: join.day, paperStart, daily, monthly, yoy };
}

export function seriesKey(account) {
  return resetSeriesKey(account) || `${account?.bot_id}::${account?.account_id}`;
}

/**
 * Для склейки берём накопленный history.json (после reset_from), иначе точки карточки.
 * Иначе у Юань 360 короткий account.history даёт дыру > 7 дней.
 */
export function stitchPaperPoints(account, cardPoints, history) {
  const key = seriesKey(account);
  const histPts = history?.series?.[key]?.points;
  const raw = Array.isArray(histPts) && histPts.length ? histPts : cardPoints || [];
  return filterResetPoints(key, raw);
}

export const MAYAK_BACKTEST_LINE =
  "С 2023-10-02 стратегия не держала акций: график показывает доходность денежного фонда LQDT. Раньше 2023-10-02 честного бэктеста нет — нет архива отчётности с датами публикации.";

export const MAYAK_SOURCE_LINE =
  "Источник ряда: пересчёт тестировщика 19.10.2026 по коду бота (коммит 0011df9), с 02.10.2023 весь счёт в паях LQDT.";

export const MAYAK_KEYS = [
  "mayak_imoex_lowvol10::mayak_imoex_lowvol10",
  "mayak_imoex_mom10::mayak_imoex_mom10",
  "mayak_imoex_mom10_lev15::mayak_imoex_mom10_lev15",
  "mayak_imoex_mom10_lev2::mayak_imoex_mom10_lev2",
];

export const EXTRA_HONESTY_BY_KEY = {
  "three_robots_okx_nasdaq_1h::paper_block2":
    "Издержки не совпадают: в бэктесте 3 б.п. на сделку без funding, бумажная книга не списывает ни комиссию, ни funding.",
  "eth_okx_moex::eth_okx_moex":
    "В бэктесте не учтены целые контракты, ГО и дисконт LQDT.",
  "v6b1::v6b1":
    "Бэктест пересчитан честно: вход только после закрытия дневной свечи. Бумажный бот входит и по незакрытой свече и торгует только топ-60 монет по объёму, поэтому результаты могут расходиться.",
  "who_pays::paper_crypto_perp":
    "Бэктест короткий: 32 дня с 19.08.2026 — раньше у OKX нет публичных данных по фандингу и открытому интересу. Две сделки, обе лонг BTC. Проверки вне выборки не было.",
  ...Object.fromEntries(MAYAK_KEYS.map((key) => [key, MAYAK_BACKTEST_LINE])),
};

export const WHO_PAYS_NO_TAPE_KEYS = [
  "who_pays::paper_us_eq",
  "who_pays::paper_ru_eq",
  "who_pays::paper_forts",
  "who_pays::paper_crypto_spot",
];

export const NO_TAPE_BACKTEST_LINE =
  "Бэктеста нет: сигналы считаются по ленте сделок и стакану, а публичного архива этих данных нет.";

export function noTapeHonestyLine(account) {
  return WHO_PAYS_NO_TAPE_KEYS.includes(seriesKey(account)) ? NO_TAPE_BACKTEST_LINE : "";
}

export function extraHonestyLine(account) {
  return EXTRA_HONESTY_BY_KEY[seriesKey(account)] || "";
}

/** Карточка: путь, sha и англ. жаргон остаются в MANIFEST, не здесь. */
export const SOURCE_RU_BY_KEY = {
  "oac_paper::oac_paper":
    "Источник ряда: пересчёт тестировщика по правилам, зафиксированным заранее (коммит 0bc436a), дневная стоимость счёта с октября 2024.",
  "desyatka_earn_paper::desyatka_earn_paper":
    "Источник ряда: повтор тестировщика по коду бота (коммит 6b6ef27), цены открытия следующего дня, с октября 2024.",
  "three_robots_okx_nasdaq_1h::paper_block2":
    "Источник ряда: пересчёт тестировщика 17.10.2026 по замороженным правилам блока 2 (коммит 8967c62), часовые данные OKX и Yahoo.",
  "cycle_6040_paper::cycle_6040_paper":
    "Источник ряда: повтор тестировщика по реплике робота (коммит bc8e4c1), дневная стоимость с сентября 2016.",
  "rf_conservative_comon::rf_conservative_comon":
    "Источник ряда: эталонный счёт тестировщика на 50 000 ₽ (коммит 67c19d7), паи фондов с сентября 2019.",
  "rf_bonds_rate_cycle::rf_bonds_rate_cycle":
    "Источник ряда: повтор тестировщика по коду бота (коммит a752acc), недельные точки с июня 2019.",
  "eth_okx_moex::eth_okx_moex":
    "Источник ряда: пересчёт тестировщика со сдвигом знака на один час (коммит 8b2d974), как в бумажном роботе.",
  "cny_mom_h360::cny_mom_h360":
    "Источник ряда: пересчёт тестировщика 17.10.2026 по заданию и коду бота (коммит ed93732), часовые свечи Московской биржи без выходных.",
  "v6b1::v6b1":
    "Источник ряда: пересчёт тестировщика 17.10.2026 по коду бота (коммит 95b78e2), дневные свечи OKX с 2020 года. Вход только после закрытия дневной свечи.",
  "who_pays::paper_crypto_perp":
    "Источник ряда: пересчёт тестировщика 17.10.2026 по коду бота (коммит 89e21d7), публичные данные OKX с 19.08.2026.",
  ...Object.fromEntries(MAYAK_KEYS.map((key) => [key, MAYAK_SOURCE_LINE])),
};

export const COSTS_RU_BY_KEY = {
  "oac_paper::oac_paper":
    "Комиссия 5 б.п., проскальзывание 10 б.п. у ликвидных бумаг и 25 б.п. у остальных; фонд коротких казначейских 2 б.п.; сделка по открытию следующего дня.",
  "desyatka_earn_paper::desyatka_earn_paper":
    "Комиссия 5 б.п. и проскальзывание 10 б.п.; сделка по открытию следующего дня; доли бумаг можно дробные.",
  "three_robots_okx_nasdaq_1h::paper_block2":
    "3 б.п. на изменение позиции; фандинг не учтён; исполнение по цене закрытия.",
  "cycle_6040_paper::cycle_6040_paper":
    "Издержки фондов 1,3% и 0,9% годовых, комиссия 0,10% на сделку; исполнение на второй сессии дня.",
  "rf_conservative_comon::rf_conservative_comon":
    "6 б.п., только целые паи фондов.",
  "rf_bonds_rate_cycle::rf_bonds_rate_cycle":
    "12 б.п. на сменяемую долю облигаций, 5 б.п. на смену веса юаня; первая позиция без комиссии",
  "eth_okx_moex::eth_okx_moex":
    "2 б.п. на сторону номинала при плече 0,5; переворот и перекладка — 2 стороны; дробные контракты, без LQDT и ГО",
  "cny_mom_h360::cny_mom_h360":
    "биржа 0,47 + брокер 1 б.п. на сторону, проскальзывание 1 шаг 0,001 ₽; ролл и переворот — 2 стороны; целые контракты; LQDT ~ на весь капитал",
  "v6b1::v6b1":
    "Комиссия 6 б.п. на сторону от номинала; без фандинга и проскальзывания, как в бумажной книге. Риск 1% от свободных денег, не больше двух позиций, номинал не больше 25%.",
  "who_pays::paper_crypto_perp":
    "комиссия 5 б.п. + проскальзывание 3 б.п. на сторону, фандинг по фактической ставке OKX",
};

const CARD_JARGON_RE =
  /fee_bps|PaperLedger|\bqty\b|build_radar_setups|sim_pdh_radar|confirm\s*=\s*1|regression kit|cost_bps_research|too_tight_stop|fill close|B_session|net-cost|\bbps\b|docs\/reports|quant\/|\.csv|\.py|\.json|\.md|blob |sha256|cursor\//i;

export function costsHonestyLine(row, account) {
  const mapped = COSTS_RU_BY_KEY[seriesKey(account)];
  if (mapped) return mapped;
  const costs = row?.costs == null ? "" : String(row.costs).trim();
  return costs;
}

export function backtestSourceDisplay(row, account) {
  const mapped = SOURCE_RU_BY_KEY[seriesKey(account)];
  if (mapped) return mapped;
  const s = row?.source == null ? "" : String(row.source).trim();
  if (!s) return "";
  return `Источник ряда: ${s}. Первичные котировки этим кабинетом не проверялись.`;
}

export function cardLineHasTesterJargon(text) {
  return CARD_JARGON_RE.test(String(text || ""));
}

export function backtestRowFor(backtests, account) {
  const key = seriesKey(account);
  const row = backtests?.series?.[key];
  return row && typeof row === "object" ? row : null;
}

export function backtestPointsFor(backtests, account) {
  const row = backtestRowFor(backtests, account);
  return Array.isArray(row?.points) ? row.points : [];
}

/** Честная пометка типа бэктеста. Неизвестный kind — пустая строка. */
export function kindHonestyLine(kind) {
  if (kind == null || kind === "") return "";
  const k = String(kind);
  if (k === "backtest_full_preregistered") {
    return "Бэктест: правила зафиксированы заранее.";
  }
  if (k === "backtest_is_to_2026-09-08_then_oos") {
    return "Бэктест: на тех же данных, где подбирались правила, до 08.09.2026, дальше вне выборки.";
  }
  if (k === "backtest_causal_gate_reimplementation") {
    return "Бэктест: на тех же данных, где подбирались правила, до 30.06.2026, дальше вне выборки.";
  }
  if (k === "in_sample" || k === "backtest_in_sample" || k.startsWith("backtest_in_sample_")) {
    return "Бэктест: только на тех же данных, где подбирались правила.";
  }
  return "";
}

export function backtestHonestyLines(row, account) {
  const lines = [];
  const kind = kindHonestyLine(row?.kind);
  if (kind) lines.push(kind);
  const costs = costsHonestyLine(row, account);
  if (costs) lines.push(costs);
  const extra = extraHonestyLine(account);
  if (extra) lines.push(extra);
  return lines;
}

export function stitchCaption(result) {
  if (!result || result.ok) return "";
  if (result.reason === "no_backtest") {
    return "Склейки нет: нет дневного бэктеста до старта бумаги.";
  }
  if (result.reason === "no_paper") {
    return "Склейки нет: у бумаги ещё нет точек эквити.";
  }
  if (result.reason === "gap") {
    return `Склейки нет: бэктест кончается ${result.backtestEnd}, бумага начинается ${result.paperStart}. Дыра больше ${GAP_DAYS} дней.`;
  }
  if (result.reason === "backtest_after_paper") {
    return "Склейки нет: бэктест начинается позже бумаги.";
  }
  if (result.reason === "negative_equity") {
    return "Склейки нет: отрицательная стоимость счёта.";
  }
  return "Склейки нет.";
}
