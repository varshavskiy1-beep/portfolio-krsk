# portfolio_krsk

Публичная витрина результатов торговых роботов. Два режима одной страницы:

- **PAPER** — бумажные стратегии (`#/paper`, старые ссылки `#/s/<bot_id>`).
- **LIVE** — роботы на реальных счетах (`#/live`). В этапе A каталог пуст, пока владелец не согласует список и публичный фид.

Сайт не управляет торговлей, не принимает заявки и не является личным кабинетом.

Публичный UI: https://portfolio-krsk.vercel.app (ветка `master`, только код и снимок-запас `public/data/*`).

## Данные PAPER

`public/data/latest.json` (`equity_ro.v1`), `history.json`, `backtests.json`.

**Живые графики PAPER** без пересборки Vercel: `latest.json` и `history.json` браузер грузит с GitHub Pages — https://varshavskiy1-beep.github.io/portfolio-krsk/ (`EQUITY_LIVE_DATA_BASE` / `VITE_EQUITY_LIVE_DATA_BASE`). Это обновляемая бумажная лента, не раздел LIVE. При сбое Pages остаётся fallback на `/data/*` из последнего code-deploy. `backtests.json` только с Vercel.

Рутина sync (`scripts/sync-equity.mjs --publish` или отдельно `node scripts/publish-equity-data.mjs`) пушит **только** `data/latest.json`, `data/history.json`, `og-cover.*`, `share.html` в ветку `gh-pages`. В `master` sync данные и OG не коммитит.

## Данные LIVE

Публичные ресурсы будущего экспортёра:

```text
<VITE_LIVE_DATA_BASE>/data/live/latest.json
<VITE_LIVE_DATA_BASE>/data/live/history.json
```

`VITE_LIVE_DATA_BASE` — публичный абсолютный HTTPS URL, не секрет. Если переменная не задана, раздел LIVE не делает запросов и показывает пустое состояние. Бумажная база сюда не подставляется. Резервной копии LIVE в репозитории нет.

Схема снимка: `portfolio_live.v1` / `portfolio_live_history.v1`, поле `mode: "live"`, общий `snapshot_id`. `account_id` — публичный псевдоним, не номер брокерского счёта. Согласованный список — `src/liveCatalog.js` (сейчас пустой). Фикстуры только в `tests/fixtures/`, в `public/` и `dist/` не копируются.

Этап B (наполнение LIVE) начинается только после отдельного разрешения владельца на конкретные псевдонимы, поля и публикацию фида. Номера счетов, позиции, сделки, ключи и полный брокерский ответ в публичный JSON не входят.

## OG и Telegram

OG-превью для Telegram: обложка на Pages (`og-cover.jpg`, 1200×630) строится из PAPER-ленты. В `index.html` на Vercel `og:image` указывает на Pages; текстовые `og:*` в сыром `index.html` и в `public/share.html` (на gh-pages). `og:url` — портал `https://portfolio-krsk.vercel.app/`. Preview-деплой с `gh-pages` на Vercel отключён в `vercel.json`.

Если карточка не появляется, в Vercel выключите **Attack Challenge Protection** (Settings → Security): краулер Telegram не проходит JS-checkpoint.
