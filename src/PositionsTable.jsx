import { patternLabel, positionHasField, sideLabel } from "./uiCopy.js";

/**
 * Таблица позиций. mark и pattern — только если есть хотя бы у одной строки.
 * compact: карточка на главной (без стопа, без текста «позиций нет»).
 */
export default function PositionsTable({ positions, compact = false }) {
  if (!positions?.length) {
    return compact ? null : <p className="muted">Открытых позиций сейчас нет.</p>;
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
