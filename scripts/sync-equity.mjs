#!/usr/bin/env node
/**
 * Pull equity-ro latest.json and append points into public/data/history.json.
 * After SCP, remaps cash currency by venue / bot_id (OKX crypto → USDT, FORTS/RU → RUB, US_EQ → USD).
 * --local skips SCP and only remaps the existing public/data snapshot + history series currency.
 * Does not read or write public/data/backtests.json (stitched daily books are committed separately).
 * Env: EQUITY_HOST (default 193.109.85.48), EQUITY_USER (equity-ro),
 *      EQUITY_KEY (path to private key), EQUITY_REMOTE (/var/lib/equity-ro/latest.json)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCanonicalCurrencies, canonicalCurrency } from "../src/cashCurrency.js";
import { applyHistoryResets, shouldAppendHistoryPoint } from "../src/historyReset.js";
import { capHistoryPoints, loadHistoryFile, writeJsonAtomic } from "../src/historyStore.js";
import { generateOgCover } from "./og-cover.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicData = path.join(root, "public", "data");
const latestPath = path.join(publicData, "latest.json");
const historyPath = path.join(publicData, "history.json");

const host = process.env.EQUITY_HOST || "193.109.85.48";
const user = process.env.EQUITY_USER || "equity-ro";
const key = process.env.EQUITY_KEY || `${process.env.HOME}/.ssh/macromonitor_equity_ro`;
const remote = process.env.EQUITY_REMOTE || "/var/lib/equity-ro/latest.json";

fs.mkdirSync(publicData, { recursive: true });

function scpLatest() {
  const r = spawnSync(
    "scp",
    ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", `${user}@${host}:${remote}`, latestPath],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`scp failed: ${r.stderr || r.stdout}`);
  }
}

function loadLatest(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    if (e && e.code === "ENOENT") throw new Error("latest.json missing");
    throw e;
  }
}

function keyOf(a) {
  return `${a.bot_id}::${a.account_id}`;
}

function appendHistory(latest) {
  const hist = loadHistoryFile(historyPath);
  const gen = latest.generated_at || new Date().toISOString();
  hist.updated_at = gen;
  // paper_block2 reset_from 2026-10-15T08:57:31Z; v6b1 reset_from 2026-10-15T17:27:12Z;
  // rf_bonds_rate_cycle reset_from 2026-10-10T08:13:19Z (drop wealth-index 2.44).
  // Drop the old books even if this history.json (or a merge with master) still has them.
  applyHistoryResets(hist);
  for (const a of latest.accounts || []) {
    const k = keyOf(a);
    const eq = a.equity == null || a.equity === "" ? null : Number(a.equity);
    const ts = a.updated_utc || gen;
    const currency = canonicalCurrency(a);
    if (!shouldAppendHistoryPoint(k, ts)) continue;
    if (!hist.series[k]) {
      hist.series[k] = {
        bot_id: a.bot_id,
        account_id: a.account_id,
        currency,
        seed: a.seed == null || a.seed === "" ? null : Number(a.seed),
        points: [],
      };
    }
    const s = hist.series[k];
    if (a.seed != null && a.seed !== "") s.seed = Number(a.seed);
    s.currency = currency;
    if (eq == null || Number.isNaN(eq)) continue;
    const pts = s.points;
    const last = pts[pts.length - 1];
    // skip duplicate identical consecutive points (same minute + same equity)
    if (last && last.t === ts && Math.abs(last.equity - eq) < 1e-9) continue;
    // if last point same second window within 50s and same equity — skip
    if (last && Math.abs(last.equity - eq) < 1e-9) {
      const t0 = Date.parse(last.t);
      const t1 = Date.parse(ts);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && Math.abs(t1 - t0) < 50_000) continue;
    }
    pts.push({ t: ts, equity: eq });
    s.points = capHistoryPoints(pts);
  }
  applyHistoryResets(hist);
  writeJsonAtomic(historyPath, hist);
  return hist;
}

const skipScp = process.argv.includes("--local");
if (!skipScp) scpLatest();
const latest = loadLatest(latestPath);
if (!latest) throw new Error(skipScp ? "latest.json missing" : "latest.json missing after scp");
applyCanonicalCurrencies(latest);
writeJsonAtomic(latestPath, latest, { trailingNewline: true });
const hist = appendHistory(latest);
const n = Object.values(hist.series).reduce((s, x) => s + x.points.length, 0);
console.log(`ok latest=${latest.generated_at} series=${Object.keys(hist.series).length} points=${n}`);
generateOgCover({ latest, history: hist, root });
