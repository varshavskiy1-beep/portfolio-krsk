/** Портальные стратегии: заголовки, paper-badge, shell без данных в equity-ro. */

export const ROBOT2_BOT_ID = "three_robots_okx_nasdaq_1h";
export const ROBOT2_ACCOUNT_ID = "paper_block2";

export const YOUNG_BOUNCE_BOT_ID = "young_bounce_combo";
export const YOUNG_BOUNCE_ACCOUNT_ID = "young_bounce_combo";

export const OAC_PAPER_BOT_ID = "oac_paper";
export const OAC_PAPER_ACCOUNT_ID = "oac_paper";

export const BOT_TITLE = {
  [ROBOT2_BOT_ID]: "Робот 2 · MSTR/TSLA/SPCX",
  [YOUNG_BOUNCE_BOT_ID]: "Young Bounce Combo",
  [OAC_PAPER_BOT_ID]: "Ядро внимания",
};

export const ACCOUNT_TITLE = {
  [ROBOT2_ACCOUNT_ID]: "Робот 2 · MSTR/TSLA/SPCX",
  [YOUNG_BOUNCE_ACCOUNT_ID]: "Young Bounce Combo",
  [OAC_PAPER_ACCOUNT_ID]: "Ядро внимания",
};

/** Подзаголовок на карточке (только для отдельных paper-ботов). */
export const ACCOUNT_SUBTITLE = {
  [OAC_PAPER_BOT_ID]: "акции США, старт $10 000. На биржу ордера не идут.",
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
  {
    bot_id: YOUNG_BOUNCE_BOT_ID,
    account_id: YOUNG_BOUNCE_ACCOUNT_ID,
    currency: "USD",
    seed: "10000",
  },
  {
    bot_id: OAC_PAPER_BOT_ID,
    account_id: OAC_PAPER_ACCOUNT_ID,
    currency: "USD",
    seed: "10000",
  },
];

export function accountKey(a) {
  return `${a.bot_id}::${a.account_id}`;
}

export function portalExcluded(excluded = []) {
  return excluded.filter((e) => !PAPER_NOT_LIVE_EXCLUDED.has(e.id));
}

export function displayTitle(account) {
  if (!account) return "";
  if (account.bot_id === OAC_PAPER_BOT_ID || account.account_id === OAC_PAPER_ACCOUNT_ID) {
    return "Ядро внимания";
  }
  if (account.bot_id === YOUNG_BOUNCE_BOT_ID || account.account_id === YOUNG_BOUNCE_ACCOUNT_ID) {
    return "Young Bounce Combo";
  }
  return (
    ACCOUNT_TITLE[account.account_id] ||
    BOT_TITLE[account.bot_id] ||
    account.account_id ||
    account.bot_id ||
    ""
  );
}

/** Заголовок карточки: displayTitle + страховка для portal-ботов. */
export function cardTitle(account) {
  const title = displayTitle(account);
  if (account?.bot_id === OAC_PAPER_BOT_ID || account?.account_id === OAC_PAPER_ACCOUNT_ID) {
    return title === OAC_PAPER_ACCOUNT_ID || title === OAC_PAPER_BOT_ID ? "Ядро внимания" : title;
  }
  if (account?.bot_id === YOUNG_BOUNCE_BOT_ID || account?.account_id === YOUNG_BOUNCE_ACCOUNT_ID) {
    return title === YOUNG_BOUNCE_ACCOUNT_ID || title === YOUNG_BOUNCE_BOT_ID
      ? "Young Bounce Combo"
      : title;
  }
  return title;
}

export function chipLabel(botId) {
  if (botId === OAC_PAPER_BOT_ID) return "Ядро внимания";
  if (botId === YOUNG_BOUNCE_BOT_ID) return "Young Bounce Combo";
  return BOT_TITLE[botId] || botId;
}

export function showsPaperBadge(account) {
  return Boolean(account);
}

export function accountSubtitle(account) {
  if (!account) return "";
  if (account.bot_id === OAC_PAPER_BOT_ID || account.account_id === OAC_PAPER_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[OAC_PAPER_BOT_ID];
  }
  return ACCOUNT_SUBTITLE[account.bot_id] || ACCOUNT_SUBTITLE[account.account_id] || "";
}

/** Подзаголовок карточки (обязателен для OAC даже при пустом фиде). */
export function cardSubtitle(account) {
  const subtitle = accountSubtitle(account);
  if (subtitle) return subtitle;
  if (account?.bot_id === OAC_PAPER_BOT_ID || account?.account_id === OAC_PAPER_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[OAC_PAPER_BOT_ID];
  }
  return "";
}

/** id счёта в бейджах для известных portal-ботов (не под заголовком). */
export function accountIdBadge(account) {
  if (!account?.account_id) return null;
  if (isKnownPortalBot(account.bot_id)) return account.account_id;
  return null;
}

/** Сырую строку id под заголовком не показываем для portal-ботов. */
export function underTitleLabel(account) {
  if (!account) return null;
  if (isKnownPortalBot(account.bot_id)) return null;
  const title = cardTitle(account);
  if (title !== account.account_id) return account.account_id;
  if (account.bot_id && account.bot_id !== account.account_id && title === account.account_id) {
    return account.bot_id;
  }
  return null;
}

export function showsDefenceBadge(account) {
  return account?.defence === true;
}

export function formatUpdatedLine(account) {
  if (!account) return "";
  const parts = [];
  if (account.as_of) parts.push(`сессия ${account.as_of}`);
  if (account.updated_utc) parts.push(`обновлено ${account.updated_utc}`);
  return parts.join(" · ");
}

export function hasBoxxCash(account) {
  return account?.boxx_usd != null && account.boxx_usd !== "";
}

export function isOacPaper(account) {
  return account?.bot_id === OAC_PAPER_BOT_ID || account?.account_id === OAC_PAPER_ACCOUNT_ID;
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

/** Пустое поле equity / equity_curve: нет числа и нет ряда точек. */
export function isEmptyEquityField(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  const n = Number(value);
  return !Number.isFinite(n);
}

/**
 * Есть что показать: не shell и не «error + пустой ряд equity».
 * Пустой ряд при error → «нет данных», никогда не ноль.
 */
export function hasAccountData(account) {
  if (account == null || account.no_data) return false;
  if (
    account.error &&
    isEmptyEquityField(account.equity) &&
    isEmptyEquityField(account.equity_curve)
  ) {
    return false;
  }
  return true;
}
