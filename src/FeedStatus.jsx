import {
  LOAD_ERROR_RU,
  LOAD_KEEP_LAST_RU,
  ONLY_PAPER_TRADE,
  RETRY_LABEL,
  STALE_LABEL,
  formatFetchedAt,
  isFeedStale,
} from "./feedValidate.js";
import {
  LIVE_LOAD_ERROR_RU,
  LIVE_STALE_LABEL_RU,
  formatLiveDateTime,
  isLiveSnapshotInFuture,
  isLiveSnapshotStale,
  liveSourceLine,
} from "./liveFeedValidate.js";

export default function FeedStatus({
  mode = "paper",
  generatedAt,
  fetchedAt,
  error,
  onRetry,
  extra = "",
  nowMs,
  sourceHost = "",
}) {
  if (mode === "live") {
    const now = nowMs ?? Date.now();
    const stale = generatedAt ? isLiveSnapshotStale(generatedAt, now) : false;
    const clockError = generatedAt ? isLiveSnapshotInFuture(generatedAt, now) : false;
    const when = generatedAt ? formatLiveDateTime(generatedAt) : "";
    return (
      <>
        <div className="meta">
          {when ? `снимок ${when}` : "снимок ещё не получен"}
          {stale ? <span className="stale"> · {LIVE_STALE_LABEL_RU}</span> : null}
          {clockError ? <span className="stale"> · ошибка времени снимка</span> : null}
          {extra}
        </div>
        <p className="feed-source">{liveSourceLine(generatedAt, sourceHost)}</p>
        {error ? (
          <div className="load-banner">
            <span>
              {LIVE_LOAD_ERROR_RU}
              {generatedAt ? ` ${LOAD_KEEP_LAST_RU}` : ""}
            </span>
            {onRetry ? (
              <button type="button" className="chip tiny" onClick={onRetry}>
                {RETRY_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

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
          {onRetry ? (
            <button type="button" className="chip tiny" onClick={onRetry}>
              {RETRY_LABEL}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
