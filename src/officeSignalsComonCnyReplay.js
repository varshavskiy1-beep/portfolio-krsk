/**
 * Исторический replay office_signals_comon_cny.
 * Источник: WORK PR633 docs-tip 514b915b, journals replay_roll0 на коде 08d3ca6.
 * Не latest.json / history.json / backtests.json. Не клеим к форварду кабинета.
 * Метрики KPI — из verified replay (NOTE 2026-11-24); кабинет их не пересчитывает.
 */

export const OFFICE_SIGNALS_REPLAY_COLUMNS = [
  "date",
  "regime",
  "equity",
  "cash",
  "stocks",
  "park",
  "mxi_qty",
  "cr_qty",
  "trades",
  "pnl_stocks_mxi",
  "pnl_cny",
  "pnl_park",
  "pnl_fees",
  "pnl_interest",
  "pnl_dividends",
];

export const OFFICE_SIGNALS_REPLAY_ASSET_DIR = "src/data/office_signals_comon_cny_replay";

export const OFFICE_SIGNALS_REPLAY_CSV_FILES = {
  W1: `${OFFICE_SIGNALS_REPLAY_ASSET_DIR}/W1_journal.csv`,
  W2: `${OFFICE_SIGNALS_REPLAY_ASSET_DIR}/W2_journal.csv`,
};

export const OFFICE_SIGNALS_REPLAY_SOURCE = {
  engineSha: "08d3ca60cfab4cd4e7064be1c542e6fcfabcf638",
  engineShort: "08d3ca6",
  docsSha: "514b915b5e98355f062442ac06ace1a75ee3a898",
  frozenSha: "912be97baf85b1bfef6d770bbf307800c870c10d",
  rollDays: 0,
  baseCapital: 1_000_000,
  currency: "RUB",
  comonFeePct: 0,
  ndfl: false,
  forwardStart: "2026-11-24",
  replayEnd: "2026-10-30",
  forwardGapCalendarDays: 25,
};

export const OFFICE_SIGNALS_REPLAY_HEADING = "Исторический replay (не форвард)";

export const OFFICE_SIGNALS_REPLAY_ENGINE_LABEL =
  "Исторический replay движка 08d3ca6 — не форвардные сделки кабинета";

export const OFFICE_SIGNALS_REPLAY_FORMULA_NOTE =
  "Формулы источника (replay.py): CAGR = (E_end / E_0)^(365.25 / cal_days) − 1; MaxDD = min(E_t / peak_t − 1); LongDD — макс. число торговых дней от пика до восстановления; MAR = CAGR / |MaxDD|; ИТА = trades / days. Цифры ниже — из verified replay 08d3ca6, в кабинете не пересчитывались.";

export const OFFICE_SIGNALS_REPLAY_ROLL_NOTE =
  "Эталон карточки — replay --cny-roll-days 0. С живым роллом за 1 торговый день (--cny-roll-days 1), как на сервере: W1 CAGR +64,00% / MaxDD −9,48%; W2 CAGR +49,09% / MaxDD −17,78%.";

export const OFFICE_SIGNALS_REPLAY_ACCOUNTING_NOTE =
  "Учёт: equity = cash + stocks + park после вариационной маржи; номинал MXI/CR к equity повторно не прибавляется. Издержки в одну сторону: акции 10 б.п., MXI 2 б.п., CR 2,31 б.п., парковка 2 б.п.; дисконт FMMM 15%, овердрафт RUSFAR + 4%, свободный положительный кэш 0%. Первый день уже содержит комиссии — точку 1 000 000 ₽ не подставляем.";

export const OFFICE_SIGNALS_REPLAY_ROLL1_REF = {
  W1: { finalRub: 7781105.81, cagrPct: 64.0, maxDdPct: -9.48 },
  W2: { finalRub: 18013010.68, cagrPct: 49.09, maxDdPct: -17.78 },
};

export const DEFAULT_OFFICE_SIGNALS_REPLAY_WINDOW = "W1";

