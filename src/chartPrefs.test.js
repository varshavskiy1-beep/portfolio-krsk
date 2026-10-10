import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  CHART_MODE_KEYS,
  CHART_RANGE_KEYS,
  DEFAULT_CHART_MODE,
  DEFAULT_CHART_RANGE,
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

test("stored money / 1m choice is kept and not overwritten by the new default", () => {
  globalThis.localStorage = memoryStorage({
    [CHART_MODE_KEYS[0]]: "money",
    [CHART_RANGE_KEYS[0]]: "1m",
  });
  assert.equal(initialChartMode(), "money");
  assert.equal(initialChartRange(), "1m");
});

test("legacy chartMode / chart-range keys are honoured", () => {
  globalThis.localStorage = memoryStorage({
    chartMode: "money",
    "chart-range": "1y",
  });
  assert.equal(initialChartMode(), "money");
  assert.equal(initialChartRange(), "1y");
});

test("invalid stored values fall back to the new default", () => {
  globalThis.localStorage = memoryStorage({
    [CHART_MODE_KEYS[0]]: "seed",
    [CHART_RANGE_KEYS[0]]: "forever",
  });
  assert.equal(initialChartMode(), "pct");
  assert.equal(initialChartRange(), "all");
});

test("persist writes the canonical keys", () => {
  const ls = memoryStorage();
  globalThis.localStorage = ls;
  persistChartMode("money");
  persistChartRange("1w");
  assert.equal(ls.getItem(CHART_MODE_KEYS[0]), "money");
  assert.equal(ls.getItem(CHART_RANGE_KEYS[0]), "1w");
  assert.equal(initialChartMode(), "money");
  assert.equal(initialChartRange(), "1w");
});

test("chart pref helpers never mention seed in their public strings", () => {
  const blob = [
    DEFAULT_CHART_MODE,
    DEFAULT_CHART_RANGE,
    ...CHART_MODE_KEYS,
    ...CHART_RANGE_KEYS,
  ].join(" ");
  assert.doesNotMatch(blob, /\bseed\b/i);
});
