// Выкладывает сайт в Yandex Object Storage (бакет = домен сайта).
//
// Что нужно один раз:
//   1) в Яндекс Облаке создать бакет с именем, равным домену (mkotov.ru);
//   2) там же создать сервисный аккаунт и статический ключ доступа;
//   3) положить ключ в переменные окружения — их нет в проекте и в git:
//        setx YC_BUCKET     mkotov.ru
//        setx YC_KEY_ID     ...
//        setx YC_KEY_SECRET ...
//      после setx откройте новое окно терминала.
//
// Запуск из корня проекта:
//   node tools/deploy.cjs             — залить изменённые файлы
//   node tools/deploy.cjs --clean     — плюс удалить в бакете то, чего нет локально
//   node tools/deploy.cjs --website   — плюс включить режим сайта (index.html и 404.html)
//   node tools/deploy.cjs --dry       — только показать, что будет сделано
//
// Ключи никуда, кроме storage.yandexcloud.net, не уходят и в файлы не пишутся.
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const HOST = "storage.yandexcloud.net";
const REGION = "ru-central1";
const ROOT = path.join(__dirname, "..");

// Доступы берём из переменных окружения, а если их нет — из файла .env.deploy
// в корне проекта. Этот файл перечислен в .gitignore и в git не попадает.
function fromFile() {
  const f = path.join(ROOT, ".env.deploy");
  const out = {};
  if (!fs.existsSync(f)) return out;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
// Файл главнее переменных окружения: в нём значения видно глазами и легко
// поправить, а забытая переменная из прошлого опыта не подменит их молча.
const CFG = fromFile();
const BUCKET = CFG.YC_BUCKET || process.env.YC_BUCKET;
const KEY_ID = CFG.YC_KEY_ID || process.env.YC_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET = CFG.YC_KEY_SECRET || process.env.YC_KEY_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
const flag = f => process.argv.includes(f);
const DRY = flag("--dry");

if (!BUCKET || !KEY_ID || !SECRET) {
  console.error("Нет доступов. Заполните .env.deploy в корне проекта — см. комментарий в начале этого файла.");
  process.exit(1);
}
// Ключ Яндекса — только латиница, цифры и знаки. Кириллица значит, что
// в поле осталась подсказка вроде «сюда_идентификатор».
for (const [name, v] of [["YC_BUCKET", BUCKET], ["YC_KEY_ID", KEY_ID], ["YC_KEY_SECRET", SECRET]]) {
  if (!/^[\x21-\x7e]+$/.test(v)) {
    console.error(`В ${name} попал текст, которого там быть не может: «${v}». Проверьте .env.deploy.`);
    process.exit(1);
  }
}

/* ---------- что выкладываем ---------- */
// Всё, кроме служебного: истории git, настроек редактора, этих самых скриптов
// и заметок для себя. На сайте им делать нечего.
// Всё, что начинается с точки, не выкладываем никогда: там история git,
// настройки редактора и .env.deploy с ключом от этого самого бакета.
const SKIP_DIR = new Set(["node_modules", "tools"]);
const SKIP_FILE = new Set(["README.md"]);
const hidden = n => n.startsWith(".");

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (hidden(e.name)) continue;
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(dir, e.name), acc); }
    else if (!SKIP_FILE.has(e.name)) acc.push(path.join(dir, e.name));
  }
  return acc;
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".ico": "image/x-icon", ".mp3": "audio/mpeg",
  ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json"
};

// Страницы и настройки не кэшируем — правка должна быть видна сразу.
// Код держим час, картинки и звук — месяц: они меняются редко.
function cacheFor(ext) {
  if ([".html", ".xml", ".txt", ".json", ".webmanifest"].includes(ext)) return "no-cache";
  if ([".js", ".mjs", ".cjs", ".css"].includes(ext)) return "public, max-age=3600";
  return "public, max-age=2592000";
}

/* ---------- подпись запросов (AWS Signature V4) ---------- */
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
// Кодируем как требует подпись: не трогаем только A-Z a-z 0-9 - _ . ~
const enc1 = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const enc = p => p.split("/").map(enc1).join("/");
// В подписи у параметра без значения всё равно должен быть знак равенства
const canonQuery = q => !q ? "" : q.split("&").map(x => x.includes("=") ? x : x + "=").sort().join("&");

