// Headless browser QA: captures menu, hero viewer, courtyard and stage-1 gameplay.
// Usage: node tools/shoot.mjs <url> <outDir>
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [url = "http://127.0.0.1:8080/", out = "visuals/shots", w = "1280", h = "720"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log("saved", `${out}/${name}.png`); };
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loading")?.hidden === true, null, { timeout: 60000 });
await wait(2500); await shot("01-menu");
const click = async (id) => page.evaluate((i) => document.getElementById(i)?.click(), id);
await click("heroButton"); await wait(3000); await shot("02-hero");
await click("heroZoom"); await wait(3000); await shot("03-hero-face");
await click("heroRight"); await click("heroRight"); await wait(2000); await shot("04-hero-turn");
await click("heroBack"); await wait(500);
await click("play"); await wait(2500); await shot("05-courtyard");
await page.evaluate(() => window.marsSweetHeist?.beginChapter(0)); await wait(800);
await click("continue"); await wait(1500); await shot("06-stage1-start");
await page.keyboard.down("KeyW"); await wait(1500); await shot("07-stage1-run");
await page.keyboard.press("Space"); await wait(250); await shot("08-stage1-jump");
await page.keyboard.up("KeyW"); await wait(800);
for (const [i, era] of [1, 2, 3].entries()) {
  await page.evaluate((e) => { const g = window.marsSweetHeist; g.campaign.data.unlocked = 3; g.beginChapter(e); }, era);
  await wait(600); await click("continue"); await wait(1200);
  await page.keyboard.down("KeyW"); await wait(900); await page.keyboard.up("KeyW"); await wait(300);
  await shot(`0${9 + i}-era${era + 1}`.replace("012", "12").replace("011", "11").replace("010", "10"));
}
console.log(logs.filter((l) => !l.includes("GPU stall")).slice(0, 40).join("\n"));
await browser.close();
