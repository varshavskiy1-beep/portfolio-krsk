/**
 * Каноническая валюта кэша/эквити по площадке, а не как пришло в equity-ro.
 * Venue важнее bot_id; если ни то ни другое не известно — оставляем значение фида.
 * Конвертации и сложения разных валют нет.
 */

export const VENUE_CURRENCY = {
  CRYPTO_SPOT: "USDT",
  CRYPTO_PERP: "USDT",
  FORTS: "RUB",
  RU_EQ: "RUB",
  US_EQ: "USD",
};

export const BOT_CURRENCY = {
  v6b1: "USDT",
  grail_b20_3x: "USDT",
  pump_radar: "USDT",
  forts_adr_adaptive: "RUB",
  forts_adr_static: "RUB",
  three_robots_okx_nasdaq_1h: "USD",
};

/** who_pays и прочие счета, если venue в снимке нет. */
export const ACCOUNT_CURRENCY = {
  paper_us_eq: "USD",
  paper_ru_eq: "RUB",
  paper_forts: "RUB",
  paper_crypto_spot: "USDT",
  paper_crypto_perp: "USDT",
  paper_block2: "USD",
};

export function canonicalCurrency(account) {
  if (!account) return undefined;
  const byVenue = account.venue && VENUE_CURRENCY[account.venue];
  if (byVenue) return byVenue;
  const byBot = account.bot_id && BOT_CURRENCY[account.bot_id];
  if (byBot) return byBot;
  const byAccount = account.account_id && ACCOUNT_CURRENCY[account.account_id];
  if (byAccount) return byAccount;
  return account.currency;
}

export function applyCanonicalCurrencies(latest) {
  if (!latest) return latest;
  for (const a of latest.accounts || []) {
    const c = canonicalCurrency(a);
    if (c) a.currency = c;
  }
  return latest;
}

export function withCanonicalCurrency(account) {
  if (!account) return account;
  return { ...account, currency: canonicalCurrency(account) };
}

export function normalizeLatest(latest) {
  if (!latest) return latest;
  return {
    ...latest,
    accounts: (latest.accounts || []).map(withCanonicalCurrency),
  };
}

export function normalizeHistory(hist) {
  if (!hist?.series) return hist;
  const series = {};
  for (const [k, s] of Object.entries(hist.series)) {
    series[k] = { ...s, currency: canonicalCurrency(s) };
  }
  return { ...hist, series };
}
