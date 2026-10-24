/** Живые JSON эквити (GitHub Pages), без пересборки Vercel при sync. */
const DEFAULT_EQUITY_LIVE_DATA_BASE = "https://varshavskiy1-beep.github.io/portfolio-krsk/";

export const EQUITY_LIVE_DATA_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_EQUITY_LIVE_DATA_BASE) ||
  DEFAULT_EQUITY_LIVE_DATA_BASE;

/** База с завершающим слэшем для конкатенации `data/*.json`. */
export function normalizeDataBase(base) {
  if (!base) return "/";
  const s = String(base);
  return s.endsWith("/") ? s : `${s}/`;
}
