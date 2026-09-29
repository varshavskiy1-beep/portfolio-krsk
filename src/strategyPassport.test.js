import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GLOSSARY,
  NO_DATA,
  TEST_STATUS,
  TEST_STATUS_LABEL,
  authoredPassportIds,
  displayedBotIds,
  getPassport,
  hasAuthoredPassport,
  passportUiStrings,
  validateDisplayedPassports,
  validatePassport,
} from "./strategyPassport.js";
import { GRAIL_PACK } from "./grailPassport.js";
import { PORTAL_SHELLS } from "./strategyMeta.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));

const DISPLAYED = [
  "v6b1",
  "grail_b20_3x",
  "who_pays",
  "forts_adr_adaptive",
  "forts_adr_static",
  "pump_radar",
  "three_robots_okx_nasdaq_1h",
  "young_bounce_combo",
  "oac_paper",
];

test("latest.json accounts + shells match expected dashboard strategies", () => {
  const ids = displayedBotIds(latest.accounts);
  assert.deepEqual(ids, DISPLAYED);
  for (const shell of PORTAL_SHELLS) {
    assert.ok(ids.includes(shell.bot_id), shell.bot_id);
  }
});

test("every displayed strategy has an authored passport", () => {
  for (const botId of displayedBotIds(latest.accounts)) {
    assert.equal(hasAuthoredPassport(botId), true, botId);
  }
  const report = validateDisplayedPassports(latest.accounts);
  for (const row of report) {
    assert.deepEqual(row.errors, [], `${row.botId}: ${row.errors.join("; ")}`);
    assert.equal(row.ok, true, row.botId);
  }
});

test("authored passports cover exactly the displayed set", () => {
  assert.deepEqual(authoredPassportIds().sort(), [...DISPLAYED].sort());
});

test("unknown values are the exact phrase нет данных", () => {
  for (const botId of DISPLAYED) {
    const p = getPassport(botId);
    for (const row of p.parameters) {
      if (!row.known) assert.equal(row.value, NO_DATA, `${botId} / ${row.name}`);
      if (row.value === NO_DATA) assert.equal(row.known, false, `${botId} / ${row.name}`);
    }
  }
});

test("UI copy never contains the word seed", () => {
  for (const botId of DISPLAYED) {
    for (const s of passportUiStrings(botId)) {
      assert.doesNotMatch(s, /\bseed\b/i, `${botId}: ${s}`);
    }
  }
  for (const g of GLOSSARY) {
    assert.doesNotMatch(g.term, /\bseed\b/i);
    assert.doesNotMatch(g.meaning, /\bseed\b/i);
  }
});

test("testing section is needs_data unless a real book pack is present", () => {
  for (const botId of DISPLAYED) {
    const t = getPassport(botId).testing;
    assert.equal(t.walkForward, null);
    assert.equal(t.overlay, null);
    assert.ok(t.missing.length >= 8, botId);
    if (botId === "grail_b20_3x") {
      assert.equal(t.status, TEST_STATUS.HAS_BOOK);
      assert.equal(t.statusLabel, TEST_STATUS_LABEL[TEST_STATUS.HAS_BOOK]);
      assert.ok(t.backtest);
      assert.match(t.disclaimer, /замороженных сигналах/i);
      continue;
    }
    assert.equal(t.status, TEST_STATUS.NEEDS_DATA);
    assert.equal(t.statusLabel, TEST_STATUS_LABEL[TEST_STATUS.NEEDS_DATA]);
    assert.equal(t.backtest, null);
    assert.match(t.disclaimer, /не бэктест и не walk-forward/i);
  }
});

test("unknown bot gets a stub passport, not invented facts", () => {
  const p = getPassport("brand_new_bot");
  assert.equal(p.authored, false);
  assert.equal(p.title, "brand_new_bot");
  assert.ok(p.parameters.every((row) => row.value === NO_DATA || row.known === true));
  const unknown = p.parameters.filter((row) => !row.known);
  assert.ok(unknown.length >= 8);
  assert.equal(p.testing.status, TEST_STATUS.NEEDS_DATA);
  const errors = validatePassport(p);
  assert.deepEqual(errors, []);
});

