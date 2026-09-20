import { useEffect, useMemo, useState } from "react";
import EquityChart from "./EquityChart.jsx";
import { plainExplain } from "./plainExplain.js";

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

function PositionsTable({ positions }) {
  if (!positions?.length) {
    return <p className="muted">Открытых позиций сейчас нет.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Инструмент</th>
          <th>Сторона</th>
          <th>Кол-во</th>
          <th>Цена входа</th>
          <th>Стоп</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => (
          <tr key={p.position_id || `${p.symbol}-${i}`}>
            <td>{p.symbol}</td>
            <td>{p.side === "long" ? "лонг" : p.side === "short" ? "шорт" : p.side}</td>
            <td>{p.qty}</td>
            <td>{p.avg_px ?? "—"}</td>
            <td>{p.stop_px ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LimitsTable({ limits }) {
  if (!limits?.length) return null;
  return (
    <>
      <h3 className="subhead">Лимитки (ещё не позиция)</h3>
      <table>
        <thead>
          <tr>
            <th>Тикер</th>
            <th>Цена лимита</th>
            <th>Нотионал</th>
          </tr>
        </thead>
        <tbody>
          {limits.map((l) => (
            <tr key={l.id || l.symbol}>
              <td>{l.symbol}</td>
              <td>{l.limit}</td>
              <td>{l.notional}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function AccountBlock({ a, points }) {
  const [mode, setMode] = useState("money");
  const [fs, setFs] = useState(false);
  const equity = num(a.equity);
  const seed = num(a.seed);
  const delta = equity != null && seed != null ? equity - seed : null;
  const pct = delta != null && seed ? (delta / seed) * 100 : null;

  useEffect(() => {
    if (!fs) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setFs(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [fs]);

  return (
    <section className="card strategy-account">
      <div className="row">
        <strong>{a.account_id}</strong>
        <span className="badge">{a.currency}</span>
      </div>
      <div className="equity">
        {equity == null ? "нет переоценки" : `${fmt(equity, a.currency)} ${a.currency}`}
      </div>
      {seed != null && delta != null ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>
          от seed {fmt(seed, a.currency)}: {delta >= 0 ? "+" : ""}
          {fmt(delta, a.currency)} ({pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%)
        </div>
      ) : null}
      {a.updated_utc ? <div className="updated">обновлено {a.updated_utc}</div> : null}

      <h3 className="subhead">График эквити</h3>
      <div className={`chart-panel ${fs ? "chart-panel-fs" : ""}`}>
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
          <button type="button" className="chip tiny accent" onClick={() => setFs((v) => !v)}>
            {fs ? "Свернуть" : "На весь экран"}
          </button>
          {fs ? <span className="chart-hint">Esc — закрыть</span> : null}
        </div>
        <EquityChart
          key={fs ? "fs" : "norm"}
          points={points}
          seed={seed}
          currency={a.currency}
          mode={mode}
          fill={fs}
          height={280}
        />
      </div>

      <h3 className="subhead">Открытые позиции</h3>
      <PositionsTable positions={a.positions || []} />
      <LimitsTable limits={a.pending_limits || []} />
      {a.note ? <p className="note">{a.note}</p> : null}
    </section>
  );
}

export default function StrategyPage({ botId, data, history, onBack }) {
  const accounts = useMemo(
    () => (data?.accounts || []).filter((a) => a.bot_id === botId),
    [data, botId],
  );
  const logic =
    (data?.manifest || []).find((m) => m.bot_id === botId)?.logic || "";
  const plain = plainExplain(botId, logic);

  const pointsFor = (a) => {
    if (Array.isArray(a.equity_curve) && a.equity_curve.length) return a.equity_curve;
    const k = seriesKey(a);
    return history?.series?.[k]?.points || [];
  };

  if (!accounts.length) {
    return (
      <div className="wrap">
        <button type="button" className="chip" onClick={onBack}>
          ← Назад
        </button>
        <p>Стратегия «{botId}» не найдена в снимке.</p>
      </div>
    );
  }

  return (
    <div className="wrap strategy-page">
      <button type="button" className="chip back-chip" onClick={onBack}>
        ← Все стратегии
      </button>
      <header>
        <h1>{botId}</h1>
        <p className="strategy-title">{plain.title}</p>
        <div className="meta">снимок {data.generated_at} · только paper</div>
      </header>

      <section className="card explain-card">
        <h2 className="subhead">Как это работает простыми словами</h2>
        <p className="explain-summary">{plain.summary}</p>
        <ol className="explain-list">
          {plain.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        {logic ? (
          <details className="tech-details">
            <summary>Техническая формулировка</summary>
            <p>{logic}</p>
          </details>
        ) : null}
        <p className="risk-note">{plain.risk}</p>
      </section>

      {accounts.map((a) => (
        <AccountBlock key={`${a.bot_id}-${a.account_id}`} a={a} points={pointsFor(a)} />
      ))}
    </div>
  );
}
