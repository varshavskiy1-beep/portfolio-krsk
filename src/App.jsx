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

function seriesKey(a) {
  return `${a.bot_id}::${a.account_id}`;
}

/** SVG chart: money or % vs seed (or first point). */
function EquityChart({ points, seed, currency, mode }) {
  if (!points || points.length < 2) {
    return (
      <div className="empty-chart">
        {points?.length === 1
          ? "Пока одна точка — график появится после следующих снимков (раз в 5 мин)."
          : "История эквити появится, когда накопятся точки."}
      </div>
    );
  }

  const seedN = num(seed);
  const values = points.map((p) => {
    const eq = num(p.equity);
    if (eq == null) return null;
    if (mode === "pct") {
      const base = seedN && seedN !== 0 ? seedN : num(points[0].equity);
      if (base == null || base === 0) return null;
      return ((eq - base) / base) * 100;
    }
    return eq;
  });

  const valid = values.map((v, i) => ({ v, t: points[i].t, i })).filter((x) => x.v != null);
  if (valid.length < 2) {
    return <div className="empty-chart">Недостаточно точек для графика.</div>;
  }

  const W = 320;
  const H = 120;
  const pad = { t: 8, r: 8, b: 18, l: 8 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const minV = Math.min(...valid.map((x) => x.v));
  const maxV = Math.max(...valid.map((x) => x.v));
  const span = maxV - minV || 1;
  const xs = valid.map((_, idx) => pad.l + (innerW * idx) / (valid.length - 1));
  const ys = valid.map((x) => pad.t + innerH * (1 - (x.v - minV) / span));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const last = valid[valid.length - 1].v;
  const first = valid[0].v;
  const up = last >= first;
  const stroke = up ? "#1f7a4c" : "#a33";
  const lastLabel =
    mode === "pct"
      ? `${last >= 0 ? "+" : ""}${last.toFixed(2)}%`
      : `${fmt(last, currency)} ${currency || ""}`.trim();
  const t0 = valid[0].t?.slice(0, 10) || "";
  const t1 = valid[valid.length - 1].t?.slice(0, 10) || "";

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="график эквити">
        <line x1={pad.l} y1={pad.t + innerH} x2={W - pad.r} y2={pad.t + innerH} stroke="#e5e1d8" />
        {mode === "pct" && minV < 0 && maxV > 0 ? (
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + innerH * (1 - (0 - minV) / span)}
            y2={pad.t + innerH * (1 - (0 - minV) / span)}
            stroke="#ccc"
            strokeDasharray="3 3"
          />
        ) : null}
        <path d={d} fill="none" stroke={stroke} strokeWidth="2" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={stroke} />
        <text x={pad.l} y={H - 4} fontSize="10" fill="#666">
          {t0}
        </text>
        <text x={W - pad.r} y={H - 4} fontSize="10" fill="#666" textAnchor="end">
          {t1}
        </text>
      </svg>
      <div className={`chart-last ${up ? "pos" : "neg"}`}>{lastLabel}</div>
    </div>
  );
}

function AccountCard({ a, historyPoints }) {
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
          {delta != null
            ? `: ${delta >= 0 ? "+" : ""}${fmt(delta, a.currency)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`
            : ""}
        </div>
      ) : null}
      {a.updated_utc ? <div className="updated">обновлено {a.updated_utc}</div> : null}
      {a.note ? <p className="note">{a.note}</p> : null}

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

export default function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");

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

  const pointsFor = (a) => {
    if (Array.isArray(a.equity_curve) && a.equity_curve.length) return a.equity_curve;
    const k = seriesKey(a);
    return history?.series?.[k]?.points || [];
  };

  if (err) return <div className="wrap">Не удалось загрузить данные: {err}</div>;
  if (!data) return <div className="wrap">Загрузка…</div>;

  const snap = data.generated_at;
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
          снимок {snap} · только paper · валюты не складываются
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
              <AccountCard
                key={`${a.bot_id}-${a.account_id}`}
                a={a}
                historyPoints={pointsFor(a)}
              />
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
