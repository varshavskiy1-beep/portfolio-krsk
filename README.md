# portfolio_krsk

Кабинет бумажных торговых ботов (paper only). Данные — `public/data/latest.json` (`equity_ro.v1`).

Публичный UI: https://portfolio-krsk.vercel.app (ветка `master`, только код и снимок-запас `public/data/*`).

**Живые графики** без пересборки Vercel: `latest.json` и `history.json` кабинет берёт с same-origin `/equity-live/data/*` (Vercel rewrite и `vite preview` proxy на существующий GitHub Pages `data/*`), иначе напрямую с https://varshavskiy1-beep.github.io/portfolio-krsk/. Браузер, которому github.io недоступен, всё равно получает живую пару через origin. При сбое обоих — tagged fallback на `/data/*` из последнего code-deploy, не тихий Oct 24. `backtests.json` только с Vercel (обновляется при деплое кода). Ни новых сервисов, ни секретов, ни 15-минутной пересборки.

Рутина sync (`scripts/sync-equity.mjs --publish` или отдельно `node scripts/publish-equity-data.mjs`) пушит **только** `data/latest.json`, `data/history.json`, `og-cover.*`, `share.html` в ветку `gh-pages`. В `master` sync данные и OG не коммитит.

OG-превью для Telegram: обложка на Pages (`og-cover.jpg`, 1200×630). В `index.html` на Vercel `og:image` указывает на Pages; текстовые `og:*` в сыром `index.html` и в `public/share.html` (на gh-pages). `og:url` — портал `https://portfolio-krsk.vercel.app/`. Preview-деплой с `gh-pages` на Vercel отключён в `vercel.json`.

Если карточка не появляется, в Vercel выключите **Attack Challenge Protection** (Settings → Security): краулер Telegram не проходит JS-checkpoint.
