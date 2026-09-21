/* ============================================================================
   Логика страницы. Ничего лишнего: подстановка значений из content.js,
   меню на телефоне, рамка у шапки при скролле и наблюдатель для появления
   секций — задел под анимацию, стили к нему добавим позже.
   ========================================================================= */
(function () {
  "use strict";

  /* --- Значения из content.js ------------------------------------------- */
  // "person.tgUrl" → CONTENT.person.tgUrl
  var get = function (path) {
    return path.split(".").reduce(function (obj, key) {
      return obj == null ? undefined : obj[key];
    }, window.CONTENT);
  };

  var fill = function () {
    if (!window.CONTENT) return;              // без данных просто остаётся запасной текст

    document.querySelectorAll("[data-c]").forEach(function (el) {
      var v = get(el.dataset.c);
      if (v != null) el.textContent = v;
    });

    document.querySelectorAll("[data-href]").forEach(function (el) {
      var v = get(el.dataset.href);
      if (v != null) el.setAttribute("href", v);
    });
  };

  /* --- Меню на телефоне -------------------------------------------------- */
  var menu = function () {
    var burger = document.querySelector(".burger");
    var panel = document.getElementById("menu");
    if (!burger || !panel) return;

    var setOpen = function (open) {
      burger.setAttribute("aria-expanded", String(open));
      panel.classList.toggle("is-open", open);
      // пока меню открыто, фон скроллиться не должен
      document.body.style.overflow = open ? "hidden" : "";
    };

    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });

    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  };

  /* --- Рамка у шапки появляется, когда страница уехала вниз -------------- */
  var header = function () {
    var hdr = document.querySelector(".hdr");
    if (!hdr) return;

    var tick = false;
    window.addEventListener("scroll", function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        hdr.classList.toggle("is-stuck", window.scrollY > 8);
        tick = false;
      });
    }, { passive: true });
  };

  /* --- Частицы фона -------------------------------------------------------
     Точки медленно плывут по экрану и мерцают. Рядом с курсором разгораются
     и слегка сторонятся его — единственное место, где фон отвечает на
     действие, поэтому эффект намеренно слабый.

     Экономия, без которой это была бы просто грелка для батареи:
     на скрытой вкладке цикл останавливается, плотность пикселей ограничена
     двойной, а при просьбе уменьшить движение рисуется один кадр и всё.  */
  var particles = function () {
    var canvas = document.querySelector(".bg__canvas");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;                       // фон переживёт: свечения в разметке

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var COLORS = ["255,255,255", "255,77,141", "255,154,60"];
    var dots = [], w = 0, h = 0, raf = 0;
    var mx = -999, my = -999;               // курсор за пределами экрана, пока не двинулся
    var REACH = 130;                        // радиус, в котором точки реагируют

    var size = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    var seed = function () {
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
          p: Math.random() * Math.PI * 2,   // фаза мерцания: иначе все пульсируют в такт
          c: COLORS[(Math.random() * COLORS.length) | 0]
        });
      }
    };

    var draw = function (t) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx;
        d.y += d.vy;

        // ушла за край — появляется с противоположного
        if (d.x < -4) d.x = w + 4; else if (d.x > w + 4) d.x = -4;
        if (d.y < -4) d.y = h + 4; else if (d.y > h + 4) d.y = -4;

        var glow = 0;
        var dx = d.x - mx, dy = d.y - my;
        var dist2 = dx * dx + dy * dy;
        if (dist2 < REACH * REACH) {
          var dist = Math.sqrt(dist2) || 0.001;
          glow = 1 - dist / REACH;
          // мягко отталкиваем: точка не убегает, а обтекает курсор
          d.x += (dx / dist) * glow * 0.6;
          d.y += (dy / dist) * glow * 0.6;
        }

        var tw = reduce ? 1 : 0.75 + 0.25 * Math.sin(t / 1400 + d.p);
        var alpha = Math.min(1, d.a * tw + glow * 0.55);

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r + glow * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + d.c + "," + alpha.toFixed(3) + ")";
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    // Решает CSS: на телефоне canvas скрыт, там вместо частиц «полотно».
    // Спрашиваем у стилей, а не сверяем ширину числом, — иначе порог
    // пришлось бы держать в двух местах и однажды он бы разъехался.
    var shown = function () {
      return window.getComputedStyle(canvas).display !== "none";
    };

    var start = function () {
      if (raf || document.hidden || !shown()) return;
      raf = requestAnimationFrame(draw);
    };
    var stop = function () {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Пересобрать под текущий размер окна и решить, рисовать ли вообще.
    var apply = function () {
      if (!shown()) { stop(); return; }     // «полотно» на телефоне: частицы не нужны
      size();
      seed();
      if (reduce) {
        draw(0);                            // один кадр: картинка есть, движения нет
        stop();
        return;
      }
      start();
    };

    apply();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (!reduce) start();
    });

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        mx = e.clientX;
        my = e.clientY;
      }, { passive: true });
    }

    // Поворот телефона или изменение окна могут перевести страницу через
    // порог: частицы тогда включаются или выключаются сами.
    var timer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(apply, 150);
    }, { passive: true });
  };

  /* --- Появление секций --------------------------------------------------
     Наблюдатель стоит на месте заранее: когда возьмёмся за анимацию,
     останется добавить стили к .reveal / .is-visible, а не править разметку.

     Важно: до .is-visible блок прозрачный, поэтому показ текста не должен
     зависеть от того, сработает ли наблюдатель. Страховка ниже открывает
     всё через 1,2 секунды — что бы ни случилось, клиент видит страницу. */
  var reveal = function () {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    var show = function (el) { el.classList.add("is-visible"); };
    var showAll = function () { nodes.forEach(show); };

    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    // Наблюдатель отчитывается по каждому элементу сразу, как только начал
    // за ним следить, — даже если тот далеко внизу. Значит, молчание через
    // секунду означает, что он не работает: тогда просто открываем всё.
    var answered = false;

    var io = new IntersectionObserver(function (entries) {
      answered = true;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        io.unobserve(entry.target);          // один раз, назад не прячем
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });

    nodes.forEach(function (el) { io.observe(el); });

    setTimeout(function () { if (!answered) showAll(); }, 1000);
  };

  /* --- Телефон у работ ----------------------------------------------------
     Пока кейсы едут мимо, телефон стоит на месте и показывает тот, что
     сейчас напротив. Между кейсами он проворачивается вокруг вертикальной
     оси: в середине поворота стоит ребром — в этот момент экран и меняется,
     поэтому подмены не видно. Кейс с атрибутом data-land укладывает
     телефон набок (сейчас такого нет, но умение осталось).

     Поворот между кейсами считаем от прокрутки: крутишь колёсико назад —
     телефон честно поворачивается обратно. А пока читаешь кейс, телефон
     живёт сам: мокап плавно покачивается, у «Котобола» идёт видео.  */
  var showcase = function () {
    var stage = document.querySelector(".stage");
    var dev = stage && stage.querySelector(".dev");
    if (!dev) return;

    var works = Array.prototype.slice.call(document.querySelectorAll(".showcase .work"));
    var shots = dev.querySelectorAll(".dev__shot");
    var screen = dev.querySelector(".dev__screen");
    var no = stage.querySelector(".stage__no");
    var txt = stage.querySelector(".stage__txt");
    if (works.length < 2 || shots.length !== works.length) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var land = works.map(function (w) { return w.hasAttribute("data-land") ? 1 : 0; });
    var shown = -1, active = -1, tick = false;
    var SPIN_FPS = 15;          // с какой частотой нарезаны кадры видео
    var SPIN_SPEED = 0.6;       // скорость проигрывания: 1 — как в ролике, меньше — медленнее
    var SPIN_SEAM = 12;         // кадров на плавный стык конца ролика с началом
    var SWAY_PERIOD = 9;        // секунд на одно покачивание мокапа

    // Кадры видео для части кейсов: пока такой кейс напротив, вместо мокапа
    // стоит телефон из видео и проигрывается сам. Кадры, а не <video>:
    // так ролик не зависит от автоплея и не мигает при перемотке.
    // Грузим, только когда колонка с телефоном вообще показана.
    var spins = Array.prototype.map.call(stage.querySelectorAll(".spin"), function (el) {
      return { el: el, ctx: el.getContext("2d"), at: +el.getAttribute("data-at"),
               frames: [], drawn: -1, vis: 0, start: 0 };
    }).filter(function (s) { return s.ctx; });
    var spinOf = function (i) {
      for (var k = 0; k < spins.length; k++) if (spins[k].at === i) return spins[k];
      return null;
    };
    var loadSpin = function (s) {
      if (s.frames.length) return;
      var base = s.el.getAttribute("data-spin");
      var n = +s.el.getAttribute("data-frames");
      for (var k = 0; k < n; k++) {
        var img = new Image();
        img.decoding = "async";
        img.onload = function () { s.drawn = -1; request(); };   // догрузился нужный кадр — перерисуем
        img.src = base + ("00" + k).slice(-3) + ".webp";
        s.frames.push(img);
      }
    };
    // Кадр k или, если он ещё не пришёл, ближайший загруженный — лишь бы не пусто.
    var frameNear = function (s, k) {
      for (var d = 0; d < s.frames.length; d++) {
        var a = s.frames[k - d], b = s.frames[k + d];
        if (a && a.complete && a.naturalWidth) return { img: a, exact: !d };
        if (b && b.complete && b.naturalWidth) return { img: b, exact: !d };
      }
      return null;
    };
    // Рисует кадр k, а поверх — кадр over с прозрачностью alpha (для стыка).
    var drawSpin = function (s, k, over, alpha) {
      var key = k + ":" + (alpha > 0 ? over + ":" + alpha.toFixed(2) : "");
      if (key === s.drawn) return;
      var base = frameNear(s, k);
      if (!base) return;
      var w = s.el.width, h = s.el.height;
      s.ctx.globalAlpha = 1;
      s.ctx.drawImage(base.img, 0, 0, w, h);
      var top = alpha > 0 ? frameNear(s, over) : null;
      if (top) { s.ctx.globalAlpha = alpha; s.ctx.drawImage(top.img, 0, 0, w, h); s.ctx.globalAlpha = 1; }
      s.drawn = base.exact && (!top || top.exact) ? key : -1;
    };

    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    // Поворот занимает середину пути между кейсами, по краям телефон стоит
    // ровно — иначе он крутился бы непрерывно и читать экран было бы нельзя.
    var ease = function (f) {
      var x = clamp((f - 0.28) / 0.44, 0, 1);
      return x * x * (3 - 2 * x);
    };

    var show = function (i) {
      if (i === shown) return;
      shown = i;
      for (var k = 0; k < shots.length; k++) shots[k].classList.toggle("is-on", k === i);
    };

    var mark = function (i) {
      if (i === active) return;
      active = i;
      works.forEach(function (w, k) { w.classList.toggle("is-active", k === i); });
      if (no) no.textContent = ("0" + (i + 1)).slice(-2);
      if (txt) txt.textContent = works[i].getAttribute("data-cap") || "";
    };

    // Состояние от прокрутки: считаем на scroll, рисуем в цикле кадров.
    var st = { t: 0, from: 0, to: 0, p: 0, on: false };

    var measure = function () {
      tick = false;
      // На узком экране колонки нет — решает CSS, как и с частицами фона.
      st.on = window.getComputedStyle(stage).display !== "none";
      if (!st.on) return;

      // Где мы между кейсами: 0 — первый по центру окна, 1 — второй, 1.5 — посередине.
      var mid = window.innerHeight / 2;
      var c = works.map(function (w) {
        var r = w.getBoundingClientRect();
        return r.top + r.height / 2 - mid;
      });
      var t = 0;
      if (c[0] < 0) {
        t = works.length - 1;
        for (var i = 0; i < c.length - 1; i++) {
          if (c[i + 1] > 0) { t = i + (-c[i]) / (c[i + 1] - c[i]); break; }
        }
      }

      st.t = t;
      st.from = Math.floor(t);
      st.to = Math.min(st.from + 1, works.length - 1);
      st.p = ease(t - st.from);
      mark(st.p < 0.5 ? st.from : st.to);

      // Видео-телефон проявляется, пока мокап встаёт ребром, и растворяется
      // на выходе. Ролик каждый раз начинается с начала — с лицевой стороны.
      var now = performance.now(), any = 0;
      // Оба соседних кейса с видео — мокап между ними не нужен, ролики
      // просто перетекают один в другой.
      var both = st.from !== st.to && spinOf(st.from) && spinOf(st.to);
      spins.forEach(function (s) {
        if (inView && Math.abs(t - s.at) < 1.5) loadSpin(s);   // качаем, когда ролик близко
        var vis = both
          ? (s.at === st.from ? 1 - st.p : s.at === st.to ? st.p : 0)
          : clamp((0.5 - Math.abs(t - s.at)) / 0.22, 0, 1);
        if (vis > 0 && !s.vis) s.start = now;
        s.vis = vis;
        s.el.style.opacity = vis.toFixed(3);
        any = Math.max(any, vis);
      });
      // между двумя видео мокап не показываем вовсе, иначе он просвечивает посередине
      dev.style.opacity = both ? "0" : (1 - any).toFixed(3);

      // Свой экран мокапу на видео-кейсе не нужен: пока он растворяется,
      // пусть показывает ближайший кейс без видео, а не мелькает чужой картинкой.
      var idx = st.p < 0.5 ? st.from : st.to;
      for (var d = 1; spinOf(idx) && d < works.length; d++) {
        var near = t < idx ? idx - d : idx + d, far = t < idx ? idx + d : idx - d;
        if (near >= 0 && near < works.length && !spinOf(near)) idx = near;
        else if (far >= 0 && far < works.length && !spinOf(far)) idx = far;
      }
      show(idx);

      if (reduce) { spins.forEach(function (s) { if (s.vis > 0) drawSpin(s, 0, 0, 0); }); return; }
      render(now);
    };

    // Каждый кадр: поворот от прокрутки плюс то, что телефон делает сам,
    // пока читаешь кейс, — мокап плавно покачивается, видео идёт по кругу.
    var render = function (now) {
      if (!st.on) return;
      var p = st.p, from = st.from, to = st.to;

      // Видео крутится по кругу в одну сторону, без пауз. Ролик кончается
      // другим экраном, чем начинается, поэтому последние SPIN_SEAM кадров
      // плавно перетекают в первые — стыка не видно.
      spins.forEach(function (s) {
        if (!s.vis || !s.frames.length) return;
        var n = s.frames.length;
        var seam = Math.min(SPIN_SEAM, Math.floor(n / 3));
        var len = n - seam;                                   // длина одного круга
        var pos = ((now - s.start) / 1000 * SPIN_FPS * SPIN_SPEED + seam) % len;   // старт сразу после стыка — с первого экрана
        var i = Math.floor(pos);
        if (i < seam) drawSpin(s, len + i, i, pos / seam);   // хвост уходит, начало проявляется
        else drawSpin(s, i, 0, 0);
      });

      // 0 → 90° (ребро, смена экрана) → с −90° обратно к 0
      var turn = p < 0.5 ? p * 180 : (p - 1) * 180;
      // Покачивание в духе видео; во время поворота затихает, чтобы не спорить с ним.
      var calm = 1 - Math.abs(turn) / 90;
      var w = now / 1000 * (2 * Math.PI / SWAY_PERIOD);
      var swayY = Math.sin(w) * 9 * calm;
      var swayX = Math.sin(w * 0.5 + 1) * 2.5 * calm;
      var lift = Math.sin(w + 0.8) * 6 * calm;

      var side = land[from] + (land[to] - land[from]) * p;    // 0 стоя, 1 лёжа
      // Лёжа телефон шире колонки: уменьшаем так, чтобы влез по ширине.
      var fit = Math.min(1, (stage.clientWidth + 80) / dev.offsetHeight);
      var scale = 1 + (fit - 1) * side;
      dev.style.transform =
        "translateY(" + lift.toFixed(2) + "px) " +
        "rotateZ(" + (-90 * side).toFixed(2) + "deg) " +
        "rotateY(" + (turn + swayY).toFixed(2) + "deg) " +
        "rotateX(" + swayX.toFixed(2) + "deg) " +
        "scale(" + scale.toFixed(3) + ")";
      // Боком к зрителю телефон темнеет — так поворот читается объёмным.
      dev.style.filter = "drop-shadow(0 40px 60px rgba(0,0,0,.6)) brightness(" +
        (1 - 0.45 * Math.abs(Math.sin((turn + swayY) * Math.PI / 180))).toFixed(3) + ")";
      // Блик идёт за поворотом, а в покое чуть гуляет вместе с покачиванием.
      screen.style.setProperty("--glare", clamp((p * 2) - 1 + swayY / 40, -1, 1).toFixed(3));
    };

    var request = function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(measure);
    };

    // Цикл кадров крутится, только пока колонка с телефоном на экране и
    // вкладка открыта. При просьбе уменьшить движение цикла нет вовсе.
    var raf = 0, inView = false;
    var loop = function (now) { render(now); raf = requestAnimationFrame(loop); };
    var run = function () {
      var want = !reduce && inView && !document.hidden;
      if (want && !raf) raf = requestAnimationFrame(loop);
      if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { inView = e[0].isIntersecting; run(); request(); }).observe(stage);
    } else {
      inView = true;
    }
    document.addEventListener("visibilitychange", run);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    measure();
    run();
  };

  /* --- Старт -------------------------------------------------------------
     Каждый блок отдельно: если один споткнётся, остальные всё равно
     отработают, а страница не останется наполовину собранной. */
  [fill, menu, header, particles, reveal, showcase].forEach(function (step) {
    try { step(); } catch (e) { console.error(e); }
  });
})();
