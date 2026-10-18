import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  TickMarkType,
  createChart,
  createTextWatermark,
} from "lightweight-charts";
import { feedSourceLine } from "./feedValidate.js";
import {
  CHANGE_TRACK_LABEL,
  LAST_AVAILABLE_MONTH,
  NO_EMA100,
  NO_SMA36,
  NO_YOY,
  YOY_PANE_EMPTY,
  asOfDayFromGeneratedAt,
  buildStitchedChartModel,
  formatChangeRu,
  formatDayRu,
  formatEquityRu,
  formatMonthLong,
  formatPctRu,
  formatTickMark,
  formatTimeLabel,
  lastObservedRow,
  lineSeriesData,
  modelFailMessage,
  momMissingReason,
  paperSeriesData,
  periodCaption,
  selectChartMonth,
  smaSeriesData,
  yoyHistogramData,
} from "./stitchedChartModel.js";
import {
  backtestHonestyLines,
  backtestPointsFor,
  backtestRowFor,
  backtestSourceDisplay,
  noTapeHonestyLine,
  stitchCaption,
  stitchEquity,
} from "./stitchEquity.js";

const UP = "#1f7a4c";
const DOWN = "#c23b3b";
const SMA = "#5b4db3";
const BACKTEST = "#2b4c7e";
const PAPER = "#d06a00";
const EMA = "#7a4ea3";

function pctAxis() {
  return {
    type: "custom",
    minMove: 0.01,
    formatter: (v) =>
      `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`,
  };
}

function hostHeightForWidth(width) {
  return width >= 768 ? 600 : 520;
}

function applyPaneHeights(chart, hostHeight) {
  const panes = chart.panes();
  if (!panes || panes.length < 2) return;
  const usable = Math.max(Math.floor(hostHeight) - 36, 80);
  const top = Math.round(usable * 0.65);
  panes[0].setHeight(top);
  panes[1].setHeight(usable - top);
}

function resizeChart(chart, host) {
  if (!chart || !host) return;
  const w = Math.floor(host.clientWidth);
  const h = Math.floor(host.clientHeight);
  if (w < 40) return;
  chart.applyOptions({ width: w, height: h });
  applyPaneHeights(chart, h);
}

function Missing({ reason }) {
  return <span className="stitch-missing">{reason}</span>;
}

