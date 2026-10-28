import {
  accountIdBadge,
  leverageBadge,
  showsBrakeBadge,
  showsDefenceBadge,
  showsPaperBadge,
} from "./strategyMeta.js";
import { LIVE_BADGE_RU } from "./uiCopy.js";

/** Бейджи карточки: режим | валюта | id счёта | плечо | защита | стоп. */
export default function AccountBadges({ account, currency, mode = "paper" }) {
  if (mode === "live") {
    return (
      <div className="badges">
        <span className="badge badge-live">{LIVE_BADGE_RU}</span>
        {currency ? <span className="badge">{currency}</span> : null}
        {account?.accountLabel ? <span className="badge badge-id">{account.accountLabel}</span> : null}
      </div>
    );
  }

  const paper = showsPaperBadge(account);
  const idBadge = accountIdBadge(account);
  const lev = leverageBadge(account);
  const defence = showsDefenceBadge(account);
  const braked = showsBrakeBadge(account);

  return (
    <div className="badges">
      {paper ? <span className="badge badge-paper">бумага</span> : null}
      <span className="badge">{currency}</span>
      {idBadge ? <span className="badge badge-id">{idBadge}</span> : null}
      {lev ? <span className="badge badge-lev">{lev}</span> : null}
      {defence ? <span className="badge badge-defence">защита</span> : null}
      {braked ? <span className="badge badge-stop">стоп</span> : null}
    </div>
  );
}
