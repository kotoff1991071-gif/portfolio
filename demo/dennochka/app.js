/* Деньночка — логика приложения */
"use strict";

// Пока нет ИП и оплаты в RuStore — всё открыто. Включим, когда подключим подписку.
const PAYWALL_ON = false;
const FREE_STORIES = [0, 1, 3]; // темнота, садик, зубы

// ---------- хранилище (только на телефоне) ----------
const KEY = "tik.v1";
const S = load();
function load() {
  const base = { profile: null, learned: [], shelf: [], last: null };
  try { return Object.assign(base, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return base; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

// ---------- текст с именем и родом ----------
// Любимая игрушка: формы слова для сказок (им., вин., твор., дат.) и род
const TOYS = [
  { id: "bunny",   icon: "🐰", n: "зайчик",     a: "зайчика",     i: "зайчиком",     d: "зайчику",     g: "m", trait: "мягкий, с одним ухом торчком, а другим вниз", def: "Буся" },
  { id: "kitten",  icon: "🐱", n: "котик",      a: "котика",      i: "котиком",      d: "котику",      g: "m", trait: "мягкий, с полосатым хвостиком", def: "Мурзик" },
  { id: "puppy",   icon: "🐶", n: "собачка",    a: "собачку",     i: "собачкой",     d: "собачке",     g: "f", trait: "мягкая, с висячими ушками", def: "Жужа" },
  { id: "bear",    icon: "🧸", n: "мишка",      a: "мишку",       i: "мишкой",       d: "мишке",       g: "m", trait: "мягкий и немножко косолапый", def: "Топтыжка" },
  { id: "doll",    icon: "👧", n: "кукла",      a: "куклу",       i: "куклой",       d: "кукле",       g: "f", trait: "с косичками и в нарядном платье", def: "Катя" },
  { id: "car",     icon: "🚗", n: "машинка",    a: "машинку",     i: "машинкой",     d: "машинке",     g: "f", trait: "красная, с фарами-глазками", def: "Молния" },
  { id: "hamster", icon: "🐹", n: "хомячок",    a: "хомячка",     i: "хомячком",     d: "хомячку",     g: "m", trait: "пушистый, с толстыми щёчками", def: "Пухлик" },
  { id: "dino",    icon: "🦕", n: "динозаврик", a: "динозаврика", i: "динозавриком", d: "динозаврику", g: "m", trait: "зелёный, с мягкими шипами на спинке", def: "Дино" }
];
const toyOf = p => TOYS.find(t => t.id === (p && p.toyKind)) || TOYS[0];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// [девочка|мальчик] — по полу ребёнка, <мужской|женский> — по роду игрушки
function fill(t) {
  const p = S.profile || { name: "Малыш", g: "m", toy: "Буся" };
  const k = toyOf(p);
  return t.replace(/\[([^|\]]*)\|([^\]]*)\]/g, (m, f, mm) => (p.g === "f" ? f : mm))
          .replace(/<([^|>]*)\|([^>]*)>/g, (m, mm, f) => (k.g === "f" ? f : mm))
          .replace(/\{ToyN\}/g, cap(k.n)).replace(/\{toyN\}/g, k.n).replace(/\{toyA\}/g, k.a)
          .replace(/\{toyI\}/g, k.i).replace(/\{toyD\}/g, k.d).replace(/\{toyTrait\}/g, k.trait)
          .replace(/\{toyAcc\}/g, declineName(p.toy, "a", k.g)).replace(/\{toyIns\}/g, declineName(p.toy, "i", k.g))
          .replace(/\{name\}/g, p.name).replace(/\{toy\}/g, p.toy).replace(/\+/g, "");
}
const noStress = t => t.replace(/\+/g, "");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const locked = i => PAYWALL_ON && !FREE_STORIES.includes(i);
const letterLocked = l => PAYWALL_ON && !FREE_LETTERS.includes(l);

// Отдельно стоящие согласные буквы в стихах («буква М», «Щ — как Ш») читаем названием буквы,
// иначе синтезатор принимает их за сокращения («Ш» → «шоссе»). Предлоги В, С, К не трогаем.
const LETTER_NAMES = { "Б": "бэ", "В": "вэ", "Г": "гэ", "Д": "дэ", "Ж": "жэ", "З": "зэ", "Й": "и краткое", "К": "ка", "Л": "эль", "М": "эм", "Н": "эн", "П": "пэ", "Р": "эр", "С": "эс", "Т": "тэ", "Ф": "эф", "Х": "ха", "Ц": "цэ", "Ч": "чэ", "Ш": "ша", "Щ": "ща" };
function letterNames(t) {
  return t.replace(/[БВГДЖЗЙКЛМНПРСТФХЦЧШЩ](?![А-Яа-яЁё+\-])/g, (ch, off, str) => {
    const prev = str.slice(0, off);
    if (/[А-Яа-яЁё+\-]$/.test(prev)) return ch;
    if (!"ВСК".includes(ch)) return LETTER_NAMES[ch];
    const after = str.slice(off + 1);
    const prevWord = (prev.match(/([А-Яа-яЁё]+)\s*$/) || [])[1] || "";
    if (/^\s*([—,.!?:;»…]|$)/.test(after) || /^(на|буква|Буква)$/.test(prevWord)) return LETTER_NAMES[ch];
    return ch;
  });
}

// ---------- голос ----------
// Версия озвучки = отпечаток всех текстов. Поменяли любой текст — телефон сам перекачает звук.
const CONTENT_VER = (() => {
  const s = JSON.stringify([STORIES, LETTERS, TWISTERS, RIDDLES, COUNT]) + declineName.toString() + "|5";
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
})();
const Voice = (() => {
  let seq = 0; const cbs = {}; const fallbacks = {};
  window.onTtsDone = id => { const cb = cbs[id]; delete cbs[id]; delete fallbacks[id]; if (cb) cb(); };
  // Нет интернета или ошибка сервера — читаем голосом телефона
  window.onAudioError = id => { const fb = fallbacks[id]; delete fallbacks[id]; delete cbs[id]; if (fb) fb(); };
  const remoteOn = () => !!(CONFIG.TTS_URL && window.Android && window.Android.playUrl);
  const ttsUrl = params => {
    const p = S.profile;
    const q = Object.assign({ name: p.name, g: p.g, toy: p.toy, kind: toyOf(p).id, v: CONTENT_VER }, params);
    return CONFIG.TTS_URL + (CONFIG.TTS_URL.includes("?") ? "&" : "?") + new URLSearchParams(q).toString();
  };
  const clean = t => letterNames(t).replace(/\+/g, "").replace(/[«»]/g, "").replace(/—/g, ", ").replace(/\n/g, " ");
  const native = () => window.Android && window.Android.isReady && window.Android.isReady();
  return {
    speak(text, rate, onend) {
      const id = "u" + (++seq);
      if (onend) cbs[id] = onend;
      if (native()) { window.Android.speak(clean(text), id, rate || 0.85); return; }
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(clean(text));
        u.lang = "ru-RU"; u.rate = rate || 0.85;
        const v = speechSynthesis.getVoices().find(x => /^ru/i.test(x.lang)); if (v) u.voice = v;
        u.onend = () => window.onTtsDone(id);
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } else if (onend) { setTimeout(() => window.onTtsDone(id), 1500); }
    },
    // Голос Яндекса: params — что озвучить (сказка/абзац или буква), text — запасной текст для голоса телефона
    remote(params, text, rate, onend) {
      if (!remoteOn()) { this.speak(text, rate, onend); return; }
      const id = "a" + (++seq);
      cbs[id] = onend || (() => {});
      fallbacks[id] = () => this.speak(text, rate, onend);
      window.Android.playUrl(ttsUrl(params), id);
    },
    prefetch(params) { if (remoteOn()) window.Android.prefetch(ttsUrl(params)); },
    stop() {
      for (const k in cbs) delete cbs[k];
      for (const k in fallbacks) delete fallbacks[k];
      if (window.Android && window.Android.stop) window.Android.stop();
      else if ("speechSynthesis" in window) speechSynthesis.cancel();
    }
  };
})();

