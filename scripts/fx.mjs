#!/usr/bin/env node
// pixelfx workflow for this game:  pixelfx (pinned) -> render -> sprite sheet (PNG + JSON) -> public/assets/fx -> game
//
//   node scripts/fx.mjs setup [--force] [--quiet]   fetch pixelfx at the pinned commit into vendor/pixelfx
//   node scripts/fx.mjs list [words...]              search the 240+ effects
//   node scripts/fx.mjs render <id> [--opts JSON]    contact sheet (+ --gif/--mp4) in vendor/pixelfx/records/<id>/
//   node scripts/fx.mjs import <id> [--as name] [--opts JSON] [--seed N]
//                                                    render a sprite sheet and install it in public/assets/fx/
//   node scripts/fx.mjs installed                    list effects the game has
//   node scripts/fx.mjs menu                         interactive: category -> effect -> import
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const LOCK = JSON.parse(readFileSync(join(HERE, "pixelfx.lock.json"), "utf8"));
const VENDOR = join(ROOT, "vendor", "pixelfx");
const FX_DIR = join(ROOT, "public", "assets", "fx");
const MANIFEST = join(FX_DIR, "manifest.json");

const argv = process.argv.slice(2), cmd = argv.shift();
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) pos.push(a);
  else if (["force", "quiet", "gif", "mp4", "all"].includes(a.slice(2))) flags[a.slice(2)] = true;
  else flags[a.slice(2)] = argv[++i];
}
const log = (...a) => { if (!flags.quiet) console.log(...a); };
const run = (c, args, opts = {}) => {
  const r = spawnSync(c, args, { stdio: opts.inherit ? "inherit" : "pipe", encoding: "utf8", ...opts });
  if (r.status !== 0 && !opts.soft) throw new Error(`${c} ${args.join(" ")} failed\n${r.stderr || ""}`);
  return r;
};
const head = () => (existsSync(join(VENDOR, ".git")) ? run("git", ["-C", VENDOR, "rev-parse", "HEAD"], { soft: true }).stdout.trim() : "");

