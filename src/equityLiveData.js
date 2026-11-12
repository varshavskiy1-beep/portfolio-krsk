/** Живые JSON эквити (GitHub Pages), без пересборки Vercel при sync. */
const DEFAULT_EQUITY_LIVE_DATA_BASE = "https://varshavskiy1-beep.github.io/portfolio-krsk/";

export const EQUITY_LIVE_DATA_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_EQUITY_LIVE_DATA_BASE) ||
  DEFAULT_EQUITY_LIVE_DATA_BASE;

/**
 * Same-origin prefix on Vercel. Rewrite proxies to existing gh-pages `data/*`
 * so a browser that cannot reach github.io still gets the live pair.
 * Bundled `/data/*` stays the last-resort snapshot, not this path.
 */
export const EQUITY_SAME_ORIGIN_LIVE_PREFIX = "equity-live/";

/** База с завершающим слэшем для конкатенации `data/*.json`. */
export function normalizeDataBase(base) {
  if (!base) return "/";
  const s = String(base);
  return s.endsWith("/") ? s : `${s}/`;
}

export function sameOriginLiveBase(appBase) {
  return `${normalizeDataBase(appBase)}${EQUITY_SAME_ORIGIN_LIVE_PREFIX}`;
}