/** Sourced verified metrics. Do not recompute in the cabinet. */
export const OFFICE_SIGNALS_REPLAY_WINDOWS = {
  W1: {
    id: "W1",
    file: "W1_journal.csv",
    label: "W1",
    switchLabel: "W1 · реальный CR",
    start: "2022-09-06",
    end: "2026-10-30",
    rows: 1058,
    calendarDays: 1515,
    crInstrument: "CR",
    siProxy: false,
    caption:
      "Исторический replay бумажного движка 08d3ca6 (реальный CR, 06.09.2022–30.10.2026, 1 000 000 ₽, Comon 0%, без НДФЛ). Не является форвардными бумажными сделками кабинета; форвардная бумага запущена 24.11.2026.",
    sourced: {
      finalRub: 8171643.66,
      finalRubDisplay: "8 171 644",
      cagrPct: 65.95,
      maxDdPct: -9.46,
      maxDdPeak: "2023-04-11",
      maxDdTrough: "2023-05-16",
      maxDdRecover: "2023-06-15",
      longDdTrading: 77,
      longDdCalendar: 111,
      longDdFrom: "2026-01-28",
      longDdTo: "2026-05-19",
      mar: 6.97,
      sharpe: 2.88,
      losingYears: 0,
      ita: 0.405,
      trades: 429,
    },
    crShortDays: 403,
    crLongDays: 189,
    first3: [
      { date: "2022-09-06", equity: 999824.04 },
      { date: "2022-09-07", equity: 1003295.05 },
      { date: "2022-09-08", equity: 1005503.9 },
    ],
    last3: [
      { date: "2026-10-28", equity: 8253747.45 },
      { date: "2026-10-29", equity: 8072739.25 },
      { date: "2026-10-30", equity: 8171643.66 },
    ],
  },
  W2: {
    id: "W2",
    file: "W2_journal.csv",
    label: "W2",
    switchLabel: "W2 · Si → CR",
    start: "2019-07-31",
    end: "2026-10-30",
    rows: 1823,
    calendarDays: 2648,
    crInstrument: "Si→CR",
    siProxy: true,
    siProxyUntil: "2022-09-05",
    caption:
      "Исторический replay бумажного движка 08d3ca6 (реальный CR, 06.09.2022–30.10.2026, 1 000 000 ₽, Comon 0%, без НДФЛ). Не является форвардными бумажными сделками кабинета; форвардная бумага запущена 24.11.2026. Расширенное стресс-окно 31.07.2019–30.10.2026: до 05.09.2022 вместо CR использован прокси-фьючерс Si.",
    sourced: {
      finalRub: 19092191.21,
      finalRubDisplay: "19 092 191",
      cagrPct: 50.29,
      maxDdPct: -17.71,
      maxDdPeak: "2022-01-26",
      maxDdTrough: "2022-02-24",
      maxDdRecover: "2022-05-04",
      longDdTrading: 151,
      longDdCalendar: 213,
      longDdFrom: "2021-01-26",
      longDdTo: "2021-08-27",
      mar: 2.84,
      sharpe: 2.15,
      losingYears: 0,
      ita: 0.538,
      trades: 980,
    },
    first3: [
      { date: "2019-07-31", equity: 995652.26 },
      { date: "2019-08-01", equity: 992971.66 },
      { date: "2019-08-02", equity: 980475.66 },
    ],
    last3: [
      { date: "2026-10-28", equity: 19284068.42 },
      { date: "2026-10-29", equity: 18861090.42 },
      { date: "2026-10-30", equity: 19092191.21 },
    ],
  },
};

export function officeSignalsReplayWindowId(id) {
  return OFFICE_SIGNALS_REPLAY_WINDOWS[id] ? id : DEFAULT_OFFICE_SIGNALS_REPLAY_WINDOW;
}

export function officeSignalsReplayCaption(id) {
  return OFFICE_SIGNALS_REPLAY_WINDOWS[officeSignalsReplayWindowId(id)].caption;
}

function parseNumber(raw, field, date) {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`journal ${date || "?"}: bad ${field}`);
  }
  return n;
}

export function parseOfficeSignalsReplayJournal(csvText) {
  const lines = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  if (lines.length < 2) throw new Error("empty replay journal");
  const header = lines[0].split(",");
  if (header.join(",") !== OFFICE_SIGNALS_REPLAY_COLUMNS.join(",")) {
    throw new Error("unexpected replay journal schema");
  }
  const rows = [];
  const seen = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    if (parts.length !== OFFICE_SIGNALS_REPLAY_COLUMNS.length) {
      throw new Error(`replay journal row ${i}: expected 15 columns`);
    }
    const rec = {};
    OFFICE_SIGNALS_REPLAY_COLUMNS.forEach((key, idx) => {
      rec[key] = parts[idx];
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) {
      throw new Error(`replay journal row ${i}: bad date`);
    }
    if (seen.has(rec.date)) throw new Error(`duplicate replay date ${rec.date}`);
    seen.add(rec.date);
    rec.equity = parseNumber(rec.equity, "equity", rec.date);
    rec.cash = parseNumber(rec.cash, "cash", rec.date);
    rec.stocks = parseNumber(rec.stocks, "stocks", rec.date);
    rec.park = parseNumber(rec.park, "park", rec.date);
    rec.mxi_qty = parseNumber(rec.mxi_qty, "mxi_qty", rec.date);
    rec.cr_qty = parseNumber(rec.cr_qty, "cr_qty", rec.date);
    rec.trades = parseNumber(rec.trades, "trades", rec.date);
    rec.pnl_stocks_mxi = parseNumber(rec.pnl_stocks_mxi, "pnl_stocks_mxi", rec.date);
    rec.pnl_cny = parseNumber(rec.pnl_cny, "pnl_cny", rec.date);
    rec.pnl_park = parseNumber(rec.pnl_park, "pnl_park", rec.date);
    rec.pnl_fees = parseNumber(rec.pnl_fees, "pnl_fees", rec.date);
    rec.pnl_interest = parseNumber(rec.pnl_interest, "pnl_interest", rec.date);
    rec.pnl_dividends = parseNumber(rec.pnl_dividends, "pnl_dividends", rec.date);
    if (rows.length && rec.date <= rows[rows.length - 1].date) {
      throw new Error(`replay journal not chronological at ${rec.date}`);
    }
    rows.push(rec);
  }
  return rows;
}