test("validatePassport rejects invented test blocks and seed in copy", () => {
  const base = getPassport("grail_b20_3x");
  const withWf = {
    ...base,
    testing: { ...base.testing, walkForward: { windows: 3 } },
  };
  assert.ok(validatePassport(withWf).some((e) => /walkForward/.test(e)));

  const withSeed = {
    ...base,
    essence: { paragraphs: ["начальный seed 10000"] },
  };
  assert.ok(validatePassport(withSeed).some((e) => /seed/.test(e)));

  const badUnknown = {
    ...base,
    parameters: [...base.parameters, { name: "X", value: "кажется 2%", meaning: "", known: false }],
  };
  assert.ok(validatePassport(badUnknown).some((e) => /нет данных/.test(e)));
});

test("manifest bot_ids all have passports", () => {
  const fromManifest = (latest.manifest || []).map((m) => m.bot_id);
  for (const botId of fromManifest) {
    assert.equal(hasAuthoredPassport(botId), true, botId);
  }
});

test("known facts stay tied to snapshot or pack, not invented numbers", () => {
  const grail = getPassport("grail_b20_3x");
  assert.match(
    grail.parameters.find((r) => r.name === "Плечо").value,
    /3×/,
  );
  assert.match(
    grail.parameters.find((r) => r.name === "Число позиций").value,
    /одной/,
  );
  assert.equal(grail.parameters.find((r) => r.name === "Инструменты").known, true);
  assert.match(grail.parameters.find((r) => r.name === "Инструменты").value, /DOGE/);
  assert.match(grail.parameters.find((r) => r.name === "Инструменты").value, /MSTR/);
  assert.doesNotMatch(grail.parameters.find((r) => r.name === "Инструменты").value, /\bBTC\b/);

  const oac = getPassport("oac_paper");
  assert.match(oac.parameters.find((r) => r.name === "Размер позиции (базовый)").value, /10%/);
  assert.equal(oac.parameters.find((r) => r.name === "День недели пересборки").known, false);

  const who = getPassport("who_pays");
  assert.equal(who.parameters.find((r) => r.name === "Начальный капитал счетов").known, false);
  assert.match(who.parameters.find((r) => r.name === "Условие допуска сделки").value, /S2–S5/);

  const yb = getPassport("young_bounce_combo");
  assert.match(yb.parameters.find((r) => r.name === "Фильтр имён").value, /25–90/);
  assert.match(yb.parameters.find((r) => r.name === "Выход").value, /10 дней/);
});