function setup() {
  if (!flags.force && head() === LOCK.commit && existsSync(join(VENDOR, "tools", "render.mjs"))) { log(`pixelfx ${LOCK.version} @ ${LOCK.commit.slice(0, 7)} ready`); return; }
  log(`fetching pixelfx ${LOCK.version} @ ${LOCK.commit.slice(0, 7)} ...`);
  rmSync(VENDOR, { recursive: true, force: true });
  mkdirSync(VENDOR, { recursive: true });
  run("git", ["-C", VENDOR, "init", "-q"]);
  run("git", ["-C", VENDOR, "remote", "add", "origin", LOCK.repo]);
  // Only what we need. gallery/ (Patch Pixel font, NOT MIT) and the big README gifs are never checked out.
  run("git", ["-C", VENDOR, "sparse-checkout", "init", "--no-cone"]);
  writeFileSync(join(VENDOR, ".git", "info", "sparse-checkout"),
    ["/src/", "/tools/", "/skills/", "/.claude-plugin/", "/docs/AUTHORING.md", "/docs/CATALOG.md", "/LICENSE", "/NOTICE.md", "/package.json", ""].join("\n"));
  const f = run("git", ["-C", VENDOR, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", LOCK.commit], { soft: true });
  if (f.status !== 0) run("git", ["-C", VENDOR, "fetch", "-q", "--depth", "1", "origin", LOCK.commit]);
  run("git", ["-C", VENDOR, "checkout", "-q", "FETCH_HEAD"]);
  rmSync(join(VENDOR, "gallery"), { recursive: true, force: true });
  if (head() !== LOCK.commit) throw new Error("pixelfx commit mismatch");
  log("done.");
}
const need = () => { if (!existsSync(join(VENDOR, "tools", "render.mjs"))) setup(); };
const pfx = (tool, args, inherit = true) => run("node", [join(VENDOR, "tools", tool), ...args], { cwd: VENDOR, inherit, soft: true });

function manifest() { try { return JSON.parse(readFileSync(MANIFEST, "utf8")); } catch { return {}; } }

function importFx(id, { as, opts, seed } = {}) {
  need();
  const name = as || id.split("/")[1];
  const out = join(VENDOR, "records", "_import");
  rmSync(out, { recursive: true, force: true });
  const args = [id, "--sheet", "--out", out];
  if (opts) args.push("--opts", typeof opts === "string" ? opts : JSON.stringify(opts));
  if (seed) args.push("--seed", String(seed));
  const r = pfx("render.mjs", args, false);
  if (r.status !== 0) throw new Error(`render failed for ${id}\n${r.stdout}\n${r.stderr}`);
  const src = join(out, id, id.split("/")[1]);
  mkdirSync(FX_DIR, { recursive: true });
  copyFileSync(src + ".png", join(FX_DIR, name + ".png"));
  const sheet = JSON.parse(readFileSync(src + ".json", "utf8"));
  sheet.meta.image = name + ".png";
  writeFileSync(join(FX_DIR, name + ".json"), JSON.stringify(sheet));
  const m = manifest(), px = sheet.meta.pixelfx;
  m[name] = { id, fps: px.fps, loop: px.loop, frames: px.frames, frameSize: px.frameSize, pivot: px.pivot, ...(opts ? { opts: typeof opts === "string" ? JSON.parse(opts) : opts } : {}) };
  writeFileSync(MANIFEST, JSON.stringify(m, null, 1) + "\n");
  console.log(`imported ${id} -> public/assets/fx/${name}.png/.json  (${px.frames} frames @ ${px.fps}fps, pivot ${px.pivot})`);
  console.log(`play it in-game: spawnFx('${name}', x, y)`);
}

async function menu() {
  need();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const cats = readdirSync(join(VENDOR, "src", "fx"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (;;) {
    console.log("\n=== pixelfx menu ===  (q = quit)");
    cats.forEach((c, i) => console.log(`${String(i + 1).padStart(2)}. ${c}`));
    console.log(" i. installed in game   s. search");
    const a = (await rl.question("> ")).trim();
    if (a === "q") break;
    if (a === "i") { installed(); continue; }
    if (a === "s") { const q = await rl.question("search: "); console.log(pfx("list.mjs", q.split(/\s+/), false).stdout); }
    else if (cats[+a - 1]) console.log(pfx("list.mjs", [cats[+a - 1]], false).stdout);
    else continue;
    const id = (await rl.question("effect id to import ('p <id>' = preview contact sheet, blank = back): ")).trim();
    if (!id) continue;
    if (id.startsWith("p ")) { pfx("render.mjs", [id.slice(2)]); console.log(`see vendor/pixelfx/records/${id.slice(2)}/contact.png`); continue; }
    importFx(id);
  }
  rl.close();
}
function installed() {
  const m = manifest();
  if (!Object.keys(m).length) return console.log("(no effects installed yet)");
  for (const [k, v] of Object.entries(m)) console.log(`${k.padEnd(18)} ${v.id.padEnd(24)} ${v.frames}f @ ${v.fps}fps  ${v.frameSize.join("x")}  pivot ${v.pivot}`);
}

try {
  switch (cmd) {
    case "setup": setup(); break;
    case "list": need(); pfx("list.mjs", pos); break;
    case "render": need(); pfx("render.mjs", [...pos, ...Object.entries(flags).flatMap(([k, v]) => (v === true ? ["--" + k] : ["--" + k, v]))]); break;
    case "import": if (!pos[0]) throw new Error("usage: import <category/name> [--as name] [--opts JSON] [--seed N]"); importFx(pos[0], { as: flags.as, opts: flags.opts, seed: flags.seed }); break;
    case "installed": installed(); break;
    case "menu": await menu(); break;
    default: console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 12).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  }
} catch (e) { console.error(String(e.message || e)); process.exit(1); }
