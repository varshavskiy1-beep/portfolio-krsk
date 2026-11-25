import { useMemo, useState } from "react";
import w1Csv from "./data/office_signals_comon_cny_replay/W1_journal.csv?raw";
import w2Csv from "./data/office_signals_comon_cny_replay/W2_journal.csv?raw";
import EquityChart from "./EquityChart.jsx";
import { initialChartMode, persistChartMode } from "./chartPrefs.js";
import {
  DEFAULT_OFFICE_SIGNALS_REPLAY_WINDOW,
  OFFICE_SIGNALS_REPLAY_ENGINE_LABEL,
  OFFICE_SIGNALS_REPLAY_FORMULA_NOTE,
  OFFICE_SIGNALS_REPLAY_HEADING,
  OFFICE_SIGNALS_REPLAY_ACCOUNTING_NOTE,
  OFFICE_SIGNALS_REPLAY_ROLL_NOTE,
  OFFICE_SIGNALS_REPLAY_SOURCE,
  OFFICE_SIGNALS_REPLAY_WINDOWS,
  officeSignalsReplayCaption,
  officeSignalsReplayKpis,
  officeSignalsReplayWindowId,
  parseOfficeSignalsReplayJournal,
  replayEquityPoints,
} from "./officeSignalsComonCnyReplay.js";
import { chartMoneyLabel } from "./rateCycleCard.js";

const JOURNALS = {
  W1: w1Csv,
  W2: w2Csv,
};

export default function OfficeSignalsReplaySection() {
  const [windowId, setWindowId] = useState(DEFAULT_OFFICE_SIGNALS_REPLAY_WINDOW);
  const [mode, setMode] = useState(initialChartMode);
  const active = officeSignalsReplayWindowId(windowId);
  const spec = OFFICE_SIGNALS_REPLAY_WINDOWS[active];
  const rows = useMemo(() => parseOfficeSignalsReplayJournal(JOURNALS[active]), [active]);
  const points = useMemo(() => replayEquityPoints(rows), [rows]);
  const kpis = officeSignalsReplayKpis(active);
  const dummyAccount = { bot_id: "office_signals_comon_cny", account_id: "office_signals_comon_cny" };

  return (
    <section className="card office-replay" data-replay-window={active}>
      <h2 className="subhead passport-title">{OFFICE_SIGNALS_REPLAY_HEADING}</h2>
      <p className="office-replay-label">{OFFICE_SIGNALS_REPLAY_ENGINE_LABEL}</p>
      <div className="office-replay-switch" role="tablist" aria-label="Окно исторического replay">
        {Object.values(OFFICE_SIGNALS_REPLAY_WINDOWS).map((w) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={active === w.id}
            className={`chip tiny ${active === w.id ? "active" : ""}`}
            onClick={() => setWindowId(w.id)}
          >
            {w.switchLabel}
          </button>
        ))}
      </div>
      <p className="office-replay-caption">{officeSignalsReplayCaption(active)}</p>
      {spec.siProxy ? (
        <p className="note">До 05.09.2022 вместо CR использован прокси-фьючерс Si.</p>
      ) : null}
      <div className="passport-kpis">
        {kpis.map((row) => (
          <div key={row.name} className="passport-kpi">
            <div className="passport-kpi-name">{row.name}</div>
            <div className="passport-kpi-value">{row.value}</div>
            <div className="passport-kpi-meaning">{row.meaning}</div>
          </div>
        ))}
      </div>
      <p className="passport-disclaimer">{OFFICE_SIGNALS_REPLAY_FORMULA_NOTE}</p>
      <p className="note">{OFFICE_SIGNALS_REPLAY_ROLL_NOTE}</p>
      <p className="note">{OFFICE_SIGNALS_REPLAY_ACCOUNTING_NOTE}</p>
      <h3 className="subhead">Кривая replay {spec.label}</h3>
      <div className="chart-toolbar">
        <button
          type="button"
          className={`chip tiny ${mode === "money" ? "active" : ""}`}
          onClick={() => {
            setMode("money");
            persistChartMode("money");
          }}
        >
          {chartMoneyLabel(dummyAccount)}
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
      </div>
      <EquityChart
        key={active}
        points={points}
        seed={OFFICE_SIGNALS_REPLAY_SOURCE.baseCapital}
        currency="RUB"
        mode={mode}
        height={280}
        priceDigits={2}
      />
    </section>
  );
}
