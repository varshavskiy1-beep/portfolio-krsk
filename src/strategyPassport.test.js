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

test("testing section is needs_data and does not invent walk-forward", () => {
  for (const botId of DISPLAYED) {
    const t = getPassport(botId).testing;
    assert.equal(t.status, TEST_STATUS.NEEDS_DATA);
    assert.equal(t.statusLabel, TEST_STATUS_LABEL[TEST_STATUS.NEEDS_DATA]);
    assert.equal(t.walkForward, null);
    assert.equal(t.backtest, null);
    assert.equal(t.overlay, null);
    assert.ok(t.missing.length >= 8, botId);
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

test("known facts stay tied to snapshot, not invented numbers", () => {
  const grail = getPassport("grail_b20_3x");
  assert.match(
    grail.parameters.find((r) => r.name === "Плечо").value,
    /×3/,
  );
  assert.match(
    grail.parameters.find((r) => r.name === "Число позиций").value,
    /одной/,
  );
  assert.equal(grail.parameters.find((r) => r.name === "Инструменты").known, false);

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
