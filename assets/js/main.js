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

  /* --- Пятно фона под курсором -------------------------------------------
     Пишем позицию в CSS-переменные, а двигает пятно трансформ: браузеру
     остаётся только сдвинуть готовый слой. Значение догоняет курсор, а не
     прыгает за ним, иначе пятно дёргается на каждом событии.

     Мыши нет или человек просил меньше движения — не вмешиваемся: пятно
     продолжает плыть само по себе, этим занимается CSS. */
  var spot = function () {
    var el = document.querySelector(".bg__spot");
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var x = window.innerWidth / 2;
    var y = window.innerHeight * 0.34;
    var tx = x, ty = y, running = false;

    var put = function () {
      el.style.setProperty("--sx", x.toFixed(1) + "px");
      el.style.setProperty("--sy", y.toFixed(1) + "px");
    };

    var frame = function () {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      put();
      if (Math.abs(tx - x) < 0.5 && Math.abs(ty - y) < 0.5) { running = false; return; }
      requestAnimationFrame(frame);
    };

    // Класс выключает в CSS самостоятельное блуждание пятна.
    document.documentElement.classList.add("has-pointer-spot");
    put();

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;     // тянуть пятно за пальцем незачем
      tx = e.clientX;
      ty = e.clientY;
      if (!running) { running = true; requestAnimationFrame(frame); }
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
  [fill, menu, header, spot, reveal].forEach(function (step) {
    try { step(); } catch (e) { console.error(e); }
  });
})();
