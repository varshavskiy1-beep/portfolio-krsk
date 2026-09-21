/** Портальные стратегии: заголовки, paper-badge, shell без данных в equity-ro. */

export const ROBOT2_BOT_ID = "three_robots_okx_nasdaq_1h";
export const ROBOT2_ACCOUNT_ID = "paper_block2";

export const BOT_TITLE = {
  [ROBOT2_BOT_ID]: "Робот 2 · MSTR/TSLA/SPCX",
};

export const ACCOUNT_TITLE = {
  [ROBOT2_ACCOUNT_ID]: "Робот 2 · MSTR/TSLA/SPCX",
};

/** Устаревшая пометка live OKX в excluded — на портале не показываем как live. */
export const PAPER_NOT_LIVE_EXCLUDED = new Set([ROBOT2_BOT_ID]);

/** Карточки, которые должны быть на главной даже до публикации счёта в equity-ro. */
export const PORTAL_SHELLS = [
  {
    bot_id: ROBOT2_BOT_ID,
    account_id: ROBOT2_ACCOUNT_ID,
    currency: "USD",
    seed: "10000",
  },
];

export const PAPER_BADGE_BOTS = new Set([ROBOT2_BOT_ID]);
export const PAPER_BADGE_ACCOUNTS = new Set([ROBOT2_ACCOUNT_ID]);

export function accountKey(a) {
  return `${a.bot_id}::${a.account_id}`;
}

export function portalExcluded(excluded = []) {
  return excluded.filter((e) => !PAPER_NOT_LIVE_EXCLUDED.has(e.id));
}

export function displayTitle(account) {
  if (!account) return "";
  return (
    ACCOUNT_TITLE[account.account_id] ||
    BOT_TITLE[account.bot_id] ||
    account.account_id ||
    account.bot_id ||
    ""
  );
}

export function chipLabel(botId) {
  return BOT_TITLE[botId] || botId;
}

export function showsPaperBadge(account) {
  if (!account) return false;
  return PAPER_BADGE_BOTS.has(account.bot_id) || PAPER_BADGE_ACCOUNTS.has(account.account_id);
}

export function isKnownPortalBot(botId) {
  return Boolean(BOT_TITLE[botId]) || PORTAL_SHELLS.some((s) => s.bot_id === botId);
}

/** Добавляет shell-карточки для стратегий, которых ещё нет в accounts[]. */
export function mergePortalAccounts(accounts = []) {
  const present = new Set((accounts || []).map(accountKey));
  const merged = [...(accounts || [])];
  for (const shell of PORTAL_SHELLS) {
    const key = accountKey(shell);
    if (present.has(key)) continue;
    merged.push({
      bot_id: shell.bot_id,
      account_id: shell.account_id,
      currency: shell.currency,
      seed: shell.seed,
      no_data: true,
    });
  }
  return merged;
}

export function hasAccountData(account) {
  return account != null && !account.no_data;
}
