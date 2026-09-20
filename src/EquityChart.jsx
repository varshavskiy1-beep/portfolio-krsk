import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";

const RANGES = [
  { id: "1d", label: "1Д", ms: 1 * 24 * 3600 * 1000 },
  { id: "1w", label: "1Н", ms: 7 * 24 * 3600 * 1000 },
  { id: "1m", label: "1М", ms: 30 * 24 * 3600 * 1000 },
  { id: "1y", label: "1Г", ms: 365 * 24 * 3600 * 1000 },
];

function toUnix(t) {
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function buildSeries(points, seed, mode) {
  const seedN = seed == null || seed === "" ? null : Number(seed);
  const raw = [];
  for (const p of points || []) {
    const time = toUnix(p.t);
    const eq = p.equity == null || p.equity === "" ? null : Number(p.equity);
    if (time == null || eq == null || Number.isNaN(eq)) continue;
    raw.push({ time, eq });
  }
  raw.sort((a, b) => a.time - b.time);
  const dedup = [];
  for (const row of raw) {
    if (dedup.length && dedup[dedup.length - 1].time === row.time) dedup[dedup.length - 1] = row;
    else dedup.push(row);
  }
  if (!dedup.length) return [];
  const base =
    mode === "pct"
      ? seedN && seedN !== 0
        ? seedN
        : dedup[0].eq
      : null;
  return dedup.map(({ time, eq }) => ({
    time,
    value: mode === "pct" ? ((eq - base) / base) * 100 : eq,
  }));
}

function applyRange(chart, series, rangeId) {
  if (!chart || !series.length) return;
  if (rangeId === "all") {
    chart.timeScale().fitContent();
    return;
  }
  const spec = RANGES.find((r) => r.id === rangeId);
  if (!spec) {
    chart.timeScale().fitContent();
    return;
  }
  const last = series[series.length - 1].time;
  const first = series[0].time;
  const from = Math.max(last - Math.floor(spec.ms / 1000), first);
  try {
    chart.timeScale().setVisibleRange({ from, to: last + 3600 });
  } catch {
    chart.timeScale().fitContent();
  }
}

export default function EquityChart({ points, seed, currency, mode, height = 200 }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState("1m");
  const series = buildSeries(points, seed, mode);
  const ready = series.length >= 2;

  // create chart once
  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const chart = createChart(wrapRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#faf9f6" },
        textColor: "#666",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#eeeae3" },
        horzLines: { color: "#eeeae3" },
      },
      width: wrapRef.current.clientWidth || 320,
      height: height || 200,
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });
    const area = chart.addAreaSeries({
      lineColor: "#2b4c7e",
      topColor: "rgba(43, 76, 126, 0.28)",
      bottomColor: "rgba(43, 76, 126, 0.02)",
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = area;
    const ro = new ResizeObserver(() => {
      if (wrapRef.current) {
        chart.applyOptions({
          width: wrapRef.current.clientWidth,
          height: height || wrapRef.current.clientHeight || 200,
        });
      }
    });
    ro.observe(wrapRef.current);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const area = seriesRef.current;
    if (!chart || !area) return;
    area.applyOptions({
      priceFormat:
        mode === "pct"
          ? { type: "custom", formatter: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` }
          : {
              type: "custom",
              formatter: (v) =>
                new Intl.NumberFormat("ru-RU", {
                  maximumFractionDigits: currency === "RUB" ? 0 : 2,
                }).format(v),
            },
    });
    if (!ready) {
      area.setData([]);
      return;
    }
    const up = series[series.length - 1].value >= series[0].value;
    area.applyOptions({
      lineColor: up ? "#1f7a4c" : "#a33",
      topColor: up ? "rgba(31, 122, 76, 0.28)" : "rgba(170, 51, 51, 0.25)",
      bottomColor: up ? "rgba(31, 122, 76, 0.02)" : "rgba(170, 51, 51, 0.02)",
    });
    area.setData(series);
    if (wrapRef.current) {
      chart.applyOptions({
        width: wrapRef.current.clientWidth,
        height: height || 200,
      });
    }
    applyRange(chart, series, range);
  }, [series, mode, currency, range, ready, height]);

  return (
    <div className="tv-chart">
      <div className="chart-toolbar">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`chip tiny ${range === r.id ? "active" : ""}`}
            onClick={() => setRange(r.id)}
            disabled={!ready}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          className={`chip tiny ${range === "all" ? "active" : ""}`}
          disabled={!ready}
          onClick={() => setRange("all")}
        >
          Всё
        </button>
        <span className="chart-hint">колёсико — зум · тяни — сдвиг</span>
      </div>
      {!ready ? (
        <div className="empty-chart">
          {series.length === 1
            ? "Пока одна точка — зум и 1Д/1Н/1М/1Г появятся после следующих снимков. Полная история с первого дня — выгрузка из леджеров."
            : "Нет точек истории для графика."}
        </div>
      ) : null}
      <div
        ref={wrapRef}
        className="tv-chart-host"
        style={{ display: ready ? "block" : "none", height: height || 200 }}
      />
    </div>
  );
}
