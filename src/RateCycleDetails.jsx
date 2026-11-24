import { cnyMomOpenedLine } from "./cnyMomCard.js";
import { ethOkxOpenedLine } from "./ethOkxCard.js";
import { historyResetLine } from "./historyReset.js";
import { officeSignalsOpenedLine, officeSignalsRegimeLine } from "./officeSignalsComonCnyCard.js";
import { rateCycleOpenedLine } from "./rateCycleCard.js";
import { isCnyMomH360, isEthOkxMoex, isOfficeSignalsComonCny, isRfBondsRateCycle } from "./strategyMeta.js";

/** Подпись «счёт только открыт» / «счёт обнулён», пока в history один день. */
export default function RateCycleDetails({ account, historyPoints }) {
  const opened = isRfBondsRateCycle(account)
    ? rateCycleOpenedLine(account)
    : isCnyMomH360(account)
      ? cnyMomOpenedLine(account, historyPoints)
      : isEthOkxMoex(account)
        ? ethOkxOpenedLine(account)
        : isOfficeSignalsComonCny(account)
          ? officeSignalsOpenedLine(account)
          : historyResetLine(account, historyPoints);
  const regime = isOfficeSignalsComonCny(account) ? officeSignalsRegimeLine(account) : "";
  if (!opened && !regime) return null;
  return (
    <>
      {regime ? <div className="updated rate-cycle-opened">{regime}</div> : null}
      {opened ? <div className="updated rate-cycle-opened">{opened}</div> : null}
    </>
  );
}
