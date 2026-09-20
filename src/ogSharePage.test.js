import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSharePage } from "./ogSharePage.js";
import { ogDescription, ogImageHref, ogTitle } from "./ogWinner.js";

test("share page keeps og/twitter tags and redirects browsers to the portal", () => {
  const row = {
    account: { bot_id: "v6b1", account_id: "v6b1" },
    pnl: 4515.61,
    pct: 0.451561,
    currency: "USDT",
    key: "v6b1::v6b1",
  };
  const image = ogImageHref("2026-09-20T08:45:43Z");
  const html = renderSharePage({ row, image });

  assert.equal(html.includes("id=\"root\""), false);
  assert.match(html, /<meta property="og:url" content="https:\/\/portfolio-krsk\.vercel\.app\/" \/>/);
  assert.equal(html.includes("https://portfolio-krsk.vercel.app/share.html"), false);
  assert.match(html, /<meta property="og:image" content="https:\/\/portfolio-krsk\.vercel\.app\/og-cover\.jpg\?v=202609200845" \/>/);
  assert.match(html, /<meta property="og:image:type" content="image\/jpeg" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/portfolio-krsk\.vercel\.app\/og-cover\.jpg\?v=202609200845" \/>/);
  assert.match(html, /<meta http-equiv="refresh" content="0; url=\/" \/>/);
  assert.match(html, /<script>location\.replace\("\/"\)<\/script>/);
  assert.match(html, /<img src="https:\/\/portfolio-krsk\.vercel\.app\/og-cover\.jpg\?v=202609200845"/);
  assert.match(html, /<noscript>[\s\S]*<a href="\/">Открыть кабинет portfolio_krsk<\/a>/);
  assert.equal(html.includes(ogTitle(row)), true);
  assert.equal(html.includes(ogDescription(row)), true);
  assert.equal(html.includes("%3A"), false);
});
