/* ============================================================================
   Фон. Создаёт слои сам — в разметке ничего не нужно. Вариант берётся из
   атрибута data-bg на <html>, стили лежат в assets/css/bg.css.

   Дорогое здесь только одно — частицы на canvas. Поэтому они рисуются
   строго когда выбраны, останавливаются на скрытой вкладке и не запускаются
   вовсе, если человек просил уменьшить количество движения.
   ========================================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Слои -------------------------------------------------------------- */
  var bg = document.createElement("div");
  bg.className = "bg";
  bg.setAttribute("aria-hidden", "true");
  bg.innerHTML =
    '<div class="bg__glow bg__glow--1"></div>' +
    '<div class="bg__glow bg__glow--2"></div>' +
    '<div class="bg__glow bg__glow--3"></div>' +
    '<div class="bg__blob bg__blob--1"></div>' +
    '<div class="bg__blob bg__blob--2"></div>' +
    '<div class="bg__blob bg__blob--3"></div>' +
    '<div class="bg__grid"></div>' +
    '<div class="bg__spot"></div>' +
    '<canvas class="bg__canvas"></canvas>';
  document.body.insertBefore(bg, document.body.firstChild);

  var canvas = bg.querySelector(".bg__canvas");

  /* --- Пятно под курсором (вариант «сетка») ------------------------------
     Позиция пишется в CSS-переменные, а не в style.background: браузеру
     остаётся только перерисовать градиент. Значение догоняет курсор плавно,
     иначе пятно дёргается вслед за каждым событием. */
  var spot = { x: 0.5, y: 0.32, tx: 0.5, ty: 0.32, running: false };

  function spotFrame() {
    spot.x += (spot.tx - spot.x) * 0.08;
    spot.y += (spot.ty - spot.y) * 0.08;
    bg.style.setProperty("--mx", (spot.x * 100).toFixed(2) + "%");
    bg.style.setProperty("--my", (spot.y * 100).toFixed(2) + "%");

    var close = Math.abs(spot.tx - spot.x) < 0.001 && Math.abs(spot.ty - spot.y) < 0.001;
    if (close) { spot.running = false; return; }
    requestAnimationFrame(spotFrame);
  }

  function onPointer(e) {
    if (root.dataset.bg !== "grid") return;
    spot.tx = e.clientX / window.innerWidth;
    spot.ty = e.clientY / window.innerHeight;
    if (!spot.running) { spot.running = true; requestAnimationFrame(spotFrame); }
  }

  // Только там, где есть настоящий курсор: на телефоне пятно просто стоит по центру.
  if (window.matchMedia("(hover: hover)").matches && !reduce) {
    window.addEventListener("pointermove", onPointer, { passive: true });
  }

  /* --- Частицы ------------------------------------------------------------ */
  var ctx = null, dots = [], raf = 0, w = 0, h = 0, dpr = 1;
  var COLORS = ["255,255,255", "255,77,141", "255,154,60"];

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);   // на 3x-экранах 3x пикселей не нужны
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    var count = Math.round(Math.min(90, w / 14));
    dots = [];
    for (var i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.5,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        a: Math.random() * 0.5 + 0.2,
        // фаза мерцания, чтобы точки не пульсировали в такт
        p: Math.random() * Math.PI * 2,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.x += d.vx;
      d.y += d.vy;
      // уходит за край — появляется с противоположного
      if (d.x < -4) d.x = w + 4; else if (d.x > w + 4) d.x = -4;
      if (d.y < -4) d.y = h + 4; else if (d.y > h + 4) d.y = -4;

      var tw = reduce ? 1 : 0.75 + 0.25 * Math.sin(t / 1400 + d.p);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + d.c + "," + (d.a * tw).toFixed(3) + ")";
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }

  function startStars() {
    if (raf) return;
    if (!ctx) {
      ctx = canvas.getContext("2d");
      if (!ctx) return;
      size();
      seed();
      window.addEventListener("resize", onResize, { passive: true });
    }
    if (reduce) { draw(0); cancelAnimationFrame(raf); raf = 0; return; }  // один кадр, без движения
    raf = requestAnimationFrame(draw);
  }

  function stopStars() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!ctx) return;
      size();
      seed();
      if (!raf && reduce) draw(0);
    }, 150);
  }

  /* --- Включение и выключение по текущему варианту ----------------------- */
  function sync() {
    if (root.dataset.bg === "stars") startStars(); else stopStars();
  }

  // Скрытая вкладка не должна крутить анимацию в фоне и жечь батарею.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopStars(); else sync();
  });

  // Примерочная сообщает о смене варианта этим событием.
  window.addEventListener("bg:change", sync);

  sync();
})();
