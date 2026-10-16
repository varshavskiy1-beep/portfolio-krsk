import { useEffect, useRef } from "react";
import { ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { formatChartPctLabel } from "./equityChartModel.js";
import {
  STITCH_COLORS,
  STITCH_COPY,
  stitchView,
} from "./stitchEquity.js";

function fit(chart, el, minH) {
  if (!chart || !el) return;
  const w = Math.floor(el.clientWidth);
  const h = Math.floor(el.clientHeight);
  if (w < 40 || h < minH) return;
  chart.applyOptions({ width: w, height: h });
}

function StitchLineChart({ lines }) {
  const hostRef = useRef(null);
  useEffect(() => {
    if (!hostRef.current || !lines.length) return undefined;
    const el = hostRef.current;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#faf9f6" },
        textColor: "#555",
        fontSize: 12,
      },
      grid: { vertLines: { color: "#eeeae3" }, horzLines: { color: "#eeeae3" } },
      width: Math.max(Math.floor(el.clientWidth) || 40, 40),
      height: Math.max(Math.floor(el.clientHeight) || 80, 80),
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.1 } },
      timeScale: { borderVisible: true, borderColor: "#e5e1d8", timeVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true },
    });
    const added = [];
    for (const line of lines) {
      const s = chart.addSeries(LineSeries, {
        color: line.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      s.setData(line.points.map((p) => ({ time: p.time, value: p.value })));
      added.push(s);
    }
    const ro = new ResizeObserver(() => fit(chart, el, 80));
    ro.observe(el);
    requestAnimationFrame(() => {
      fit(chart, el, 80);
      chart.timeScale().fitContent();
    });
    return () => {
      ro.disconnect();
      added.length = 0;
      chart.remove();
    };
  }, [lines]);
  return <div ref={hostRef} className="tv-chart-host stitch-line-host" />;
}

function StitchHistChart({ yoy, avg36 }) {
  const hostRef = useRef(null);
  useEffect(() => {
    if (!hostRef.current || !yoy.length) return undefined;
    const el = hostRef.current;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#faf9f6" },
        textColor: "#555",
        fontSize: 12,
      },
      grid: { vertLines: { color: "#eeeae3" }, horzLines: { color: "#eeeae3" } },
      width: Math.max(Math.floor(el.clientWidth) || 40, 40),
      height: Math.max(Math.floor(el.clientHeight) || 80, 80),
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderVisible: true, borderColor: "#e5e1d8", timeVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true },
    });
    const hist = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "custom", formatter: formatChartPctLabel },
      priceLineVisible: false,
    });
    hist.setData(
      yoy.map((p) => ({
        time: p.time,
        value: p.value,
        color: p.value >= 0 ? STITCH_COLORS.yoyPos : STITCH_COLORS.yoyNeg,
      })),
    );
    if (avg36 != null) {
      const avg = chart.addSeries(LineSeries, {
        color: STITCH_COLORS.avg36,
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: formatChartPctLabel },
      });
      avg.setData(yoy.map((p) => ({ time: p.time, value: avg36 })));
    }
    const ro = new ResizeObserver(() => fit(chart, el, 80));
    ro.observe(el);
    requestAnimationFrame(() => {
      fit(chart, el, 80);
      chart.timeScale().fitContent();
    });
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [yoy, avg36]);
  return <div ref={hostRef} className="tv-chart-host stitch-hist-host" />;
}

export default function StitchBlock({ botId, accountId, backtests }) {
  const view = stitchView(backtests, botId, accountId);
  return (
    <section className="stitch-block">
      <h3 className="subhead">{STITCH_COPY.title}</h3>
      {view.empty ? (
        <p className="muted stitch-empty">{view.message}</p>
      ) : (
        <>
          {view.lines.length ? (
            <>
              <ul className="stitch-legend">
                {view.lines.map((l) => (
                  <li key={l.id}>
                    <span className="stitch-swatch" style={{ background: l.color }} />
                    {l.label}
                  </li>
                ))}
              </ul>
              <StitchLineChart lines={view.lines} />
            </>
          ) : null}
          {view.yoy.length ? (
            <>
              <ul className="stitch-legend">
                <li>
                  <span className="stitch-swatch" style={{ background: STITCH_COLORS.yoyPos }} />
                  {STITCH_COPY.yoy}
                </li>
                {view.avg36 != null ? (
                  <li>
                    <span className="stitch-swatch" style={{ background: STITCH_COLORS.avg36 }} />
                    {STITCH_COPY.avg36}
                    {": "}
                    {formatChartPctLabel(view.avg36)}
                  </li>
                ) : null}
              </ul>
              <StitchHistChart yoy={view.yoy} avg36={view.avg36} />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
