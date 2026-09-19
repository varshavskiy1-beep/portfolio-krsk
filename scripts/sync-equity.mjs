#!/usr/bin/env node
/**
 * Pull equity-ro latest.json and append points into public/data/history.json.
 * Env: EQUITY_HOST (default 193.109.85.48), EQUITY_USER (equity-ro),
 *      EQUITY_KEY (path to private key), EQUITY_REMOTE (/var/lib/equity-ro/latest.json)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function keyOf(a) {
  return `${a.bot_id}::${a.account_id}`;
}

function appendHistory(latest) {
  const hist = loadJson(historyPath, {
    schema: "equity_history.v1",
    updated_at: null,
    series: {},
  });
  const gen = latest.generated_at || new Date().toISOString();
  hist.updated_at = gen;
  for (const a of latest.accounts || []) {
    const k = keyOf(a);
    const eq = a.equity == null || a.equity === "" ? null : Number(a.equity);
    const ts = a.updated_utc || gen;
    if (!hist.series[k]) {
      hist.series[k] = {
        bot_id: a.bot_id,
        account_id: a.account_id,
        currency: a.currency,
        seed: a.seed == null || a.seed === "" ? null : Number(a.seed),
        points: [],
      };
    }
    const s = hist.series[k];
    if (a.seed != null && a.seed !== "") s.seed = Number(a.seed);
    s.currency = a.currency;
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
    // keep ~90 days at 1pt/min ≈ 130k — cap at 20k pts/account (~2 weeks @1min)
    if (pts.length > 20000) s.points = pts.slice(-20000);
  }
  fs.writeFileSync(historyPath, JSON.stringify(hist, null, 2));
  return hist;
}

scpLatest();
const latest = loadJson(latestPath, null);
if (!latest) throw new Error("latest.json missing after scp");
const hist = appendHistory(latest);
const n = Object.values(hist.series).reduce((s, x) => s + x.points.length, 0);
console.log(`ok latest=${latest.generated_at} series=${Object.keys(hist.series).length} points=${n}`);
