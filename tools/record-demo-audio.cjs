// Записывает озвучку веб-демо «Деньночки» голосом Яндекса через функцию tik-voice.
// Профиль — CONFIG.DEMO_PROFILE (Маша, девочка, зайчик Буся).
//
// Когда запускать: поменялись тексты сказок, букв, скороговорок, загадок или счёта.
// Запуск из корня проекта:  node tools/record-demo-audio.cjs
// Уже записанные файлы пропускаются — чтобы перезаписать всё, удалите demo/dennochka/audio.
// Каждый запуск тратит немного денег на синтез речи в Yandex Cloud.
const fs = require("fs");
const path = require("path");
const DEMO = path.join(__dirname, "..", "demo", "dennochka");
const OUT = DEMO + "/audio";
const URL_BASE = "https://functions.yandexcloud.net/d4e3qm546p3ve0favrtr";
const VER = "o92n3q";
const PROFILE = { name: "Маша", g: "f", toy: "Буся", kind: "bunny" };

global.window = {};
const src = ["letters.js", "stories.js", "extras.js"].map(f => fs.readFileSync(path.join(DEMO, f), "utf8")).join("\n");
const { STORIES: ST, LETTERS: LT, TWISTERS: TW, RIDDLES: RD, COUNT: CN } =
  eval(src + ";({STORIES, LETTERS, TWISTERS, RIDDLES, COUNT})");

// Тот же ключ считает app.js — имя файла по параметрам запроса.
const demoKey = p => Object.keys(p).sort().map(k => k + "-" + (k === "l" ? p[k].codePointAt(0) : p[k])).join("_");

const jobs = [];
ST.forEach((s, si) => s.p.forEach((_, pi) => jobs.push({ s: si, p: pi })));
Object.keys(LT).forEach(l => { jobs.push({ l, part: "poem" }); jobs.push({ l, part: "sound" }); });
TW.forEach((_, i) => { jobs.push({ x: "tw", i }); jobs.push({ x: "tw", i, fast: 1 }); });
RD.forEach((_, i) => { jobs.push({ x: "rd", i, part: "q" }); jobs.push({ x: "rd", i, part: "a" }); });
CN.forEach((_, i) => { jobs.push({ x: "num", i, part: "w" }); jobs.push({ x: "num", i, part: "line" }); });

fs.mkdirSync(OUT, { recursive: true });
let done = 0, failed = [], bytes = 0;

async function one(p) {
  const file = path.join(OUT, demoKey(p) + ".mp3");
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) { done++; bytes += fs.statSync(file).size; return; }
  const q = new URLSearchParams(Object.assign({}, PROFILE, { v: VER }, p)).toString();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(URL_BASE + "?" + q, { signal: AbortSignal.timeout(60000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok || !(r.headers.get("content-type") || "").includes("audio") || buf.length < 1000)
        throw new Error(r.status + " " + (r.headers.get("content-type")) + " " + buf.slice(0, 200).toString());
      fs.writeFileSync(file, buf); done++; bytes += buf.length; return;
    } catch (e) {
      if (attempt === 3) failed.push([demoKey(p), String(e.message).slice(0, 200)]);
      else await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

(async () => {
  console.log("jobs:", jobs.length);
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await one(queue.shift()); }));
  console.log("done:", done, "failed:", failed.length, "MB:", (bytes / 1048576).toFixed(1));
  failed.forEach(f => console.log("FAIL", f[0], f[1]));
})();
