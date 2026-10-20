#!/usr/bin/env node
/**
 * Pull equity-ro latest.json and append points into public/data/history.json.
 * An account with a non-empty equity_curve replaces its history series entirely
 * with that curve (equity → number); other accounts stay append-only.
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
import { applyCanonicalCurrencies } from "../src/cashCurrency.js";
import { mergeLatestIntoHistory } from "../src/historyMerge.js";
import { loadHistoryFile, writeJsonAtomic } from "../src/historyStore.js";
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

function appendHistory(latest) {
  const hist = mergeLatestIntoHistory(loadHistoryFile(historyPath), latest);
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
