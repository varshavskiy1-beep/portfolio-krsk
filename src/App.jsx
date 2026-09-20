import { useEffect, useMemo, useState } from "react";
import EquityChart from "./EquityChart.jsx";
import StrategyPage from "./StrategyPage.jsx";

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

function seriesKey(a) {
  return `${a.bot_id}::${a.account_id}`;
}

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
  const equity = num(a.equity);
  const seed = num(a.seed);
  const delta = equity != null && seed != null ? equity - seed : null;
  const pct = delta != null && seed ? (delta / seed) * 100 : null;
  const positions = a.positions || [];
  const limits = a.pending_limits || [];
  const curve = a.equity_curve || historyPoints || [];

  return (
    <article className="card">
      <div className="row">
        <button type="button" className="linkish" onClick={() => onOpenStrategy(a.bot_id)}>
          <strong>{a.account_id}</strong>
        </button>
        <span className="badge">{a.currency}</span>
      </div>
      {a.bot_id && a.bot_id !== a.account_id ? <div className="bot-label">{a.bot_id}</div> : null}
      {a.venue ? <div className="updated">{a.venue}</div> : null}
      <div className="equity">
        {equity == null ? "нет переоценки" : `${fmt(equity, a.currency)} ${a.currency}`}
      </div>
      {seed != null ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>
          от seed {fmt(seed, a.currency)}
          {delta != null
            ? `: ${delta >= 0 ? "+" : ""}${fmt(delta, a.currency)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`
            : ""}
        </div>
      ) : null}
      {a.updated_utc ? <div className="updated">обновлено {a.updated_utc}</div> : null}

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
      <EquityChart points={curve} seed={seed} currency={a.currency} mode={mode} />

      {positions.length ? (
        <table>
          <thead>
            <tr>
              <th>Позиция</th>
              <th>Сторона</th>
              <th>Кол-во</th>
              <th>Цена</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={p.position_id || p.symbol || i}>
                <td>{p.symbol}</td>
                <td>{p.side}</td>
                <td>{p.qty}</td>
                <td>{p.avg_px ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {limits.length ? (
        <>
          <div className="updated" style={{ marginTop: 10 }}>
            Лимитки (ещё не позиция)
          </div>
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
        </>
      ) : null}
    </article>
  );
}

function Home({ data, history, filter, setFilter }) {
  const bots = useMemo(() => {
    const ids = [];
    const seen = new Set();
    for (const a of data.accounts || []) {
      if (!seen.has(a.bot_id)) {
        seen.add(a.bot_id);
        ids.push(a.bot_id);
      }
    }
    return ids;
  }, [data]);

  const currencies = useMemo(
    () => [...new Set((data.accounts || []).map((a) => a.currency))],
    [data],
  );

  const pointsFor = (a) => {
    if (Array.isArray(a.equity_curve) && a.equity_curve.length) return a.equity_curve;
    return history?.series?.[seriesKey(a)]?.points || [];
  };

  const visibleAccounts = useMemo(() => {
    const accounts = data.accounts || [];
    if (filter === "all") return accounts;
    if (currencies.includes(filter)) return accounts.filter((a) => a.currency === filter);
    return accounts.filter((a) => a.bot_id === filter);
  }, [data, filter, currencies]);

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
            {id}
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
        Не на сайте (live): {(data.excluded || []).map((e) => e.id).join(", ") || "—"}. Это кабинет бумажных
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
        setData(latest);
        setHistory(hist);
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
