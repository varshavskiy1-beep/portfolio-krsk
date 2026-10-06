import { cardBlurb, isMayak } from "./strategyMeta.js";
import { mayakDetailLines } from "./mayakCard.js";

/** Пояснение и поля снимка Маяка: режим, ставки, акции, кэш/заём, доля. */
export default function MayakDetails({ account, hasData }) {
  if (!isMayak(account)) return null;
  const blurb = cardBlurb(account);
  const lines = hasData ? mayakDetailLines(account) : [];
  if (!blurb && !lines.length) return null;
  return (
    <>
      {blurb ? <div className="account-blurb">{blurb}</div> : null}
      {lines.map((l) => (
        <div key={l.kind} className={`updated mayak-line mayak-${l.kind}`}>
          {l.text}
        </div>
      ))}
    </>
  );
}
