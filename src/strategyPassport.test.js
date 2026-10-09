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
import { MAYAK_BOT_IDS, PORTAL_SHELLS, hasAccountData, isHiddenPortalId } from "./strategyMeta.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));

const DISPLAYED = [
  "v6b1",
  "who_pays",
  "forts_adr_adaptive",
  "forts_adr_static",
  "pump_radar",
  "three_robots_okx_nasdaq_1h",
  "young_bounce_combo",
  "oac_paper",
  "desyatka_earn_paper",
  "cycle_6040_paper",
  "rf_conservative_comon",
  "rf_bonds_rate_cycle",
  "mayak_imoex_lowvol10",
  "mayak_imoex_mom10",
  "mayak_imoex_mom10_lev15",
  "mayak_imoex_mom10_lev2",
];

test("cycle_6040_paper stays on the dashboard; snapshot row is used when present", () => {
  const row = (latest.accounts || []).find((a) => a.bot_id === "cycle_6040_paper");
  assert.equal(displayedBotIds(latest.accounts).includes("cycle_6040_paper"), true);
  if (row) {
    assert.equal(hasAccountData(row), true);
  } else {
    assert.equal(hasAccountData({ bot_id: "cycle_6040_paper", no_data: true }), false);
  }
});

test("rf_bonds_rate_cycle stays on the dashboard; absent snapshot → нет данных", () => {
  const ids = displayedBotIds(latest.accounts);
  assert.equal(ids.includes("rf_bonds_rate_cycle"), true);
  const row = (latest.accounts || []).find((a) => a.bot_id === "rf_bonds_rate_cycle");
  if (!row) {
    assert.equal(hasAccountData({ bot_id: "rf_bonds_rate_cycle", no_data: true }), false);
  }
});

test("rf_conservative_comon stays on the dashboard; snapshot row is used when present", () => {
  const row = (latest.accounts || []).find((a) => a.bot_id === "rf_conservative_comon");
  assert.equal(displayedBotIds(latest.accounts).includes("rf_conservative_comon"), true);
  if (row) {
    assert.equal(hasAccountData(row), true);
  } else {
    assert.equal(hasAccountData({ bot_id: "rf_conservative_comon", no_data: true }), false);
  }
});

test("desyatka in latest.json is a live cash book, not нет данных and not 100000", () => {
  const row = (latest.accounts || []).find((a) => a.bot_id === "desyatka_earn_paper");
  assert.ok(row, "desyatka_earn_paper must be in equity_ro latest.json");
  assert.equal(hasAccountData(row), true);
  assert.equal(Number(row.seed), 10000);
  assert.notEqual(Number(row.equity), 100000);
  assert.notEqual(Number(row.seed), 100000);
});

test("mayak cards stay on the dashboard; absent snapshot → нет данных", () => {
  const ids = displayedBotIds(latest.accounts);
  for (const botId of MAYAK_BOT_IDS) {
    assert.equal(ids.includes(botId), true, botId);
    const row = (latest.accounts || []).find((a) => a.bot_id === botId || a.account_id === botId);
    if (!row) {
      assert.equal(hasAccountData({ bot_id: botId, no_data: true }), false);
    }
  }
});

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
  const base = getPassport("v6b1");
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
  const fromManifest = (latest.manifest || [])
    .map((m) => m.bot_id)
    .filter((id) => !isHiddenPortalId(id));
  for (const botId of fromManifest) {
    assert.equal(hasAuthoredPassport(botId), true, botId);
  }
});

test("decommissioned grail_b20_3x has no authored passport and is not displayed", () => {
  assert.equal(hasAuthoredPassport("grail_b20_3x"), false);
  assert.equal(authoredPassportIds().includes("grail_b20_3x"), false);
  assert.equal(displayedBotIds(latest.accounts).includes("grail_b20_3x"), false);
  const stub = getPassport("grail_b20_3x");
  assert.equal(stub.authored, false);
  assert.doesNotMatch(stub.title, /Grail B20/);
});

