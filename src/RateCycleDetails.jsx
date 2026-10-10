import { rateCycleOpenedLine } from "./rateCycleCard.js";
import { isRfBondsRateCycle } from "./strategyMeta.js";

/** Подпись «счёт только открыт», пока в history одна точка. */
export default function RateCycleDetails({ account }) {
  if (!isRfBondsRateCycle(account)) return null;
  const opened = rateCycleOpenedLine(account);
  if (!opened) return null;
  return <div className="updated rate-cycle-opened">{opened}</div>;
}
