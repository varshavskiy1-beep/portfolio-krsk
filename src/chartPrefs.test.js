import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  CHART_MODE_KEYS,
  CHART_RANGE_KEYS,
  DEFAULT_CHART_MODE,
  DEFAULT_CHART_RANGE,
  LEGACY_CHART_MODE_KEYS,
  LEGACY_CHART_RANGE_KEYS,
  initialChartMode,
  initialChartRange,
  persistChartMode,
  persistChartRange,
  readStoredChartMode,
  readStoredChartRange,
} from "./chartPrefs.js";

afterEach(() => {
  try {
    delete globalThis.localStorage;
  } catch {
    /* ignore */
  }
});

function memoryStorage(start = {}) {
  const data = { ...start };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    _data: data,
  };
}

test("without a stored choice the default is percent for all time", () => {
  globalThis.localStorage = memoryStorage();
  assert.equal(DEFAULT_CHART_MODE, "pct");
  assert.equal(DEFAULT_CHART_RANGE, "all");
  assert.equal(readStoredChartMode(), null);
  assert.equal(readStoredChartRange(), null);
  assert.equal(initialChartMode(), "pct");
  assert.equal(initialChartRange(), "all");
});

test("legacy money / 1m keys from older versions do not override the default", () => {
  globalThis.localStorage = memoryStorage({
    "portfolio_krsk.chartMode": "money",
    "portfolio_krsk.chartRange": "1m",
    chartMode: "money",
    "chart-mode": "money",
    chartRange: "1d",
    "chart-range": "1y",
  });
  assert.equal(initialChartMode(), "pct");
  assert.equal(initialChartRange(), "all");
  assert.equal(readStoredChartMode(), null);
  assert.equal(readStoredChartRange(), null);
});

test("v2 stored money / 1m choice after a manual click is kept", () => {
  globalThis.localStorage = memoryStorage({
    [CHART_MODE_KEYS[0]]: "money",
    [CHART_RANGE_KEYS[0]]: "1m",
  });
  assert.equal(initialChartMode(), "money");
  assert.equal(initialChartRange(), "1m");
});

test("invalid stored values fall back to the new default", () => {
  globalThis.localStorage = memoryStorage({
    [CHART_MODE_KEYS[0]]: "seed",
    [CHART_RANGE_KEYS[0]]: "forever",
  });
  assert.equal(initialChartMode(), "pct");
  assert.equal(initialChartRange(), "all");
});

test("persist writes the v2 keys and does not revive legacy money", () => {
  const ls = memoryStorage({
    "portfolio_krsk.chartMode": "money",
    chartMode: "money",
  });
  globalThis.localStorage = ls;
  persistChartMode("pct");
  persistChartRange("all");
  assert.equal(ls.getItem(CHART_MODE_KEYS[0]), "pct");
  assert.equal(ls.getItem(CHART_RANGE_KEYS[0]), "all");
  assert.equal(initialChartMode(), "pct");
  assert.equal(initialChartRange(), "all");
  persistChartMode("money");
  persistChartRange("1w");
  assert.equal(ls.getItem(CHART_MODE_KEYS[0]), "money");
  assert.equal(ls.getItem(CHART_RANGE_KEYS[0]), "1w");
  assert.equal(initialChartMode(), "money");
  assert.equal(initialChartRange(), "1w");
});

test("canonical keys are versioned and legacy aliases stay listed for the ignore test", () => {
  assert.equal(CHART_MODE_KEYS[0], "portfolio_krsk.chartMode.v2");
  assert.equal(CHART_RANGE_KEYS[0], "portfolio_krsk.chartRange.v2");
  assert.ok(LEGACY_CHART_MODE_KEYS.includes("portfolio_krsk.chartMode"));
  assert.ok(LEGACY_CHART_RANGE_KEYS.includes("portfolio_krsk.chartRange"));
});

test("chart pref helpers never mention seed in their public strings", () => {
  const blob = [
    DEFAULT_CHART_MODE,
    DEFAULT_CHART_RANGE,
    ...CHART_MODE_KEYS,
    ...CHART_RANGE_KEYS,
    ...LEGACY_CHART_MODE_KEYS,
    ...LEGACY_CHART_RANGE_KEYS,
  ].join(" ");
  assert.doesNotMatch(blob, /\bseed\b/i);
});