export function replayEquityPoints(rows) {
  return (rows || []).map((row) => ({ t: row.date, equity: row.equity }));
}

export function replayAccountingDiffs(rows) {
  let maxNav = 0;
  let maxPnl = 0;
  const capital = OFFICE_SIGNALS_REPLAY_SOURCE.baseCapital;
  for (const row of rows || []) {
    maxNav = Math.max(maxNav, Math.abs(row.equity - (row.cash + row.stocks + row.park)));
    const pnlSum =
      capital + row.pnl_stocks_mxi + row.pnl_cny + row.pnl_park + row.pnl_fees + row.pnl_interest;
    maxPnl = Math.max(maxPnl, Math.abs(row.equity - pnlSum));
  }
  return { maxNav, maxPnl };
}

export function replayCrSideDays(rows) {
  let short = 0;
  let long = 0;
  let flat = 0;
  for (const row of rows || []) {
    if (row.cr_qty < 0) short += 1;
    else if (row.cr_qty > 0) long += 1;
    else flat += 1;
  }
  return { short, long, flat };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function verifyOfficeSignalsReplayJournal(rows, windowId) {
  const spec = OFFICE_SIGNALS_REPLAY_WINDOWS[windowId];
  const errors = [];
  if (!spec) {
    errors.push(`unknown window ${windowId}`);
    return errors;
  }
  if (!Array.isArray(rows)) {
    errors.push("rows missing");
    return errors;
  }
  if (rows.length !== spec.rows) errors.push(`rows ${rows.length} != ${spec.rows}`);
  if (rows[0]?.date !== spec.start) errors.push(`start ${rows[0]?.date} != ${spec.start}`);
  if (rows.at(-1)?.date !== spec.end) errors.push(`end ${rows.at(-1)?.date} != ${spec.end}`);
  spec.first3.forEach((pt, i) => {
    if (rows[i]?.date !== pt.date || round2(rows[i]?.equity) !== pt.equity) {
      errors.push(`first3[${i}] mismatch`);
    }
  });
  spec.last3.forEach((pt, i) => {
    const row = rows[rows.length - spec.last3.length + i];
    if (row?.date !== pt.date || round2(row?.equity) !== pt.equity) {
      errors.push(`last3[${i}] mismatch`);
    }
  });
  if (rows[0] && rows[0].equity === OFFICE_SIGNALS_REPLAY_SOURCE.baseCapital) {
    errors.push("fabricated 1 000 000 start point");
  }
  const acc = replayAccountingDiffs(rows);
  if (acc.maxNav > 1e-6) errors.push(`nav identity ${acc.maxNav}`);
  if (acc.maxPnl > 1e-6) errors.push(`pnl identity ${acc.maxPnl}`);
  if (spec.crShortDays != null) {
    const sides = replayCrSideDays(rows);
    if (sides.short !== spec.crShortDays) errors.push(`cr short days ${sides.short}`);
    if (sides.long !== spec.crLongDays) errors.push(`cr long days ${sides.long}`);
  }
  return errors;
}

export function officeSignalsReplayKpis(id) {
  const spec = OFFICE_SIGNALS_REPLAY_WINDOWS[officeSignalsReplayWindowId(id)];
  const m = spec.sourced;
  return [
    { name: "Итог", value: `${m.finalRubDisplay} ₽`, meaning: "капитал на 30.10.2026, Comon 0%, без НДФЛ" },
    { name: "CAGR", value: `+${String(m.cagrPct).replace(".", ",")}%`, meaning: "годовых, формула replay.py" },
    { name: "MaxDD", value: `−${String(Math.abs(m.maxDdPct)).replace(".", ",")}%`, meaning: `${m.maxDdPeak} → ${m.maxDdTrough} → ${m.maxDdRecover}` },
    {
      name: "LongDD",
      value: `${m.longDdTrading} торг. / ${m.longDdCalendar} кал.`,
      meaning: `${m.longDdFrom} .. ${m.longDdTo}`,
    },
    { name: "MAR", value: String(m.mar).replace(".", ","), meaning: "CAGR / |MaxDD|" },
    { name: "Sharpe", value: String(m.sharpe).replace(".", ","), meaning: "из verified replay" },
    { name: "Убыт. лет", value: String(m.losingYears), meaning: "календарные годы от 1 000 000 ₽" },
    { name: "ИТА", value: String(m.ita).replace(".", ","), meaning: `${m.trades} сделок / ${spec.rows} дн.` },
  ];
}