test("known facts stay tied to snapshot or pack, not invented numbers", () => {
  const oac = getPassport("oac_paper");
  assert.match(oac.parameters.find((r) => r.name === "Размер позиции (базовый)").value, /10%/);
  assert.equal(oac.parameters.find((r) => r.name === "День недели пересборки").known, false);

  const who = getPassport("who_pays");
  assert.equal(who.parameters.find((r) => r.name === "Начальный капитал счетов").known, false);
  assert.match(who.parameters.find((r) => r.name === "Условие допуска сделки").value, /S2–S5/);

  const yb = getPassport("young_bounce_combo");
  assert.match(yb.parameters.find((r) => r.name === "Фильтр имён").value, /25–90/);
  assert.match(yb.parameters.find((r) => r.name === "Выход").value, /10 дней/);

  const de = getPassport("desyatka_earn_paper");
  assert.equal(de.title, "Десятка Earn");
  assert.match(de.parameters.find((r) => r.name === "Начальный капитал").value, /10 000 USD/);
  assert.equal(
    de.parameters.find((r) => r.name === "Рынок").meaning,
    "акции США, старт 10 000 USD. На биржу ордера не идут.",
  );
  assert.doesNotMatch(de.essence.paragraphs.join("\n"), /100 000|100000|\$100/);
  for (const s of passportUiStrings("desyatka_earn_paper")) {
    assert.doesNotMatch(s, /100 000|100000|\$100 000/, s);
  }
  assert.match(de.parameters.find((r) => r.name === "Комиссия").value, /5 б\.п\./);
  assert.match(de.parameters.find((r) => r.name === "Проскальзывание").value, /10 б\.п\./);
  assert.doesNotMatch(de.essence.paragraphs.join("\n"), /\bseed\b/i);

  const cyc = getPassport("cycle_6040_paper");
  assert.equal(cyc.title, "Цикл 60/40");
  assert.match(cyc.parameters.find((r) => r.name === "Начальный капитал").value, /1 000 000 RUB/);
  assert.equal(
    cyc.parameters.find((r) => r.name === "Рынок").meaning,
    "РФ, DIVD/SBLB/LQDT, старт 1 000 000 ₽. На биржу ордера не идут.",
  );
  assert.match(cyc.parameters.find((r) => r.name === "Стоп по model").value, /−6%/);
  assert.match(cyc.essence.paragraphs.join("\n"), /cycle_53477/);
  assert.doesNotMatch(cyc.essence.paragraphs.join("\n"), /\bseed\b/i);
  assert.doesNotMatch(cyc.essence.paragraphs.join("\n"), /10 000 USD|10000 USD/);

  const rfc = getPassport("rf_conservative_comon");
  assert.equal(rfc.title, "РФ Консерватив: облигации в цикле ЦБ + 10% акций");
  assert.match(rfc.parameters.find((r) => r.name === "Начальный капитал").value, /50 000 RUB/);
  assert.equal(
    rfc.parameters.find((r) => r.name === "Рынок").meaning,
    "РФ, SBMX/SBRB/LQDT, старт 50 000 ₽. На биржу ордера не идут.",
  );
  assert.match(rfc.parameters.find((r) => r.name === "Канон (документация)").value, /RF_CONSERVATIVE_CANON_COMON_v1/);
  assert.match(rfc.parameters.find((r) => r.name === "Инструменты").value, /SBMX, SBRB, LQDT/);
  assert.doesNotMatch(rfc.parameters.find((r) => r.name === "Инструменты").value, /DIVD|SBLB/);
  assert.match(rfc.essence.paragraphs.join("\n"), /90% — облигации SBRB/);
  assert.match(rfc.essence.paragraphs.join("\n"), /ENABLE_EXCHANGE_ORDERS=0/);
  assert.doesNotMatch(rfc.essence.paragraphs.join("\n"), /\bseed\b/i);
  assert.doesNotMatch(rfc.essence.paragraphs.join("\n"), /1 000 000|DIVD|SBLB|cycle_53477/);
  for (const s of passportUiStrings("rf_conservative_comon")) {
    assert.doesNotMatch(s, /включить ордера/, s);
    assert.doesNotMatch(s, /счёт Finam|номер счёта Finam|Finam account/i, s);
  }

  const rbc = getPassport("rf_bonds_rate_cycle");
  assert.equal(rbc.title, "Цикл ставки 80/20: дальние облигации и юань");
  assert.equal(rbc.parameters.find((r) => r.name === "Начальное значение").known, false);
  assert.equal(rbc.parameters.find((r) => r.name === "Начальное значение").value, NO_DATA);
  assert.match(rbc.parameters.find((r) => r.name === "Канон (документация)").value, /RF_BONDS_RATE_CYCLE_80_20_v1/);
  assert.match(rbc.parameters.find((r) => r.name === "Инструменты").value, /OBLG, SBRB, CR/);
  assert.doesNotMatch(rbc.parameters.find((r) => r.name === "Инструменты").value, /RUCBTR5YNS|RUCBITR1Y|CNYRUB/);
  assert.match(rbc.essence.paragraphs.join("\n"), /история, не живой счёт/);
  assert.match(rbc.essence.paragraphs.join("\n"), /индекс богатства/);
  assert.match(rbc.essence.paragraphs.join("\n"), /История канона считалась по индексам/);
  assert.doesNotMatch(rbc.essence.paragraphs.join("\n"), /\bseed\b/i);
  assert.doesNotMatch(rbc.essence.paragraphs.join("\n"), /50 000|1 000 000|SBMX|DIVD|\/var\/lib|sqlite/);
  for (const s of passportUiStrings("rf_bonds_rate_cycle")) {
    assert.doesNotMatch(s, /включить ордера/, s);
    assert.doesNotMatch(s, /\bseed\b/i, s);
    assert.doesNotMatch(s, /RUCBTR5YNS|RUCBITR1Y|CNYRUB_TOM/, s);
  }
  assert.doesNotMatch(rbc.essence.paragraphs.join("\n"), /₽/);
  assert.doesNotMatch(rbc.parameters.map((p) => `${p.name} ${p.value}`).join("\n"), /₽/);

  const lowvol = getPassport("mayak_imoex_lowvol10");
  assert.equal(lowvol.title, "Маяк Low Vol");
  assert.equal(lowvol.parameters.find((r) => r.name === "Начальный капитал").known, false);
  assert.equal(lowvol.parameters.find((r) => r.name === "Начальный капитал").value, NO_DATA);
  assert.equal(lowvol.parameters.find((r) => r.name === "Бэктест").value, NO_DATA);
  assert.match(lowvol.essence.paragraphs.join("\n"), /Автоследования/);
  assert.match(lowvol.essence.paragraphs.join("\n"), /19:15 МСК/);
  assert.doesNotMatch(lowvol.essence.paragraphs.join("\n"), /\bseed\b/i);
  assert.doesNotMatch(lowvol.essence.paragraphs.join("\n"), /\/var\/lib|equity-ro/);
  const lev = getPassport("mayak_imoex_mom10_lev15");
  assert.equal(lev.title, "Маяк Momentum ×1,5");
  assert.match(lev.parameters.find((r) => r.name === "Плечо").value, /1,5/);
  assert.match(lev.risk.paragraphs.join("\n"), /заём/);
  for (const botId of MAYAK_BOT_IDS) {
    for (const s of passportUiStrings(botId)) {
      assert.doesNotMatch(s, /\bseed\b/i, `${botId}: ${s}`);
      assert.doesNotMatch(s, /включить ордера/, s);
      assert.doesNotMatch(s, /\/var\/lib/, s);
    }
  }
});

test("displayed passport UI has no Grail / grail_b20_3x copy", () => {
  for (const botId of displayedBotIds(latest.accounts)) {
    const text = [botId, ...passportUiStrings(botId)].join("\n");
    assert.doesNotMatch(text, /grail_b20_3x/i, botId);
    assert.doesNotMatch(text, /Grail B20/, botId);
    assert.doesNotMatch(text, /\bGrail\b/, botId);
  }
});
