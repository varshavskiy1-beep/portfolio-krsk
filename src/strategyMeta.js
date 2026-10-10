/** Портальные стратегии: заголовки, paper-badge, shell без данных в equity-ro. */

export const ROBOT2_BOT_ID = "three_robots_okx_nasdaq_1h";
export const ROBOT2_ACCOUNT_ID = "paper_block2";

export const YOUNG_BOUNCE_BOT_ID = "young_bounce_combo";
export const YOUNG_BOUNCE_ACCOUNT_ID = "young_bounce_combo";

export const OAC_PAPER_BOT_ID = "oac_paper";
export const OAC_PAPER_ACCOUNT_ID = "oac_paper";

/** Paper id на хосте: DESYATKA_EARN_PAPER. В кабинете — desyatka_earn_paper. Только бумага. */
export const DESYATKA_EARN_BOT_ID = "desyatka_earn_paper";
export const DESYATKA_EARN_ACCOUNT_ID = "desyatka_earn_paper";
export const DESYATKA_EARN_TITLE = "Десятка Earn";

/** Paper id: cycle_6040_paper. Только бумага, RUB. Пока нет в accounts[] — «нет данных». */
export const CYCLE_6040_BOT_ID = "cycle_6040_paper";
export const CYCLE_6040_ACCOUNT_ID = "cycle_6040_paper";
export const CYCLE_6040_TITLE = "Цикл 60/40";

/** Paper id: rf_conservative_comon. Только бумага, RUB. Канон в docs: RF_CONSERVATIVE_CANON_COMON_v1. Пока нет в accounts[] — «нет данных». */
export const RF_CONSERVATIVE_BOT_ID = "rf_conservative_comon";
export const RF_CONSERVATIVE_ACCOUNT_ID = "rf_conservative_comon";
export const RF_CONSERVATIVE_TITLE = "РФ Консерватив: облигации в цикле ЦБ + 10% акций";

/** Paper id: rf_bonds_rate_cycle. Бумажный рублёвый счёт. Канон: RF_BONDS_RATE_CYCLE_80_20_v1. Пока нет в accounts[] или equity пустой — «нет данных». */
export const RF_BONDS_RATE_CYCLE_BOT_ID = "rf_bonds_rate_cycle";
export const RF_BONDS_RATE_CYCLE_ACCOUNT_ID = "rf_bonds_rate_cycle";
export const RF_BONDS_RATE_CYCLE_TITLE = "Цикл ставки 80/20: дальние облигации и юань";
export const RF_BONDS_RATE_CYCLE_CANON_ID = "RF_BONDS_RATE_CYCLE_80_20_v1";
export const RF_BONDS_RATE_CYCLE_CURRENCY = "RUB";
export const RF_BONDS_RATE_CYCLE_LOGIC =
  "Бумага. Неделя по пятнице. Решение пятницы работает со следующей недели. 80% OBLG и 20% SBRB, сверху фьючерс CR на 20% капитала, пока цикл ставки включён. На биржу ордера не идут.";

/**
 * Семейство бумажных счетов «Маяк». Четыре отдельные карточки.
 * Стартовый капитал не зашит: только поле seed из accounts[] снимка.
 */
export const MAYAK_COMMON_LOGIC =
  "РФ, бумага. Акции из списка Автоследования с P/E ниже рынка, корзина из 10 бумаг раз в месяц, у каждой бумаги трейлинг по EMA100. Если ключевая ставка выше 12% и реальная выше 6 п.п. (режим HARD) или индекс Мосбиржи ниже EMA100 — всё в LQDT. Решение по close D, сделка на open D+1. На биржу ордера не идут.";

