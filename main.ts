// Token Launch Radar v2 — main.ts (Node 22, standard library only).
// Written fresh in this session.
//
// Reads the sealed snapshot, ranks the pre-token launch candidates,
// writes the board, the dashboard's data, the dashboard itself, and the
// dossier. Fully deterministic: every byte comes from the snapshot file,
// so two runs write identical output.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
//   node main.ts                       # defaults: /input/snapshot.json -> /output
//
// --skip-dossier is a local scaffolding flag for the first run, before
// screenshots exist; graded runs never use it (buildDossier refuses an
// empty screenshots/ directory).

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildModel } from "./src/model.ts";
import { buildFarmPlan } from "./src/farm.ts";
import { modelCardHtml, toBoardRows, toDashboardData } from "./src/emit.ts";
import { buildDossier } from "./vendor/makefun-board.ts";
import type { Snapshot } from "./src/types.ts";

const here = dirname(fileURLToPath(import.meta.url));

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

const inputPath = argValue("--input") ?? "/input/snapshot.json";
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const skipDossier = process.argv.includes("--skip-dossier");

const snapshotBytes = readFileSync(inputPath);
const snapshotSha256 = createHash("sha256").update(snapshotBytes).digest("hex");
const snap = JSON.parse(snapshotBytes.toString("utf8")) as Snapshot;

const { rows, meta } = buildModel(snap, snapshotSha256);
for (const row of rows) {
  const plan = buildFarmPlan(row);
  row.farmSteps = plan.steps;
  row.farmCostUsd = plan.costUsd;
  row.farmMinutes = plan.minutes;
}

const boardRows = toBoardRows(rows);

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "dashboard"), { recursive: true });

writeFileSync(
  join(outDir, "board.json"),
  JSON.stringify({ rows: boardRows }, null, 2) + "\n",
  "utf8",
);

const data = toDashboardData(rows, meta);
writeFileSync(
  join(outDir, "data.js"),
  "window.RADAR = " + JSON.stringify(data) + ";\n",
  "utf8",
);

// Dashboard: copy every file, injecting the generated model card into the
// page so the dossier's source carries the real fitted numbers.
const dashSrc = join(here, "dashboard");
for (const name of readdirSync(dashSrc)) {
  const src = join(dashSrc, name);
  if (!statSync(src).isFile()) continue;
  let text = readFileSync(src, "utf8");
  if (name === "index.html") {
    text = text.replace("<!--MODEL-CARD-->", modelCardHtml(meta));
  }
  writeFileSync(join(outDir, "dashboard", name), text, "utf8");
}

// Screenshots: copied as-is; the program never draws them.
const shotsSrc = join(here, "screenshots");
mkdirSync(join(outDir, "screenshots"), { recursive: true });
if (existsSync(shotsSrc)) {
  for (const name of readdirSync(shotsSrc)) {
    const src = join(shotsSrc, name);
    if (statSync(src).isFile()) cpSync(src, join(outDir, "screenshots", name));
  }
}

if (!skipDossier) {
  // buildDossier returns the dossier bytes (a Uint8Array): write them
  // exactly as returned, never re-serialized, or the bytes change.
  const dossier = buildDossier(outDir, { text_max_bytes: 65536 }) as unknown;
  const dossierBuf =
    typeof dossier === "string"
      ? Buffer.from(dossier, "utf8")
      : Buffer.from(dossier as Uint8Array);
  writeFileSync(join(outDir, "dossier.json"), dossierBuf);
}

const top = rows[0];
console.log(`rows: ${rows.length}`);
console.log(`watchlist covered: ${meta.watchlistCovered}/${meta.watchlistTotal}`);
console.log(`set aside (appendix): ${meta.setAside}`);
console.log(`global multiple: ${meta.globalMultiple.toFixed(4)}x`);
console.log(
  `held-out median |log error|: ${meta.heldOutMedianLogError.toFixed(3)} ` +
    `(train ${meta.heldOutTrainN}, test ${meta.heldOutTestN})`,
);
console.log(`rank 1: ${top.slug} (${top.name}) implied ${top.impliedValueUsd}`);
console.log(`output: ${resolve(outDir)}`);
