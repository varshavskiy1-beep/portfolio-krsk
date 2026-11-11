# Записка деплоеру: forts_adr_static без текущей эквити

Скопируй блок ниже целиком → деплоеру / equity_ro. Портал не чинит host и не подставляет NAV.

```text
Привет.
На https://portfolio-krsk.vercel.app главная карточка forts_adr_static показывает «нет данных» / пустой график. Это не снятие стратегии и не обнуление капитала в кабинете.

Актуальный live latest (Pages gh-pages, пример 2026-11-11T06:29:45Z) для forts_adr_static::forts_adr_static:

есть:
  bot_id, account_id, currency=RUB, seed="1500000", positions=[], error="NameError: name 'forts_static_curve' is not defined"
  equity: null

нет (сравни с живым соседом v6b1):
  числовой equity (строка/число > 0)
  updated_utc
  equity_curve[]  — ряд {t, equity}
  cash (если ведёте)
  note (необязательно)

history.json ряд forts_adr_static::forts_adr_static n=54, последняя точка
  t=2026-11-10T13:20:37.879370Z equity=1535646.4682664329
это исторический print, НЕ текущий подтверждённый баланс. Портал его на карточку как NAV не ставит: в latest есть error и пустой equity.

Что нужно с хоста / equity_ro.v1, без force-reset истории:
1. Починить Python NameError: name 'forts_static_curve' is not defined (похоже, сломалось рядом со stop+purge adaptive).
2. Опубликовать текущий numeric equity и equity_curve / updated_utc. Поле error убрать, когда оценка снова есть.
3. Не подставлять 1 535 646,46 как «текущее», пока журнал сделок это не подтвердит.
4. Adaptive (forts_adr_adaptive) на портал не возвращать.

Кабинет после этого сам покажет ₽ и %. Пока latest.equity=null+error — честно «нет данных».
```
