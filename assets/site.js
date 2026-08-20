/* 8 Hz — quiet cinematic motion system */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MOBILE = window.matchMedia("(max-width: 820px)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 1.75);

  var header = document.querySelector(".site-header");
  function onScrollHeader() { if (header) header.classList.toggle("scrolled", window.scrollY > 40); }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  var menuBtn = document.querySelector(".menu-btn");
  var mobileNav = document.querySelector(".mobile-nav");
  var menuClose = document.querySelector(".menu-close");
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () {
      mobileNav.classList.add("open"); mobileNav.removeAttribute("aria-hidden");
      document.body.style.overflow = "hidden"; menuClose.focus();
    });
    function closeMenu() {
      mobileNav.classList.remove("open"); mobileNav.setAttribute("aria-hidden", "true");
      document.body.style.overflow = ""; menuBtn.focus();
    }
    menuClose.addEventListener("click", closeMenu);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.classList.contains("open")) closeMenu();
    });
  }

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("on"); revealIO.unobserve(en.target); } });
  }, { threshold: 0.18 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });

  var stages = document.querySelectorAll(".hero .stage");
  if (stages.length) {
    if (REDUCED) { stages.forEach(function (s) { s.classList.add("on"); }); document.body.classList.add("intro-done"); }
    else { setTimeout(function () { stages.forEach(function (s) { s.classList.add("on"); }); document.body.classList.add("intro-done"); }, 1400); }
  }

  var sky = document.getElementById("sky");
  if (sky) initSky(sky);

  function initSky(canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0;
    var stars = { back: [], mid: [], fore: [] };
    var filaments = [];
    var mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    var t0 = performance.now();
    var introP = 0, visible = true;
    var flow = null, nextAutoFlow = 0;

    var CONS = [
      { pts: [[0.200,0.300,1],[0.265,0.235,0],[0.345,0.270,1],[0.390,0.360,0],[0.320,0.420,0],[0.240,0.390,0]], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
      { pts: [[0.640,0.180,1],[0.720,0.150,0],[0.790,0.210,1],[0.760,0.300,0],[0.670,0.290,0]], edges: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
      { pts: [[0.860,0.520,0],[0.930,0.470,1],[1.020,0.500,0],[1.080,0.430,1],[1.140,0.470,0]], edges: [[0,1],[1,2],[2,3],[3,4]] },
      { pts: [[0.080,0.640,0],[0.150,0.600,1],[0.210,0.660,0],[0.160,0.740,0]], edges: [[0,1],[1,2],[2,3]] },
      { pts: [[0.520,0.700,0],[0.600,0.660,1],[0.680,0.710,0],[0.640,0.790,0],[0.550,0.780,0]], edges: [[0,1],[1,2],[2,3],[3,4],[4,1]] }
    ];
    var consActive = -1;
    if (MOBILE) CONS = CONS.slice(0, 3);

    function resize() { W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); buildField(); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function buildField() {
      stars.back = []; stars.mid = []; stars.fore = [];
      var area = W * H;
      var nBack = Math.min(260, Math.round(area / (MOBILE ? 16000 : 9000)));
      var nMid = Math.min(90, Math.round(area / (MOBILE ? 42000 : 26000)));
      var nFore = Math.min(26, Math.round(area / (MOBILE ? 150000 : 90000)));
      var i;
      for (i = 0; i < nBack; i++) stars.back.push({ x: Math.random(), y: Math.random(), r: rnd(0.3, 0.8), a: rnd(0.14, 0.42), tw: rnd(0.0004, 0.0012), ph: rnd(0, 6.28) });
      for (i = 0; i < nMid; i++) stars.mid.push({ x: Math.random(), y: Math.random(), r: rnd(0.7, 1.3), a: rnd(0.3, 0.62), tw: rnd(0.0006, 0.0016), ph: rnd(0, 6.28) });
      for (i = 0; i < nFore; i++) stars.fore.push({ x: Math.random(), y: Math.random(), r: rnd(1.1, 1.9), a: rnd(0.45, 0.85), tw: rnd(0.0008, 0.002), ph: rnd(0, 6.28) });
      filaments = [];
      var nf = MOBILE ? 2 : 4;
      for (i = 0; i < nf; i++) filaments.push({ x: rnd(-0.1, 1.0), y: rnd(0.1, 0.85), len: rnd(0.18, 0.42), ang: rnd(-0.5, -0.15), sp: rnd(0.004, 0.011), a: rnd(0.05, 0.13), ph: rnd(0, 6.28) });
    }
    function consPixels() {
      return CONS.map(function (c) { return { pts: c.pts.map(function (p) { return { x: p[0] * W, y: p[1] * H, bright: p[2] === 1 }; }), edges: c.edges }; });
    }

    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = Math.min(50, now - last); last = now;
      var t = now - t0;
      introP += (1 - introP) * (dt * 0.00035); if (introP > 0.995) introP = 1;
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      var breathe = REDUCED ? 0 : Math.sin(t * 0.00012) * 0.012;
      var scrollP = Math.min(1, window.scrollY / Math.max(1, H));
      var camScale = 1 + breathe + scrollP * 0.06;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(camScale, camScale); ctx.translate(-W / 2, -H / 2);
      var mx = (mouse.x - 0.5), my = (mouse.y - 0.5);
      drawStars(stars.back, mx * 1, my * 1, t, 0.25 * introP);
      drawStars(stars.mid, mx * 2.5, my * 2.5, t, 0.55 * introP);
      drawStars(stars.fore, mx * 5, my * 5, t, 1 * introP);
      if (!REDUCED) {
        filaments.forEach(function (f) {
          f.x += f.sp * dt * 0.001;
          if (f.x - f.len > 1.2) f.x = -0.3 - Math.random() * 0.3;
          var fx = f.x * W, fy = f.y * H;
          var x2 = fx + Math.cos(f.ang) * f.len * W, y2 = fy + Math.sin(f.ang) * f.len * W;
          var g = ctx.createLinearGradient(fx, fy, x2, y2);
          var fade = 0.55 + 0.45 * Math.sin(t * 0.0002 + f.ph);
          g.addColorStop(0, "rgba(185,192,204,0)");
          g.addColorStop(0.5, "rgba(185,192,204," + (f.a * fade * introP).toFixed(3) + ")");
          g.addColorStop(1, "rgba(185,192,204,0)");
          ctx.strokeStyle = g; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(fx, fy);
          ctx.quadraticCurveTo((fx + x2) / 2, (fy + y2) / 2 - 14, x2, y2);
          ctx.stroke();
        });
      }
      var px = consPixels();
      if (!MOBILE) {
        consActive = -1;
        var mxi = mouse.tx * W, myi = mouse.ty * H;
        px.forEach(function (c, ci) {
          if (consActive >= 0) return;
          var xs = c.pts.map(function (p) { return p.x; }), ys = c.pts.map(function (p) { return p.y; });
          var pad = 70;
          if (mxi > Math.min.apply(0, xs) - pad && mxi < Math.max.apply(0, xs) + pad && myi > Math.min.apply(0, ys) - pad && myi < Math.max.apply(0, ys) + pad) consActive = ci;
        });
      } else if (!REDUCED && now > nextAutoFlow && introP >= 1) {
        consActive = Math.floor(Math.random() * px.length);
        nextAutoFlow = now + 9000 + Math.random() * 8000;
      }
      var baseLineA = 0.14 * introP;
      px.forEach(function (c, ci) {
        var act = ci === consActive;
        ctx.strokeStyle = "rgba(185,192,204," + (act ? baseLineA * 1.7 : baseLineA).toFixed(3) + ")";
        ctx.lineWidth = 0.55;
        c.edges.forEach(function (e) { var a = c.pts[e[0]], b = c.pts[e[1]]; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
        c.pts.forEach(function (p) {
          var tw = 0.8 + 0.2 * Math.sin(t * 0.0009 + p.x);
          var a = (p.bright ? 0.85 : 0.5) * tw * introP;
          if (p.bright) {
            var halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
            halo.addColorStop(0, "rgba(236,237,241," + (0.5 * a).toFixed(3) + ")");
            halo.addColorStop(1, "rgba(236,237,241,0)");
            ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 6.29); ctx.fill();
          }
          ctx.fillStyle = "rgba(236,237,241," + a.toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.bright ? 1.6 : 1.1, 0, 6.29); ctx.fill();
        });
      });
      if (consActive >= 0 && !REDUCED && introP >= 1) {
        if (!flow || flow.ci !== consActive) flow = { ci: consActive, edge: 0, p: 0 };
        var c = px[flow.ci];
        var e = c.edges[flow.edge % c.edges.length];
        var a2 = c.pts[e[0]], b2 = c.pts[e[1]];
        flow.p += dt * 0.00042;
        if (flow.p >= 1) { flow.p = 0; flow.edge++; }
        var fx2 = a2.x + (b2.x - a2.x) * flow.p;
        var fy2 = a2.y + (b2.y - a2.y) * flow.p;
        var trail = ctx.createRadialGradient(fx2, fy2, 0, fx2, fy2, 12);
        trail.addColorStop(0, "rgba(236,237,241,0.55)"); trail.addColorStop(0.4, "rgba(185,192,204,0.18)"); trail.addColorStop(1, "rgba(185,192,204,0)");
        ctx.fillStyle = trail; ctx.beginPath(); ctx.arc(fx2, fy2, 12, 0, 6.29); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(fx2, fy2, 1.3, 0, 6.29); ctx.fill();
        if (flow.p > 0.8) {
          var ba = (flow.p - 0.8) / 0.2;
          var hb = ctx.createRadialGradient(b2.x, b2.y, 0, b2.x, b2.y, 13);
          hb.addColorStop(0, "rgba(236,237,241," + (0.4 * ba).toFixed(3) + ")"); hb.addColorStop(1, "rgba(236,237,241,0)");
          ctx.fillStyle = hb; ctx.beginPath(); ctx.arc(b2.x, b2.y, 13, 0, 6.29); ctx.fill();
        }
      } else { flow = null; }
      ctx.restore();
      var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.78);
      vg.addColorStop(0, "rgba(3,3,5,0)"); vg.addColorStop(1, "rgba(3,3,5,0.55)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    function drawStars(layer, ox, oy, t, am) {
      for (var i = 0; i < layer.length; i++) {
        var s = layer[i];
        var tw = 0.72 + 0.28 * Math.sin(t * s.tw + s.ph);
        var a = s.a * tw * am;
        if (a < 0.01) continue;
        ctx.fillStyle = "rgba(236,237,241," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(s.x * W + ox, s.y * H + oy, s.r, 0, 6.29); ctx.fill();
      }
    }
    window.addEventListener("mousemove", function (e) { mouse.tx = e.clientX / window.innerWidth; mouse.ty = e.clientY / window.innerHeight; }, { passive: true });
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(canvas);
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
  }

  var noiseCanvas = document.getElementById("noise-canvas");
  var noiseSection = document.querySelector(".noise-section");
  if (noiseCanvas && noiseSection) initNoise(noiseCanvas, noiseSection);

  function initNoise(canvas, section) {
    var ctx = canvas.getContext("2d");
    var W, H, frags = [];
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      frags = [];
      var n = MOBILE ? 26 : 48;
      for (var i = 0; i < n; i++) frags.push({ x: Math.random(), y: Math.random(), len: 20 + Math.random() * 90, ang: Math.random() * Math.PI, sp: 0.2 + Math.random() * 0.8, ph: Math.random() * 6.28, kind: Math.random() < 0.28 ? "wave" : "line", a: 0.05 + Math.random() * 0.16 });
    }
    resize(); window.addEventListener("resize", resize);
    var visible = false;
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(section);
    var copy = section.querySelector(".noise-copy"), copyOn = false;
    function progress() { var r = section.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight))); }
    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = Math.min(50, now - last); last = now;
      var t = now, p = progress();
      var shouldOn = p > 0.52;
      if (shouldOn !== copyOn) { copyOn = shouldOn; if (copy) copy.classList.toggle("on", copyOn); }
      ctx.clearRect(0, 0, W, H);
      var density = p < 0.5 ? p * 2 : (1 - p) * 2;
      var slow = 1 - p * 0.75;
      frags.forEach(function (f, i) {
        if (i / frags.length > density * 1.15) return;
        var drift = REDUCED ? 0 : t * 0.00002 * f.sp * slow;
        var cx = ((f.x + drift) % 1.2 - 0.1) * W;
        var cy = f.y * H + Math.sin(t * 0.0003 * f.sp + f.ph) * 10 * slow;
        var spread = 1 + p * 2.2;
        var dx = (cx - W / 2) * spread * 0.35, dy = (cy - H / 2) * spread * 0.35;
        var alpha = f.a * density * (1 - Math.max(0, p - 0.72) * 3.2);
        if (alpha <= 0.004) return;
        ctx.strokeStyle = "rgba(185,192,204," + alpha.toFixed(3) + ")"; ctx.lineWidth = 0.6;
        ctx.beginPath();
        if (f.kind === "wave") {
          var segs = 14, wl = f.len * 0.9;
          for (var s2 = 0; s2 <= segs; s2++) {
            var wx = cx + dx + (s2 / segs - 0.5) * wl;
            var wy = cy + dy + Math.sin(s2 * 0.9 + t * 0.0006 * slow + f.ph) * 6 * slow;
            if (s2 === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
          }
        } else {
          ctx.moveTo(cx + dx, cy + dy);
          ctx.lineTo(cx + dx + Math.cos(f.ang) * f.len, cy + dy + Math.sin(f.ang) * f.len * 0.3);
        }
        ctx.stroke();
      });
    }
    requestAnimationFrame(frame);
  }

  var device = document.querySelector(".device");
  if (device) {
    var screens = device.querySelectorAll(".app-screen"), si = 0;
    new IntersectionObserver(function (en) { if (en[0].isIntersecting) device.classList.add("on"); }, { threshold: 0.3 }).observe(device);
    if (!REDUCED && screens.length > 1) setInterval(function () { screens[si].classList.remove("active"); si = (si + 1) % screens.length; screens[si].classList.add("active"); }, 5200);
  }

  var sw = document.querySelector(".somewhere");
  if (sw) initSomewhere(sw);

  function initSomewhere(section) {
    var map = section.querySelector(".sw-mapwrap");
    var dots = section.querySelectorAll(".sw-dot");
    var clusters = section.querySelectorAll(".sw-cluster");
    var legend = section.querySelector(".sw-legend");
    var corner = section.querySelector(".sw-brand-corner");
    var preview = section.querySelector(".sw-preview");
    var endcopy = section.querySelector(".sw-endcopy");
    var saiKungDot = section.querySelector(".sw-dot.main");
    var visible = false;
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(section);
    function seg(p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); }
    function ease(x) { return x * x * (3 - 2 * x); }
    function update() {
      var r = section.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      var mapIn = ease(seg(p, 0.0, 0.12));
      var dotsIn = ease(seg(p, 0.12, 0.24));
      var focus = ease(seg(p, 0.26, 0.4));
      var prevIn = ease(seg(p, 0.38, 0.52));
      var mapOut = ease(seg(p, 0.58, 0.74));
      var endIn = ease(seg(p, 0.72, 0.86));
      var allOut = ease(seg(p, 0.9, 1.0));
      map.style.opacity = (mapIn * (1 - mapOut)).toFixed(3);
      var sc = 1 + focus * 0.22 + mapOut * 0.3;
      var tx = focus * -9 + mapOut * -3;
      var ty = focus * 4 + mapOut * 7;
      map.style.transform = "translate(" + tx + "%," + ty + "%) scale(" + sc + ")";
      dots.forEach(function (d, i) { var dd = Math.min(1, Math.max(0, dotsIn * 1.6 - i * 0.18)); d.style.opacity = (dd * (1 - mapOut)).toFixed(3); d.style.transform = "scale(" + (0.6 + dd * 0.4) + ")"; });
      clusters.forEach(function (c, i) { c.style.opacity = (Math.min(1, Math.max(0, dotsIn * 1.4 - 0.3 - i * 0.2)) * 0.9 * (1 - mapOut)).toFixed(3); });
      if (legend) legend.style.opacity = (mapIn * 0.9 * (1 - mapOut)).toFixed(3);
      if (corner) corner.style.opacity = (mapIn * (1 - mapOut)).toFixed(3);
      if (saiKungDot) saiKungDot.classList.toggle("bright", focus > 0.4);
      preview.style.opacity = (prevIn * (1 - endIn)).toFixed(3);
      preview.style.transform = "translate(-50%," + ((1 - prevIn) * 40 - endIn * 90) + "px)";
      preview.style.visibility = endIn >= 1 ? "hidden" : "visible";
      endcopy.style.opacity = (endIn * (1 - allOut)).toFixed(3);
      endcopy.style.transform = "translateY(" + ((1 - endIn) * 24) + "px)";
      endcopy.style.filter = "blur(" + ((1 - endIn) * 4) + "px)";
    }
    if (REDUCED) return;
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!visible || ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }, { passive: true });
    update();
  }
})();
