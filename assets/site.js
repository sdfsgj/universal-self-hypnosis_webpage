/* 8 Hz — quiet cinematic motion system */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MOBILE = window.matchMedia("(max-width: 820px)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 1.75);

  /* ---------------- Header ---------------- */
  var header = document.querySelector(".site-header");
  function onScrollHeader() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  var menuBtn = document.querySelector(".menu-btn");
  var mobileNav = document.querySelector(".mobile-nav");
  var menuClose = document.querySelector(".menu-close");
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () {
      mobileNav.classList.add("open");
      mobileNav.removeAttribute("aria-hidden");
      document.body.style.overflow = "hidden";
      menuClose.focus();
    });
    function closeMenu() {
      mobileNav.classList.remove("open");
      mobileNav.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      menuBtn.focus();
    }
    menuClose.addEventListener("click", closeMenu);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.classList.contains("open")) closeMenu();
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("on"); revealIO.unobserve(en.target); }
    });
  }, { threshold: 0.18 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });

  /* ---------------- Hero staged intro ---------------- */
  var stages = document.querySelectorAll(".hero .stage");
  if (stages.length) {
    if (REDUCED) {
      stages.forEach(function (s) { s.classList.add("on"); });
      document.body.classList.add("intro-done");
    } else {
      setTimeout(function () {
        stages.forEach(function (s) { s.classList.add("on"); });
        document.body.classList.add("intro-done");
      }, 1400);
    }
  }

  /* ---------------- Starfield ---------------- */
  var sky = document.getElementById("sky");
  if (sky) initSky(sky);

  function initSky(canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0;
    var stars = { back: [], mid: [], fore: [] };
    var filaments = [];
    var mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    var t0 = performance.now();
    var introP = 0; // 0..1 staged reveal of the field
    var running = true, visible = true;
    var nextAutoFlow = 0;

    /* Constellation definitions — relative to viewport, asymmetric.
       points: [x,y,bright?]  edges: index pairs */
    var CONS = [
      { pts: [[0.200,0.300,1],[0.265,0.235,0],[0.345,0.270,1],[0.390,0.360,0],[0.320,0.420,0],[0.240,0.390,0]],
        edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
      { pts: [[0.640,0.180,1],[0.720,0.150,0],[0.790,0.210,1],[0.760,0.300,0],[0.670,0.290,0]],
        edges: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
      { pts: [[0.860,0.520,0],[0.930,0.470,1],[1.020,0.500,0],[1.080,0.430,1],[1.140,0.470,0]],
        edges: [[0,1],[1,2],[2,3],[3,4]] },
      { pts: [[0.080,0.640,0],[0.150,0.600,1],[0.210,0.660,0],[0.160,0.740,0]],
        edges: [[0,1],[1,2],[2,3]] },
      { pts: [[0.520,0.700,0],[0.600,0.660,1],[0.680,0.710,0],[0.640,0.790,0],[0.550,0.780,0]],
        edges: [[0,1],[1,2],[2,3],[3,4],[4,1]] }
    ];
    if (MOBILE) CONS = CONS.slice(0, 3);

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildField();
      buildPaths(consPixels());
    }

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function buildField() {
      stars.back = []; stars.mid = []; stars.fore = [];
      var area = W * H;
      var nBack = Math.min(260, Math.round(area / (MOBILE ? 16000 : 9000)));
      var nMid = Math.min(90, Math.round(area / (MOBILE ? 42000 : 26000)));
      var nFore = Math.min(26, Math.round(area / (MOBILE ? 150000 : 90000)));
      var i;
      for (i = 0; i < nBack; i++) stars.back.push({ x: Math.random(), y: Math.random(), r: rnd(0.3, 0.8), a: rnd(0.2, 0.5), tw: rnd(0.0004, 0.0012), ph: rnd(0, 6.28) });
      for (i = 0; i < nMid; i++) stars.mid.push({ x: Math.random(), y: Math.random(), r: rnd(0.7, 1.3), a: rnd(0.36, 0.7), tw: rnd(0.0006, 0.0016), ph: rnd(0, 6.28) });
      for (i = 0; i < nFore; i++) stars.fore.push({ x: Math.random(), y: Math.random(), r: rnd(1.1, 1.9), a: rnd(0.5, 0.9), tw: rnd(0.0008, 0.002), ph: rnd(0, 6.28) });

      filaments = [];
      var nf = MOBILE ? 2 : 4;
      for (i = 0; i < nf; i++) {
        filaments.push({
          x: rnd(-0.1, 1.0), y: rnd(0.1, 0.85),
          len: rnd(0.18, 0.42), ang: rnd(-0.5, -0.15),
          sp: rnd(0.002, 0.006), a: rnd(0.035, 0.09), ph: rnd(0, 6.28)
        });
      }
    }

    function consPixels() {
      return CONS.map(function (c) {
        return {
          pts: c.pts.map(function (p) { return { x: p[0] * W, y: p[1] * H, bright: p[2] === 1 }; }),
          edges: c.edges
        };
      });
    }

    /* ---- Continuous flow paths ---------------------------------------
       Each constellation's edges are walked into one ordered node path,
       then arc-length parameterized, so the light travels the whole
       constellation at a constant speed instead of hopping edge by edge. */
    var paths = [];      // { pts, cum, total, closed }
    var flowAct = [];    // 0..1 eased activation per constellation
    var flowDist = [];   // arc-length position of the flow head
    var autoRun = [];    // mobile: remaining distance of an autonomous pass

    function buildPaths(px) {
      paths = px.map(function (c) {
        var edges = c.edges.map(function (e) { return [e[0], e[1]]; });
        var order = [edges[0][0], edges[0][1]];
        edges.splice(0, 1);
        var guard = 64;
        while (edges.length && guard--) {
          var last = order[order.length - 1], found = -1;
          for (var i = 0; i < edges.length; i++) {
            if (edges[i][0] === last || edges[i][1] === last) { found = i; break; }
          }
          if (found < 0) break;
          var e = edges.splice(found, 1)[0];
          order.push(e[0] === last ? e[1] : e[0]);
          if (order[order.length - 1] === order[0]) break;
        }
        // close the loop when an edge joins the walk's end back to its start
        var closed = order.length > 2 && order[order.length - 1] === order[0];
        if (!closed && order.length > 2) {
          var fi = order[0], li = order[order.length - 1];
          for (var j = 0; j < c.edges.length; j++) {
            var ee = c.edges[j];
            if ((ee[0] === li && ee[1] === fi) || (ee[1] === li && ee[0] === fi)) {
              order.push(fi); closed = true; break;
            }
          }
        }
        var pts = order.map(function (idx) { return c.pts[idx]; });
        var cum = [0], total = 0;
        for (var k = 1; k < pts.length; k++) {
          total += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
          cum.push(total);
        }
        return { pts: pts, cum: cum, total: Math.max(1, total), closed: closed };
      });
      CONS.forEach(function (_, i) {
        if (flowAct[i] == null) {
          flowAct[i] = 0;
          flowDist[i] = Math.random() * (paths[i] ? paths[i].total : 1);
          autoRun[i] = 0;
        }
      });
    }

    /* position on path at arc-length d (wraps on closed loops) */
    function posAt(path, d) {
      var total = path.total;
      if (path.closed) d = ((d % total) + total) % total;
      else d = Math.min(total, Math.max(0, d));
      var cum = path.cum, pts = path.pts, i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      var seg = cum[i] - cum[i - 1] || 1;
      var p = (d - cum[i - 1]) / seg;
      var a = pts[i - 1], b = pts[i];
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    }

    /* 3-point moving average along the path — slightly softens the
       transition between edges so the eye reads one continuous motion */
    var SMOOTH = 7;
    function posSmooth(path, d) {
      var p1 = posAt(path, d - SMOOTH), p2 = posAt(path, d), p3 = posAt(path, d + SMOOTH);
      return { x: (p1.x + p2.x + p3.x) / 3, y: (p1.y + p2.y + p3.y) / 3 };
    }

    var last = performance.now();
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = Math.min(50, now - last); last = now;
      var t = now - t0;

      // staged intro of the field
      var targetIntro = 1;
      introP += (targetIntro - introP) * (dt * 0.00035);
      if (introP > 0.995) introP = 1;

      // eased mouse
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;

      // camera breathing + scroll push
      var breathe = REDUCED ? 0 : Math.sin(t * 0.00012) * 0.012;
      var scrollP = Math.min(1, window.scrollY / Math.max(1, H));
      var camScale = 1 + breathe + scrollP * 0.06;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(camScale, camScale); ctx.translate(-W / 2, -H / 2);

      var mx = REDUCED ? 0 : (mouse.x - 0.5), my = REDUCED ? 0 : (mouse.y - 0.5);

      // background layer — almost static
      drawStars(stars.back, mx * 1, my * 1, t, 0.35 * introP);
      // midground
      drawStars(stars.mid, mx * 2.5, my * 2.5, t, 0.65 * introP);
      // foreground — responds most (2–6px)
      drawStars(stars.fore, mx * 5, my * 5, t, 1 * introP);

      // filaments
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

      // constellations
      var px = consPixels();

      // hover target (desktop) — nearest constellation whose padded
      // bounding box contains the smoothed pointer
      var hoverI = -1;
      if (!MOBILE && !REDUCED) {
        var mxi = mouse.x * W, myi = mouse.y * H;
        var bestD = 1e9;
        px.forEach(function (c, ci) {
          var xs = c.pts.map(function (p) { return p.x; }), ys = c.pts.map(function (p) { return p.y; });
          var pad = 80;
          var x0 = Math.min.apply(0, xs) - pad, x1 = Math.max.apply(0, xs) + pad;
          var y0 = Math.min.apply(0, ys) - pad, y1 = Math.max.apply(0, ys) + pad;
          if (mxi > x0 && mxi < x1 && myi > y0 && myi < y1) {
            var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            var dd = (mxi - cx) * (mxi - cx) + (myi - cy) * (myi - cy);
            if (dd < bestD) { bestD = dd; hoverI = ci; }
          }
        });
      }
      // mobile: occasionally play one restrained autonomous pass
      if (MOBILE && !REDUCED && introP >= 1 && now > nextAutoFlow) {
        var pick = Math.floor(Math.random() * px.length);
        autoRun[pick] = paths[pick].total;
        nextAutoFlow = now + 10000 + Math.random() * 8000;
      }

      var baseLineA = 0.24 * introP;
      px.forEach(function (c, ci) {
        var path = paths[ci];

        // eased activation: ~0.5s fade in on approach, ~1.2s release on leave
        var target = (ci === hoverI || autoRun[ci] > 0) ? 1 : 0;
        var rate = target > flowAct[ci] ? dt * 0.0028 : dt * 0.0011;
        flowAct[ci] += (target - flowAct[ci]) * Math.min(1, rate);
        if (target === 0 && flowAct[ci] < 0.002) flowAct[ci] = 0;
        var act = flowAct[ci];

        // advance the flow head at constant arc-length speed (4–8s per pass)
        if (!REDUCED && act > 0) {
          var dur = Math.min(8000, Math.max(4000, path.total * 10));
          var adv = dt * (path.total / dur) * (0.15 + 0.85 * act);
          flowDist[ci] += adv;
          if (autoRun[ci] > 0) autoRun[ci] -= adv;
          if (!path.closed && flowDist[ci] > path.total * 1.15) flowDist[ci] = 0;
        }
        var head = act > 0.01 ? posSmooth(path, flowDist[ci]) : null;

        // constellation lines — soft silver, slightly lifted when active
        ctx.strokeStyle = "rgba(185,192,204," + (baseLineA * (1 + 0.18 * act)).toFixed(3) + ")";
        ctx.lineWidth = 0.55;
        c.edges.forEach(function (e) {
          var a = c.pts[e[0]], b = c.pts[e[1]];
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });

        // stars — hierarchy preserved; a star gently brightens as the
        // flow approaches and settles again after it passes
        c.pts.forEach(function (p) {
          var tw = REDUCED ? 1 : 0.8 + 0.2 * Math.sin(t * 0.0009 + p.x);
          var boost = 0;
          if (head) {
            var dh = Math.hypot(p.x - head.x, p.y - head.y);
            if (dh < 95) { var u = 1 - dh / 95; boost = u * u * (3 - 2 * u) * act; }
          }
          var a = (p.bright ? 0.92 : 0.62) * tw * introP * (1 + 0.45 * boost);
          if (a > 1) a = 1;
          if (p.bright || boost > 0.02) {
            var hr = (p.bright ? 12 : 7) + 6 * boost;
            var halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr);
            halo.addColorStop(0, "rgba(236,237,241," + Math.min(1, 0.5 * a + 0.3 * boost).toFixed(3) + ")");
            halo.addColorStop(1, "rgba(236,237,241,0)");
            ctx.fillStyle = halo;
            ctx.beginPath(); ctx.arc(p.x, p.y, hr, 0, 6.29); ctx.fill();
          }
          ctx.fillStyle = "rgba(236,237,241," + a.toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.bright ? 1.8 : 1.25, 0, 6.29); ctx.fill();
        });

        // light flow — a short luminous trail travelling the whole path
        if (head && introP >= 1) {
          // open chains softly fade in/out at their ends
          var fade = 1;
          if (!path.closed) {
            var pf = flowDist[ci] / path.total;
            fade = Math.min(1, pf / 0.08) * Math.min(1, (1 - pf) / 0.08);
            fade = fade * fade * (3 - 2 * fade);
          }
          var fAct = act * fade;
          if (fAct > 0.01) {
            var trailLen = Math.min(path.total * 0.09, 90);
            var N = MOBILE ? 16 : 24;
            var prev = null;
            for (var i = N; i >= 0; i--) {
              var d0 = flowDist[ci] - trailLen * (i / N);
              if (!path.closed && d0 < 0) continue;
              var pt = posSmooth(path, d0);
              if (prev) {
                var k = 1 - i / N; // 0 at tail end → 1 at head
                var al = fAct * 0.55 * k * k * (3 - 2 * k);
                if (al > 0.004) {
                  ctx.strokeStyle = "rgba(236,237,241," + al.toFixed(3) + ")";
                  ctx.lineWidth = 0.5 + 1.1 * k;
                  ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
                }
              }
              prev = pt;
            }
            // head: small white core + very soft halo
            var hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 11);
            hg.addColorStop(0, "rgba(236,237,241," + (0.6 * fAct).toFixed(3) + ")");
            hg.addColorStop(1, "rgba(236,237,241,0)");
            ctx.fillStyle = hg;
            ctx.beginPath(); ctx.arc(head.x, head.y, 11, 0, 6.29); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255," + (0.9 * fAct).toFixed(3) + ")";
            ctx.beginPath(); ctx.arc(head.x, head.y, 1.3, 0, 6.29); ctx.fill();
          }
        }
      });

      ctx.restore();

      // subtle vignette for depth
      var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.78);
      vg.addColorStop(0, "rgba(3,3,5,0)");
      vg.addColorStop(1, "rgba(3,3,5,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
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

    window.addEventListener("mousemove", function (e) {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = e.clientY / window.innerHeight;
    }, { passive: true });

    var visIO = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 });
    visIO.observe(canvas);
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
  }

  /* ---------------- Noise → Stillness ---------------- */
  var noiseCanvas = document.getElementById("noise-canvas");
  var noiseSection = document.querySelector(".noise-section");
  if (noiseCanvas && noiseSection) initNoise(noiseCanvas, noiseSection);

  function initNoise(canvas, section) {
    var ctx = canvas.getContext("2d");
    var W, H;
    var frags = [];
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      frags = [];
      var n = MOBILE ? 26 : 48;
      for (var i = 0; i < n; i++) {
        frags.push({
          x: Math.random(), y: Math.random(),
          len: 20 + Math.random() * 90,
          ang: Math.random() * Math.PI,
          sp: 0.2 + Math.random() * 0.8,
          ph: Math.random() * 6.28,
          kind: Math.random() < 0.28 ? "wave" : "line",
          a: 0.05 + Math.random() * 0.16
        });
      }
    }
    resize();
    window.addEventListener("resize", resize);

    var visible = false;
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(section);
    var copy = section.querySelector(".noise-copy");
    var copyOn = false;

    function progress() {
      var r = section.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      return Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    }

    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = Math.min(50, now - last); last = now;
      var t = now;
      var p = progress(); // 0..1; noise dense early, disperses late

      // copy appears in the stillness (later half)
      var shouldOn = p > 0.52;
      if (shouldOn !== copyOn) { copyOn = shouldOn; if (copy) copy.classList.toggle("on", copyOn); }

      ctx.clearRect(0, 0, W, H);
      var density = p < 0.5 ? p * 2 : (1 - p) * 2; // peaks mid
      var slow = 1 - p * 0.75; // movement slows
      frags.forEach(function (f, i) {
        if (i / frags.length > density * 1.15) return;
        var drift = REDUCED ? 0 : t * 0.00002 * f.sp * slow;
        var cx = ((f.x + drift) % 1.2 - 0.1) * W;
        var cy = f.y * H + Math.sin(t * 0.0003 * f.sp + f.ph) * 10 * slow;
        var spread = 1 + p * 2.2; // disperse
        var dx = (cx - W / 2) * spread * 0.35, dy = (cy - H / 2) * spread * 0.35;
        var alpha = f.a * density * (1 - Math.max(0, p - 0.72) * 3.2);
        if (alpha <= 0.004) return;
        ctx.strokeStyle = "rgba(185,192,204," + alpha.toFixed(3) + ")";
        ctx.lineWidth = 0.6;
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

  /* ---------------- App glimpse screens ---------------- */
  var device = document.querySelector(".device");
  if (device) {
    var screens = device.querySelectorAll(".app-screen");
    var si = 0;
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) device.classList.add("on");
    }, { threshold: 0.3 }).observe(device);
    if (!REDUCED && screens.length > 1) {
      setInterval(function () {
        screens[si].classList.remove("active");
        si = (si + 1) % screens.length;
        screens[si].classList.add("active");
      }, 5200);
    }
  }

  /* ---------------- Somewhere scroll sequence ---------------- */
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
      var total = r.height - window.innerHeight;
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));

      // Stage timeline:
      // 0.00–0.14 map fades in      0.14–0.28 dots appear
      // 0.26–0.38 one dot brightens, camera moves toward it
      // 0.38–0.55 preview rises     0.58–0.74 map fades, place fills
      // 0.72–0.88 endcopy           0.9+ drift back to dark
      var mapIn = ease(seg(p, 0.0, 0.12));
      var dotsIn = ease(seg(p, 0.12, 0.24));
      var focus = ease(seg(p, 0.26, 0.4));
      var prevIn = ease(seg(p, 0.38, 0.52));
      var mapOut = ease(seg(p, 0.58, 0.74));
      var endIn = ease(seg(p, 0.72, 0.86));
      var allOut = ease(seg(p, 0.9, 1.0));

      map.style.opacity = (mapIn * (1 - mapOut * 0.92)).toFixed(3);
      // camera subtly moves toward the Sai Kung dot (positioned ~76%,38%)
      var sc = 1 + focus * 0.22 + mapOut * 0.3;
      var tx = focus * -9 + mapOut * -3; // percent shift toward dot
      var ty = focus * 4 + mapOut * 7;
      map.style.transform = "translate(" + tx + "%," + ty + "%) scale(" + sc + ")";

      dots.forEach(function (d, i) {
        var dd = Math.min(1, Math.max(0, dotsIn * 1.6 - i * 0.18));
        d.style.opacity = (dd * (1 - mapOut)).toFixed(3);
        d.style.transform = "scale(" + (0.6 + dd * 0.4) + ")";
      });
      clusters.forEach(function (c, i) {
        c.style.opacity = (Math.min(1, Math.max(0, dotsIn * 1.4 - 0.3 - i * 0.2)) * 0.9 * (1 - mapOut)).toFixed(3);
      });
      if (legend) legend.style.opacity = (mapIn * 0.9 * (1 - mapOut)).toFixed(3);
      if (corner) corner.style.opacity = (mapIn * (1 - mapOut)).toFixed(3);
      if (saiKungDot) saiKungDot.classList.toggle("bright", focus > 0.4);

      preview.style.opacity = (prevIn * (1 - endIn)).toFixed(3);
      preview.style.transform = "translate(-50%," + ((1 - prevIn) * 40 - endIn * 90) + "px)";
      preview.style.visibility = endIn >= 1 ? "hidden" : "visible";
      map.style.opacity = (mapIn * (1 - mapOut)).toFixed(3);

      endcopy.style.opacity = (endIn * (1 - allOut)).toFixed(3);
      endcopy.style.transform = "translateY(" + ((1 - endIn) * 24) + "px)";
      endcopy.style.filter = "blur(" + ((1 - endIn) * 4) + "px)";
    }

    if (REDUCED) return; // CSS reduced-motion block presents the scene statically
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!visible || ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }, { passive: true });
    update();
  }
})();
