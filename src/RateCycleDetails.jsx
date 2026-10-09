import {
  RATE_CYCLE_BOOK_LINE,
  RATE_CYCLE_COMPOSITION,
  RATE_CYCLE_HISTORY_LABEL,
  RATE_CYCLE_HISTORY_LINES,
  optionalFeedLines,
} from "./rateCycleCard.js";
import { isRfBondsRateCycle } from "./strategyMeta.js";

/** Описание книги, исторический состав и блок истории. Логика недели — в подзаголовке. */
export default function RateCycleDetails({ account, hasData }) {
  if (!isRfBondsRateCycle(account)) return null;
  const extra = hasData ? optionalFeedLines(account) : [];
  return (
    <>
      <div className="account-blurb">{RATE_CYCLE_BOOK_LINE}</div>
      <div className="account-blurb">{RATE_CYCLE_COMPOSITION}</div>
      <div className="rate-cycle-history">
        <div className="rate-cycle-history-label">{RATE_CYCLE_HISTORY_LABEL}</div>
        {RATE_CYCLE_HISTORY_LINES.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      {extra.map((l) => (
        <div key={l.kind} className="updated rate-cycle-feed">
          {l.text}
        </div>
      ))}
    </>
  );
}
