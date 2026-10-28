import { useEffect, useMemo, useRef, useState } from "react";
import AccountBadges from "./AccountBadges.jsx";
import EquityChart from "./EquityChart.jsx";
import FeedStatus from "./FeedStatus.jsx";
import MayakDetails, { MayakFromStart } from "./MayakDetails.jsx";
import ModeSwitch from "./ModeSwitch.jsx";
import PositionsTable from "./PositionsTable.jsx";
import RateCycleDetails from "./RateCycleDetails.jsx";
import StrategyNotFound from "./StrategyNotFound.jsx";
import StrategyPage from "./StrategyPage.jsx";
import { canonicalCurrency } from "./cashCurrency.js";
import { initialChartMode, persistChartMode } from "./chartPrefs.js";
import { lastEquityValue, resolveChartBase, resolveEquityPoints } from "./equityChartModel.js";
import { LOAD_ERROR_RU, LIVE_FOOTER_LABEL, REFRESH_MS, RETRY_LABEL } from "./feedValidate.js";
import { liveEquityDisplay, resolveLiveEquityPoints } from "./liveEquity.js";
import {
  LIVE_FEED_EMPTY_RU,
  LIVE_LOAD_ERROR_RU,
  LIVE_NOT_CONFIGURED_RU,
  LIVE_NO_TWR_RU,
  formatLiveDateTime,
} from "./liveFeedValidate.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";
import { loadLiveMode, readLiveDataBase } from "./loadLiveFeed.js";
import { cardUpdatedLine } from "./mayakCard.js";
import {
  createModeLoadGate,
  emptyFilters,
  emptyModeBucket,
  portalDocumentTitle,
} from "./portalMode.js";
import {
  catalogCurrencies,
  filterPortalAccounts,
  modeSummaryCounts,
} from "./portalFilters.js";
import {
  canonicalizePortalRoute,
  homeHash,
  isBlockedStrategyRoute,
  readPortalRoute,
  strategyHash,
} from "./portalRoute.js";
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
import {
  ALL_CURRENCIES_RU,
  CURRENCY_LABEL_RU,
  LIVE_FOOTER_RISK_RU,
  LIVE_HEADING_RU as LIVE_H,
  LIVE_MODE_HINT_RU,
  PAGE_NOT_FOUND_RU,
  PAPER_HEADING_RU as PAPER_H,
  PAPER_MODE_HINT_RU,
  PORTAL_KICKER_RU,
  PORTAL_TITLE_RU,
  RESET_FILTERS_RU,
  SEARCH_EMPTY_RU,
  SEARCH_LABEL_RU,
  SEARCH_PLACEHOLDER_RU,
  displayNote,
  formatMoneyRu,
  fromCapitalLine,
} from "./uiCopy.js";

const fmt = (n, currency) => formatMoneyRu(n, currency);

const num = (v) => (v == null || v === "" ? null : Number(v));

function readRoute() {
  return canonicalizePortalRoute(readPortalRoute(), window.history, window.location);
}

function goStrategy(mode, botId) {
  window.location.hash = strategyHash(mode, botId);
}

