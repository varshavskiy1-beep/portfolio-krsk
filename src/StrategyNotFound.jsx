import ModeSwitch from "./ModeSwitch.jsx";
import { homeHash } from "./portalRoute.js";
import { STRATEGY_NOT_FOUND_RU } from "./uiCopy.js";

/** Общая заглушка: без bot_id и без паспорта в разметке. */
export default function StrategyNotFound({ onBack, mode = "paper" }) {
  return (
    <div className="wrap">
      <ModeSwitch mode={mode} />
      {onBack ? (
        <button type="button" className="chip" onClick={onBack}>
          ← Назад
        </button>
      ) : (
        <a className="chip" href={homeHash(mode)}>
          ← Назад
        </a>
      )}
      <p>{STRATEGY_NOT_FOUND_RU}</p>
    </div>
  );
}
