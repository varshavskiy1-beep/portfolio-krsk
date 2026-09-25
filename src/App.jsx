import { useEffect, useMemo, useState } from "react";
import AccountBadges from "./AccountBadges.jsx";
import EquityChart from "./EquityChart.jsx";
import PositionsTable from "./PositionsTable.jsx";
import StrategyPage from "./StrategyPage.jsx";
import { canonicalCurrency, normalizeHistory, normalizeLatest } from "./cashCurrency.js";
import { lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import {
  cardSubtitle,
  cardTitle,
  chipLabel,
  formatUpdatedLine,
  hasAccountData,
  hasBoxxCash,
  mergePortalAccounts,
  portalExcluded,
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
  const h = (window.location.hash || "").replace(/^#/, "");
  const m = h.match(/^\/?s\/([^/]+)\/?$/);
  return m ? { name: "strategy", botId: decodeURIComponent(m[1]) } : { name: "home" };
}

function goStrategy(botId) {
  window.location.hash = `#/s/${encodeURIComponent(botId)}`;
}

function goHome() {
  window.location.hash = "";
}

function AccountCard({ a, historyPoints, onOpenStrategy }) {
  const [mode, setMode] = useState("money");
  const currency = canonicalCurrency(a);
  const title =
    a.bot_id === "oac_paper" || a.account_id === "oac_paper"
      ? "Ядро внимания"
      : cardTitle(a);
  const subtitle = cardSubtitle(a);
  const idUnderTitle = underTitleLabel(a);
  const hasData = hasAccountData(a);
  const equity = hasData ? lastEquityValue(a) : null;
  const seed = hasData ? num(a.seed) : null;
  const delta = equity != null && seed != null ? equity - seed : null;
  const pct = delta != null && seed ? (delta / seed) * 100 : null;
  const positions = hasData ? a.positions || [] : [];
  const limits = hasData ? a.pending_limits || [] : [];

  return (
    <article className="card">
      <div className="row">
        <button type="button" className="linkish" onClick={() => onOpenStrategy(a.bot_id)}>
          <strong>{title}</strong>
        </button>
        <AccountBadges account={a} currency={currency} />
      </div>
      {subtitle ? <div className="account-subtitle">{subtitle}</div> : null}
      {idUnderTitle ? <div className="bot-label">{idUnderTitle}</div> : null}
      {a.venue ? <div className="updated">{a.venue}</div> : null}
      <div className="equity">
        {!hasData
          ? "нет данных"
          : equity == null
            ? "нет переоценки"
            : `${fmt(equity, currency)} ${currency}`}
      </div>
      {hasData && seed != null ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>
          {fromCapitalLine({ seed, currency, delta, pct })}
        </div>
      ) : null}
      {hasData && formatUpdatedLine(a) ? (
        <div className="updated">{formatUpdatedLine(a)}</div>
      ) : null}
      {hasData && hasBoxxCash(a) ? (
        <div className="updated">
          BOXX (кэш): {fmt(num(a.boxx_usd), currency)} {currency}
        </div>
      ) : null}

      <div className="chart-toolbar">
        <button
          type="button"
          className={`chip tiny ${mode === "money" ? "active" : ""}`}
          onClick={() => setMode("money")}
        >
          В деньгах
        </button>
        <button
          type="button"
          className={`chip tiny ${mode === "pct" ? "active" : ""}`}
          onClick={() => setMode("pct")}
        >
          В %
        </button>
        <button type="button" className="chip tiny" onClick={() => onOpenStrategy(a.bot_id)}>
          Открыть →
        </button>
      </div>
      <EquityChart points={historyPoints} seed={seed} currency={currency} mode={mode} />

      <PositionsTable positions={positions} compact botId={a.bot_id} />

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
      {hasData && a.note ? <p className="note">{displayNote(a.note, a)}</p> : null}
    </article>
  );
}

function Home({ data, history, filter, setFilter }) {
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
        <div className="meta">
          снимок {data.generated_at} · только paper · валюты не складываются
        </div>
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
            onOpenStrategy={goStrategy}
          />
        ))}
      </div>

      <footer className="foot">
        Не на сайте (live): {liveExcluded.map((e) => e.id).join(", ") || "—"}. Это кабинет бумажных
        счетов, не торговые рекомендации. Нажмите карточку — откроется подробная страница стратегии.
      </footer>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/latest.json`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`${base}data/history.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([latest, hist]) => {
        setData(normalizeLatest(latest));
        setHistory(normalizeHistory(hist));
      })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (err) return <div className="wrap">Не удалось загрузить данные: {err}</div>;
  if (!data) return <div className="wrap">Загрузка…</div>;

  if (route.name === "strategy") {
    return (
      <StrategyPage
        botId={route.botId}
        data={data}
        history={history}
        onBack={goHome}
      />
    );
  }

  return <Home data={data} history={history} filter={filter} setFilter={setFilter} />;
}
