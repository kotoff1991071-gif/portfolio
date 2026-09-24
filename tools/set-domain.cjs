// Прописывает адрес сайта во всех местах, где он нужен: в настройках,
// в превью ссылки, в robots.txt и sitemap.xml.
//
// Запуск из корня проекта:  node tools/set-domain.cjs mkotov.ru
// Можно запускать сколько угодно раз — если домен поменяется, просто
// запустите снова с новым именем, старый адрес будет заменён.
const fs = require("fs");
const path = require("path");

const arg = (process.argv[2] || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
if (!arg || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(arg)) {
  console.error("Укажите домен, например:  node tools/set-domain.cjs mkotov.ru");
  process.exit(1);
}
const SITE = "https://" + arg + "/";              // https://mkotov.ru/
const ROOT = path.join(__dirname, "..");
const today = new Date().toISOString().slice(0, 10);

const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => { fs.writeFileSync(path.join(ROOT, f), s); console.log("  ✓ " + f); };

console.log("Адрес сайта: " + SITE);

/* ---------- index.html: превью ссылки и канонический адрес ---------- */
let html = read("index.html");

// комментарий-напоминание больше не нужен
html = html.replace(/<!-- Картинка для превью[\s\S]*?-->/, "<!-- Картинка для превью ссылки в мессенджерах, 1200×630.\n     Адрес полный: Телеграм и ВКонтакте надёжно понимают только такой. -->");

html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}assets/img/og.jpg">`);

// og:url — какой адрес показывать в превью
if (/<meta property="og:url"/.test(html)) {
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${SITE}">`);
} else {
  html = html.replace(/(<meta property="og:locale"[^>]*>)(\r?\n)/, `$1$2<meta property="og:url" content="${SITE}">$2`);
}

// canonical — какой адрес считать главным, чтобы поиск не видел две копии
if (/<link rel="canonical"/.test(html)) {
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}">`);
} else {
  html = html.replace(/(<link rel="icon")/, `<link rel="canonical" href="${SITE}">\n$1`);
}
write("index.html", html);

/* ---------- content.js: адрес в настройках ---------- */
let content = read("assets/js/content.js");
content = content.replace(/siteUrl:\s*"[^"]*"[^\n]*/, `siteUrl:   "${SITE}"`);
write("assets/js/content.js", content);

/* ---------- robots.txt ---------- */
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

/* ---------- sitemap.xml ---------- */
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`);

console.log("Готово. Проверьте страницу и выкладывайте: node tools/deploy.cjs");
