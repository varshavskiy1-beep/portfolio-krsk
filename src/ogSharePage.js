/**
 * Static share page for Telegram / Open Graph crawlers.
 * Meta tags stay in the document so bots can read the chart preview;
 * real browsers (including Telegram in-app) redirect immediately to `/`.
 */
import { OG_SITE, ogDescription, ogTitle } from "./ogWinner.js";

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderSharePage({ row, image }) {
  const title = ogTitle(row);
  const desc = ogDescription(row);
  const pageUrl = `${OG_SITE}/`;
  const t = escapeHtml(title);
  const d = escapeHtml(desc);
  const img = escapeHtml(image);
  const url = escapeHtml(pageUrl);
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="portfolio_krsk" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <link rel="image_src" href="${img}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <meta http-equiv="refresh" content="0; url=/" />
    <script>location.replace("/")</script>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #f6f4ef;
        color: #1a1a1a;
      }
      main {
        max-width: 720px;
        margin: 0 auto;
        padding: 28px 20px 48px;
      }
      img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 16px;
        background: #fff;
      }
      p { line-height: 1.45; }
      a { color: #2b4c7e; }
    </style>
  </head>
  <body>
    <main>
      <img src="${img}" alt="${t}" width="1200" height="630" />
      <noscript>
        <p>${d}</p>
        <p><a href="/">Открыть кабинет portfolio_krsk</a></p>
      </noscript>
    </main>
  </body>
</html>
`;
}