function goHome(mode) {
  window.location.hash = homeHash(mode);
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
        <a className="linkish" href={strategyHash("paper", a.bot_id)}>
          <strong>{title}</strong>
        </a>
        <AccountBadges account={a} currency={currency} mode="paper" />
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
        <a className="chip tiny" href={strategyHash("paper", a.bot_id)}>
          Открыть →
        </a>
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

function LiveAccountCard({ a, historyPoints }) {
  const display = liveEquityDisplay(a);
  const showChart = display.kind === "value" && historyPoints.length > 0;
  const updated = a.updated_utc ? formatLiveDateTime(a.updated_utc) : "";

  return (
    <article className="card">
      <div className="row">
        <a className="linkish" href={strategyHash("live", a.bot_id)}>
          <strong>{a.title}</strong>
        </a>
        <AccountBadges account={a} currency={a.currency} mode="live" />
      </div>
      {a.venue ? <div className="updated">{a.venue}</div> : null}
      <div className="equity">
        {display.kind === "value"
          ? `${fmt(display.value, a.currency)} ${a.currency}`
          : display.text}
      </div>
      {updated ? <div className="updated">{updated}</div> : null}
      <p className="note">{LIVE_NO_TWR_RU}</p>
      <div className="chart-toolbar">
        <a className="chip tiny" href={strategyHash("live", a.bot_id)}>
          Открыть →
        </a>
      </div>
      {showChart ? (
        <EquityChart points={historyPoints} seed={null} currency={a.currency} mode="money" />
      ) : (
        <div className="empty-chart">{display.text || "Нет данных о стоимости счёта"}</div>
      )}
    </article>
  );
}

function PortalHeader({ mode }) {
  return (
    <header className="portal-header">
      <h1 className="portal-title">{PORTAL_TITLE_RU}</h1>
      <p className="portal-kicker">{PORTAL_KICKER_RU}</p>
      <ModeSwitch mode={mode} />
    </header>
  );
}

function ModeIntro({ mode }) {
  const live = mode === "live";
  return (
    <div className="mode-intro">
      <h2 className="mode-heading">{live ? LIVE_H : PAPER_H}</h2>
      <p className="mode-hint">{live ? LIVE_MODE_HINT_RU : PAPER_MODE_HINT_RU}</p>
    </div>
  );
}

function CatalogFilters({ query, currency, currencies, onQuery, onCurrency }) {
  return (
    <div className="catalog-filters">
      <label className="filter-field">
        <span className="visually-hidden">{SEARCH_LABEL_RU}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER_RU}
          aria-label={SEARCH_LABEL_RU}
        />
      </label>
      <label className="filter-field filter-currency">
        <span className="visually-hidden">{CURRENCY_LABEL_RU}</span>
        <select value={currency} onChange={(e) => onCurrency(e.target.value)} aria-label={CURRENCY_LABEL_RU}>
          <option value="all">{ALL_CURRENCIES_RU}</option>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function formatPaperSnapshot(generatedAt) {
  if (!generatedAt) return "—";
  return String(generatedAt);
}

function Home({
  mode,
  data,
  history,
  backtests,
  filters,
  setFilters,
  fetchedAt,
  loadError,
  onRetry,
  configured = true,
  sourceHost = "",
  nowMs,
}) {
  const isLive = mode === "live";
  const accounts = useMemo(() => {
    if (isLive) return data?.accounts || [];
    return mergePortalAccounts(data?.accounts || []);
  }, [data, isLive]);

  const accessors = useMemo(
    () => ({
      titleOf: (a) => (isLive ? a.title || a.bot_id : cardTitle(a)),
      currencyOf: (a) => (isLive ? a.currency : canonicalCurrency(a)),
    }),
    [isLive],
  );

  const counts = useMemo(() => modeSummaryCounts(accounts), [accounts]);
  const currencies = useMemo(
    () => catalogCurrencies(accounts, accessors.currencyOf),
    [accounts, accessors],
  );
  const visibleAccounts = useMemo(
    () => filterPortalAccounts(accounts, filters, accessors),
    [accounts, filters, accessors],
  );
  const filterActive = Boolean(filters.query.trim()) || (filters.currency && filters.currency !== "all");
  const snapshotLabel = isLive
    ? data?.generated_at
      ? formatLiveDateTime(data.generated_at)
      : "—"
    : formatPaperSnapshot(data?.generated_at);

  const pointsFor = (a) =>
    isLive ? resolveLiveEquityPoints(a, history) : resolveEquityPoints(a, history);

  const liveExcluded = isLive ? [] : portalExcluded(data?.excluded || []);

  return (
    <div className="wrap">
      <PortalHeader mode={mode} />
      <ModeIntro mode={mode} />
      {isLive && !configured ? (
        <p className="empty-state">{LIVE_NOT_CONFIGURED_RU}</p>
      ) : (
        <>
      <p className="mode-summary">
        Стратегий: {counts.bots} · Счетов: {counts.accounts} · Данные на: {snapshotLabel}
        {filterActive ? ` · Показано ${visibleAccounts.length} из ${counts.accounts} счетов` : ""}
      </p>
      <FeedStatus
        mode={mode}
        generatedAt={data?.generated_at}
        fetchedAt={fetchedAt}
        error={loadError}
        onRetry={onRetry}
        sourceHost={sourceHost}
        nowMs={nowMs}
      />
      <CatalogFilters
        query={filters.query}
        currency={filters.currency}
        currencies={currencies}
        onQuery={(query) => setFilters((f) => ({ ...f, query }))}
        onCurrency={(currency) => setFilters((f) => ({ ...f, currency }))}
      />
        </>
      )}

      {isLive && !configured ? null : isLive && configured && !loadError && accounts.length === 0 ? (
        <p className="empty-state">{LIVE_FEED_EMPTY_RU}</p>
      ) : visibleAccounts.length === 0 ? (
        <div className="empty-state">
          <p>{SEARCH_EMPTY_RU}</p>
          <button type="button" className="chip" onClick={() => setFilters(emptyFilters())}>
            {RESET_FILTERS_RU}
          </button>
        </div>
      ) : (
        <div className="grid">
          {visibleAccounts.map((a) =>
            isLive ? (
              <LiveAccountCard
                key={`${a.bot_id}-${a.account_id}`}
                a={a}
                historyPoints={pointsFor(a)}
              />
            ) : (
              <AccountCard
                key={`${a.bot_id}-${a.account_id}`}
                a={a}
                historyPoints={pointsFor(a)}
                backtests={backtests}
                onOpenStrategy={(id) => goStrategy("paper", id)}
              />
            ),
          )}
        </div>
      )}

      <footer className="foot">
        {isLive ? (
          LIVE_FOOTER_RISK_RU
        ) : (
          <>
            {LIVE_FOOTER_LABEL}: {liveExcluded.map((e) => e.id).join(", ") || "—"}. Это кабинет бумажных
            счетов, не торговые рекомендации. Нажмите карточку — откроется подробная страница стратегии.
          </>
        )}
      </footer>
    </div>
  );
}

function PageNotFound({ mode }) {
  return (
    <div className="wrap">
      <PortalHeader mode={mode} />
      <p>{PAGE_NOT_FOUND_RU}</p>
      <a className="chip" href={homeHash(mode)}>
        На главную
      </a>
    </div>
  );
}

export default function App() {
  const [paper, setPaper] = useState(() => emptyModeBucket("paper"));
  const [live, setLive] = useState(() => emptyModeBucket("live"));
  const [liveMeta, setLiveMeta] = useState(() => ({
    configured: readLiveDataBase().configured,
    host: "",
  }));
  const [filters, setFilters] = useState(emptyFilters);
  const [route, setRoute] = useState(readRoute);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const loadRef = useRef(() => {});
  const modeRef = useRef(route.mode);
  const gateRef = useRef(createModeLoadGate());

  useEffect(() => {
    if (modeRef.current !== route.mode) {
      setFilters(emptyFilters());
      modeRef.current = route.mode;
    }
  }, [route.mode]);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (route.name !== "strategy") {
      document.title = portalDocumentTitle(route.mode);
      return;
    }
    if (route.mode === "live") {
      const acc = (live.data?.accounts || []).find((a) => a.bot_id === route.botId);
      document.title = portalDocumentTitle("live", acc?.title || route.botId);
      return;
    }
    document.title = portalDocumentTitle("paper", chipLabel(route.botId));
  }, [route, live.data]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    let cancelled = false;
    let ctrl = null;
    const mode = route.mode;

    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      const { signal } = ctrl;
      const ticket = gateRef.current.begin(mode);

      if (mode === "paper") {
        setPaper((s) => ({ ...s, loading: true }));
        fetchCabinetSnapshot(base, { signal })
          .then((snap) => {
            if (cancelled || !ticket.accept("paper", { aborted: signal.aborted })) return;
            if (snap.ok) {
              setPaper({
                mode: "paper",
                data: snap.latest,
                history: snap.history,
                backtests: snap.backtests,
                fetchedAt: snap.fetchedAt,
                error: false,
                errorReason: null,
                loading: false,
              });
              return;
            }
            console.warn("snapshot rejected", snap.reason);
            setPaper((s) => ({ ...s, error: true, errorReason: snap.reason, loading: false }));
          })
          .catch((e) => {
            if (cancelled || e?.name === "AbortError" || !ticket.accept("paper", { aborted: true })) {
              return;
            }
            console.warn("snapshot fetch failed", e);
            setPaper((s) => ({ ...s, error: true, errorReason: "fetch", loading: false }));
          });
        return;
      }

      const cfg = readLiveDataBase();
      setLiveMeta({ configured: cfg.configured, host: cfg.host || "" });
      if (!cfg.configured) {
        setLive((s) => ({ ...s, loading: false, error: false, errorReason: null }));
        return;
      }
      if (cfg.ok === false) {
        setLive((s) => ({
          ...s,
          loading: false,
          error: true,
          errorReason: cfg.reason,
        }));
        return;
      }
      setLive((s) => ({ ...s, loading: true }));
      loadLiveMode(cfg.base, { signal })
        .then((snap) => {
          if (cancelled || !ticket.accept("live", { aborted: signal.aborted })) return;
          if (snap.ok && snap.configured) {
            setLive({
              mode: "live",
              data: snap.latest,
              history: snap.history,
              backtests: undefined,
              fetchedAt: snap.fetchedAt,
              error: false,
              errorReason: null,
              loading: false,
            });
            setLiveMeta({ configured: true, host: snap.host || cfg.host || "" });
            return;
          }
          if (snap.ok && !snap.configured) {
            setLive((s) => ({ ...s, loading: false, error: false }));
            return;
          }
          console.warn("live snapshot rejected", snap.reason);
          setLive((s) => ({ ...s, error: true, errorReason: snap.reason, loading: false }));
        })
        .catch((e) => {
          if (cancelled || e?.name === "AbortError" || !ticket.accept("live", { aborted: true })) {
            return;
          }
          console.warn("live snapshot fetch failed", e);
          setLive((s) => ({ ...s, error: true, errorReason: "fetch", loading: false }));
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
      gateRef.current.invalidate();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [route.mode]);

  const onRetry = () => loadRef.current();
  const mode = route.mode === "live" ? "live" : "paper";
  const bucket = mode === "live" ? live : paper;

  if (route.name === "notFound") {
    return <PageNotFound mode={mode} />;
  }
  if (isBlockedStrategyRoute(route)) {
    return <StrategyNotFound onBack={() => goHome("paper")} mode="paper" />;
  }

  if (mode === "live" && !liveMeta.configured) {
    if (route.name === "strategy") {
      return <StrategyNotFound onBack={() => goHome("live")} mode="live" />;
    }
    return (
      <Home
        mode="live"
        data={null}
        history={null}
        backtests={null}
        filters={filters}
        setFilters={setFilters}
        fetchedAt={null}
        loadError={false}
        onRetry={onRetry}
        configured={false}
        nowMs={nowMs}
      />
    );
  }

  if (!bucket.data) {
    return (
      <div className="wrap">
        <PortalHeader mode={mode} />
        <ModeIntro mode={mode} />
        {bucket.error ? (
          <>
            <p>{mode === "live" ? LIVE_LOAD_ERROR_RU : LOAD_ERROR_RU}</p>
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
        mode={mode}
        data={bucket.data}
        history={bucket.history}
        backtests={bucket.backtests}
        fetchedAt={bucket.fetchedAt}
        loadError={bucket.error}
        onRetry={onRetry}
        onBack={() => goHome(mode)}
        sourceHost={liveMeta.host}
        nowMs={nowMs}
      />
    );
  }

  return (
    <Home
      mode={mode}
      data={bucket.data}
      history={bucket.history}
      backtests={bucket.backtests}
      filters={filters}
      setFilters={setFilters}
      fetchedAt={bucket.fetchedAt}
      loadError={bucket.error}
      onRetry={onRetry}
      configured={mode === "live" ? liveMeta.configured : true}
      sourceHost={liveMeta.host}
      nowMs={nowMs}
    />
  );
}
