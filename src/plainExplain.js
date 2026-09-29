/** Совместимость: короткие поля из паспорта. Новый UI — StrategyPassport. */
import { getPassport } from "./strategyPassport.js";

export function plainExplain(botId, fallbackLogic) {
  const p = getPassport(botId, fallbackLogic);
  return {
    title: p.title,
    summary: p.essence.paragraphs[0] || fallbackLogic || "Описание стратегии пока уточняется.",
    how: p.decisionSteps,
    risk: p.risk.paragraphs[0] || "Бумажный счёт, не торговая рекомендация.",
  };
}
