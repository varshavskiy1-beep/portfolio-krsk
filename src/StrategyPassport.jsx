import {
  GLOSSARY,
  NO_DATA,
  TEST_STATUS,
  getPassport,
} from "./strategyPassport.js";
import { rewriteAccountCurrencyCopy } from "./uiCopy.js";

function ValueCell({ row }) {
  if (!row.known || row.value === NO_DATA) {
    return <span className="passport-nodata">{NO_DATA}</span>;
  }
  return row.value;
}

function MetricValue({ row }) {
  if (!row.known || row.value === NO_DATA) {
    return <span className="passport-nodata">{NO_DATA}</span>;
  }
  return row.value;
}

function WindowsTable({ rows, showWeak }) {
  return (
    <div className="table-scroll">
      <table className="passport-table passport-windows">
        <thead>
          <tr>
            <th>Период</th>
            <th>Годовая доходность</th>
            <th>Макс. просадка</th>
            <th>Коэфф. прибыли</th>
            <th>Сделок</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className={showWeak && w.weak ? "passport-window-weak" : undefined}>
              <td>
                {w.label_ru}
                <div className="passport-window-sub">{w.period}</div>
              </td>
              <td>{w.cagr}</td>
              <td>{w.maxDd}</td>
              <td>{w.pf}</td>
              <td>{w.trades}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestingBook({ passport }) {
  const book = passport.testing.backtest;
  return (
    <div className="passport-test passport-test-book">
      <p className="passport-test-status">{passport.testing.statusLabel}</p>
      <p className="passport-p">{passport.testing.disclaimer}</p>

      <h4 className="passport-h4">{book.primaryTitle}</h4>
      <div className="passport-kpis">
        {book.primaryMetrics.map((row) => (
          <div key={row.name} className="passport-kpi">
            <div className="passport-kpi-name">{row.name}</div>
            <div className="passport-kpi-value">
              <MetricValue row={row} />
            </div>
            <div className="passport-kpi-meaning">{row.meaning}</div>
          </div>
        ))}
      </div>
      <p className="passport-disclaimer">{book.cagrDisclaimer}</p>

      <h4 className="passport-h4">{book.periodTitle}</h4>
      <WindowsTable rows={book.windowsLev3} showWeak />
      <p className="passport-p">{book.weakWindowNote}</p>

      <h4 className="passport-h4">{book.referenceTitle}</h4>
      <p className="passport-hint">
        Основной продукт — плечо 3×. Ниже — как выглядело бы без плеча. Это справка, не второй
        продукт.
      </p>
      <WindowsTable rows={book.windowsLev1} />

      <p className="passport-p">{book.equityNote}</p>
      {passport.testing.paperEquity ? (
        <p className="passport-p">{book.paperNote}</p>
      ) : (
        <p className="passport-p">Бумажной кривой эквити для этой стратегии в кабинете тоже нет.</p>
      )}

      <p className="passport-hint">{book.missingAfterPack}</p>
      <ul className="passport-risk-list">
        {passport.testing.missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TestingGap({ passport }) {
  return (
    <div className="passport-test passport-test-gap">
      <p className="passport-test-status">{passport.testing.statusLabel}</p>
      <p className="passport-p">{passport.testing.disclaimer}</p>
      {passport.testing.paperEquity ? (
        <p className="passport-p">
          На этой странице ниже есть график бумажной эквити кабинета. Он показывает учёт
          paper-счёта, а не лабораторный бэктест и не walk-forward. Overlay (сравнение с эталоном)
          в репозитории нет — график эталона не рисуем.
        </p>
      ) : (
        <p className="passport-p">Бумажной кривой эквити для этой стратегии в кабинете тоже нет.</p>
      )}
      <p className="passport-hint">Чтобы заполнить эту секцию числами теста, не хватает:</p>
      <ul className="passport-risk-list">
        {passport.testing.missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function StrategyPassport({ botId, logic }) {
  const passport = getPassport(botId, logic);
  const tech = logic ? rewriteAccountCurrencyCopy(logic, botId) : "";
  const hasBook = passport.testing.status === TEST_STATUS.HAS_BOOK;

  return (
    <section className="card passport-card">
      <h2 className="subhead passport-title">Паспорт стратегии</h2>
      {!passport.authored ? (
        <p className="passport-unauthored">
          Авторского паспорта для «{botId}» ещё нет. Поля ниже помечены «нет данных», ничего не
          выдумано.
        </p>
      ) : null}

      <h3 className="subhead">Суть стратегии</h3>
      {passport.essence.paragraphs.map((p) => (
        <p key={p} className="passport-p">
          {p}
        </p>
      ))}

      <h3 className="subhead">Как принимается решение</h3>
      <ol className="explain-list passport-steps">
        {passport.decisionSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h3 className="subhead">Параметры и настройки</h3>
      <p className="passport-hint">
        Значение «<span className="passport-nodata">{NO_DATA}</span>» значит: в этом репозитории
        поля нет. Мы его не подставляем из догадок.
      </p>
      <div className="table-scroll">
        <table className="passport-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Значение</th>
              <th>Смысл</th>
            </tr>
          </thead>
          <tbody>
            {passport.parameters.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>
                  <ValueCell row={row} />
                </td>
                <td>{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subhead">Риск и ограничения</h3>
      {passport.risk.paragraphs.map((p) => (
        <p key={p} className="passport-p">
          {p}
        </p>
      ))}
      <ul className="passport-risk-list">
        {passport.risk.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h3 className="subhead">Бэктест и проверка устойчивости</h3>
      {hasBook ? <TestingBook passport={passport} /> : <TestingGap passport={passport} />}

      {tech ? (
        <details className="tech-details">
          <summary>Техническая формулировка из снимка</summary>
          <p>{tech}</p>
        </details>
      ) : null}

      <details className="tech-details passport-glossary">
        <summary>Словарь терминов</summary>
        <dl className="passport-dl">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="passport-dl-row">
              <dt>{g.term}</dt>
              <dd>{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
