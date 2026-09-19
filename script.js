/* ==========================================================================
   The Miso Ramen Museum — behavior
   Nav state, mobile menu, and all motion (GSAP + ScrollTrigger).

   Motion language, kept deliberately small:
   - Hero:      one intro sequence, then it fades away as you scroll.
   - Headings:  words slide up out of a mask.
   - Everything else: a soft fade + short rise, staggered in groups.
   - Images:    a wipe + fade, with a gentle parallax drift.
   Everything reverses when you scroll back up, so it fades out again.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  var canAnimate = !!(window.gsap && window.ScrollTrigger);

  // The "js" class (set in <head>) hides elements until GSAP reveals them.
  // If GSAP didn't load, show everything as-is.
  if (!canAnimate) {
    root.classList.remove("js");
    console.info(
      "Animations are off: GSAP or ScrollTrigger did not load (check your connection or ad-blocker)."
    );
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Nav: solid background after scrolling past hero ---------- */
  var nav = document.getElementById("siteNav");
  var heroEl = document.querySelector(".hero");

  function updateNavSolid() {
    if (!nav) return;
    var threshold = heroEl ? heroEl.offsetHeight * 0.7 : 80;
    nav.classList.toggle("is-solid", window.scrollY > threshold);
  }

  /* ---------- Broth-fill scroll progress ---------- */
  var brothFill = document.getElementById("brothFill");

  function updateBrothFill() {
    if (!brothFill) return;
    var doc = document.documentElement;
    var scrollTop = window.scrollY || doc.scrollTop;
    var height = doc.scrollHeight - doc.clientHeight;
    var pct = height > 0 ? (scrollTop / height) * 100 : 0;
    brothFill.style.width = Math.min(100, Math.max(0, pct)) + "%";
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateNavSolid();
      updateBrothFill();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  updateNavSolid();
  updateBrothFill();

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Active nav link while scrolling ---------- */
  var navAnchors = Array.prototype.slice.call(
    document.querySelectorAll("[data-nav]")
  );
  var trackedSections = navAnchors
    .map(function (a) {
      var id = a.getAttribute("href").replace("#", "");
      var el = document.getElementById(id);
      return el ? { link: a, el: el } : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && trackedSections.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var match = trackedSections.find(function (s) {
            return s.el === entry.target;
          });
          if (!match || !entry.isIntersecting) return;
          navAnchors.forEach(function (a) {
            a.classList.remove("is-active");
          });
          match.link.classList.add("is-active");
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    trackedSections.forEach(function (s) {
      navObserver.observe(s.el);
    });
  }

  /* ---------- Team photo tilt (desktop pointer only) ---------- */
  if (hasFinePointer && !prefersReducedMotion) {
    document.querySelectorAll(".keeper-photo").forEach(function (photo) {
      var img = photo.querySelector("img");
      if (!img) return;
      photo.addEventListener("mousemove", function (e) {
        var r = photo.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        img.style.transform =
          "rotateY(" + (x * 12).toFixed(2) + "deg) " +
          "rotateX(" + (-y * 12).toFixed(2) + "deg) " +
          "scale(1.08)";
      });
      photo.addEventListener("mouseleave", function () {
        img.style.transform = "";
      });
    });

    /* ---------- Magnetic pull on nav links ---------- */
    document.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("mousemove", function (e) {
        var r = link.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.3;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        link.style.transform =
          "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      link.addEventListener("mouseleave", function () {
        link.style.transform = "";
      });
    });
  }

  /* ==========================================================================
     GSAP motion
     ========================================================================== */

  var TOGGLE = "play none none reverse"; // fade in on enter, fade out on scroll back up

  /** Wrap every word of an element in a mask so it can slide up into view. */
  function splitWords(el) {
    var text = el.textContent.trim();
    el.setAttribute("aria-label", text); // screen readers hear the real heading
    var frag = document.createDocumentFragment();
    var words = text.split(/\s+/);

    words.forEach(function (word, i) {
      var mask = document.createElement("span");
      mask.className = "split-word";
      mask.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span");
      inner.className = "split-word__inner";
      inner.textContent = word;
      mask.appendChild(inner);
      frag.appendChild(mask);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(" "));
    });

    el.textContent = "";
    el.appendChild(frag);
    return el.querySelectorAll(".split-word__inner");
  }

  /* -- 1. Hero: one orchestrated intro ------------------------------------ */
  function initHero() {
    var words = gsap.utils.toArray(".hero-title .word").map(function (w) {
      var inner = document.createElement("span");
      inner.className = "split-word__inner";
      inner.textContent = w.textContent;
      w.textContent = "";
      w.classList.add("split-word");
      w.appendChild(inner);
      return inner;
    });

    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });

    intro
      .fromTo(".hero-img",
        { scale: 1.18, opacity: 0 },
        { scale: 1, opacity: 1, duration: 2.6, ease: "power2.out" }, 0)
      .from(".site-nav .nav-inner", { y: -20, opacity: 0, duration: 1 }, 0.4)
      .from(words, { yPercent: 115, duration: 1.2, ease: "power4.out", stagger: 0.12 }, 0.35)
      .from(".hero-subtitle", { y: 18, opacity: 0, duration: 1 }, ">-0.6")
      .from(".scroll-cue", { opacity: 0, duration: 1 }, ">-0.4");

    // Elements were hidden by CSS until now; reveal the (already positioned) containers.
    gsap.set([".hero-title", ".hero-subtitle", ".scroll-cue"], { visibility: "visible" });

    // Leaving the hero: image drifts slower than the page, text fades and lifts away.
    gsap.timeline({
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    })
      .to(".hero-media", { yPercent: 14, ease: "none", duration: 1 }, 0)
      .to(".hero-content", { yPercent: -14, opacity: 0, ease: "none", duration: 0.7 }, 0);

    // The scroll cue disappears as soon as you do scroll.
    gsap.to(".scroll-cue", {
      opacity: 0, duration: 0.4, overwrite: "auto",
      scrollTrigger: { trigger: ".hero", start: "top -80", toggleActions: TOGGLE }
    });

    // Soft glow that eases after the cursor
    var glow = document.getElementById("heroGlow");
    if (glow && heroEl && hasFinePointer) {
      gsap.set(glow, { xPercent: -50, yPercent: -50 });
      var moveX = gsap.quickTo(glow, "x", { duration: 0.6, ease: "power3" });
      var moveY = gsap.quickTo(glow, "y", { duration: 0.6, ease: "power3" });
      heroEl.addEventListener("mousemove", function (e) {
        var r = heroEl.getBoundingClientRect();
        var x = e.clientX - r.left;
        var y = e.clientY - r.top;
        if (!glow.classList.contains("is-active")) {
          gsap.set(glow, { x: x, y: y }); // don't fly in from the corner
        }
        moveX(x);
        moveY(y);
        glow.classList.add("is-active");
      });
      heroEl.addEventListener("mouseleave", function () {
        glow.classList.remove("is-active");
      });
    }
  }

  /* -- 2. Headings: words slide up out of a mask -------------------------- */
  function initHeadings() {
    gsap.utils.toArray(".char-reveal").forEach(function (el) {
      var words = splitWords(el);
      gsap.set(el, { visibility: "visible" });
      gsap.fromTo(words,
        { yPercent: 115 },
        {
          yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.07,
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: TOGGLE }
        });
    });
  }

  /* -- 3. Text blocks & cards: fade + short rise, staggered in groups ----- */
  function initReveals() {
    // Groups reveal together, one after another
    gsap.utils
      .toArray(".find-grid, .keepers-grid, .sources-list, .site-footer")
      .forEach(function (group) {
        var items = Array.prototype.slice.call(group.children).filter(function (c) {
          return c.classList.contains("reveal") && !c.classList.contains("char-reveal");
        });
        if (!items.length) return;
        items.forEach(function (c) { c.dataset.grouped = "true"; });

        gsap.fromTo(items,
          { opacity: 0, y: 36 },
          {
            opacity: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.12,
            scrollTrigger: {
              trigger: group,
              start: group.classList.contains("site-footer") ? "top 95%" : "top 85%",
              toggleActions: TOGGLE
            }
          });
      });

    // Everything else that's marked .reveal
    gsap.utils.toArray(".reveal").forEach(function (el) {
      if (el.dataset.grouped || el.classList.contains("char-reveal")) return;

      var from = { opacity: 0 };
      // Containers that hold an animated heading just fade; the heading does the moving.
      if (!el.querySelector(".char-reveal")) {
        if (el.classList.contains("reveal--left")) from.x = -40;
        else if (el.classList.contains("reveal--right")) from.x = 40;
        else if (el.classList.contains("reveal--down")) from.y = -30;
        else from.y = 32;
      }

      gsap.fromTo(el, from, {
        opacity: 1, x: 0, y: 0, duration: 1.2, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", toggleActions: TOGGLE }
      });
    });

    // Cards lift on hover (done in GSAP so it never fights the scroll reveal)
    if (hasFinePointer) {
      gsap.utils.toArray(".find-card").forEach(function (card) {
        var lift = function (y) {
          return function () {
            gsap.to(card, { y: y, duration: 0.4, ease: "power3.out", overwrite: "auto" });
          };
        };
        card.addEventListener("mouseenter", lift(-6));
        card.addEventListener("mouseleave", lift(0));
        card.addEventListener("focus", lift(-6));
        card.addEventListener("blur", lift(0));
      });
    }

    // Divider lines draw outward from the centre
    gsap.utils.toArray(".ignite-divider").forEach(function (el) {
      gsap.fromTo(el,
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1, opacity: 1, duration: 1.4, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", toggleActions: TOGGLE }
        });
    });
  }

  /* -- 4. Images: wipe + fade in, gentle parallax while scrolling --------- */
  function initImages() {
    gsap.utils.toArray(".media-reveal").forEach(function (el) {
      var fromRight = el.classList.contains("media-reveal--right");
      gsap.fromTo(el,
        {
          opacity: 0,
          clipPath: fromRight ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)"
        },
        {
          opacity: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "power3.inOut",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: TOGGLE }
        });
    });

  }

  function initAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    initHero();
    initHeadings();
    initReveals();
    initImages();

    // Positions shift once fonts and images settle, so re-measure.
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  if (canAnimate) {
    try {
      initAnimations();
    } catch (err) {
      // Never leave the page blank if something goes wrong.
      console.error("Animation setup failed:", err);
      root.classList.remove("js");
      gsap.set(
        ".reveal, .media-reveal, .ignite-divider, .char-reveal, .hero-title, .hero-subtitle, .scroll-cue",
        { clearProps: "all" }
      );
    }
  }
})();
