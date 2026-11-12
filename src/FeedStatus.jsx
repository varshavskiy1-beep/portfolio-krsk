import {
  FALLBACK_BANNER_RU,
  FEED_SOURCE_FALLBACK,
  LOAD_ERROR_RU,
  LOAD_KEEP_LAST_RU,
  ONLY_PAPER_TRADE,
  RETRY_LABEL,
  STALE_LABEL,
  feedFallbackLine,
  formatFetchedAt,
  isFeedStale,
  isGeneratedAtStale,
} from "./feedValidate.js";

export default function FeedStatus({
  generatedAt,
  fetchedAt,
  error,
  onRetry,
  extra = "",
  source = null,
}) {
  const fallback = source === FEED_SOURCE_FALLBACK;
  const stale = fallback || isFeedStale(fetchedAt) || isGeneratedAtStale(generatedAt);
  const fetchedTxt = formatFetchedAt(fetchedAt);
  return (
    <>
      <div className="meta">
        снимок {generatedAt} · {ONLY_PAPER_TRADE} · валюты не складываются
        {fetchedTxt ? ` · последнее успешное обновление ${fetchedTxt} UTC` : ""}
        {stale ? <span className="stale"> · {STALE_LABEL}</span> : null}
        {extra}
      </div>
      {fallback ? (
        <div className="load-banner" data-feed-source="fallback">
          <span>
            {feedFallbackLine(generatedAt)} {FALLBACK_BANNER_RU}
          </span>
          {onRetry ? (
            <button type="button" className="chip tiny" onClick={onRetry}>
              {RETRY_LABEL}
            </button>
          ) : null}
        </div>
      ) : null}
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
