/** Общая заглушка: без bot_id и без паспорта в разметке. */
export default function StrategyNotFound({ onBack }) {
  return (
    <div className="wrap">
      <button type="button" className="chip" onClick={onBack}>
        ← Назад
      </button>
      <p>Стратегия не найдена в снимке.</p>
    </div>
  );
}
