import { PAPER_SWITCH_HINT_RU, LIVE_SWITCH_HINT_RU } from "./uiCopy.js";

export default function ModeSwitch({ mode }) {
  return (
    <nav className="mode-switch" aria-label="Режим витрины">
      <a
        href="#/paper"
        className={`mode-switch-link ${mode === "paper" ? "active paper" : ""}`}
        aria-current={mode === "paper" ? "page" : undefined}
      >
        <span className="mode-switch-name">PAPER</span>
        <span className="mode-switch-hint">{PAPER_SWITCH_HINT_RU}</span>
      </a>
      <a
        href="#/live"
        className={`mode-switch-link ${mode === "live" ? "active live" : ""}`}
        aria-current={mode === "live" ? "page" : undefined}
      >
        <span className="mode-switch-name">LIVE</span>
        <span className="mode-switch-hint">{LIVE_SWITCH_HINT_RU}</span>
      </a>
    </nav>
  );
}
