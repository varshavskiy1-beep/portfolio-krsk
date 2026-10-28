# ENGINEER.md

## Проект

portfolio-krsk — публичная витрина торговых роботов (Vite 6.4.3, React 19.3.0, lightweight-charts 5.2.1). Два режима одной витрины: PAPER (`#/paper`) и LIVE (`#/live`). Старые адреса `#/s/<bot_id>` остаются PAPER-ссылками и переписываются через `replaceState`.

Данные PAPER: `public/data/latest.json`, `history.json`, `backtests.json`; живое обновление с GitHub Pages (`EQUITY_LIVE_DATA_BASE` / `VITE_EQUITY_LIVE_DATA_BASE`). Имя `equityLiveData.js` означает обновляемую бумажную ленту, не торговлю реальными деньгами.

Данные LIVE: только `<VITE_LIVE_DATA_BASE>/data/live/latest.json` и `history.json`. Если переменная пуста, LIVE — честный пустой раздел, без запросов и без подстановки PAPER. Каталог `src/liveCatalog.js` в этапе A пуст.

Синк бумажной эквити в master примерно каждые 15 минут; эти коммиты не переписывать. Production и публикацию LIVE-данных не трогать без отдельного подтверждения владельца.

## Соглашения кода

- UI по-русски; идентификаторы, комментарии и коммиты по-английски. Подписи `PAPER` и `LIVE` в переключателе — буквально.
- JS + JSDoc, без TypeScript.
- Тесты: `node:test` + `assert/strict`, подключение в `package.json` → `npm test`.
- Не трогать ботов, хост, заявки, `public/data/*.json`, reset_from, алгоритм стыка, `EquityChart.jsx`, мини-графики, `scripts/sync-equity.mjs`, `scripts/publish-equity-data.mjs`.

## Архитектурные решения

- WEB-EQUITY-CHARTS-01: один `createChart` с двумя штатными панелями (`addSeries(..., paneIndex)`, `addPane(true)`), общее перекрестие и одна ось времени. Без второй библиотеки и без ручной синхронизации двух chart.
- Производные месячные поля (MoM, календарные пропуски, подписи) живут в `src/stitchedChartModel.js`. `stitchEquity.js` (стык, EMA100, YoY, SMA36) не переписывается.
- Внешняя рамка `.stitch-chart-frame` (border) отдельно от внутреннего `.stitch-chart-host` (без border/padding). Один ResizeObserver на content-box host. Высота host 600px при ширине ≥768, иначе 520px. `timeScale.minimumHeight = 36` внутри размера chart.
- Причина обрезания до правки (DOM, не гипотеза): глобальный `* { box-sizing: border-box }` + `.stitch-chart { height: 320px; border: 1px; overflow: hidden }` давали content-box 318px при `createChart(..., height: 320)`, ось времени рисовалась внизу canvas и резалась overflow.
- WEB-PAPER-LIVE-01 этап A: общий каркас витрины, раздельные ленты и состояние. Режим берётся из URL, не из localStorage и не из имени счёта. Один `bot_id::account_id` может существовать в обоих режимах как две разные записи; словари истории не сливаются. LIVE не вызывает `stitchEquity`, `historyReset` и PAPER-резолверы. Список LIVE не угадывается: только согласованный `liveCatalog.js`.

## Реестр ТЗ для исполнителя

| ID | Название | Статус | Ветка / PR |
| --- | --- | --- | --- |
| WEB-EQUITY-CHARTS-01 | Единое перекрестие и полная шкала дат для трека эквити | в работе | `fix/equity-shared-crosshair-and-time-axis` |
| WEB-PAPER-LIVE-01 | Раздел «БОТЫ LIVE» и переключатель PAPER/LIVE | этап A в работе; этап B не начат | `feat/paper-live-portal` |

Этап A — интерфейс, изоляция, загрузчик и тесты на фикстурах. Этап B — только после разрешённого публичного фида и отдельной проверки опубликованных данных. Готовность A не означает подключение реальных роботов.

## Журнал ревью

- 2026-10-17: самопроверка WEB-EQUITY-CHARTS-01 — модель 17 тестов, unified chart, без merge на прод.
- 2026-10-17: на превью при zoom 200% левая метка «2021» резалась скруглением рамки; host без padding, inset перенесён на `.stitch-chart-frame`.
- 2026-10-28: WEB-PAPER-LIVE-01 этап A — маршруты `#/paper` / `#/live`, пустой LIVE без fallback на PAPER, фикстуры только в `tests/fixtures/`. Production и gh-pages не публиковались.

## Известные ловушки проекта

- lightweight-charts v5: `addSeries(LineSeries, options, paneIndex)`, не `addLineSeries`.
- Time как YYYY-MM-01 нельзя переводить через локальный `Date.getMonth()` — сдвиг месяца. Только UTC / business day / срез строки.
- WhitespaceData = `{ time }` без `value`. Ноль — это значение, не дыра.
- Синк эквити в master каждые ~15 мин; rebase только, без force-push поверх sync.
- `og-cover` / `share.html` пересобираются `npm run build`; не коммитить, если не часть задачи.
- `equityLiveData.js` и `VITE_EQUITY_LIVE_DATA_BASE` — бумажная лента с Pages. Не подключать их к вкладке LIVE из-за слова Live.
- LIVE не использует `PORTAL_SHELLS`, `mergePortalAccounts` и глобальные PAPER-исключения. Пустой каталог — норма этапа A.
- Совпавший `bot_id` не даёт права брать PAPER-ряд, seed, `%` или склейку для LIVE. Без TWR проценты и PnL на LIVE не показывать.
- `valuation_basis: "unknown"` скрывает число и график, даже если в JSON есть `equity`.
- Не хранить LIVE-данные в localStorage / sessionStorage / IndexedDB / SW.

## Уроки

- P03 (нулевой/битый seed) нельзя чинить запасной базой, если поле seed в ленте есть.
- Склейка who_pays без публичной ленты сделок — честное «Склейки нет», не пустой график.
- Модель месяца и курсор должны смотреть по ключу YYYY-MM, не по индексу: YoY начинается позже equity.
- Клиентский режим не защищает приватные поля: всё, что попало в публичный JSON, читается напрямую.