// ---------- картинки ----------
function tik(size, night) {
  const wing = night ? .5 : .9, body = night ? "#F5D78E" : "#F2B632", head = night ? "#3B3F6B" : "#1F2A44";
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><circle cx="32" cy="38" r="24" fill="${body}" opacity=".2"/><ellipse cx="22" cy="24" rx="9" ry="12" fill="#fff" opacity="${wing}" transform="rotate(-25 22 24)"/><ellipse cx="42" cy="24" rx="9" ry="12" fill="#fff" opacity="${wing}" transform="rotate(25 42 24)"/><ellipse cx="32" cy="41" rx="10" ry="13" fill="${body}"/><circle cx="32" cy="26" r="8" fill="${head}"/><circle cx="29" cy="25" r="1.6" fill="#fff"/><circle cx="35" cy="25" r="1.6" fill="#fff"/><path d="M28 18 L25 11 M36 18 L39 11" stroke="${head}" stroke-width="2" stroke-linecap="round"/></svg>`;
}
const LOCK = '<svg viewBox="0 0 24 24" aria-label="В подписке"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>';
const BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

// ---------- навигация ----------
const $ = s => document.querySelector(s);
const stack = [];
let current = null;
function go(name, arg, replace) {
  stopPlayer();
  if (current && !replace) stack.push(current);
  current = { name, arg };
  render();
}
window.onBack = () => {
  if ($("#veil") && !$("#veil").hidden) { $("#veil").hidden = true; return true; }
  if (!stack.length) return false;
  stopPlayer(); current = stack.pop(); render(); return true;
};
function setNight(on) {
  document.body.classList.toggle("night", on);
  if (window.Android && window.Android.setNight) window.Android.setNight(on);
}
function render() {
  const { name, arg } = current;
  const tabsOn = ["day", "night", "shelf", "parents"].includes(name);
  $("#tabs").hidden = !tabsOn;
  $("#screen").classList.toggle("no-tabs", !tabsOn);
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.go === name));
  if (name === "day" || name === "letter" || name === "onboarding") setNight(false);
  if (name === "night" || name === "player") setNight(true);
  $("#screen").innerHTML = SCREENS[name](arg);
  window.scrollTo(0, 0);
  if (AFTER[name]) AFTER[name](arg);
}
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (g) {
    const tab = g.closest("#tabs");
    if (tab) { stack.length = 0; current = null; }
    go(g.dataset.go, g.dataset.arg !== undefined ? g.dataset.arg : undefined, !!g.dataset.replace);
  }
});

// ---------- экраны ----------
const SCREENS = {
  onboarding(editing) {
    const p = S.profile || { name: "", g: "f", toy: "Буся", toyKind: "bunny" };
    return `
      <div class="tik-say">${tik(72)}<div class="bubble">Привет! Я светлячок Тик. Расскажи мне про малыша — и я буду рассказывать сказки про него.</div></div>
      <h1 class="h1">${editing ? "Профиль ребёнка" : "Для кого будем рассказывать?"}</h1>
      <div class="field"><label for="f-name">Имя ребёнка</label><input id="f-name" maxlength="16" autocomplete="off" value="${esc(p.name)}" placeholder="Например, Маша"></div>
      <div class="field"><span class="lbl">Кто слушает</span>
        <div class="seg" id="f-g"><button data-g="f" class="${p.g === "f" ? "on" : ""}">Девочка</button><button data-g="m" class="${p.g === "m" ? "on" : ""}">Мальчик</button></div></div>
      <div class="field"><span class="lbl">Любимая игрушка</span>
        <div class="toys" id="f-kind">${TOYS.map(t => `<button data-k="${t.id}" class="${toyOf(p).id === t.id ? "on" : ""}"><span aria-hidden="true">${t.icon}</span>${t.n}</button>`).join("")}</div></div>
      <div class="field"><label for="f-toy" id="f-toy-lbl">Как зовут ${toyOf(p).a}?</label><input id="f-toy" maxlength="16" autocomplete="off" value="${esc(p.toy)}"></div>
      <p class="note">Игрушка станет другом ребёнка во всех сказках.</p>
      <p class="err" id="f-err" hidden>Впишите имя ребёнка русскими буквами.</p>
      <button class="btn primary" id="f-save">${editing ? "Сохранить" : "Готово, знакомимся!"}</button>
      <p class="note" style="text-align:center">Имя хранится только на этом телефоне и никуда не отправляется.</p>`;
  },

  day() {
    const name = S.profile.name;
    const letters = name.toUpperCase().split("").filter(c => ABC.includes(c));
    const ready = ABC.filter(l => LETTERS[l]);
    return `
      <div class="row"><div><div class="eyebrow">Днём — учимся</div><h1 class="h1">Доброе утро, ${esc(name)}!</h1></div>${tik(56)}</div>
      <section class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="row"><b style="font-size:17px">Буквы моего имени</b><span class="note">${letters.filter(l => S.learned.includes(l)).length} из ${letters.length}</span></div>
        <div class="namebox">${letters.map(l => `<button data-go="letter" data-arg="${l}" class="${S.learned.includes(l) ? "learned" : ""} ${LETTERS[l] ? "" : "soon"}" aria-label="Буква ${l}">${l}</button>`).join("")}</div>
      </section>
      <section style="display:flex;flex-direction:column;gap:10px">
        <div class="row"><h2 class="h2">Азбука в стихах</h2><span class="note">готово ${ready.length} из 33</span></div>
        <div class="grid6">${ABC.map(l => `<button class="lt ${LETTERS[l] ? "ready" : ""} ${S.learned.includes(l) ? "learned" : ""}" data-go="letter" data-arg="${l}" aria-label="Буква ${l}">${l}</button>`).join("")}</div>
      </section>
      <section class="tiles">
        <button class="tile" data-go="tw"><b>Скорого&shy;ворки</b><span>для речи</span></button>
        <button class="tile" data-go="riddles"><b>Загадки</b><span>на смекалку</span></button>
        <button class="tile" data-go="count" data-arg="0"><b>Счёт</b><span>до десяти</span></button>
      </section>`;
  },

  letter(l) {
    const d = LETTERS[l];
    const idx = ABC.indexOf(l);
    const prev = ABC.slice(0, idx).reverse().find(x => LETTERS[x]);
    const next = ABC.slice(idx + 1).find(x => LETTERS[x]);
    const top = `<div class="row"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button><span class="eyebrow">Буква ${idx + 1} из 33</span><span style="width:44px"></span></div>`;
    if (!d) return top + `<div class="letter-card"><div class="big">${l}<small>${l.toLowerCase()}</small></div><p class="poem" style="font-size:19px">Стишок про эту букву Тик ещё сочиняет. Она появится в обновлении!</p></div>`;
    if (letterLocked(l)) return top + `<div class="letter-card"><div class="big">${l}</div><p>Эта буква — в подписке.</p><button class="btn sun" data-go="parents">Подробнее</button></div>`;
    return top + `
      <div class="letter-card">
        <div class="row" style="align-items:center"><div class="big">${l}<small>${l.toLowerCase()}</small></div><div class="pic">${PIC[d.pic]}${d.word}</div></div>
        <p class="poem">${esc(noStress(d.poem))}</p>
        <div class="ask">${esc(fill(d.ask))}</div>
      </div>
      <div style="display:flex;gap:10px"><button class="btn sun" style="flex:1" id="read">${PLAY}Прочитать</button><button class="btn ghost" id="snd">${"ЪЬ".includes(l) ? "Что делает" : "Звук [" + l.toLowerCase() + "]"}</button></div>
      <p class="note">Озвучиваем звуком, а не названием буквы: «м», а не «эм». Так советуют логопеды — так легче научиться читать.</p>
      <div class="row">${prev ? `<button class="btn soft" data-go="letter" data-arg="${prev}">← ${prev}</button>` : "<span></span>"}${next ? `<button class="btn soft" data-go="letter" data-arg="${next}">${next} →</button>` : "<span></span>"}</div>`;
  },

  night() {
    const last = S.last && STORIES[S.last.i];
    return `
      <div class="row"><div><div class="eyebrow">Ночью — сказки</div><h1 class="h1">Добрый вечер, ${esc(S.profile.name)}</h1></div></div>
      ${last ? `<button class="continue" data-go="player" data-arg="${S.last.i}">${tik(60, true)}<span style="display:flex;flex-direction:column;gap:2px"><span class="eyebrow" style="color:var(--sun)">Продолжить</span><span style="font:20px/1.2 var(--display)">${esc(fill(last.title))}</span></span></button>` : ""}
      <div class="row"><h2 class="h2">С чем помочь сегодня?</h2>${PAYWALL_ON ? `<button class="note" data-go="parents" style="border:0;background:none;color:var(--sun);font-weight:800">3 из ${STORIES.length} бесплатно</button>` : ""}</div>
      <div class="sits">${STORIES.map((s, i) => `<button class="sit" data-go="player" data-arg="${i}"><span>${esc(s.chip)}</span>${locked(i) ? LOCK : ""}</button>`).join("")}</div>
      <p class="note">Новые сказки будут появляться с обновлениями.</p>`;
  },

  player(i) {
    i = +i; const s = STORIES[i];
    if (locked(i)) return `<div class="player-top"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button></div><div class="tik-big">${tik(150, true)}</div><h1 class="story-title">${esc(fill(s.title))}</h1><p style="text-align:center">Эта сказка — в подписке.</p><button class="btn sun" data-go="parents">Подробнее</button>`;
    return `
      <div class="player-top"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button><span class="eyebrow">${esc(s.chip)}</span><button class="round" id="timer" aria-label="Таймер сна">${timerLabel()}</button></div>
      <div class="tik-big" id="tikbig">${tik(150, true)}</div>
      <h1 class="story-title">${esc(fill(s.title))}</h1>
      <div class="story-text" id="text">${s.p.map((p, k) => `<p data-k="${k}">${esc(fill(p)).replace(/\n/g, "<br>")}</p>`).join("")}</div>
      <div class="tip"><b>Для родителей</b><p>${esc(s.tip)}</p></div>
      <div class="controls">
        <div class="progress"><i id="prog"></i></div>
        <div class="ctrl-row">
          <button class="round" id="prev" aria-label="Абзац назад">−1</button>
          <button class="play-big" id="play" aria-label="Слушать">${PLAY}</button>
          <button class="round" id="next" aria-label="Абзац вперёд">+1</button>
        </div>
      </div>`;
  },

  shelf() {
    const items = S.shelf.slice().reverse();
    return `
      <div class="eyebrow">Полка</div><h1 class="h1">Наши сказки</h1>
      ${items.length ? `<div class="list">${items.map(x => `<button data-go="player" data-arg="${x.i}"><span><b>${esc(fill(STORIES[x.i].title))}</b><br><small>${esc(STORIES[x.i].chip)} · ${new Date(x.t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</small></span>${PLAY.replace("<svg", '<svg width="20" height="20" fill="currentColor"')}</button>`).join("")}</div>`
        : `<div class="card"><p style="margin:0">Здесь будут сказки, которые вы уже слушали — чтобы любимые было легко включить снова.</p></div><button class="btn sun" data-go="night">Выбрать сказку</button>`}
      <section style="display:flex;flex-direction:column;gap:8px"><h2 class="h2">Выученные буквы</h2>
        <p style="margin:0;font:28px var(--display);letter-spacing:.1em">${S.learned.length ? S.learned.join(" ") : "<span class='note'>Пока ни одной — загляните в дневной режим.</span>"}</p></section>`;
  },

  tw() {
    return `
      <div class="row"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button><span class="eyebrow">Скороговорки</span><span style="width:44px"></span></div>
      <h1 class="h1">Язычок-зарядка</h1>
      <p class="note">Сначала слушаем медленно, потом пробуем быстрее. Повтори три раза — и язычок станет ловким!</p>
      <div class="list">${TWISTERS.map((x, i) => `<div class="card tw"><p class="tw-text">${esc(noStress(x.t))}</p><div class="row"><small class="note">Тренируем: ${esc(x.s)}</small><span style="display:flex;gap:6px"><button class="btn soft sm" data-tw="${i}">${PLAY}Медленно</button><button class="btn sun sm" data-tw="${i}" data-fast="1">Быстро!</button></span></div></div>`).join("")}</div>`;
  },

  riddles() {
    return `
      <div class="row"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button><span class="eyebrow">Загадки</span><span style="width:44px"></span></div>
      <h1 class="h1">Отгадай-ка!</h1>
      <p class="note">Послушайте загадку, подумайте вместе и только потом откройте отгадку.</p>
      <div class="list">${RIDDLES.map((x, i) => `<div class="card riddle" id="rd${i}"><p class="tw-text">${esc(noStress(x.q))}</p><div class="answer" hidden><div class="pic">${x.pic === "tik" ? tik(110) : PIC[x.pic]}</div><b>${esc(x.a)}</b></div><div class="row"><button class="btn soft sm" data-rd="${i}">${PLAY}Слушать</button><button class="btn sun sm" data-rda="${i}">Отгадка</button></div></div>`).join("")}</div>`;
  },

  count(n) {
    n = Math.max(0, Math.min(9, +n || 0));
    const c = COUNT[n];
    return `
      <div class="row"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button><span class="eyebrow">Счёт до десяти</span><span style="width:44px"></span></div>
      <div class="nums">${COUNT.map((x, i) => `<button class="${i === n ? "on" : ""}" data-go="count" data-arg="${i}" data-replace="1">${i + 1}</button>`).join("")}</div>
      <div class="letter-card" style="align-items:center;text-align:center">
        <div class="big" style="font-size:120px">${n + 1}</div>
        <p class="poem" style="font-size:20px">${esc(fill(c.line))}</p>
        <div class="dots" id="dots">${Array.from({ length: n + 1 }, (_, k) => `<button class="dot" data-k="${k}" aria-label="Предмет ${k + 1}"><svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.5-6.2 3.5 1.3-7L2 9.4l7-.9z"/></svg></button>`).join("")}</div>
        <p class="note" id="cnt-hint">Нажимай на звёздочки и считай вслух!</p>
      </div>
      <div class="row"><button class="btn soft" id="c-line">${PLAY}Слушать</button>${n < 9 ? `<button class="btn sun" data-go="count" data-arg="${n + 1}" data-replace="1">${n + 2} →</button>` : `<button class="btn sun" data-go="day">Готово!</button>`}</div>`;
  },

  privacy() {
    const sec = (h, body) => `<section class="card" style="display:flex;flex-direction:column;gap:6px"><h2 class="h2" style="font-size:19px">${h}</h2>${body}</section>`;
    return `
      <div class="row"><button class="icon-btn" id="back" aria-label="Назад">${BACK}</button><span class="eyebrow">Для родителей</span><span style="width:44px"></span></div>
      <h1 class="h1" style="font-size:24px;overflow-wrap:anywhere">Политика конфиденциальности</h1>
      <p class="note">«Деньночка» — приложение для детей 3–7 лет. Профиль ребёнка заполняет родитель. Здесь простыми словами: какие данные использует приложение, зачем и где они хранятся.</p>
      ${sec("Коротко", `<p class="note">Без регистрации и аккаунтов. Без рекламы. Без аналитики, трекеров и геолокации. Профиль хранится на вашем телефоне.</p>`)}
      ${sec("Какие данные используются", `<p class="note"><b>Имя ребёнка</b> (или прозвище) — чтобы герой сказки звался как ребёнок. <b>Девочка или мальчик</b> — для правильных окончаний слов. <b>Любимая игрушка</b> (вид и имя) — она становится героем сказок. <b>Прогресс</b> — выученные буквы и прослушанные сказки. Всё это хранится на телефоне.</p><p class="note">Мы не собираем фамилию, возраст, фотографии, голос ребёнка, контакты, местоположение, телефон и почту. Приложению нужно только одно разрешение — интернет, для озвучки.</p>`)}
      ${sec("Как работает озвучка", `<p class="note">Сказки читает голос Yandex SpeechKit. Когда фрагмент звучит впервые, приложение отправляет на наш сервер озвучки в Yandex Cloud (серверы в России) номер сказки или буквы, имя ребёнка, «девочка/мальчик», вид и имя игрушки. Сервер сам собирает текст из заранее написанных сказок — произвольный текст он не принимает.</p><p class="note">Готовый звук сохраняется на телефоне, чтобы потом звучать без интернета. Копия звука хранится в облачном хранилище Yandex под обезличенным кодом, без связи с телефоном или человеком. Мы не ведём журналов с именами детей. Yandex Cloud как поставщик может обрабатывать технические данные запроса (например, IP-адрес) по своим правилам.</p><p class="note"><b>Не хотите отправлять настоящее имя?</b> Укажите прозвище — «Зайка», «Солнышко». Всё будет работать так же.</p>`)}
      ${sec("Кому передаём данные", `<p class="note">Никому. Мы не продаём данные и не показываем рекламу. Единственные обработчики — сервисы Yandex Cloud, на которых работает озвучка. Если появится подписка, оплата пойдёт через RuStore — данные карт мы не получаем.</p>`)}
      ${sec("Согласие родителя", `<p class="note">Заполняя профиль ребёнка, родитель или законный представитель соглашается на обработку этих данных для работы приложения, как описано здесь.</p>`)}
      ${sec("Как изменить или удалить", `<p class="note">Изменить профиль: «Родителям» → «Изменить». Удалить всё с телефона: удалите приложение или очистите его данные в настройках Android. Удалить облачные копии озвучки с именем ребёнка: напишите нам — удалим в течение 30 дней.</p>`)}
      ${sec("Контакты", `<p class="note">Разработчик и оператор данных: Котов Михаил. Почта: kotoff1991071@gmail.com</p><p class="note">Редакция от 20 сентября 2026 года.</p>`)}`;
  },

  parents() {
    return `
      <div class="eyebrow">Для родителей</div><h1 class="h1">Деньночка целиком</h1>
      ${PAYWALL_ON ? "" : `<div class="card" style="border:2px dashed var(--sun)"><b>Сейчас всё бесплатно.</b> Это ранняя версия: все сказки и буквы открыты. Подписка появится позже — мы заранее предупредим.</div>`}
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div class="check">${CHECK}<span><b>Сказки под ситуацию</b> — с именем ребёнка и подсказкой для вас</span></div>
        <div class="check">${CHECK}<span><b>Азбука в стихах</b> — звуки, а не названия букв</span></div>
        <div class="check">${CHECK}<span><b>Без рекламы</b> — никогда</span></div>
        <div class="check">${CHECK}<span><b>Без регистрации</b> — профиль хранится на телефоне, имя нужно только для озвучки</span></div>
      </div>
      ${PAYWALL_ON ? `<button class="plan best"><span><b>На год</b><br><small class="note">≈ 166 ₽ в месяц</small></span><b>1 990 ₽</b></button><button class="plan"><b>На месяц</b><b>299 ₽</b></button><button class="btn primary">Попробовать 7 дней бесплатно</button>` : ""}
      <section style="display:flex;flex-direction:column;gap:8px"><h2 class="h2">Профиль</h2>
        <div class="card row"><span><b>${esc(S.profile.name)}</b>, ${S.profile.g === "f" ? "девочка" : "мальчик"}<br><small class="note">${toyOf(S.profile).n} ${esc(S.profile.toy)}</small></span><button class="btn soft" data-go="onboarding" data-arg="1">Изменить</button></div>
      </section>
      <section style="display:flex;flex-direction:column;gap:8px"><h2 class="h2">Голос</h2>
        <div class="card">${CONFIG.TTS_URL ? `<b>Голос Яндекса</b><br><small class="note">Каждая сказка скачивается один раз и потом звучит без интернета.${window.Android && window.Android.cacheSizeMb ? " Сохранено: " + window.Android.cacheSizeMb() + " МБ." : ""}</small>` : `<b>Голос телефона</b><br><small class="note">Если звучит неприятно: Настройки телефона → Специальные возможности → Синтез речи → «Синтезатор речи Google», русский язык.</small>`}</div>
      </section>
      <button class="btn ghost sm" data-go="privacy">Политика конфиденциальности</button>
      <p class="note">Деньночка, версия 1.0.1. Сказки помогают, но не заменяют консультацию специалиста, если трудности сохраняются долго.</p>`;
  }
};

// ---------- поведение экранов ----------
const AFTER = {
  privacy() { bindBack(); },
  tw() {
    bindBack();
    document.querySelectorAll("[data-tw]").forEach(b => b.onclick = () => {
      const i = +b.dataset.tw, fast = !!b.dataset.fast;
      Voice.stop();
      Voice.remote(fast ? { x: "tw", i, fast: 1 } : { x: "tw", i }, TWISTERS[i].t, fast ? 1.25 : 0.8);
    });
  },
  riddles() {
    bindBack();
    document.querySelectorAll("[data-rd]").forEach(b => b.onclick = () => {
      const i = +b.dataset.rd; Voice.stop(); Voice.remote({ x: "rd", i, part: "q" }, RIDDLES[i].q, 0.85);
    });
    document.querySelectorAll("[data-rda]").forEach(b => b.onclick = () => {
      const i = +b.dataset.rda; $("#rd" + i + " .answer").hidden = false; b.hidden = true;
      Voice.stop(); Voice.remote({ x: "rd", i, part: "a" }, "Это " + RIDDLES[i].a, 0.85);
    });
  },
  count(n) {
    n = Math.max(0, Math.min(9, +n || 0)); bindBack();
    let counted = 0;
    for (let k = 0; k <= n; k++) Voice.prefetch({ x: "num", i: k, part: "w" });
    $("#c-line").onclick = () => { Voice.stop(); Voice.remote({ x: "num", i: n, part: "line" }, fill(COUNT[n].line), 0.85); };
    document.querySelectorAll(".dot").forEach(d => d.onclick = () => {
      if (d.classList.contains("on")) return;
      d.classList.add("on"); const k = counted++;
      Voice.stop(); Voice.remote({ x: "num", i: k, part: "w" }, COUNT[k].w, 0.9);
      if (counted === n + 1) $("#cnt-hint").textContent = "Правильно! Всего " + COUNT[n].w + ".";
    });
  },
  onboarding(editing) {
    let g = (S.profile && S.profile.g) || "f";
    document.querySelectorAll("#f-g button").forEach(b => b.onclick = () => {
      g = b.dataset.g; document.querySelectorAll("#f-g button").forEach(x => x.classList.toggle("on", x === b));
    });
    let kind = toyOf(S.profile).id;
    document.querySelectorAll("#f-kind button").forEach(b => b.onclick = () => {
      const old = toyOf({ toyKind: kind }); kind = b.dataset.k; const k = toyOf({ toyKind: kind });
      document.querySelectorAll("#f-kind button").forEach(x => x.classList.toggle("on", x === b));
      $("#f-toy-lbl").textContent = "Как зовут " + k.a + "?";
      const inp = $("#f-toy"); if (!inp.value.trim() || inp.value.trim() === old.def) inp.value = k.def;
    });
    $("#f-save").onclick = () => {
      const name = $("#f-name").value.trim();
      const toy = $("#f-toy").value.trim() || toyOf({ toyKind: kind }).def;
      if (!/^[А-ЯЁа-яё][А-ЯЁа-яё -]{0,15}$/.test(name)) { $("#f-err").hidden = false; return; }
      S.profile = { name: cap(name), g, toy: cap(toy), toyKind: kind }; save();
      stack.length = 0; current = null; go(editing ? "parents" : "day");
    };
  },
  letter(l) {
    const d = LETTERS[l]; bindBack(); if (!d || letterLocked(l)) return;
    $("#read").onclick = () => {
      Voice.remote({ l, part: "poem" }, d.poem + ". " + fill(d.ask), 0.85, () => {
        if (!S.learned.includes(l)) { S.learned.push(l); save(); }
      });
    };
    $("#snd").onclick = () => Voice.remote({ l, part: "sound" }, d.sound, 0.6);
  },
  player(i) { bindBack(); if (!locked(+i)) startPlayer(+i); }
};
function bindBack() { const b = $("#back"); if (b) b.onclick = () => window.onBack(); }

// ---------- плеер сказки ----------
const TIMERS = [0, 10, 20, 30];
let timerMin = 10, timerId = null, playing = false, pos = 0, storyIdx = 0;
function timerLabel() { return timerMin ? timerMin + " мин" : "выкл"; }
function startPlayer(i) {
  storyIdx = i; playing = false;
  pos = (S.last && S.last.i === i && S.last.p < STORIES[i].p.length - 1) ? S.last.p : 0;
  mark();
  $("#play").onclick = () => (playing ? pause() : play());
  $("#prev").onclick = () => { pos = Math.max(0, pos - 1); restart(); };
  $("#next").onclick = () => { pos = Math.min(STORIES[i].p.length - 1, pos + 1); restart(); };
  $("#timer").onclick = () => { timerMin = TIMERS[(TIMERS.indexOf(timerMin) + 1) % TIMERS.length]; $("#timer").textContent = timerLabel(); if (playing) armTimer(); };
}
function mark() {
  const ps = document.querySelectorAll("#text p");
  ps.forEach(p => p.classList.toggle("now", +p.dataset.k === pos));
  const prog = $("#prog"); if (prog) prog.style.width = Math.round(pos / ps.length * 100) + "%";
  S.last = { i: storyIdx, p: pos }; save();
}
function play() {
  playing = true; $("#text").classList.add("playing"); $("#tikbig").classList.add("playing");
  $("#play").innerHTML = PAUSE; $("#play").setAttribute("aria-label", "Пауза");
  armTimer(); speakCurrent();
}
function speakCurrent() {
  const ps = document.querySelectorAll("#text p");
  if (!playing || !ps.length) return;
  if (pos >= ps.length) { finish(); return; }
  mark(); ps[pos].scrollIntoView({ block: "center", behavior: "smooth" });
  Voice.remote({ s: storyIdx, p: pos }, ps[pos].innerText, 0.82, () => { if (!playing) return; pos++; speakCurrent(); });
  if (pos + 1 < ps.length) Voice.prefetch({ s: storyIdx, p: pos + 1 });
}
function restart() { Voice.stop(); mark(); if (playing) speakCurrent(); }
function pause() {
  playing = false; Voice.stop(); clearTimeout(timerId);
  const t = $("#text"); if (t) t.classList.remove("playing");
  const k = $("#tikbig"); if (k) k.classList.remove("playing");
  const b = $("#play"); if (b) { b.innerHTML = PLAY; b.setAttribute("aria-label", "Слушать"); }
}
function finish() {
  pause(); pos = 0; S.last = null;
  S.shelf = S.shelf.filter(x => x.i !== storyIdx); S.shelf.push({ i: storyIdx, t: Date.now() }); save();
  const prog = $("#prog"); if (prog) prog.style.width = "100%";
}
function armTimer() {
  clearTimeout(timerId);
  if (timerMin) timerId = setTimeout(() => { pause(); $("#veil").hidden = false; }, timerMin * 60000);
}
function stopPlayer() { if (playing) pause(); clearTimeout(timerId); }
$("#veil").onclick = () => { $("#veil").hidden = true; };

// ---------- звёзды ----------
(function () {
  const c = $("#stars"), x = c.getContext("2d"); let st = [];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size() { const r = devicePixelRatio || 1; c.width = innerWidth * r; c.height = innerHeight * r; c.style.width = "100%"; c.style.height = "100%"; st = Array.from({ length: 70 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: (Math.random() * 1.3 + .3) * r, p: Math.random() * 6 })); }
  size(); addEventListener("resize", size);
  function draw(t) {
    if (document.body.classList.contains("night")) {
      x.clearRect(0, 0, c.width, c.height);
      for (const s of st) { x.globalAlpha = .3 + .3 * Math.sin(t / 1500 + s.p); x.fillStyle = "#F5D78E"; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); }
    }
    if (!still) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// ---------- старт ----------
const hour = new Date().getHours();
go(S.profile ? (hour >= 19 || hour < 6 ? "night" : "day") : "onboarding");
