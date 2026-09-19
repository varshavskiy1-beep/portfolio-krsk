import { useEffect, useMemo, useState } from "react";

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

function AccountCard({ a }) {
  const equity = num(a.equity);
  const seed = num(a.seed);
  const delta = equity != null && seed != null ? equity - seed : null;
  const pct = delta != null && seed ? (delta / seed) * 100 : null;
  const positions = a.positions || [];
  const limits = a.pending_limits || [];

  return (
    <article className="card">
      <div className="row">
        <strong>{a.account_id}</strong>
        <span className="badge">{a.currency}</span>
      </div>
      {a.venue ? <div className="updated">{a.venue}</div> : null}
      <div className="equity">
        {equity == null ? "нет переоценки" : `${fmt(equity, a.currency)} ${a.currency}`}
      </div>
      {seed != null ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>
          от seed {fmt(seed, a.currency)}
          {delta != null ? `: ${delta >= 0 ? "+" : ""}${fmt(delta, a.currency)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : ""}
        </div>
      ) : null}
      {a.updated_utc ? <div className="updated">обновлено {a.updated_utc}</div> : null}
      {a.note ? <p className="note">{a.note}</p> : null}

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

      <div className="empty-chart">История эквити появится, когда в фиде будут ряды точек.</div>
    </article>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/data/latest.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  const bots = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const a of data.accounts || []) {
      if (!map.has(a.bot_id)) map.set(a.bot_id, []);
      map.get(a.bot_id).push(a);
    }
    return [...map.entries()];
  }, [data]);

  const currencies = useMemo(() => {
    if (!data) return [];
    return [...new Set((data.accounts || []).map((a) => a.currency))];
  }, [data]);

  const logic = (botId) =>
    (data?.manifest || []).find((m) => m.bot_id === botId)?.logic ||
    "Описание логики уточняется.";

  if (err) return <div className="wrap">Не удалось загрузить данные: {err}</div>;
  if (!data) return <div className="wrap">Загрузка…</div>;

  const visibleBots = bots
    .map(([botId, accounts]) => [
      botId,
      filter === "all" || filter === botId || currencies.includes(filter)
        ? accounts.filter((a) => filter === "all" || filter === botId || a.currency === filter)
        : accounts,
    ])
    .filter(([, accounts]) => accounts.length);

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
        {bots.map(([id]) => (
          <button key={id} className={`chip ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
            {id}
          </button>
        ))}
        {currencies.map((c) => (
          <button key={c} className={`chip ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      {visibleBots.map(([botId, accounts]) => (
        <section className="bot" key={botId}>
          <h2>{botId}</h2>
          <p className="logic">{logic(botId)}</p>
          <div className="grid">
            {accounts.map((a) => (
              <AccountCard key={`${a.bot_id}-${a.account_id}`} a={a} />
            ))}
          </div>
        </section>
      ))}

      <footer className="foot">
        Не на сайте (live): {(data.excluded || []).map((e) => e.id).join(", ") || "—"}. Это кабинет бумажных
        счетов, не торговые рекомендации.
      </footer>
    </div>
  );
}
