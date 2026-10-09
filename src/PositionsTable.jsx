import { emptyPositionsHint } from "./mayakCard.js";
import { visibleRateCyclePositions } from "./rateCycleCard.js";
import { isMayak, isRfBondsRateCycle, OAC_PAPER_BOT_ID } from "./strategyMeta.js";
import { formatMoneyRu, patternLabel, positionHasField, sideLabel } from "./uiCopy.js";

/**
 * Таблица позиций. mark, pattern, value_usd и value_rub — только если есть хотя бы у одной строки.
 * compact: карточка на главной (без стопа, без текста «позиций нет»).
 * oac_paper: Тикер | Кол-во | Стоимость, $ (value_usd, без цены и стороны).
 * desyatka_earn_paper: тикер, сторона, qty строкой, avg_px и/или value_usd если есть.
 * cycle_6040_paper: DIVD|SBLB|LQDT, long, qty строкой, avg_px и/или value_rub если есть.
 * rf_conservative_comon: SBMX|SBRB|LQDT, long, qty строкой, avg_px и/или value_rub если есть.
 * Маяк: тикер, лонг, qty строкой; цен нет — колонку не рисуем; пустой стакан в hard/protect не ошибка.
 * Цикл ставки 80/20: только OBLG/SBRB/CR; индексы отфильтрованы; пустая таблица нейтральная.
 */
export default function PositionsTable({ positions, compact = false, botId, account }) {
  const acc = account || { bot_id: botId };
  const mayak = isMayak(acc);
  const rateCycle = isRfBondsRateCycle(acc);
  const rows = rateCycle ? visibleRateCyclePositions({ ...acc, positions: positions || acc.positions }) : positions;
  if (!rows?.length) {
    if (rateCycle) {
      return (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{compact ? "Позиция" : "Инструмент"}</th>
                <th>Сторона</th>
                <th>Кол-во</th>
                <th>{compact ? "Цена" : "Цена пая / контракта"}</th>
              </tr>
            </thead>
            <tbody />
          </table>
        </div>
      );
    }
    if (mayak) {
      const hint = emptyPositionsHint(acc);
      if (compact && hint !== "в деньгах (LQDT)") return null;
      return <p className="muted">{hint}</p>;
    }
    return compact ? null : <p className="muted">Открытых позиций сейчас нет.</p>;
  }

  if (botId === OAC_PAPER_BOT_ID) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Тикер</th>
              <th>Кол-во</th>
              <th>Стоимость, $</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.position_id || `${p.symbol}-${i}`}>
                <td>{p.symbol}</td>
                <td>{p.qty}</td>
                <td>{formatMoneyRu(Number(p.value_usd), "USD")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const showMark = rows.some((p) => positionHasField(p, "mark"));
  const showPattern = rows.some((p) => positionHasField(p, "pattern"));
  const showValueUsd = rows.some((p) => positionHasField(p, "value_usd"));
  const showValueRub = rows.some((p) => positionHasField(p, "value_rub"));
  const showAvgPx = mayak ? rows.some((p) => positionHasField(p, "avg_px")) : true;
  const showStop = compact ? false : mayak ? rows.some((p) => positionHasField(p, "stop_px")) : true;
  const priceHead = rateCycle
    ? compact
      ? "Цена"
      : "Цена пая / контракта"
    : compact
      ? "Цена"
      : "Цена входа";
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{compact ? "Позиция" : "Инструмент"}</th>
            <th>Сторона</th>
            <th>Кол-во</th>
            {showAvgPx ? <th>{priceHead}</th> : null}
            {showValueUsd ? <th>Стоимость, $</th> : null}
            {showValueRub ? <th>Стоимость, ₽</th> : null}
            {showMark ? <th>Рынок</th> : null}
            {showPattern ? <th>Паттерн</th> : null}
            {showStop ? <th>Стоп</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.position_id || `${p.symbol}-${i}`}>
              <td>{p.symbol}</td>
              <td>{sideLabel(p.side)}</td>
              <td>{p.qty == null || p.qty === "" ? "" : String(p.qty)}</td>
              {showAvgPx ? <td>{p.avg_px ?? "—"}</td> : null}
              {showValueUsd ? (
                <td>{formatMoneyRu(Number(p.value_usd), "USD")}</td>
              ) : null}
              {showValueRub ? (
                <td>{formatMoneyRu(Number(p.value_rub), "RUB")}</td>
              ) : null}
              {showMark ? <td>{p.mark ?? "—"}</td> : null}
              {showPattern ? <td>{patternLabel(p.pattern)}</td> : null}
              {showStop ? <td>{p.stop_px ?? "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
