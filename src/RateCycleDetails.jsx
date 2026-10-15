import { cnyMomOpenedLine } from "./cnyMomCard.js";
import { ethOkxOpenedLine } from "./ethOkxCard.js";
import { robot2ResetLine } from "./historyReset.js";
import { rateCycleOpenedLine } from "./rateCycleCard.js";
import { isCnyMomH360, isEthOkxMoex, isRfBondsRateCycle } from "./strategyMeta.js";

/** Подпись «счёт только открыт» / «счёт обнулён», пока в history один день. */
export default function RateCycleDetails({ account, historyPoints }) {
  const opened = isRfBondsRateCycle(account)
    ? rateCycleOpenedLine(account)
    : isCnyMomH360(account)
      ? cnyMomOpenedLine(account)
      : isEthOkxMoex(account)
        ? ethOkxOpenedLine(account)
        : robot2ResetLine(account, historyPoints);
  if (!opened) return null;
  return <div className="updated rate-cycle-opened">{opened}</div>;
}
