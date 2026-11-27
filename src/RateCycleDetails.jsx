import { cnyMomOpenedLine } from "./cnyMomCard.js";
import { ethOkxOpenedLine } from "./ethOkxCard.js";
import { historyResetLine } from "./historyReset.js";
import { moexMulti360CollateralLine, moexMulti360OpenedLine } from "./moexMulti360Card.js";
import { officeSignalsOpenedLine, officeSignalsRegimeLine } from "./officeSignalsComonCnyCard.js";
import { rateCycleOpenedLine } from "./rateCycleCard.js";
import {
  isCnyMomH360,
  isEthOkxMoex,
  isMoexMulti360,
  isOfficeSignalsComonCny,
  isRfBondsRateCycle,
} from "./strategyMeta.js";

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
          : isMoexMulti360(account)
            ? moexMulti360OpenedLine(account, historyPoints)
            : historyResetLine(account, historyPoints);
  const regime = isOfficeSignalsComonCny(account) ? officeSignalsRegimeLine(account) : "";
  const collateral = isMoexMulti360(account) ? moexMulti360CollateralLine(account) : "";
  if (!opened && !regime && !collateral) return null;
  return (
    <>
      {regime ? <div className="updated rate-cycle-opened">{regime}</div> : null}
      {collateral ? <div className="updated rate-cycle-opened">{collateral}</div> : null}
      {opened ? <div className="updated rate-cycle-opened">{opened}</div> : null}
    </>
  );
}