export const MAYAK_ACCOUNTS = [
  {
    bot_id: "mayak_imoex_lowvol10",
    account_id: "mayak_imoex_lowvol10",
    title: "Маяк Low Vol",
    subtitle: "РФ, акции MOEX и LQDT, без плеча. На биржу ордера не идут.",
    blurb: "10 самых спокойных бумаг, до 10% на бумагу.",
    leverageBadge: null,
    leverageLabel: "без плеча",
    maxNamePct: "10%",
    maxGrossPct: "100%",
  },
  {
    bot_id: "mayak_imoex_mom10",
    account_id: "mayak_imoex_mom10",
    title: "Маяк Momentum",
    subtitle: "РФ, акции MOEX и LQDT, без плеча. На биржу ордера не идут.",
    blurb: "10 самых растущих за 120 дней, до 10% на бумагу.",
    leverageBadge: null,
    leverageLabel: "без плеча",
    maxNamePct: "10%",
    maxGrossPct: "100%",
  },
  {
    bot_id: "mayak_imoex_mom10_lev15",
    account_id: "mayak_imoex_mom10_lev15",
    title: "Маяк Momentum ×1,5",
    subtitle: "РФ, акции MOEX и LQDT, плечо 1,5. На биржу ордера не идут.",
    blurb: "до 15% на бумагу, всего до 150%.",
    leverageBadge: "плечо 1,5",
    leverageLabel: "плечо 1,5",
    maxNamePct: "15%",
    maxGrossPct: "150%",
  },
  {
    bot_id: "mayak_imoex_mom10_lev2",
    account_id: "mayak_imoex_mom10_lev2",
    title: "Маяк Momentum ×2",
    subtitle: "РФ, акции MOEX и LQDT, плечо 2. На биржу ордера не идут.",
    blurb: "до 20% на бумагу, всего до 200%.",
    leverageBadge: "плечо 2",
    leverageLabel: "плечо 2",
    maxNamePct: "20%",
    maxGrossPct: "200%",
  },
];

export const MAYAK_BOT_IDS = MAYAK_ACCOUNTS.map((s) => s.bot_id);

const MAYAK_BY_ID = new Map();
for (const spec of MAYAK_ACCOUNTS) {
  MAYAK_BY_ID.set(spec.bot_id, spec);
  MAYAK_BY_ID.set(spec.account_id, spec);
}

/** Спека карточки Маяка по bot_id / account_id (как у cycle_6040_paper / rf_conservative_comon). */
export function mayakSpec(accountOrId) {
  if (accountOrId == null || accountOrId === "") return null;
  if (typeof accountOrId === "string") return MAYAK_BY_ID.get(accountOrId) || null;
  return MAYAK_BY_ID.get(accountOrId.bot_id) || MAYAK_BY_ID.get(accountOrId.account_id) || null;
}

export function isMayak(accountOrId) {
  return Boolean(mayakSpec(accountOrId));
}

/** Снятые стратегии: не рисуем карточку, чип, паспорт и OG, даже если id ещё в снимке. */
export const HIDDEN_PORTAL_IDS = new Set(["grail_b20_3x"]);

