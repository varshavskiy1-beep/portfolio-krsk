# portfolio_krsk

Кабинет бумажных торговых ботов (paper only). Данные — `public/data/latest.json` (`equity_ro.v1`).

Публичный сайт: https://portfolio-krsk.vercel.app

OG-превью для Telegram: `public/og-cover.jpg` (1200×630, JPEG q≈85; PNG остаётся как запасной файл). Счёт с максимальной прибылью в деньгах: equity − seed, без FX. Теги `og:*` лежат в сыром `index.html` и в статической `public/share.html` (копируется в `dist/share.html`). Краулеры читают мета и картинку; живой браузер сразу уходит на кабинет `/`. `og:url` указывает на портал `https://portfolio-krsk.vercel.app/`. `og:image` — абсолютный `https://portfolio-krsk.vercel.app/og-cover.jpg` с коротким `?v=YYYYMMDDHHMM` (без ISO и `%3A`). `robots.txt` разрешает всех краулеров. После деплоя кэш Telegram можно сбросить через https://t.me/webpagebot; надёжная проверка — переслать `https://portfolio-krsk.vercel.app/share.html` в Saved Messages (ответ webpagebot часто без карточки даже после успешного обновления).

Если карточка всё ещё не появляется, в проекте Vercel стоит выключить **Attack Challenge Protection** (Settings → Security): краулер Telegram не проходит JS-checkpoint.
