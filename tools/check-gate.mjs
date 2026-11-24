// Token Launch Radar v2 — local gate checker (fresh, implements the seven
// gate rows from the kit's RULES.txt). Node 22+, standard library only.
//   node tools/check-gate.mjs [out-dir] [snapshot.json]

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildDossier } from "../vendor/makefun-board.ts";

const outDir = process.argv[2] ?? "out";
const snapPath =
  process.argv[3] ??
  "/home/hatch/workspace/makefun/token-radar/kit/input/snapshot.json";

const snap = JSON.parse(readFileSync(snapPath, "utf8"));
const protocols = new Set(snap.protocols.map((p) => p.slug));
const watchlist = snap.watchlist;

let pass = 0;
let fail = 0;
function row(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

function listFiles(dir, base = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? base + "/" + name : name;
    if (statSync(p).isDirectory()) out.push(...listFiles(p, rel));
    else out.push(rel);
  }
  return out.sort();
}

const NAME_OK = /^[A-Za-z0-9._-]{1,128}$/;

// --- 1. dashboard_files ---------------------------------------------------
{
  const dashDir = join(outDir, "dashboard");
  const files = listFiles(dashDir);
  let detail = `${files.length} files`;
  let ok = files.length <= 400;
  let total = 0;
  let hasHtml = false;
  let hasCss = false;
  let hasJs = false;
  for (const f of files) {
    const parts = f.split("/");
    if (parts.some((x) => x.startsWith(".")) || parts.some((x) => x.startsWith("-"))) ok = false;
    if (!NAME_OK.test(parts[parts.length - 1])) ok = false;
    const buf = readFileSync(join(dashDir, f));
    total += buf.length;
    if (f === "index.html") hasHtml = true;
    if (f.endsWith(".css")) hasCss = true;
    if (f.endsWith(".js")) hasJs = true;
    const text = buf.toString("utf8");
    if (text.includes("http://") || text.includes("https://")) {
      ok = false;
      detail += `; network address in ${f}`;
    }
  }
  if (total > 4 * 1024 * 1024) ok = false;
  if (!hasHtml || !hasCss || !hasJs) ok = false;
  detail += `, ${total} bytes, html=${hasHtml} css=${hasCss} js=${hasJs}`;
  row("dashboard_files", ok, detail);
}

// --- 2-5. board ------------------------------------------------------------
const board = JSON.parse(readFileSync(join(outDir, "board.json"), "utf8"));
const rows = Array.isArray(board) ? board : board.rows;
const boardBytes = statSync(join(outDir, "board.json")).size;
{
  let ok = rows.length >= 100 && rows.length <= 4000 && boardBytes <= 8 * 1024 * 1024;
  let bad = null;
  for (const r of rows) {
    if (!protocols.has(r.slug)) { bad = "unknown slug " + r.slug; break; }
    if (typeof r.name !== "string" || r.name.length === 0) { bad = "empty name"; break; }
    if (!Number.isInteger(r.rank) || r.rank <= 0) { bad = "bad rank"; break; }
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) { bad = "bad implied value"; break; }
    if (!Array.isArray(r.farm_steps)) { bad = "farm_steps not array"; break; }
  }
  if (bad) ok = false;
  row("board_file", ok, `${rows.length} rows, ${boardBytes} bytes${bad ? "; " + bad : ""}`);
}
{
  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  let ok = ranks.length > 0 && ranks.every((v, i) => v === i + 1);
  const byRank = [...rows].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i].implied_value_usd > byRank[i - 1].implied_value_usd) ok = false;
  }
  if (new Set(rows.map((r) => r.implied_value_usd)).size < 2) ok = false;
  row("sorted_by_value", ok, `ranks 1..${rows.length}, top implied ${byRank[0]?.implied_value_usd}`);
}
{
  const have = new Set(rows.map((r) => r.slug));
  const missing = watchlist.filter((s) => !have.has(s));
  row("coverage", missing.length === 0, `${watchlist.length - missing.length}/${watchlist.length} watchlist covered${missing.length ? "; missing " + missing.slice(0, 5).join(",") : ""}`);
}
{
  let ok = true;
  let bad = null;
  for (const r of rows) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) { ok = false; bad = r.slug + " step count " + steps.length; break; }
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) { ok = false; bad = r.slug + " step length " + t.length; break; }
    }
    if (!ok) break;
  }
  row("farm_steps", ok, bad ?? `${rows.length} rows x ${rows[0]?.farm_steps.length} steps`);
}

// --- 6. screenshots ---------------------------------------------------------
function pngSize(buf) {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}
{
  const dir = join(outDir, "screenshots");
  const files = readdirSync(dir).filter((f) => !f.startsWith(".")).sort();
  let ok = files.length >= 3 && files.length <= 4;
  let detail = `${files.length} images`;
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    if (buf.length > 512 * 1024) { ok = false; detail += `; ${f} ${buf.length}B over cap`; }
    const size = pngSize(buf) ?? jpegSize(buf);
    if (!size) { ok = false; detail += `; ${f} not PNG/JPEG`; continue; }
    const long = Math.max(size.w, size.h);
    const short = Math.min(size.w, size.h);
    if (long > 1440 || short < 800) { ok = false; detail += `; ${f} ${size.w}x${size.h}`; }
    detail += `; ${f} ${size.w}x${size.h} ${Math.round(buf.length / 1024)}KB`;
  }
  row("screenshots", ok, detail);
}

// --- 7. dossier_matches ------------------------------------------------------
{
  const expected = buildDossier(outDir, { text_max_bytes: 65536 });
  const expectedBuf =
    typeof expected === "string"
      ? Buffer.from(expected, "utf8")
      : Buffer.from(expected);
  const actual = readFileSync(join(outDir, "dossier.json"));
  const ok = actual.equals(expectedBuf);
  row("dossier_matches", ok, `dossier ${actual.length} bytes, expected ${expectedBuf.length} bytes`);
}

// --- info: dashboard source size vs the 64 KB dossier text cap --------------
{
  const dashDir = join(outDir, "dashboard");
  const total = listFiles(dashDir).reduce((n, f) => n + statSync(join(dashDir, f)).size, 0);
  console.log(`INFO  dashboard source total ${total} bytes (dossier text cap 65536)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
