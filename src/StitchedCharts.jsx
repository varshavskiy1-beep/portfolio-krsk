import { useEffect, useRef } from "react";
import { ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { backtestSourceLine, feedSourceLine } from "./feedValidate.js";
import {
  backtestHonestyLines,
  backtestPointsFor,
  backtestRowFor,
  stitchCaption,
  stitchEquity,
} from "./stitchEquity.js";

const UP = "#1f7a4c";
const DOWN = "#c23b3b";
const SMA = "#5b4db3";
const BACKTEST = "#2b4c7e";
const PAPER = "#d06a00";
const EMA = "#7a4ea3";

function monthTime(month) {
  const [y, m] = month.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function chartBase(el, height) {
  return createChart(el, {
    layout: {
      background: { type: ColorType.Solid, color: "#f3f1ec" },
      textColor: "#444",
      fontSize: 12,
    },
    grid: {
      vertLines: { color: "#e4e0d8" },
      horzLines: { color: "#e4e0d8" },
    },
    width: Math.max(Math.floor(el.clientWidth) || 40, 40),
    height,
    rightPriceScale: { borderVisible: false },
    timeScale: { borderColor: "#e5e1d8", rightOffset: 4 },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  });
}

function fit(chart, el, height) {
  if (!chart || !el) return;
  const w = Math.floor(el.clientWidth);
  if (w < 40) return;
  chart.applyOptions({ width: w, height });
}

function useResize(chartRef, elRef, height) {
  useEffect(() => {
    const el = elRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return undefined;
    const ro = new ResizeObserver(() => fit(chart, el, height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartRef, elRef, height]);
}

function EquityMonthChart({ monthly }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  useResize(chartRef, elRef, 320);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    const chart = chartBase(el, 320);
    const stitch = chart.addSeries(LineSeries, { color: BACKTEST, lineWidth: 2, title: "склейка" });
    const paper = chart.addSeries(LineSeries, { color: PAPER, lineWidth: 2, title: "бумага" });
    const ema = chart.addSeries(LineSeries, { color: EMA, lineWidth: 2, title: "EMA100" });
    chartRef.current = chart;
    stitch.setData(
      monthly.map((row) => ({ time: monthTime(row.month), value: row.equity })),
    );
    paper.setData(
      monthly
        .filter((row) => row.segment === "paper")
        .map((row) => ({ time: monthTime(row.month), value: row.equity })),
    );
    ema.setData(
      monthly
        .filter((row) => row.ema100 != null)
        .map((row) => ({ time: monthTime(row.month), value: row.ema100 })),
    );
    chart.timeScale().fitContent();
    fit(chart, el, 320);
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [monthly]);

  return <div ref={elRef} className="stitch-chart" />;
}

function YoyChart({ yoy }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  useResize(chartRef, elRef, 260);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    const chart = chartBase(el, 260);
    const pct = {
      type: "custom",
      minMove: 0.01,
      formatter: (v) =>
        `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`,
    };
    const bars = chart.addSeries(HistogramSeries, { priceFormat: pct });
    const line = chart.addSeries(LineSeries, { color: SMA, lineWidth: 2, priceFormat: pct });
    chartRef.current = chart;
    bars.setData(
      yoy.map((row) => ({
        time: monthTime(row.month),
        value: row.yoy * 100,
        color: row.yoy >= 0 ? UP : DOWN,
      })),
    );
    line.setData(
      yoy
        .filter((row) => row.sma36 != null)
        .map((row) => ({ time: monthTime(row.month), value: row.sma36 * 100 })),
    );
    chart.timeScale().fitContent();
    fit(chart, el, 260);
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [yoy]);

  return <div ref={elRef} className="stitch-chart stitch-chart-short" />;
}

function HonestyNotes({ backtests, account, generatedAt }) {
  const row = backtestRowFor(backtests, account);
  const lines = [
    ...backtestHonestyLines(row, account),
    backtestSourceLine(row?.source),
    feedSourceLine(generatedAt),
  ].filter(Boolean);
  if (!lines.length) return null;
  return lines.map((line) => (
    <p key={line} className="updated stitch-meta">{line}</p>
  ));
}

export default function StitchedCharts({ account, paperPoints, backtests, generatedAt }) {
  const backtest = backtestPointsFor(backtests, account);
  const result = stitchEquity(backtest, paperPoints);
  if (!result.ok) {
    return (
      <section className="stitch-block">
        <h3 className="subhead">Бэктест и бумага</h3>
        <HonestyNotes backtests={backtests} account={account} generatedAt={generatedAt} />
        <p className="note">{stitchCaption(result)}</p>
      </section>
    );
  }
  const smaReady = result.yoy.some((row) => row.sma36 != null);
  return (
    <section className="stitch-block">
      <h3 className="subhead">Бэктест и бумага, помесячно</h3>
      <HonestyNotes backtests={backtests} account={account} generatedAt={generatedAt} />
      <p className="stitch-legend">
        <span className="swatch swatch-backtest" /> склейка
        <span className="swatch swatch-paper" /> бумага с {result.paperStart}
        <span className="swatch swatch-ema" /> EMA100 дневная
      </p>
      <p className="note">
        Синяя линия — дневный бэктест до бумаги и бумажный трек после, без скачка на стыке{" "}
        {result.joinDay}. Оранжевая линия — тот же бумажный участок поверх. Фиолетовая — EMA100
        по дневной эквити, на графике значение конца месяца.
      </p>
      <EquityMonthChart monthly={result.monthly} />
      <h3 className="subhead">Год к году</h3>
      <p className="stitch-legend">
        <span className="swatch swatch-up" /> прирост за 12 месяцев
        <span className="swatch swatch-down" /> спад
        <span className="swatch swatch-sma" /> средняя за 3 года
      </p>
      {result.yoy.length ? <YoyChart yoy={result.yoy} /> : null}
      <p className="note">
        Столбик — насколько эквити выросла за 12 месяцев. Линия — средняя этих приростов за 36
        месяцев. Стратегию снова смотреть к подключению, когда зелёный столбик поднимается выше
        линии.
        {smaReady
          ? ""
          : " Средней за 3 года ещё нет: нужно 36 месячных приростов подряд, это около четырёх лет дневного ряда."}
      </p>
    </section>
  );
}