function sign({ method, key = "", query = "", body = Buffer.alloc(0), headers = {} }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amzDate.slice(0, 8);
  const hash = sha256(body);

  const all = Object.assign({ host: HOST, "x-amz-content-sha256": hash, "x-amz-date": amzDate }, headers);
  const names = Object.keys(all).map(n => n.toLowerCase()).sort();
  const canonHeaders = names.map(n => n + ":" + String(all[Object.keys(all).find(k => k.toLowerCase() === n)]).trim() + "\n").join("");
  const signed = names.join(";");

  const canonReq = [method, "/" + BUCKET + (key ? "/" + enc(key) : ""), canonQuery(query), canonHeaders, signed, hash].join("\n");
  const scope = `${date}/${REGION}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonReq)].join("\n");

  let k = hmac("AWS4" + SECRET, date);
  for (const part of [REGION, "s3", "aws4_request"]) k = hmac(k, part);

  all.Authorization = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${hmac(k, toSign).toString("hex")}`;
  return { headers: all, path: "/" + BUCKET + (key ? "/" + enc(key) : "") + (query ? "?" + query : "") };
}

function request(opts) {
  const { headers, path: p } = sign(opts);
  return new Promise((res, rej) => {
    const r = https.request({ host: HOST, method: opts.method, path: p, headers }, resp => {
      let data = "";
      resp.on("data", d => data += d);
      resp.on("end", () => resp.statusCode < 300
        ? res({ status: resp.statusCode, body: data })
        : rej(new Error(opts.method + " " + p + " → " + resp.statusCode + "\n" + data.slice(0, 400))));
    });
    r.on("error", rej);
    if (opts.body && opts.body.length) r.write(opts.body);
    r.end();
  });
}

/* ---------- что уже лежит в бакете ---------- */
async function listRemote() {
  const out = new Map();
  let token = "";
  do {
    const q = "list-type=2&max-keys=1000" + (token ? "&continuation-token=" + encodeURIComponent(token) : "");
    // в подписи параметры должны идти по алфавиту
    const query = q.split("&").sort().join("&");
    const { body } = await request({ method: "GET", query });
    // Кавычки вокруг контрольной суммы Яндекс отдаёт как &#34;, другие S3 — как &quot; или как есть.
    for (const m of body.matchAll(/<Key>([^<]+)<\/Key>[\s\S]*?<ETag>(?:&quot;|&#34;|")([^&"<]+)/g)) out.set(m[1], m[2]);
    token = (body.match(/<NextContinuationToken>([^<]+)</) || [])[1] || "";
  } while (token);
  return out;
}

/* ---------- поехали ---------- */
(async () => {
  const files = walk(ROOT).map(f => ({ abs: f, key: path.relative(ROOT, f).split(path.sep).join("/") }));
  console.log(`Локально: ${files.length} файлов. Бакет: ${BUCKET}`);

  const remote = await listRemote();
  console.log(`В бакете: ${remote.size}`);

  let up = 0, same = 0;
  for (const f of files) {
    const body = fs.readFileSync(f.abs);
    const md5 = crypto.createHash("md5").update(body).digest("hex");
    if (remote.get(f.key) === md5) { same++; continue; }

    const ext = path.extname(f.key).toLowerCase();
    up++;
    console.log(`  ↑ ${f.key} (${Math.round(body.length / 1024)} КБ)`);
    if (!DRY) await request({
      method: "PUT", key: f.key, body,
      headers: { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": cacheFor(ext) }
    });
  }

  const extra = [...remote.keys()].filter(k => !files.some(f => f.key === k));
  if (extra.length) {
    console.log(`Лишнее в бакете: ${extra.length} файлов${flag("--clean") ? ", удаляю" : " (удалить: --clean)"}`);
    for (const k of extra) {
      console.log("  × " + k);
      if (flag("--clean") && !DRY) await request({ method: "DELETE", key: k });
    }
  }

  if (flag("--website") && !DRY) {
    const body = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><WebsiteConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IndexDocument><Suffix>index.html</Suffix></IndexDocument><ErrorDocument><Key>404.html</Key></ErrorDocument></WebsiteConfiguration>');
    await request({ method: "PUT", query: "website", body, headers: { "content-type": "application/xml" } });
    console.log("Режим сайта включён: index.html и 404.html");
  }

  console.log(`\nГотово${DRY ? " (ничего не менял, это --dry)" : ""}: залито ${up}, без изменений ${same}.`);
  console.log(`Проверить: https://${BUCKET}.website.yandexcloud.net/`);
})().catch(e => { console.error("\nОшибка: " + e.message); process.exit(1); });