function SelectedMonthBlock({ row, asOfDay, hovering }) {
  if (!row) return null;
  const period = periodCaption(row, asOfDay);
  return (
    <div className="stitch-month-block">
      <div className="stitch-month-head">
        <h4 className="stitch-month-title">Выбранный месяц</h4>
        {!hovering ? <span className="stitch-month-latest">{LAST_AVAILABLE_MONTH}</span> : null}
      </div>
      <div className="stitch-month-name">{formatMonthLong(row.month)}</div>
      <div className="stitch-month-obs">
        Фактический день наблюдения:{" "}
        {row.observedDay ? formatDayRu(row.observedDay) : <Missing reason="нет данных: нет наблюдения в этом месяце" />}
      </div>
      {period ? <div className="stitch-month-period">{period}</div> : null}
      <div className="stitch-month-grid">
        <div className="stitch-metric">
          <div className="stitch-metric-label">Эквити</div>
          <div className="stitch-metric-value">
            {row.equity != null ? formatEquityRu(row.equity) : <Missing reason="нет данных: нет наблюдения в этом месяце" />}
          </div>
        </div>
        <div className="stitch-metric stitch-metric-mom">
          <div className="stitch-metric-label">Изменение за месяц</div>
          <div className="stitch-metric-value">
            {row.mom != null ? (
              <>
                <span>{formatChangeRu(row.change)}</span>
                <span className="stitch-metric-pct">{formatPctRu(row.mom)}</span>
              </>
            ) : (
              <Missing reason={momMissingReason(row)} />
            )}
          </div>
          <div className="stitch-metric-hint">{CHANGE_TRACK_LABEL}</div>
        </div>
        <div className="stitch-metric stitch-metric-yoy">
          <div className="stitch-metric-label">Изменение за 12 месяцев</div>
          <div className="stitch-metric-value">
            {row.yoy != null ? formatPctRu(row.yoy) : <Missing reason={NO_YOY} />}
          </div>
        </div>
        <div className="stitch-metric">
          <div className="stitch-metric-label">Средняя за 3 года (SMA36)</div>
          <div className="stitch-metric-value">
            {row.sma36 != null ? formatPctRu(row.sma36) : <Missing reason={NO_SMA36} />}
          </div>
        </div>
        <div className="stitch-metric">
          <div className="stitch-metric-label">EMA100</div>
          <div className="stitch-metric-value">
            {row.ema100 != null ? formatEquityRu(row.ema100) : <Missing reason={NO_EMA100} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnifiedStitchedChart({ model, asOfDay, paperStart }) {
  const frameRef = useRef(null);
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const fittedRef = useRef(false);
  const modelRef = useRef(model);
  const hoverRef = useRef(null);
  const yoyMarkRef = useRef(null);
  const [hoverMonth, setHoverMonth] = useState(null);
  const last = lastObservedRow(model);
  const [pinnedMonth, setPinnedMonth] = useState(last?.month ?? null);
  modelRef.current = model;

  const observedCount = useMemo(
    () => (model.rows || []).filter((row) => row.equity != null).length,
    [model],
  );
  const hasYoy = useMemo(() => (model.rows || []).some((row) => row.yoy != null), [model]);

  useEffect(() => {
    setPinnedMonth((prev) => {
      if (prev && model.byMonth.has(prev)) return prev;
      return lastObservedRow(model)?.month ?? null;
    });
  }, [model]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    fittedRef.current = false;
    hoverRef.current = null;
    setHoverMonth(null);

    const chart = createChart(host, {
      layout: {
        background: { type: ColorType.Solid, color: "#f3f1ec" },
        textColor: "#444",
        fontSize: 12,
        panes: { enableResize: false, separatorColor: "#e5e1d8" },
        attributionLogo: true,
      },
      localization: {
        locale: "ru-RU",
        timeFormatter: (time) => formatTimeLabel(time),
      },
      grid: {
        vertLines: { color: "#e4e0d8" },
        horzLines: { color: "#e4e0d8" },
      },
      width: Math.max(Math.floor(host.clientWidth) || 40, 40),
      height: Math.max(Math.floor(host.clientHeight) || 80, 80),
      rightPriceScale: { borderVisible: false },
      timeScale: {
        visible: true,
        borderColor: "#e5e1d8",
        rightOffset: 6,
        ticksVisible: true,
        timeVisible: false,
        secondsVisible: false,
        minimumHeight: 36,
        tickMarkMaxCharacterLength: 16,
        tickMarkFormatter: (time, tickMarkType) => formatTickMark(time, tickMarkType ?? TickMarkType.Month),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: true, labelVisible: true, color: "#666", width: 1 },
        horzLine: { visible: true, labelVisible: true, color: "#666", width: 1 },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const stitch = chart.addSeries(LineSeries, {
      color: BACKTEST,
      lineWidth: 2,
      title: "склейка",
      pointMarkersVisible: observedCount < 2,
    }, 0);
    const paper = chart.addSeries(LineSeries, {
      color: PAPER,
      lineWidth: 2,
      title: "бумага",
      pointMarkersVisible: false,
    }, 0);
    const ema = chart.addSeries(LineSeries, {
      color: EMA,
      lineWidth: 2,
      title: "EMA100",
      pointMarkersVisible: false,
    }, 0);

    chart.addPane(true);
    const yoy = chart.addSeries(
      HistogramSeries,
      { priceFormat: pctAxis(), lastValueVisible: false },
      1,
    );
    const sma = chart.addSeries(
      LineSeries,
      { color: SMA, lineWidth: 2, priceFormat: pctAxis(), title: "SMA36" },
      1,
    );

    const onMove = (param) => {
      if (param?.time == null) {
        if (hoverRef.current != null) {
          hoverRef.current = null;
          setHoverMonth(null);
        }
        return;
      }
      const picked = selectChartMonth(modelRef.current, param.time);
      const month = picked?.month ?? null;
      if (month === hoverRef.current) return;
      hoverRef.current = month;
      setHoverMonth(month);
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const box = entry?.contentBoxSize?.[0];
      const w = Math.floor(box?.inlineSize ?? entry?.contentRect?.width ?? host.clientWidth);
      if (w < 40) return;
      const h = Math.floor(host.clientHeight);
      chart.applyOptions({ width: w, height: h });
      applyPaneHeights(chart, h);
    });
    ro.observe(host, { box: "content-box" });

    chartRef.current = chart;
    seriesRef.current = { stitch, paper, ema, yoy, sma };
    resizeChart(chart, host);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      ro.disconnect();
      yoyMarkRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !model?.ok) return;
    const range = fittedRef.current ? chart.timeScale().getVisibleLogicalRange() : null;
    series.stitch.applyOptions({ pointMarkersVisible: observedCount < 2 });
    series.stitch.setData(lineSeriesData(model.rows, "equity"));
    series.paper.setData(paperSeriesData(model.rows));
    series.ema.setData(lineSeriesData(model.rows, "ema100"));
    series.yoy.setData(yoyHistogramData(model.rows, UP, DOWN));
    series.sma.setData(smaSeriesData(model.rows));

    const pane1 = chart.panes()[1];
    if (pane1 && yoyMarkRef.current !== hasYoy) {
      yoyMarkRef.current = hasYoy;
      if (!hasYoy) {
        createTextWatermark(pane1, {
          visible: true,
          horzAlign: "center",
          vertAlign: "center",
          lines: [{ text: YOY_PANE_EMPTY, color: "#888", fontSize: 13 }],
        });
      }
    }

    if (!fittedRef.current) {
      chart.timeScale().fitContent();
      fittedRef.current = true;
    } else if (range) {
      chart.timeScale().setVisibleLogicalRange(range);
    }
    resizeChart(chart, hostRef.current);
  }, [model, observedCount, hasYoy]);

  const hovering = hoverMonth != null;
  const shown = hovering ? model.byMonth.get(hoverMonth) : model.byMonth.get(pinnedMonth) || last;

  return (
    <>
      <div className="stitch-toolbar">
        <p className="stitch-legend">
          <span className="swatch swatch-backtest" /> склейка
          <span className="swatch swatch-paper" /> бумага{paperStart ? ` с ${paperStart}` : ""}
          <span className="swatch swatch-ema" /> EMA100 дневная
          <span className="swatch swatch-up" /> год к году
          <span className="swatch swatch-down" /> спад
          <span className="swatch swatch-sma" /> SMA36
        </p>
        <button
          type="button"
          className="chip tiny"
          onClick={() => chartRef.current?.timeScale().fitContent()}
        >
          Вся история
        </button>
      </div>
      <SelectedMonthBlock row={shown} asOfDay={asOfDay} hovering={hovering} />
      <div ref={frameRef} className="stitch-chart-frame">
        <div ref={hostRef} className="stitch-chart-host" />
      </div>
    </>
  );
}

function HonestyNotes({ backtests, account, generatedAt }) {
  const row = backtestRowFor(backtests, account);
  const lines = [
    ...backtestHonestyLines(row, account),
    backtestSourceDisplay(row, account),
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
    const noTape = noTapeHonestyLine(account);
    if (noTape) {
      return (
        <section className="stitch-block">
          <h3 className="subhead">Бэктест и бумага</h3>
          <p className="updated stitch-meta">{noTape}</p>
          <p className="note">Склейки нет</p>
        </section>
      );
    }
    return (
      <section className="stitch-block">
        <h3 className="subhead">Бэктест и бумага</h3>
        <HonestyNotes backtests={backtests} account={account} generatedAt={generatedAt} />
        <p className="note">{stitchCaption(result)}</p>
      </section>
    );
  }

  const asOfDay = asOfDayFromGeneratedAt(generatedAt);
  const model = buildStitchedChartModel({
    monthly: result.monthly,
    yoy: result.yoy,
    asOfDay,
  });
  const smaReady = result.yoy.some((row) => row.sma36 != null);

  return (
    <section className="stitch-block">
      <h3 className="subhead">Бэктест и бумага, помесячно</h3>
      <HonestyNotes backtests={backtests} account={account} generatedAt={generatedAt} />
      <p className="note">
        Синяя линия — дневный бэктест до бумаги и бумажный трек после, без скачка на стыке{" "}
        {result.joinDay}. Оранжевая линия — тот же бумажный участок поверх. Фиолетовая верхняя —
        EMA100 по дневной эквити, на графике значение конца месяца.
      </p>
      {model.ok ? (
        <UnifiedStitchedChart
          key={`${account.bot_id}::${account.account_id}`}
          model={model}
          asOfDay={asOfDay}
          paperStart={result.paperStart}
        />
      ) : (
        <p className="note">{modelFailMessage(model.reason)}</p>
      )}
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
