import { useEffect, useMemo, useRef, useState } from "react";
import AccountBadges from "./AccountBadges.jsx";
import EquityChart from "./EquityChart.jsx";
import FeedStatus from "./FeedStatus.jsx";
import MayakDetails, { MayakFromStart } from "./MayakDetails.jsx";
import PositionsTable from "./PositionsTable.jsx";
import RateCycleDetails from "./RateCycleDetails.jsx";
import StrategyNotFound from "./StrategyNotFound.jsx";
import StrategyPage from "./StrategyPage.jsx";
import { canonicalCurrency } from "./cashCurrency.js";
import { initialChartMode, persistChartMode } from "./chartPrefs.js";
import { lastEquityValue, resolveChartBase, resolveEquityPoints } from "./equityChartModel.js";
import { LOAD_ERROR_RU, LIVE_FOOTER_LABEL, REFRESH_MS, RETRY_LABEL } from "./feedValidate.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";
import { cardUpdatedLine } from "./mayakCard.js";
import { isBlockedStrategyRoute, readPortalRoute } from "./portalRoute.js";
import {
  cnyMomDescription,
  cnyMomFromStartPctLine,
  hasCnyMomAccountLine,
} from "./cnyMomCard.js";
import {
  ethOkxDescription,
  ethOkxEquityLine,
  ethOkxFromStartPctLine,
  hasEthOkxAccountLine,
} from "./ethOkxCard.js";
import {
  chartMoneyLabel,
  fromStartPctLine,
  hasRateCycleAccountLine,
  rateCycleDescription,
} from "./rateCycleCard.js";
import {
  cardSubtitle,
  cardTitle,
  chipLabel,
  hasAccountData,
  hasBoxxCash,
  isCnyMomH360,
  isEthOkxMoex,
  isHistoryOnlyRubPaper,
  isMayak,
  isRfBondsRateCycle,
  mergePortalAccounts,
  portalExcluded,
  showsFreeCash,
  underTitleLabel,
} from "./strategyMeta.js";
import { displayNote, fromCapitalLine } from "./uiCopy.js";

const fmt = (n, currency) => {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: currency === "RUB" ? 0 : 2,
    }).format(n);
  } catch {
    return String(n);
  }
};

const num = (v) => (v == null || v === "" ? null : Number(v));

function readRoute() {
  return readPortalRoute();
}

function goStrategy(botId) {
  window.location.hash = `#/s/${encodeURIComponent(botId)}`;
}

function goHome() {
  window.location.hash = "";
}

