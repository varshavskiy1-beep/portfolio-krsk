import {
  LOAD_ERROR_RU,
  LOAD_KEEP_LAST_RU,
  ONLY_PAPER_TRADE,
  RETRY_LABEL,
  STALE_LABEL,
  formatFetchedAt,
  isFeedStale,
} from "./feedValidate.js";

export default function FeedStatus({
  generatedAt,
  fetchedAt,
  error,
  onRetry,
  extra = "",
}) {
  const stale = isFeedStale(fetchedAt);
  const fetchedTxt = formatFetchedAt(fetchedAt);
  return (
    <>
      <div className="meta">
        снимок {generatedAt} · {ONLY_PAPER_TRADE} · валюты не складываются
        {fetchedTxt ? ` · последнее успешное обновление ${fetchedTxt} UTC` : ""}
        {stale ? <span className="stale"> · {STALE_LABEL}</span> : null}
        {extra}
      </div>
      {error ? (
        <div className="load-banner">
          <span>
            {LOAD_ERROR_RU}
            {generatedAt ? ` ${LOAD_KEEP_LAST_RU}` : ""}
          </span>
          <button type="button" className="chip tiny" onClick={onRetry}>
            {RETRY_LABEL}
          </button>
        </div>
      ) : null}
    </>
  );
}
