import { cnyMomOpenedLine } from "./cnyMomCard.js";
import { rateCycleOpenedLine } from "./rateCycleCard.js";
import { isCnyMomH360, isRfBondsRateCycle } from "./strategyMeta.js";

/** Подпись «счёт только открыт», пока в history одна точка. */
export default function RateCycleDetails({ account }) {
  const opened = isRfBondsRateCycle(account)
    ? rateCycleOpenedLine(account)
    : isCnyMomH360(account)
      ? cnyMomOpenedLine(account)
      : "";
  if (!opened) return null;
  return <div className="updated rate-cycle-opened">{opened}</div>;
}
