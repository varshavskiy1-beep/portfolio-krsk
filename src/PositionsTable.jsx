import { OAC_PAPER_BOT_ID } from "./strategyMeta.js";
import { formatMoneyRu, patternLabel, positionHasField, sideLabel } from "./uiCopy.js";

/**
 * Таблица позиций. mark и pattern — только если есть хотя бы у одной строки.
 * compact: карточка на главной (без стопа, без текста «позиций нет»).
 * oac_paper: Тикер | Кол-во | Стоимость, $ (value_usd, без цены и стороны).
 */
export default function PositionsTable({ positions, compact = false, botId }) {
  if (!positions?.length) {
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
            {positions.map((p, i) => (
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

  const showMark = positions.some((p) => positionHasField(p, "mark"));
  const showPattern = positions.some((p) => positionHasField(p, "pattern"));
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{compact ? "Позиция" : "Инструмент"}</th>
            <th>Сторона</th>
            <th>Кол-во</th>
            <th>{compact ? "Цена" : "Цена входа"}</th>
            {showMark ? <th>Рынок</th> : null}
            {showPattern ? <th>Паттерн</th> : null}
            {compact ? null : <th>Стоп</th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <tr key={p.position_id || `${p.symbol}-${i}`}>
              <td>{p.symbol}</td>
              <td>{sideLabel(p.side)}</td>
              <td>{p.qty}</td>
              <td>{p.avg_px ?? "—"}</td>
              {showMark ? <td>{p.mark ?? "—"}</td> : null}
              {showPattern ? <td>{patternLabel(p.pattern)}</td> : null}
              {compact ? null : <td>{p.stop_px ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
