/**
 * Режим витрины PAPER / LIVE. Один и тот же режим задаёт маршрут,
 * загрузку, карточки и подписи. Математика доходности сюда не входит.
 */

/**
 * @typedef {"paper" | "live"} PortalMode
 */

export const PORTAL_MODES = Object.freeze(["paper", "live"]);
export const DEFAULT_PORTAL_MODE = "paper";

/**
 * @param {unknown} value
 * @returns {value is PortalMode}
 */
export function isPortalMode(value) {
  return value === "paper" || value === "live";
}

/**
 * @param {unknown} value
 * @returns {PortalMode}
 */
export function coercePortalMode(value) {
  return isPortalMode(value) ? value : DEFAULT_PORTAL_MODE;
}

/**
 * Состояние одного режима. Словари PAPER и LIVE никогда не сливаются.
 * @param {PortalMode} mode
 */
export function emptyModeBucket(mode) {
  return {
    mode,
    data: null,
    history: null,
    backtests: mode === "paper" ? null : undefined,
    fetchedAt: null,
    error: false,
    errorReason: null,
    loading: false,
  };
}

/**
 * @param {PortalMode} mode
 * @param {{ paper: object, live: object }} store
 */
export function selectModeBucket(store, mode) {
  const key = coercePortalMode(mode);
  return store[key];
}

/**
 * История только выбранного режима. Ключ ряда `bot_id::account_id`
 * допустим внутри режима; словари режимов не объединяются.
 * @param {PortalMode} mode
 * @param {{ paper?: object|null, live?: object|null }} histories
 */
export function selectModeHistory(mode, histories) {
  if (mode === "live") return histories?.live ?? null;
  return histories?.paper ?? null;
}

/**
 * Снимок latest только выбранного режима.
 * @param {PortalMode} mode
 * @param {{ paper?: object|null, live?: object|null }} snapshots
 */
export function selectModeSnapshot(mode, snapshots) {
  if (mode === "live") return snapshots?.live ?? null;
  return snapshots?.paper ?? null;
}

/**
 * Затвор загрузки: поздний ответ чужого режима или отменённый id не пишутся.
 */
export function createModeLoadGate() {
  let seq = 0;
  /** @type {PortalMode | null} */
  let activeMode = null;

  return {
    /** @param {PortalMode} mode */
    begin(mode) {
      activeMode = mode;
      const id = (seq += 1);
      return {
        id,
        mode,
        /**
         * @param {PortalMode} targetMode
         * @param {{ aborted?: boolean }} [opts]
         */
        accept(targetMode, opts = {}) {
          if (opts.aborted) return false;
          return targetMode === activeMode && id === seq;
        },
      };
    },
    invalidate() {
      seq += 1;
    },
    activeMode() {
      return activeMode;
    },
  };
}

/**
 * Фильтры сбрасываются при смене режима; внутри режима сохраняются.
 * @param {PortalMode} prevMode
 * @param {PortalMode} nextMode
 * @param {{ query: string, currency: string }} filters
 */
export function filtersAfterModeChange(prevMode, nextMode, filters) {
  if (prevMode !== nextMode) return { query: "", currency: "all" };
  return filters;
}

export function emptyFilters() {
  return { query: "", currency: "all" };
}

/**
 * @param {PortalMode} mode
 * @param {string} [strategyTitle]
 */
export function portalDocumentTitle(mode, strategyTitle) {
  const label = mode === "live" ? "LIVE" : "PAPER";
  const base = `Боты ${label} | Портфель стратегий`;
  const title = strategyTitle == null ? "" : String(strategyTitle).trim();
  return title ? `${title} · ${base}` : base;
}
