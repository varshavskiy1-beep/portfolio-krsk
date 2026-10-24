#!/usr/bin/env node
/**
 * Публикует только живые артефакты эквити на ветку gh-pages (GitHub Pages).
 * Master / Vercel не трогаем — UI тянет JSON с Pages, backtests остаётся на code-deploy.
 *
 * Usage: node scripts/publish-equity-data.mjs [--dry-run]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const PUBLISH_FILES = [
  { src: "public/data/latest.json", dest: "data/latest.json" },
  { src: "public/data/history.json", dest: "data/history.json" },
  { src: "public/og-cover.jpg", dest: "og-cover.jpg" },
  { src: "public/og-cover.png", dest: "og-cover.png" },
  { src: "public/share.html", dest: "share.html" },
];

function run(cmd, args, { cwd = root, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0 && !allowFail) {
    const err = (r.stderr || r.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed: ${err || r.status}`);
  }
  return r;
}

function loadGeneratedAt() {
  const p = path.join(root, "public", "data", "latest.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!raw?.generated_at) throw new Error("latest.json missing generated_at");
  return raw.generated_at;
}

function copyArtifacts(workDir) {
  for (const { src, dest } of PUBLISH_FILES) {
    const from = path.join(root, src);
    if (!fs.existsSync(from)) throw new Error(`missing ${src}`);
    const to = path.join(workDir, dest);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  const nojekyll = path.join(workDir, ".nojekyll");
  if (!fs.existsSync(nojekyll)) fs.writeFileSync(nojekyll, "");
}

function main() {
  const generatedAt = loadGeneratedAt();
  const message = `sync equity data ${generatedAt}`;

  if (dryRun) {
    console.log(`dry-run: would commit on gh-pages: ${message}`);
    for (const { src, dest } of PUBLISH_FILES) {
      console.log(`  ${src} -> ${dest}`);
    }
    return;
  }

  run("git", ["fetch", "origin", "gh-pages"]);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "equity-gh-pages-"));
  try {
    run("git", ["worktree", "add", "--force", "-B", "gh-pages", workDir, "origin/gh-pages"]);
    copyArtifacts(workDir);
    run("git", ["add", ...PUBLISH_FILES.map((f) => f.dest), ".nojekyll"], { cwd: workDir });
    const status = run("git", ["status", "--porcelain"], { cwd: workDir });
    if (!status.stdout.trim()) {
      console.log("gh-pages: no changes");
      return;
    }
    run("git", ["commit", "-m", message], { cwd: workDir });
    run("git", ["push", "origin", "gh-pages"], { cwd: workDir });
    console.log(`published gh-pages: ${message}`);
  } finally {
    run("git", ["worktree", "remove", "--force", workDir], { allowFail: true });
  }
}

main();
