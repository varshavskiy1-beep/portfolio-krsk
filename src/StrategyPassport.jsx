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

export default function StrategyPassport({ botId, logic }) {
  const passport = getPassport(botId, logic);
  const tech = logic ? rewriteAccountCurrencyCopy(logic, botId) : "";
  const needsData = passport.testing.status === TEST_STATUS.NEEDS_DATA;

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
      <div className={`passport-test ${needsData ? "passport-test-gap" : ""}`}>
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
