#!/usr/bin/env node
/**
 * Renders public/og-cover.jpg (1200×630, q≈85) plus a PNG fallback for the
 * account with the largest absolute profit in money (equity − seed, no FX),
 * patches OG tags in index.html, and writes public/share.html
 * (og/twitter meta for crawlers; browsers redirect immediately to `/`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { canonicalCurrency } from "../src/cashCurrency.js";
import { renderSharePage } from "../src/ogSharePage.js";
import {
  formatPct,
  formatSignedMoney,
  ogDescription,
  ogImageHref,
  ogTitle,
  pickOgWinner,
  winnerLabel,
} from "../src/ogWinner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = "https://portfolio-krsk.vercel.app";
const W = 1200;
const H = 630;

const COLORS = {
  bg: "#f6f4ef",
  card: "#ffffff",
  ink: "#1a1a1a",
  muted: "#666666",
  line: "#e5e1d8",
  accent: "#2b4c7e",
  good: "#1f7a4c",
  bad: "#aa3333",
  chartFill: "rgba(31, 122, 76, 0.16)",
  chartFillNeg: "rgba(170, 51, 51, 0.14)",
  chartBg: "#faf9f6",
};

function defaultRoot() {
  return path.resolve(__dirname, "..");
}

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function registerFonts(root) {
  const bundled = [
    { file: "Inter-Regular.ttf", family: "OgSans", weight: 400 },
    { file: "Inter-Bold.ttf", family: "OgSans", weight: 700 },
  ];
  const dir = path.join(root, "scripts", "fonts");
  let ok = 0;
  for (const f of bundled) {
    const p = path.join(dir, f.file);
    if (fs.existsSync(p)) {
      GlobalFonts.registerFromPath(p, f.family);
      ok += 1;
    }
  }
  if (ok) return "OgSans";
  const fallbacks = [
    "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  ];
  for (const p of fallbacks) {
    if (fs.existsSync(p)) {
      GlobalFonts.registerFromPath(p, "OgSans");
      return "OgSans";
    }
  }
  return "sans-serif";
}

function formatSnap(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return String(iso);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function historyPoints(row) {
  const pts = [];
  for (const p of row?.series?.points || []) {
    const t = Date.parse(p.t);
    const eq = Number(p.equity);
    if (!Number.isFinite(eq)) continue;
    pts.push({ t: Number.isFinite(t) ? t : pts.length, eq });
  }
  pts.sort((a, b) => a.t - b.t);
  if (row?.seed != null && (pts.length === 0 || pts[0].eq !== row.seed)) {
    pts.unshift({ t: (pts[0]?.t ?? 0) - 86_400_000, eq: row.seed });
  }
  if (row && row.equity != null && (pts.length === 0 || pts[pts.length - 1].eq !== row.equity)) {
    pts.push({ t: (pts[pts.length - 1]?.t ?? 1) + 1, eq: row.equity });
  }
  return pts;
}

function downsample(points, maxN) {
  if (points.length <= maxN) return points;
  const out = [];
  const last = points.length - 1;
  for (let i = 0; i < maxN; i++) {
    const idx = Math.round((i / (maxN - 1)) * last);
    if (!out.length || out[out.length - 1] !== points[idx]) out.push(points[idx]);
  }
  return out;
}

function drawChart(ctx, points, seed, x, y, w, h, positive) {
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = COLORS.chartBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  const padL = 28;
  const padR = 20;
  const padT = 22;
  const padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const vals = points.map((p) => p.eq);
  if (seed != null) vals.push(seed);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;

  const nx = (i) => x + padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const ny = (v) => y + padT + (1 - (v - min) / (max - min)) * innerH;

  if (seed != null) {
    const sy = ny(seed);
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + padL, sy);
    ctx.lineTo(x + w - padR, sy);
    ctx.stroke();
    ctx.restore();
  }

  const stroke = positive ? COLORS.good : COLORS.bad;
  const fill = positive ? COLORS.chartFill : COLORS.chartFillNeg;
  ctx.beginPath();
  points.forEach((p, i) => {
    const px = nx(i);
    const py = ny(p.eq);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.lineTo(nx(points.length - 1), y + h - padB);
  ctx.lineTo(nx(0), y + h - padB);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    const px = nx(i);
    const py = ny(p.eq);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(nx(points.length - 1), ny(last.eq), 7, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
  ctx.strokeStyle = COLORS.card;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCard(ctx, row, generatedAt, fontFamily) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  roundRect(ctx, 36, 36, W - 72, H - 72, 28);
  ctx.fillStyle = COLORS.card;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(36, 36, 14, H - 72);

  const font = (size, weight = 400) =>
    `${weight === 700 ? "700" : "400"} ${size}px ${fontFamily}, "DejaVu Sans", sans-serif`;

  ctx.fillStyle = COLORS.muted;
  ctx.font = font(28, 400);
  ctx.fillText("portfolio_krsk", 78, 96);

  ctx.fillStyle = COLORS.accent;
  ctx.font = font(20, 700);
  const badge = row?.currency || "—";
  const badgeW = Math.max(90, ctx.measureText(badge).width + 28);
  roundRect(ctx, W - 78 - badgeW, 68, badgeW, 40, 10);
  ctx.fillStyle = "#e8eef7";
  ctx.fill();
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(badge, W - 78 - badgeW + (badgeW - ctx.measureText(badge).width) / 2, 96);

  const name = row ? winnerLabel(row) : "бумажные боты";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(36, 700);
  ctx.fillText(name, 78, 148);

  const positive = !row || row.pnl >= 0;
  const money = row ? `${formatSignedMoney(row.pnl, row.currency)} ${row.currency}` : "нет счёта с equity";
  ctx.fillStyle = positive ? COLORS.good : COLORS.bad;
  ctx.font = font(72, 700);
  ctx.fillText(money, 78, 236);

  const seedAmt = row ? formatSignedMoney(row.seed, row.currency).replace(/^\+/, "") : "";
  const pctLine = row
    ? `${formatPct(row.pct)}% от начального капитала ${seedAmt} ${row.currency}`
    : "эквити − начальный капитал, без конвертации валют";
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(28, 400);
  ctx.fillText(pctLine, 78, 282);

  const points = downsample(historyPoints(row), 80);
  if (points.length) {
    drawChart(ctx, points, row?.seed, 78, 318, W - 156, 196, positive);
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = font(20, 400);
  const when = formatSnap(generatedAt);
  const foot = when ? `эквити с запуска · прибыль в деньгах · ${when}` : "эквити с запуска · прибыль в деньгах";
  ctx.fillText(foot, 78, 552);
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function insertBeforeHeadClose(html, tag) {
  return html.replace(/\n?[ \t]*<\/head>/i, `\n    ${tag}\n  </head>`);
}

function upsertMeta(html, attr, key, content) {
  const re = new RegExp(`<meta\\s+[^>]*${attr}="${key}"[^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return insertBeforeHeadClose(html, tag);
}

function upsertLink(html, rel, href) {
  const re = new RegExp(`<link\\s+[^>]*rel="${rel}"[^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${escapeAttr(href)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return insertBeforeHeadClose(html, tag);
}

function patchIndexHtml(root, row, image) {
  const indexPath = path.join(root, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const desc = ogDescription(row);
  html = upsertMeta(html, "property", "og:title", ogTitle(row));
  html = upsertMeta(html, "property", "og:description", desc);
  html = upsertMeta(html, "property", "og:url", `${SITE}/`);
  html = upsertMeta(html, "property", "og:site_name", "portfolio_krsk");
  html = upsertMeta(html, "property", "og:locale", "ru_RU");
  html = upsertMeta(html, "property", "og:image", image);
  html = upsertMeta(html, "property", "og:image:secure_url", image);
  html = upsertMeta(html, "property", "og:image:type", "image/jpeg");
  html = upsertMeta(html, "property", "og:image:width", "1200");
  html = upsertMeta(html, "property", "og:image:height", "630");
  html = upsertMeta(html, "property", "og:type", "website");
  html = upsertMeta(html, "name", "description", desc);
  html = upsertMeta(html, "name", "twitter:card", "summary_large_image");
  html = upsertMeta(html, "name", "twitter:title", ogTitle(row));
  html = upsertMeta(html, "name", "twitter:description", desc);
  html = upsertMeta(html, "name", "twitter:image", image);
  html = upsertLink(html, "image_src", image);
  fs.writeFileSync(indexPath, html);
  return image;
}

function writeShareHtml(root, row, image) {
  const sharePath = path.join(root, "public", "share.html");
  fs.writeFileSync(sharePath, renderSharePage({ row, image }));
  return sharePath;
}

export function generateOgCover({ latest, history, root } = {}) {
  const base = root || defaultRoot();
  const latestPath = path.join(base, "public", "data", "latest.json");
  const historyPath = path.join(base, "public", "data", "history.json");
  const snap = latest || loadJson(latestPath, null);
  const hist = history || loadJson(historyPath, { series: {} });
  if (!snap) throw new Error("latest.json missing — cannot render OG cover");

  const row = pickOgWinner(snap, hist, canonicalCurrency);
  const generatedAt = snap.generated_at || new Date().toISOString();
  const fontFamily = registerFonts(base);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";
  ctx.antialias = "subpixel";
  drawCard(ctx, row, generatedAt, fontFamily);

  const jpgOut = path.join(base, "public", "og-cover.jpg");
  const pngOut = path.join(base, "public", "og-cover.png");
  fs.writeFileSync(jpgOut, canvas.encodeSync("jpeg", 85));
  fs.writeFileSync(pngOut, canvas.encodeSync("png"));
  const image = ogImageHref(generatedAt);
  patchIndexHtml(base, row, image);
  const sharePath = writeShareHtml(base, row, image);

  const label = row ? `${row.key} pnl=${row.pnl} ${row.currency}` : "no-winner";
  console.log(`og-cover ${jpgOut} ${W}x${H} q=85 winner=${label} image=${image} share=${sharePath}`);
  return { row, image, out: jpgOut, jpgOut, pngOut, sharePath };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateOgCover();