test("grail_b20_3x reads the real passport pack and does not invent missing metrics", () => {
  const grail = getPassport("grail_b20_3x");
  const { card, metrics, windows, config, costs, capital } = GRAIL_PACK;
  const book = grail.testing.backtest;
  const kpi = (name) => book.primaryMetrics.find((r) => r.name === name);

  assert.equal(grail.packSource, "passports/grail_b20_3x");
  assert.equal(grail.title, "Grail B20 · плечо 3×");
  assert.equal(grail.testing.status, TEST_STATUS.HAS_BOOK);
  assert.equal(grail.testing.asof, "2026-09-04");
  assert.equal(grail.testing.source, card.source);
  assert.equal(card.cagr_pct, 1029.7);
  assert.equal(card.max_dd_pct, 47.9);
  assert.equal(card.profit_factor, 1.909);
  assert.equal(card.n_trades, 468);
  assert.equal(card.asof, "2026-09-04");
  assert.equal(kpi("Годовая доходность (CAGR)").value, "1\u00a0029,7%");
  assert.equal(kpi("Макс. просадка").value, "47,9%");
  assert.equal(kpi("Коэффициент прибыли").value, "1,909");
  assert.equal(kpi("Доход на единицу просадки (MAR)").value, "21,51");
  assert.equal(kpi("Сделок").value, "468");
  assert.equal(kpi("Дата книги").value, "2026-09-04");
  assert.equal(kpi("Sharpe").value, NO_DATA);
  assert.equal(kpi("Sharpe").known, false);
  assert.equal(kpi("Доля прибыльных").value, NO_DATA);
  assert.equal(kpi("Годовая волатильность").value, NO_DATA);

  const full3 = book.windowsLev3.find((w) => w.id === "full_lev3");
  const h2 = book.windowsLev3.find((w) => w.id === "2024H2_lev3");
  const y25 = book.windowsLev3.find((w) => w.id === "2025_lev3");
  const y26 = book.windowsLev3.find((w) => w.id === "2026YTD_lev3");
  assert.equal(full3.cagr, "1\u00a0029,7%");
  assert.equal(full3.pf, "1,909");
  assert.equal(h2.weak, true);
  assert.equal(h2.pf, "1,074");
  assert.equal(h2.cagr, "26,2%");
  assert.equal(h2.maxDd, "43,1%");
  assert.equal(h2.trades, "113");
  assert.equal(y25.pf, "2,129");
  assert.equal(y26.trades, "126");
  assert.match(book.weakWindowNote, /1,07/);

  const full1 = book.windowsLev1.find((w) => w.id === "full_lev1");
  assert.equal(full1.cagr, "100,2%");
  assert.equal(full1.pf, "1,741");
  assert.equal(full1.trades, "241");

  assert.equal(windows.primary_window, "full_lev3");
  assert.equal(windows.windows.length, metrics.windows.length);
  assert.equal(config.leverage, 3);
  assert.equal(config.margin_buffer_pct, 0.57);
  assert.equal(config.max_sl_distance_pct, 12);
  assert.equal(config.min_rr, 1);
  assert.equal(config.rr_action, "stretch_tp");
  assert.equal(config.td_mode, "cross");
  assert.equal(config.n_symbols, 20);
  assert.equal(config.symbols.length, 20);
  assert.equal(costs.commission_bps, 5);
  assert.equal(costs.slippage_bps, 2);
  assert.equal(capital.initial_capital, 10000);
  assert.equal(metrics.primary.sharpe, null);
  assert.equal(metrics.overlays.capital_tp_pct, 12);
  assert.equal(metrics.overlays.profit_lock_peak_pct, 7.5);
  assert.equal(metrics.overlays.profit_lock_giveback_pct, 25);
  assert.equal(metrics.overlays.camarilla_full_exit_min_profit_pct, 3.75);

  assert.match(grail.parameters.find((r) => r.name === "Буфер капитала").value, /57%/);
  assert.match(grail.parameters.find((r) => r.name === "Макс. стоп").value, /12%/);
  assert.match(grail.parameters.find((r) => r.name === "Комиссия теста").value, /5/);
  assert.match(grail.parameters.find((r) => r.name === "Проскальзывание теста").value, /2/);
  assert.equal(grail.parameters.find((r) => r.name === "Sharpe").known, false);
  assert.match(grail.parameters.find((r) => r.name === "Не торгует").value, /BTC/);
  assert.match(grail.risk.paragraphs.join(" "), /47,9%/);
  assert.match(grail.risk.paragraphs.join(" "), /5×/);
  assert.match(book.cagrDisclaimer, /не гарантирует/);
  assert.match(book.equityNote, /не приложена/);
  assert.match(book.paperNote, /не эта книга/);
  assert.doesNotMatch(grail.essence.paragraphs.join(" "), /гарантированн/i);
  assert.doesNotMatch(passportUiStrings("grail_b20_3x").join("\n"), /гарантированная доходность/i);

  const algo = readFileSync(join(root, "passports/grail_b20_3x/algorithm.md"), "utf8");
  assert.match(algo, /m5hard/);
  assert.match(algo, /55%/);
  assert.match(algo, /обещать «живой боевой счёт/);
  assert.ok(validatePassport(grail).length === 0, validatePassport(grail).join("; "));
});
