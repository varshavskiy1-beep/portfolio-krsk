import {
  accountIdBadge,
  showsBrakeBadge,
  showsDefenceBadge,
  showsPaperBadge,
} from "./strategyMeta.js";

/** Бейджи карточки: бумага | валюта | id счёта | защита | стоп. */
export default function AccountBadges({ account, currency }) {
  const paper = showsPaperBadge(account);
  const idBadge = accountIdBadge(account);
  const defence = showsDefenceBadge(account);
  const braked = showsBrakeBadge(account);

  return (
    <div className="badges">
      {paper ? <span className="badge badge-paper">бумага</span> : null}
      <span className="badge">{currency}</span>
      {idBadge ? <span className="badge badge-id">{idBadge}</span> : null}
      {defence ? <span className="badge badge-defence">защита</span> : null}
      {braked ? <span className="badge badge-stop">стоп</span> : null}
    </div>
  );
}
