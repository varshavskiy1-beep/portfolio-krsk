/**
 * Поиск и валютный фильтр витрины. Сначала сводка полного режима,
 * затем отбор по запросу и валюте.
 */

/**
 * @param {string} query
 * @param {object} account
 * @param {(account: object) => string} titleOf
 */
export function accountMatchesQuery(account, query, titleOf) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const title = String(titleOf(account) || "").toLowerCase();
  const botId = String(account?.bot_id || "").toLowerCase();
  return title.includes(q) || botId.includes(q);
}

/**
 * @param {object[]} accounts
 * @param {{ query?: string, currency?: string }} filters
 * @param {{ titleOf: (a: object) => string, currencyOf: (a: object) => string }} accessors
 */
export function filterPortalAccounts(accounts, filters, accessors) {
  const list = Array.isArray(accounts) ? accounts : [];
  const currency = filters?.currency && filters.currency !== "all" ? filters.currency : null;
  return list.filter((a) => {
    if (currency && accessors.currencyOf(a) !== currency) return false;
    return accountMatchesQuery(a, filters?.query, accessors.titleOf);
  });
}

/**
 * @param {object[]} accounts
 * @param {(a: object) => string} currencyOf
 */
export function catalogCurrencies(accounts, currencyOf) {
  const seen = new Set();
  const out = [];
  for (const a of accounts || []) {
    const c = currencyOf(a);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * @param {object[]} accounts
 */
export function modeSummaryCounts(accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  const bots = new Set();
  for (const a of list) {
    if (a?.bot_id) bots.add(a.bot_id);
  }
  return { bots: bots.size, accounts: list.length };
}
