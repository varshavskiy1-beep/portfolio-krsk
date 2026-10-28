/**
 * Пользовательские подписи. Слово seed в интерфейсе не показываем:
 * это стартовый / начальный капитал счёта. Поле JSON `seed` не трогаем.
 */

export const PORTAL_TITLE_RU = "Портфель стратегий";
export const PORTAL_KICKER_RU = "Результаты торговых роботов";
export const PAPER_HEADING_RU = "БОТЫ PAPER";
export const LIVE_HEADING_RU = "БОТЫ LIVE";
export const PAPER_MODE_HINT_RU =
  "Бумажная торговля. Сделки не исполняются на реальном счёте";
export const LIVE_MODE_HINT_RU =
  "Результаты роботов на реальных счетах. Эта страница не управляет торговлей";
export const PAPER_SWITCH_HINT_RU = "Бумажная торговля";
export const LIVE_SWITCH_HINT_RU = "Реальные счета";
export const LIVE_BADGE_RU = "LIVE · реальный счёт";
export const SEARCH_PLACEHOLDER_RU = "Найти стратегию…";
export const SEARCH_LABEL_RU = "Найти стратегию";
export const CURRENCY_LABEL_RU = "Валюта";
export const ALL_CURRENCIES_RU = "Все валюты";
export const RESET_FILTERS_RU = "Сбросить фильтры";
export const SEARCH_EMPTY_RU = "По заданным условиям ничего не найдено";
export const PAGE_NOT_FOUND_RU = "Страница не найдена";
export const STRATEGY_NOT_FOUND_RU = "Стратегия не найдена";
export const LIVE_FOOTER_RISK_RU =
  "Эта страница не управляет торговлей. Это не торговые рекомендации.";


export function formatMoneyRu(n, currency) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: currency === "RUB" ? 0 : 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

/** «от начального капитала 1 500 000» + опционально дельта. */
export function fromCapitalLine({ seed, currency, delta, pct }) {
  const seedTxt = formatMoneyRu(seed, currency);
  let line = `от начального капитала ${seedTxt}`;
  if (delta == null || Number.isNaN(delta)) return line;
  const sign = delta >= 0 ? "+" : "";
  const pctPart =
    pct != null && !Number.isNaN(pct)
      ? ` (${pct >= 0 ? "+" : "−"}${new Intl.NumberFormat("ru-RU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Math.abs(pct))}%)`
      : "";
  return `${line}: ${sign}${formatMoneyRu(delta, currency)}${pctPart}`;
}

/** Счета, где фид ещё пишет USD, а карточка должна показывать USDT. */
const USDT_ACCOUNT_COPY_IDS = new Set([
  "three_robots_okx_nasdaq_1h",
  "paper_block2",
  "young_bounce_combo",
]);

function isUsdtAccountCopy(account) {
  if (!account) return false;
  if (typeof account === "string") return USDT_ACCOUNT_COPY_IDS.has(account);
  return USDT_ACCOUNT_COPY_IDS.has(account.bot_id) || USDT_ACCOUNT_COPY_IDS.has(account.account_id);
}

/** В текстах фида про валюту счёта: Robot 2 / Young Bounce → USDT; OAC не трогаем. */
export function rewriteAccountCurrencyCopy(text, account) {
  if (text == null || text === "") return "";
  const raw = String(text);
  if (!isUsdtAccountCopy(account)) return raw;
  return raw.replace(/\$\s?(?=\d)/g, "").replace(/\bUSD\b/g, "USDT");
}

/** Технические note из снимка: seed → «начальный капитал», без сырых id; валюта — по инструменту. */
export function displayNote(note, account) {
  if (note == null || note === "") return "";
  const cleaned = String(note)
    .replace(/\bseed\b/gi, "начальный капитал")
    .replace(/\bmir_caps\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return rewriteAccountCurrencyCopy(cleaned, account);
}

/** Паттерны Young Bounce Combo: короткие русские подписи, значение не врём. */
export const PATTERN_LABEL = {
  crash: "обвал",
  listing_dump: "дамп листинга",
};

export function patternLabel(pattern) {
  if (pattern == null || pattern === "") return "—";
  return PATTERN_LABEL[pattern] || String(pattern);
}

export function sideLabel(side) {
  if (side === "long") return "лонг";
  if (side === "short") return "шорт";
  return side == null || side === "" ? "—" : String(side);
}

export function positionHasField(position, field) {
  if (!position) return false;
  const v = position[field];
  return v != null && v !== "";
}
