import {
  accountIdBadge,
  leverageBadge,
  showsBrakeBadge,
  showsDefenceBadge,
  showsPaperBadge,
} from "./strategyMeta.js";

/** Бейджи карточки: бумага | валюта | id счёта | плечо | защита | стоп. */
export default function AccountBadges({ account, currency }) {
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
