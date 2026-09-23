import { useEffect, useMemo, useState } from "react";
import EquityChart from "./EquityChart.jsx";
import PositionsTable from "./PositionsTable.jsx";
import { canonicalCurrency } from "./cashCurrency.js";
import { lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import { plainExplain } from "./plainExplain.js";
import {
  chipLabel,
  displayTitle,
  hasAccountData,
  isKnownPortalBot,
  mergePortalAccounts,
  showsPaperBadge,
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

function LimitsTable({ limits }) {
  if (!limits?.length) return null;
  return (
    <>
      <h3 className="subhead">Лимитки (ещё не позиция)</h3>
      <div className="table-scroll">
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
      </div>
    </>
  );
}

function AccountBlock({ a, points }) {
  const [mode, setMode] = useState("money");
  const [fs, setFs] = useState(false);
  const currency = canonicalCurrency(a);
  const title = displayTitle(a);
  const paper = showsPaperBadge(a);
  const hasData = hasAccountData(a);
  const equity = hasData ? lastEquityValue(a) : null;
  const seed = hasData ? num(a.seed) : null;
  const delta = equity != null && seed != null ? equity - seed : null;
  const pct = delta != null && seed ? (delta / seed) * 100 : null;

  useEffect(() => {
    if (!fs) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setFs(false);
    };
    const y = window.scrollY;
    const root = document.documentElement;
    root.classList.add("chart-fs-open");
    document.body.classList.add("chart-fs-open");
    document.body.style.top = `-${y}px`;
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("chart-fs-open");
      document.body.classList.remove("chart-fs-open");
      document.body.style.top = "";
      window.removeEventListener("keydown", onKey);
      window.scrollTo(0, y);
    };
  }, [fs]);

  return (
    <section className="card strategy-account">
      <div className="row">
        <strong>{title}</strong>
        <div className="badges">
          {paper ? <span className="badge badge-paper">бумага</span> : null}
          <span className="badge">{currency}</span>
        </div>
      </div>
      {title !== a.account_id ? <div className="bot-label">{a.account_id}</div> : null}
      <div className="equity">
        {!hasData
          ? "нет данных"
          : equity == null
            ? "нет переоценки"
            : `${fmt(equity, currency)} ${currency}`}
      </div>
      {hasData && seed != null && delta != null ? (
        <div className={`delta ${delta >= 0 ? "pos" : "neg"}`}>
          {fromCapitalLine({ seed, currency, delta, pct })}
        </div>
      ) : null}
      {hasData && a.updated_utc ? <div className="updated">обновлено {a.updated_utc}</div> : null}

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
          {fs ? (
            <span className="chart-hint">
              <span className="hint-esc">Esc — закрыть</span>
              <span className="hint-rotate">Поверните телефон</span>
            </span>
          ) : null}
        </div>
        <EquityChart
          key={fs ? "fs" : "norm"}
          points={points}
          seed={seed}
          currency={currency}
          mode={mode}
          fill={fs}
          height={280}
        />
      </div>

      <h3 className="subhead">Открытые позиции</h3>
      {hasData ? (
        <>
          <PositionsTable positions={a.positions || []} />
          <LimitsTable limits={a.pending_limits || []} />
        </>
      ) : (
        <p className="muted">нет данных</p>
      )}
      {hasData && a.note ? <p className="note">{displayNote(a.note)}</p> : null}
    </section>
  );
}

export default function StrategyPage({ botId, data, history, onBack }) {
  const accounts = useMemo(
    () => mergePortalAccounts(data?.accounts || []).filter((a) => a.bot_id === botId),
    [data, botId],
  );
  const logic =
    (data?.manifest || []).find((m) => m.bot_id === botId)?.logic || "";
  const plain = plainExplain(botId, logic);
  const pageTitle = chipLabel(botId);

  const pointsFor = (a) => resolveEquityPoints(a, history);

  if (!accounts.length && !isKnownPortalBot(botId)) {
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
        <h1>{pageTitle}</h1>
        {pageTitle !== botId ? <p className="strategy-title">{botId}</p> : null}
        {pageTitle === botId && plain.title !== botId ? <p className="strategy-title">{plain.title}</p> : null}
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
