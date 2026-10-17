# ENGINEER.md

## Проект

portfolio-krsk — кабинет бумажных счетов (Vite 6.4.3, React 19.3.0, lightweight-charts 5.2.1). Страницы стратегий `#/s/<bot_id>`. Живые счета скрыты. Данные: `public/data/latest.json`, `history.json`, `backtests.json`. Синк в master примерно каждые 15 минут; эти коммиты не переписывать.

## Соглашения кода

- UI по-русски; идентификаторы, комментарии и коммиты по-английски.
- JS + JSDoc, без TypeScript.
- Тесты: `node:test` + `assert/strict`, подключение в `package.json` → `npm test`.
- Не трогать ботов, хост, заявки, `public/data/*.json`, reset_from, алгоритм стыка, `EquityChart.jsx`, мини-графики.

## Архитектурные решения

- WEB-EQUITY-CHARTS-01: один `createChart` с двумя штатными панелями (`addSeries(..., paneIndex)`, `addPane(true)`), общее перекрестие и одна ось времени. Без второй библиотеки и без ручной синхронизации двух chart.
- Производные месячные поля (MoM, календарные пропуски, подписи) живут в `src/stitchedChartModel.js`. `stitchEquity.js` (стык, EMA100, YoY, SMA36) не переписывается.
- Внешняя рамка `.stitch-chart-frame` (border) отдельно от внутреннего `.stitch-chart-host` (без border/padding). Один ResizeObserver на content-box host. Высота host 600px при ширине ≥768, иначе 520px. `timeScale.minimumHeight = 36` внутри размера chart.
- Причина обрезания до правки (DOM, не гипотеза): глобальный `* { box-sizing: border-box }` + `.stitch-chart { height: 320px; border: 1px; overflow: hidden }` давали content-box 318px при `createChart(..., height: 320)`, ось времени рисовалась внизу canvas и резалась overflow.

## Реестр ТЗ для исполнителя

| ID | Название | Статус | Ветка / PR |
| --- | --- | --- | --- |
| WEB-EQUITY-CHARTS-01 | Единое перекрестие и полная шкала дат для трека эквити | в работе | `fix/equity-shared-crosshair-and-time-axis` |

## Журнал ревью

- 2026-10-17: самопроверка WEB-EQUITY-CHARTS-01 — модель 17 тестов, unified chart, без merge на прод.
- 2026-10-17: на превью при zoom 200% левая метка «2021» резалась скруглением рамки; host без padding, inset перенесён на `.stitch-chart-frame`.

## Известные ловушки проекта

- lightweight-charts v5: `addSeries(LineSeries, options, paneIndex)`, не `addLineSeries`.
- Time как YYYY-MM-01 нельзя переводить через локальный `Date.getMonth()` — сдвиг месяца. Только UTC / business day / срез строки.
- WhitespaceData = `{ time }` без `value`. Ноль — это значение, не дыра.
- Синк эквити в master каждые ~15 мин; rebase только, без force-push поверх sync.
- `og-cover` / `share.html` пересобираются `npm run build`; не коммитить, если не часть задачи.

## Уроки

- P03 (нулевой/битый seed) нельзя чинить запасной базой, если поле seed в ленте есть.
- Склейка who_pays без публичной ленты сделок — честное «Склейки нет», не пустой график.
- Модель месяца и курсор должны смотреть по ключу YYYY-MM, не по индексу: YoY начинается позже equity.