/** Нормализация bot_id из hash/фида: trim, decode, без query и хвостового /. */
export function normalizePortalId(id) {
  if (id == null || id === "") return "";
  let s = String(id).trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* оставляем как есть */
  }
  return s.split(/[?#]/)[0].replace(/\/+$/, "").trim();
}

export const BOT_TITLE = {
  [ROBOT2_BOT_ID]: "Робот 2 · MSTR/TSLA/SPCX",
  [YOUNG_BOUNCE_BOT_ID]: "Young Bounce Combo",
  [OAC_PAPER_BOT_ID]: "Ядро внимания",
  [DESYATKA_EARN_BOT_ID]: DESYATKA_EARN_TITLE,
  [CYCLE_6040_BOT_ID]: CYCLE_6040_TITLE,
  [RF_CONSERVATIVE_BOT_ID]: RF_CONSERVATIVE_TITLE,
  [RF_BONDS_RATE_CYCLE_BOT_ID]: RF_BONDS_RATE_CYCLE_TITLE,
  ...Object.fromEntries(MAYAK_ACCOUNTS.map((s) => [s.bot_id, s.title])),
};

export const ACCOUNT_TITLE = {
  [ROBOT2_ACCOUNT_ID]: "Робот 2 · MSTR/TSLA/SPCX",
  [YOUNG_BOUNCE_ACCOUNT_ID]: "Young Bounce Combo",
  [OAC_PAPER_ACCOUNT_ID]: "Ядро внимания",
  [DESYATKA_EARN_ACCOUNT_ID]: DESYATKA_EARN_TITLE,
  [CYCLE_6040_ACCOUNT_ID]: CYCLE_6040_TITLE,
  [RF_CONSERVATIVE_ACCOUNT_ID]: RF_CONSERVATIVE_TITLE,
  [RF_BONDS_RATE_CYCLE_ACCOUNT_ID]: RF_BONDS_RATE_CYCLE_TITLE,
  ...Object.fromEntries(MAYAK_ACCOUNTS.map((s) => [s.account_id, s.title])),
};

/** Подзаголовок на карточке (только для отдельных paper-ботов). */
export const ACCOUNT_SUBTITLE = {
  [OAC_PAPER_BOT_ID]: "акции США, старт $10 000. На биржу ордера не идут.",
  /** Формат как у эквити: «10 000 USD», без знака $ вплотную к цифрам. */
  [DESYATKA_EARN_BOT_ID]: "акции США, старт 10 000 USD. На биржу ордера не идут.",
  [CYCLE_6040_BOT_ID]: "РФ, DIVD/SBLB/LQDT, старт 1 000 000 ₽. На биржу ордера не идут.",
  [RF_CONSERVATIVE_BOT_ID]: "РФ, SBMX/SBRB/LQDT, старт 50 000 ₽. На биржу ордера не идут.",
  [RF_BONDS_RATE_CYCLE_BOT_ID]:
    "РФ, OBLG/SBRB и фьючерс CR. На биржу ордера не идут.",
  ...Object.fromEntries(MAYAK_ACCOUNTS.map((s) => [s.bot_id, s.subtitle])),
};

/** Устаревшая пометка live OKX в excluded — на портале не показываем как live. */
export const PAPER_NOT_LIVE_EXCLUDED = new Set([
  ROBOT2_BOT_ID,
  DESYATKA_EARN_BOT_ID,
  CYCLE_6040_BOT_ID,
  RF_CONSERVATIVE_BOT_ID,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  ...MAYAK_BOT_IDS,
]);

/** Карточки, которые должны быть на главной даже до публикации счёта в equity-ro. */
export const PORTAL_SHELLS = [
  {
    bot_id: ROBOT2_BOT_ID,
    account_id: ROBOT2_ACCOUNT_ID,
    currency: "USDT",
    seed: "10000",
  },
  {
    bot_id: YOUNG_BOUNCE_BOT_ID,
    account_id: YOUNG_BOUNCE_ACCOUNT_ID,
    currency: "USDT",
    seed: "10000",
  },
  {
    bot_id: OAC_PAPER_BOT_ID,
    account_id: OAC_PAPER_ACCOUNT_ID,
    currency: "USD",
    seed: "10000",
  },
  {
    bot_id: DESYATKA_EARN_BOT_ID,
    account_id: DESYATKA_EARN_ACCOUNT_ID,
    currency: "USD",
    seed: "10000",
  },
  {
    bot_id: CYCLE_6040_BOT_ID,
    account_id: CYCLE_6040_ACCOUNT_ID,
    currency: "RUB",
    seed: "1000000",
  },
  {
    bot_id: RF_CONSERVATIVE_BOT_ID,
    account_id: RF_CONSERVATIVE_ACCOUNT_ID,
    currency: "RUB",
    seed: "50000",
  },
  {
    bot_id: RF_BONDS_RATE_CYCLE_BOT_ID,
    account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
    currency: RF_BONDS_RATE_CYCLE_CURRENCY,
  },
  ...MAYAK_ACCOUNTS.map((s) => ({
    bot_id: s.bot_id,
    account_id: s.account_id,
    currency: "RUB",
  })),
];

export function accountKey(a) {
  return `${a.bot_id}::${a.account_id}`;
}

export function portalExcluded(excluded = []) {
  return excluded.filter((e) => !PAPER_NOT_LIVE_EXCLUDED.has(e.id));
}

export function displayTitle(account) {
  if (!account) return "";
  const mayak = mayakSpec(account);
  if (mayak) return mayak.title;
  if (account.bot_id === OAC_PAPER_BOT_ID || account.account_id === OAC_PAPER_ACCOUNT_ID) {
    return "Ядро внимания";
  }
  if (account.bot_id === YOUNG_BOUNCE_BOT_ID || account.account_id === YOUNG_BOUNCE_ACCOUNT_ID) {
    return "Young Bounce Combo";
  }
  if (account.bot_id === DESYATKA_EARN_BOT_ID || account.account_id === DESYATKA_EARN_ACCOUNT_ID) {
    return DESYATKA_EARN_TITLE;
  }
  if (account.bot_id === CYCLE_6040_BOT_ID || account.account_id === CYCLE_6040_ACCOUNT_ID) {
    return CYCLE_6040_TITLE;
  }
  if (account.bot_id === RF_CONSERVATIVE_BOT_ID || account.account_id === RF_CONSERVATIVE_ACCOUNT_ID) {
    return RF_CONSERVATIVE_TITLE;
  }
  if (account.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID || account.account_id === RF_BONDS_RATE_CYCLE_ACCOUNT_ID) {
    return RF_BONDS_RATE_CYCLE_TITLE;
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
  const mayak = mayakSpec(account);
  if (mayak) return mayak.title;
  const title = displayTitle(account);
  if (account?.bot_id === OAC_PAPER_BOT_ID || account?.account_id === OAC_PAPER_ACCOUNT_ID) {
    return title === OAC_PAPER_ACCOUNT_ID || title === OAC_PAPER_BOT_ID ? "Ядро внимания" : title;
  }
  if (account?.bot_id === YOUNG_BOUNCE_BOT_ID || account?.account_id === YOUNG_BOUNCE_ACCOUNT_ID) {
    return title === YOUNG_BOUNCE_ACCOUNT_ID || title === YOUNG_BOUNCE_BOT_ID
      ? "Young Bounce Combo"
      : title;
  }
  if (account?.bot_id === DESYATKA_EARN_BOT_ID || account?.account_id === DESYATKA_EARN_ACCOUNT_ID) {
    return title === DESYATKA_EARN_ACCOUNT_ID || title === DESYATKA_EARN_BOT_ID
      ? DESYATKA_EARN_TITLE
      : title;
  }
  if (account?.bot_id === CYCLE_6040_BOT_ID || account?.account_id === CYCLE_6040_ACCOUNT_ID) {
    return title === CYCLE_6040_ACCOUNT_ID || title === CYCLE_6040_BOT_ID
      ? CYCLE_6040_TITLE
      : title;
  }
  if (account?.bot_id === RF_CONSERVATIVE_BOT_ID || account?.account_id === RF_CONSERVATIVE_ACCOUNT_ID) {
    return title === RF_CONSERVATIVE_ACCOUNT_ID || title === RF_CONSERVATIVE_BOT_ID
      ? RF_CONSERVATIVE_TITLE
      : title;
  }
  if (account?.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID || account?.account_id === RF_BONDS_RATE_CYCLE_ACCOUNT_ID) {
    return title === RF_BONDS_RATE_CYCLE_ACCOUNT_ID || title === RF_BONDS_RATE_CYCLE_BOT_ID
      ? RF_BONDS_RATE_CYCLE_TITLE
      : title;
  }
  return title;
}

export function chipLabel(botId) {
  const mayak = mayakSpec(botId);
  if (mayak) return mayak.title;
  if (botId === OAC_PAPER_BOT_ID) return "Ядро внимания";
  if (botId === YOUNG_BOUNCE_BOT_ID) return "Young Bounce Combo";
  if (botId === DESYATKA_EARN_BOT_ID) return DESYATKA_EARN_TITLE;
  if (botId === CYCLE_6040_BOT_ID) return CYCLE_6040_TITLE;
  if (botId === RF_CONSERVATIVE_BOT_ID) return RF_CONSERVATIVE_TITLE;
  if (botId === RF_BONDS_RATE_CYCLE_BOT_ID) return RF_BONDS_RATE_CYCLE_TITLE;
  return BOT_TITLE[botId] || botId;
}

export function showsPaperBadge(account) {
  return Boolean(account);
}

export function accountSubtitle(account) {
  if (!account) return "";
  const mayak = mayakSpec(account);
  if (mayak) return mayak.subtitle;
  if (account.bot_id === OAC_PAPER_BOT_ID || account.account_id === OAC_PAPER_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[OAC_PAPER_BOT_ID];
  }
  if (account.bot_id === DESYATKA_EARN_BOT_ID || account.account_id === DESYATKA_EARN_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[DESYATKA_EARN_BOT_ID];
  }
  if (account.bot_id === CYCLE_6040_BOT_ID || account.account_id === CYCLE_6040_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[CYCLE_6040_BOT_ID];
  }
  if (account.bot_id === RF_CONSERVATIVE_BOT_ID || account.account_id === RF_CONSERVATIVE_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[RF_CONSERVATIVE_BOT_ID];
  }
  if (account.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID || account.account_id === RF_BONDS_RATE_CYCLE_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[RF_BONDS_RATE_CYCLE_BOT_ID];
  }
  return ACCOUNT_SUBTITLE[account.bot_id] || ACCOUNT_SUBTITLE[account.account_id] || "";
}

/** Подзаголовок карточки (обязателен для OAC, Десятки, Цикла 60/40, РФ Консерватив и Маяка даже при пустом фиде). */
export function cardSubtitle(account) {
  const mayak = mayakSpec(account);
  if (mayak) return mayak.subtitle;
  const subtitle = accountSubtitle(account);
  if (subtitle) return subtitle;
  if (account?.bot_id === OAC_PAPER_BOT_ID || account?.account_id === OAC_PAPER_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[OAC_PAPER_BOT_ID];
  }
  if (account?.bot_id === DESYATKA_EARN_BOT_ID || account?.account_id === DESYATKA_EARN_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[DESYATKA_EARN_BOT_ID];
  }
  if (account?.bot_id === CYCLE_6040_BOT_ID || account?.account_id === CYCLE_6040_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[CYCLE_6040_BOT_ID];
  }
  if (account?.bot_id === RF_CONSERVATIVE_BOT_ID || account?.account_id === RF_CONSERVATIVE_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[RF_CONSERVATIVE_BOT_ID];
  }
  if (account?.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID || account?.account_id === RF_BONDS_RATE_CYCLE_ACCOUNT_ID) {
    return ACCOUNT_SUBTITLE[RF_BONDS_RATE_CYCLE_BOT_ID];
  }
  return "";
}

/** Пояснение на карточке Маяка (отдельная строка под подзаголовком). */
export function cardBlurb(account) {
  return mayakSpec(account)?.blurb || "";
}

export function leverageBadge(account) {
  return mayakSpec(account)?.leverageBadge || null;
}

/** id счёта в бейджах для известных portal-ботов (не под заголовком). */
export function accountIdBadge(account) {
  if (!account?.account_id) return null;
  const mayak = mayakSpec(account);
  if (mayak) return mayak.account_id;
  if (account.bot_id === OAC_PAPER_BOT_ID || account.account_id === OAC_PAPER_ACCOUNT_ID) {
    return OAC_PAPER_ACCOUNT_ID;
  }
  if (account.bot_id === DESYATKA_EARN_BOT_ID || account.account_id === DESYATKA_EARN_ACCOUNT_ID) {
    return DESYATKA_EARN_ACCOUNT_ID;
  }
  if (account.bot_id === CYCLE_6040_BOT_ID || account.account_id === CYCLE_6040_ACCOUNT_ID) {
    return CYCLE_6040_ACCOUNT_ID;
  }
  if (account.bot_id === RF_CONSERVATIVE_BOT_ID || account.account_id === RF_CONSERVATIVE_ACCOUNT_ID) {
    return RF_CONSERVATIVE_ACCOUNT_ID;
  }
  if (account.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID || account.account_id === RF_BONDS_RATE_CYCLE_ACCOUNT_ID) {
    return RF_BONDS_RATE_CYCLE_ACCOUNT_ID;
  }
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
  if (account.next_rebalance) parts.push(`ребаланс ${account.next_rebalance}`);
  if (account.planned_fill) parts.push(`план ${account.planned_fill}`);
  return parts.join(" · ");
}

export function hasBoxxCash(account) {
  return account?.boxx_usd != null && account.boxx_usd !== "";
}

export function isOacPaper(account) {
  return account?.bot_id === OAC_PAPER_BOT_ID || account?.account_id === OAC_PAPER_ACCOUNT_ID;
}

export function isDesyatkaEarn(account) {
  return (
    account?.bot_id === DESYATKA_EARN_BOT_ID || account?.account_id === DESYATKA_EARN_ACCOUNT_ID
  );
}

export function isCycle6040(account) {
  return account?.bot_id === CYCLE_6040_BOT_ID || account?.account_id === CYCLE_6040_ACCOUNT_ID;
}

export function isRfConservative(account) {
  return (
    account?.bot_id === RF_CONSERVATIVE_BOT_ID || account?.account_id === RF_CONSERVATIVE_ACCOUNT_ID
  );
}

export function isRfBondsRateCycle(account) {
  return (
    account?.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID ||
    account?.account_id === RF_BONDS_RATE_CYCLE_ACCOUNT_ID
  );
}

/** Стоп по model (−6%): бейдж «стоп», только если фид прислал braked=true. */
export function showsBrakeBadge(account) {
  return account?.braked === true;
}

/** Свободный USD на книге earn; теневые sit / earn_boxx / qqq не сюда. */
export function showsFreeCash(account) {
  if (!isDesyatkaEarn(account)) return false;
  return account?.cash != null && account.cash !== "";
}

export function isHiddenPortalId(id) {
  const n = normalizePortalId(id).toLowerCase();
  return Boolean(n) && HIDDEN_PORTAL_IDS.has(n);
}

export function isHiddenPortalAccount(account) {
  if (!account) return false;
  return isHiddenPortalId(account.bot_id) || isHiddenPortalId(account.account_id);
}

export function isKnownPortalBot(botId) {
  if (isHiddenPortalId(botId)) return false;
  return Boolean(BOT_TITLE[botId]) || PORTAL_SHELLS.some((s) => s.bot_id === botId);
}

/** Добавляет shell-карточки для стратегий, которых ещё нет в accounts[]. */
export function mergePortalAccounts(accounts = []) {
  const visible = (accounts || []).filter((a) => !isHiddenPortalAccount(a));
  const present = new Set(visible.map(accountKey));
  const merged = [...visible];
  for (const shell of PORTAL_SHELLS) {
    const key = accountKey(shell);
    if (present.has(key)) continue;
    const row = {
      bot_id: shell.bot_id,
      account_id: shell.account_id,
      currency: shell.currency,
      no_data: true,
    };
    if (shell.seed != null && shell.seed !== "") row.seed = shell.seed;
    merged.push(row);
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
