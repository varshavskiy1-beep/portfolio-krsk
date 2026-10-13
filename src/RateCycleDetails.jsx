import { cnyMomOpenedLine } from "./cnyMomCard.js";
import { ethOkxOpenedLine } from "./ethOkxCard.js";
import { rateCycleOpenedLine } from "./rateCycleCard.js";
import { isCnyMomH360, isEthOkxMoex, isRfBondsRateCycle } from "./strategyMeta.js";

/** Подпись «счёт только открыт», пока в history одна точка / один день. */
export default function RateCycleDetails({ account }) {
  const opened = isRfBondsRateCycle(account)
    ? rateCycleOpenedLine(account)
    : isCnyMomH360(account)
      ? cnyMomOpenedLine(account)
      : isEthOkxMoex(account)
        ? ethOkxOpenedLine(account)
        : "";
  if (!opened) return null;
  return <div className="updated rate-cycle-opened">{opened}</div>;
}
