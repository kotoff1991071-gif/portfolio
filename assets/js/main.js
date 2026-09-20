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

    var start = function () {
      if (raf || document.hidden) return;
      raf = requestAnimationFrame(draw);
    };
    var stop = function () {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    size();
    seed();

    if (reduce) {
      draw(0);                              // один кадр: картинка есть, движения нет
      stop();
    } else {
      start();
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
      });
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        window.addEventListener("pointermove", function (e) {
          if (e.pointerType === "touch") return;
          mx = e.clientX;
          my = e.clientY;
        }, { passive: true });
      }
    }

    var timer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        size();
        seed();
        if (reduce) draw(0);
      }, 150);
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

  /* --- Старт -------------------------------------------------------------
     Каждый блок отдельно: если один споткнётся, остальные всё равно
     отработают, а страница не останется наполовину собранной. */
  [fill, menu, header, particles, reveal].forEach(function (step) {
    try { step(); } catch (e) { console.error(e); }
  });
})();
