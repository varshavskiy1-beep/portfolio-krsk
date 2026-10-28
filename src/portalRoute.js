/**
 * Hash-маршруты витрины PAPER / LIVE.
 * Снятые PAPER bot_id не доходят до паспорта и StrategyPage.
 */

import { DEFAULT_PORTAL_MODE, isPortalMode } from "./portalMode.js";
import { isHiddenPortalId, normalizePortalId } from "./strategyMeta.js";

/**
 * @typedef {import("./portalMode.js").PortalMode} PortalMode
 * @typedef {(
 *   | { name: "home", mode: PortalMode, legacy?: boolean }
 *   | { name: "strategy", mode: PortalMode, botId: string, legacy?: boolean }
 *   | { name: "notFound", mode: PortalMode }
 * )} PortalRoute
 */

function parseStrategySegment(seg, mode, extra = {}) {
  let raw;
  try {
    raw = decodeURIComponent(seg);
  } catch {
    return { name: "notFound", mode };
  }
  const botId = normalizePortalId(raw);
  if (!botId) return { name: "notFound", mode };
  return { name: "strategy", mode, botId, ...extra };
}

/**
 * @param {string} [hash]
 * @returns {PortalRoute}
 */
export function parsePortalHash(hash) {
  const h = String(hash || "").replace(/^#/, "");
  const trimmed = h.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { name: "home", mode: DEFAULT_PORTAL_MODE };

  const parts = trimmed.split("/").filter(Boolean);

  if (parts.length === 1 && isPortalMode(parts[0])) {
    return { name: "home", mode: parts[0] };
  }

  if (parts[0] === "s" && parts.length === 2) {
    return parseStrategySegment(parts[1], DEFAULT_PORTAL_MODE, { legacy: true });
  }

  if (isPortalMode(parts[0]) && parts[1] === "s" && parts.length === 3) {
    return parseStrategySegment(parts[2], parts[0]);
  }

  if (isPortalMode(parts[0])) {
    return { name: "notFound", mode: parts[0] };
  }
  return { name: "notFound", mode: DEFAULT_PORTAL_MODE };
}

export function readPortalRoute() {
  if (typeof window === "undefined") return { name: "home", mode: DEFAULT_PORTAL_MODE };
  return parsePortalHash(window.location.hash);
}

export function isBlockedStrategyRoute(route) {
  return (
    route?.name === "strategy" &&
    route.mode === "paper" &&
    isHiddenPortalId(route.botId)
  );
}

/** @param {PortalMode} mode */
export function homeHash(mode) {
  return isPortalMode(mode) ? `#/${mode}` : "#/paper";
}

/** @param {PortalMode} mode @param {string} botId */
export function strategyHash(mode, botId) {
  return `${homeHash(mode)}/s/${encodeURIComponent(botId)}`;
}

/**
 * Старый `#/s/<id>` остаётся PAPER-ссылкой. Адрес обновляем через replaceState,
 * без лишней записи в историю.
 * @param {PortalRoute} route
 * @returns {PortalRoute}
 */
export function canonicalizePortalRoute(route, historyApi, location) {
  if (!route?.legacy) return route;
  const next =
    route.name === "strategy"
      ? { name: "strategy", mode: "paper", botId: route.botId }
      : { name: "home", mode: "paper" };
  if (historyApi && location) {
    const hash = route.name === "strategy" ? strategyHash("paper", route.botId) : homeHash("paper");
    const url = `${location.pathname}${location.search}${hash}`;
    historyApi.replaceState(historyApi.state, "", url);
  }
  return next;
}
