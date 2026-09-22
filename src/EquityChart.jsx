import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import { buildSeries, chartSeriesColors, isChartUpVsSeed } from "./equityChartModel.js";

const RANGES = [
  { id: "1d", label: "1Д", ms: 1 * 24 * 3600 * 1000 },
  { id: "1w", label: "1Н", ms: 7 * 24 * 3600 * 1000 },
  { id: "1m", label: "1М", ms: 30 * 24 * 3600 * 1000 },
  { id: "1y", label: "1Г", ms: 365 * 24 * 3600 * 1000 },
];

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

function fitChart(chart, el) {
  if (!chart || !el) return;
  // Только content-box хоста. Хост не зависит от canvas (LWC absolute),
  // поэтому clientHeight — реальная выделенная область, не «раздутая» виджетом.
  const w = Math.floor(el.clientWidth);
  const h = Math.floor(el.clientHeight);
  if (w < 40 || h < 80) return;
  const shortPhone =
    typeof window !== "undefined" &&
    window.matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
  chart.applyOptions({
    width: w,
    height: h,
    layout: { fontSize: shortPhone ? 11 : 12 },
  });
}

function subscribeViewportFit(run) {
  const delayed = () => {
    run();
    requestAnimationFrame(run);
    window.setTimeout(run, 120);
    window.setTimeout(run, 400);
  };
  window.addEventListener("orientationchange", delayed);
  window.addEventListener("resize", run);
  window.visualViewport?.addEventListener("resize", run);
  return () => {
    window.removeEventListener("orientationchange", delayed);
    window.removeEventListener("resize", run);
    window.visualViewport?.removeEventListener("resize", run);
  };
}

const TIME_SCALE_MIN_H = { fill: 40, normal: 26 };

/**
 * @param {object} props
 * @param {number} [props.height=280] — высота хоста, если не fill
 * @param {boolean} [props.fill=false] — хост тянется на 100% родителя (fullscreen)
 */
export default function EquityChart({
  points,
  seed,
  currency,
  mode,
  height = 280,
  fill = false,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState("1m");
  const series = buildSeries(points, seed, mode);
  const ready = series.length >= 2;

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const el = wrapRef.current;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#faf9f6" },
        textColor: "#555",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#eeeae3" },
        horzLines: { color: "#eeeae3" },
      },
      width: Math.max(Math.floor(el.clientWidth) || 40, 40),
      height: Math.max(Math.floor(el.clientHeight) || 80, 80),
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: true,
        borderColor: "#e5e1d8",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
        tickMarkMaxCharacterLength: 12,
        // v5: запас внутри оси, чтобы цифры не прилипали к нижнему краю canvas
        minimumHeight: fill ? TIME_SCALE_MIN_H.fill : TIME_SCALE_MIN_H.normal,
      },
      crosshair: {
        horzLine: { labelVisible: true },
        vertLine: { labelVisible: true },
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
    const area = chart.addSeries(AreaSeries, {
      lineColor: "#2b4c7e",
      topColor: "rgba(43, 76, 126, 0.28)",
      bottomColor: "rgba(43, 76, 126, 0.02)",
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = area;

    const ro = new ResizeObserver(() => fitChart(chart, el));
    ro.observe(el);
    const unsubVv = subscribeViewportFit(() => fitChart(chart, el));
    // после layout
    requestAnimationFrame(() => fitChart(chart, el));

    return () => {
      unsubVv();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [fill, height]);

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
    const up = isChartUpVsSeed(series, seed, mode);
    area.applyOptions(chartSeriesColors(up));
    area.setData(series);
    fitChart(chart, wrapRef.current);
    applyRange(chart, series, range);
    // дать layout дорисоваться, потом ещё раз подогнать высоту
    requestAnimationFrame(() => {
      fitChart(chart, wrapRef.current);
      try {
        chart.timeScale().applyOptions({ visible: true });
      } catch (_) {}
    });
  }, [series, mode, currency, range, ready, seed]);

  // при смене fill/height — пересчитать размер и высоту time-scale
  useEffect(() => {
    const chart = chartRef.current;
    const run = () => fitChart(chart, wrapRef.current);
    if (chart) {
      try {
        chart.timeScale().applyOptions({
          minimumHeight: fill ? TIME_SCALE_MIN_H.fill : TIME_SCALE_MIN_H.normal,
        });
      } catch (_) {}
    }
    run();
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const unsubVv = subscribeViewportFit(run);
    return () => {
      cancelAnimationFrame(id);
      unsubVv();
    };
  }, [fill, height]);

  return (
    <div className={`tv-chart ${fill ? "tv-chart-fill" : ""}`}>
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
        <span className="chart-hint hint-desktop">колёсико — зум · тяни — сдвиг</span>
      </div>
      {!ready ? (
        <div className="empty-chart">
          {series.length === 1
            ? "Пока одна точка — зум и периоды появятся после следующих снимков."
            : "Нет точек истории для графика."}
        </div>
      ) : null}
      <div className="tv-chart-stage">
        <div
          ref={wrapRef}
          className="tv-chart-host"
          style={ready ? undefined : { display: "none" }}
        />
        {fill ? <div className="tv-chart-timeband" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}