function AccountCard({ a, historyPoints, backtests, onOpenStrategy }) {
  const [mode, setMode] = useState(initialChartMode);
  const currency = canonicalCurrency(a);
  const title = cardTitle(a);
  const subtitle = cardSubtitle(a);
  const idUnderTitle = underTitleLabel(a);
  const hasData = hasAccountData(a);
  const historyCard = isHistoryOnlyRubPaper(a);
  const showLine = isRfBondsRateCycle(a)
    ? hasRateCycleAccountLine(a)
    : isCnyMomH360(a)
      ? hasCnyMomAccountLine(a)
      : isEthOkxMoex(a)
        ? hasEthOkxAccountLine(a)
        : hasData;
  const equity = showLine ? lastEquityValue(a) : null;
  const seed = showLine ? num(a.seed) : null;
  const delta = equity != null && seed != null ? equity - seed : null;
  const pct = delta != null && seed ? (delta / seed) * 100 : null;
  const chartBase = showLine
    ? resolveChartBase(a, historyPoints, backtests)
    : { base: null, caption: null };
  const positions = hasData || historyCard ? a.positions || [] : [];
  const fromStart = isRfBondsRateCycle(a)
    ? fromStartPctLine(a)
    : isCnyMomH360(a)
      ? cnyMomFromStartPctLine(a)
      : isEthOkxMoex(a)
        ? ethOkxFromStartPctLine(a)
        : "";
  const noteText = isRfBondsRateCycle(a)
    ? rateCycleDescription(a)
    : isCnyMomH360(a)
      ? cnyMomDescription(a)
      : isEthOkxMoex(a)
        ? ethOkxDescription(a)
        : "";
  const limits = showLine ? a.pending_limits || [] : [];

  return (
    <article className="card">
      <div className="row">
        <button type="button" className="linkish" onClick={() => onOpenStrategy(a.bot_id)}>
          <strong>{title}</strong>
        </button>
        <AccountBadges account={a} currency={currency} />
      </div>
      {subtitle ? <div className="account-subtitle">{subtitle}</div> : null}
      <MayakDetails account={a} hasData={hasData} />
      {idUnderTitle ? <div className="bot-label">{idUnderTitle}</div> : null}
      {a.venue ? <div className="updated">{a.venue}</div> : null}
      <div className="equity">
        {!showLine
          ? "нет данных"
          : equity == null
            ? "нет переоценки"
            : historyCard
              ? isEthOkxMoex(a)
                ? ethOkxEquityLine(a)
                : `${fmt(equity, "RUB")} ₽`
              : `${fmt(equity, currency)} ${currency}`}
      </div>
      {showLine && seed != null && historyCard && fromStart ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>{fromStart}</div>
      ) : null}
      <RateCycleDetails account={a} historyPoints={historyPoints} />
      {showLine && seed != null && !isMayak(a) && !historyCard ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>
          {fromCapitalLine({ seed, currency, delta, pct })}
        </div>
      ) : null}
      {showLine && cardUpdatedLine(a) ? (
        <div className="updated">{cardUpdatedLine(a)}</div>
      ) : null}
      {showLine && hasBoxxCash(a) ? (
        <div className="updated">
          BOXX (кэш): {fmt(num(a.boxx_usd), currency)} {currency}
        </div>
      ) : null}
      {showLine && showsFreeCash(a) ? (
        <div className="updated">
          кэш: {fmt(num(a.cash), currency)} {currency}
        </div>
      ) : null}

      <div className="chart-toolbar">
        <button
          type="button"
          className={`chip tiny ${mode === "money" ? "active" : ""}`}
          onClick={() => {
            setMode("money");
            persistChartMode("money");
          }}
        >
          {chartMoneyLabel(a)}
        </button>
        <button
          type="button"
          className={`chip tiny ${mode === "pct" ? "active" : ""}`}
          onClick={() => {
            setMode("pct");
            persistChartMode("pct");
          }}
        >
          В %
        </button>
        <button type="button" className="chip tiny" onClick={() => onOpenStrategy(a.bot_id)}>
          Открыть →
        </button>
      </div>
      <EquityChart
        points={historyPoints}
        seed={chartBase.base}
        currency={currency}
        mode={mode}
        priceDigits={isEthOkxMoex(a) ? 2 : undefined}
        baseCaption={mode === "pct" ? chartBase.caption : null}
      />
      <MayakFromStart account={a} hasData={hasData} />

      <PositionsTable positions={positions} compact botId={a.bot_id} account={a} />

      {limits.length ? (
        <>
          <div className="updated" style={{ marginTop: 10 }}>
            Лимитки (ещё не позиция)
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Тикер</th>
                  <th>Лимит</th>
                  <th>Нотионал</th>
                </tr>
              </thead>
              <tbody>
                {limits.map((l) => (
                  <tr key={l.id}>
                    <td>{l.symbol}</td>
                    <td>{l.limit}</td>
                    <td>{l.notional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {historyCard && showLine ? (
        <p className="note">{noteText}</p>
      ) : hasData && a.note ? (
        <p className="note">{displayNote(a.note, a)}</p>
      ) : null}
    </article>
  );
}

function Home({ data, history, backtests, filter, setFilter, fetchedAt, loadError, onRetry }) {
  const accounts = useMemo(() => mergePortalAccounts(data.accounts || []), [data]);

  const bots = useMemo(() => {
    const ids = [];
    const seen = new Set();
    for (const a of accounts) {
      if (!seen.has(a.bot_id)) {
        seen.add(a.bot_id);
        ids.push(a.bot_id);
      }
    }
    return ids;
  }, [accounts]);

  const currencies = useMemo(() => [...new Set(accounts.map((a) => canonicalCurrency(a)))], [accounts]);

  const pointsFor = (a) => resolveEquityPoints(a, history);

  const visibleAccounts = useMemo(() => {
    if (filter === "all") return accounts;
    if (currencies.includes(filter)) {
      return accounts.filter((a) => canonicalCurrency(a) === filter);
    }
    return accounts.filter((a) => a.bot_id === filter);
  }, [accounts, filter, currencies]);

  const liveExcluded = portalExcluded(data.excluded || []);

  return (
    <div className="wrap">
      <header>
        <h1>portfolio_krsk — бумажные боты</h1>
        <FeedStatus
          generatedAt={data.generated_at}
          fetchedAt={fetchedAt}
          error={loadError}
          onRetry={onRetry}
        />
      </header>

      <div className="chips">
        <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          Все
        </button>
        {bots.map((id) => (
          <button
            key={id}
            className={`chip ${filter === id ? "active" : ""}`}
            onClick={() => goStrategy(id)}
            title="Открыть страницу стратегии"
          >
            {chipLabel(id)}
          </button>
        ))}
        {currencies.map((c) => (
          <button key={c} className={`chip ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid">
        {visibleAccounts.map((a) => (
          <AccountCard
            key={`${a.bot_id}-${a.account_id}`}
            a={a}
            historyPoints={pointsFor(a)}
            backtests={backtests}
            onOpenStrategy={goStrategy}
          />
        ))}
      </div>

      <footer className="foot">
        {LIVE_FOOTER_LABEL}: {liveExcluded.map((e) => e.id).join(", ") || "—"}. Это кабинет бумажных
        счетов, не торговые рекомендации. Нажмите карточку — откроется подробная страница стратегии.
      </footer>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [backtests, setBacktests] = useState(null);
  const [err, setErr] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [filter, setFilter] = useState("all");
  const [route, setRoute] = useState(readRoute);
  const loadRef = useRef(() => {});

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    let cancelled = false;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      const { signal } = ctrl;
      fetchCabinetSnapshot(base, { signal })
        .then((snap) => {
          if (cancelled || signal.aborted) return;
          if (snap.ok) {
            setData(snap.latest);
            setHistory(snap.history);
            setBacktests(snap.backtests);
            setFetchedAt(snap.fetchedAt);
            setErr(false);
            return;
          }
          console.warn("snapshot rejected", snap.reason);
          setErr(true);
        })
        .catch((e) => {
          if (cancelled || e?.name === "AbortError") return;
          console.warn("snapshot fetch failed", e);
          setErr(true);
        });
    };
    loadRef.current = load;
    load();
    const id = window.setInterval(load, REFRESH_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      ctrl?.abort();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const onRetry = () => loadRef.current();

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (isBlockedStrategyRoute(route)) {
    return <StrategyNotFound onBack={goHome} />;
  }
  if (!data) {
    return (
      <div className="wrap">
        {err ? (
          <>
            <p>{LOAD_ERROR_RU}</p>
            <button type="button" className="chip" onClick={onRetry}>
              {RETRY_LABEL}
            </button>
          </>
        ) : (
          "Загрузка…"
        )}
      </div>
    );
  }

  if (route.name === "strategy") {
    return (
      <StrategyPage
        botId={route.botId}
        data={data}
        history={history}
        backtests={backtests}
        fetchedAt={fetchedAt}
        loadError={err}
        onRetry={onRetry}
        onBack={goHome}
      />
    );
  }

  return (
    <Home
      data={data}
      history={history}
      backtests={backtests}
      filter={filter}
      setFilter={setFilter}
      fetchedAt={fetchedAt}
      loadError={err}
      onRetry={onRetry}
    />
  );
}
