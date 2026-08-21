/* 8 Hz — quiet cinematic motion system */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MOBILE = window.matchMedia("(max-width: 820px)").matches;
  var SMALL = window.matchMedia("(max-width: 560px)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, SMALL ? 1.15 : MOBILE ? 1.35 : 1.6);

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

  /* ---------------- Deep starfield + soft nebula ---------------- */
  var sky = document.getElementById("sky");
  if (sky) initSky(sky);

  function initSky(canvas) {
    var ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    var content = document.querySelector(".hero-content");
    var W = 0, H = 0, renderDpr = 1;
    var stars = { back: [], dust: [], mid: [], bright: [] };
    var filaments = [];
    var safe = { cx: 0, cy: 0, rx: 1, ry: 1 };
    var nebulaSource = null;
    var nebulaLayer = document.createElement("canvas");
    var nebulaCtx = nebulaLayer.getContext("2d");
    var haloSprite = makeHaloSprite();
    var vignette = null;
    var visible = true;
    var running = false;
    var rafId = 0;
    var intro = REDUCED ? 1 : 0;
    var t0 = performance.now();
    var last = t0;
    var target = { x: 0.5, y: 0.5 };
    var smooth = { x: 0.5, y: 0.5 };
    var offset = { x: 0, y: 0 };
    var velocity = { x: 0, y: 0 };
    var cursor = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, lastX: 0, lastY: 0, lastAt: 0, active: false };
    var influenceRadius = 240;
    var starPalette = [
      "244,247,255", "225,234,255", "198,217,255",
      "217,211,255", "235,232,255", "250,250,252"
    ];

    function rnd(a, b) { return a + Math.random() * (b - a); }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function smoothstep(a, b, v) {
      var x = clamp01((v - a) / (b - a));
      return x * x * (3 - 2 * x);
    }

    function makeHaloSprite() {
      var c = document.createElement("canvas");
      c.width = c.height = 48;
      var g = c.getContext("2d");
      var rg = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      rg.addColorStop(0, "rgba(250,250,252,0.72)");
      rg.addColorStop(0.22, "rgba(185,192,204,0.22)");
      rg.addColorStop(1, "rgba(185,192,204,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 48, 48);
      return c;
    }

    function hash(ix, iy) {
      var n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    }
    function valueNoise(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y);
      var fx = x - ix, fy = y - iy;
      var ux = fx * fx * (3 - 2 * fx);
      var uy = fy * fy * (3 - 2 * fy);
      var a = hash(ix, iy), b = hash(ix + 1, iy);
      var c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }
    function fbm(x, y, octaves) {
      var v = 0, amp = 0.52, freq = 1;
      for (var i = 0; i < octaves; i++) {
        v += valueNoise(x * freq, y * freq) * amp;
        var nx = (x * 0.82 - y * 0.57) * 2.03 + 11.7;
        var ny = (x * 0.57 + y * 0.82) * 2.03 + 5.1;
        x = nx; y = ny;
        amp *= 0.48;
      }
      return v;
    }

    function buildNebulaSource() {
      var aspect = Math.max(0.55, Math.min(2.4, W / Math.max(1, H)));
      var nw = MOBILE ? 300 : 420;
      var nh = Math.max(170, Math.round(nw / aspect));
      var c = document.createElement("canvas");
      c.width = nw; c.height = nh;
      var g = c.getContext("2d");
      var img = g.createImageData(nw, nh);
      var data = img.data;
      for (var y = 0; y < nh; y++) {
        for (var x = 0; x < nw; x++) {
          var u = x / nw, v = y / nh;
          var ex = (u - 0.5) * 2.25;
          var ey = (v - 0.5) * 2.0;
          var d = Math.sqrt(ex * ex + ey * ey);
          var ring = smoothstep(0.20, 0.58, d) * (1 - smoothstep(1.02, 1.55, d));
          var wx = fbm(u * 2.2 + 8.4, v * 2.2 + 2.8, 3) - 0.5;
          var wy = fbm(u * 2.2 + 1.7, v * 2.2 + 7.6, 3) - 0.5;
          var cloud = fbm(u * 2.7 + wx * 0.55, v * 2.7 + wy * 0.55, 5);
          var structure = fbm(u * 5.2 - wy * 0.28, v * 5.2 + wx * 0.28, 4);
          var n = smoothstep(0.43, 0.82, cloud) * (0.55 + 0.45 * structure) * ring;
          n = Math.pow(n, 1.18);
          var silver = smoothstep(0.48, 0.88, structure);
          var blue = 1 - silver;
          var violet = smoothstep(0.55, 0.92, cloud) * 0.22;
          var rr = (42 * blue + 205 * silver) * (1 - violet) + 55 * violet;
          var gg = (55 * blue + 209 * silver) * (1 - violet) + 52 * violet;
          var bb = (86 * blue + 221 * silver) * (1 - violet) + 82 * violet;
          var i = (y * nw + x) * 4;
          data[i] = rr;
          data[i + 1] = gg;
          data[i + 2] = bb;
          data[i + 3] = Math.round(Math.min(1, n * 0.92) * 255);
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    }

    function updateSafeZone() {
      if (!content || !W || !H) return;
      var c = canvas.getBoundingClientRect();
      var r = content.getBoundingClientRect();
      safe.cx = r.left + r.width / 2 - c.left;
      safe.cy = r.top + r.height / 2 - c.top;
      safe.rx = r.width / 2 + Math.min(160, Math.max(84, W * 0.09));
      safe.ry = r.height / 2 + Math.min(150, Math.max(76, H * 0.12));
    }

    function inSafe(x, y, scale) {
      var dx = (x - safe.cx) / (safe.rx * scale);
      var dy = (y - safe.cy) / (safe.ry * scale);
      return dx * dx + dy * dy < 1;
    }

    function randomStar(layer, bright) {
      var x = Math.random() * W;
      var y = Math.random() * H;
      if (bright || layer === "mid") {
        var guard = 32;
        while (inSafe(x, y, bright ? 1.04 : 0.98) && guard--) {
          x = Math.random() * W;
          y = Math.random() * H;
        }
      }
      return { x: x, y: y, bx: x, by: y, vx: 0, vy: 0, color: starPalette[Math.floor(Math.random() * starPalette.length)] };
    }

    function buildStars() {
      stars.back = []; stars.dust = []; stars.mid = []; stars.bright = [];
      var area = W * H;
      var total = MOBILE
        ? Math.min(760, Math.max(620, Math.round(area / 650)))
        : Math.min(1500, Math.max(1100, Math.round(area / 900)));
      var backN = Math.round(total * 0.25);
      var dustN = Math.round(total * 0.30);
      var midN = Math.round(total * 0.40);
      var brightN = total - backN - dustN - midN;
      var i, s;
      for (i = 0; i < backN; i++) {
        s = randomStar("back", false);
        s.r = rnd(0.34, 0.72); s.a = rnd(0.28, 0.58); s.tw = rnd(0.18, 0.62); s.ph = rnd(0, 6.28); s.depth = 0.10;
        stars.back.push(s);
      }
      for (i = 0; i < dustN; i++) {
        s = randomStar("dust", false);
        s.r = rnd(0.48, 0.94); s.a = rnd(0.40, 0.72); s.tw = rnd(0.24, 0.82); s.ph = rnd(0, 6.28); s.depth = 0.38;
        stars.dust.push(s);
      }
      for (i = 0; i < midN; i++) {
        s = randomStar("mid", false);
        s.r = rnd(0.62, 1.24); s.a = rnd(0.58, 0.94); s.tw = rnd(0.3, 1.05); s.ph = rnd(0, 6.28); s.depth = 0.68;
        stars.mid.push(s);
      }
      for (i = 0; i < brightN; i++) {
        s = randomStar("bright", true);
        s.r = rnd(0.9, 1.7); s.a = rnd(0.76, 1); s.tw = rnd(0.35, 0.9); s.ph = rnd(0, 6.28); s.halo = rnd(8, 17); s.depth = 1;
        stars.bright.push(s);
      }
      filaments = [];
      var nf = MOBILE ? 2 : 4;
      for (i = 0; i < nf; i++) {
        var filamentDirection = Math.random() < 0.5 ? rnd(-0.78, -0.34) : rnd(0.34, 0.78);
        filaments.push({
          x: rnd(-0.12, 0.9), y: rnd(0.08, 0.88),
          len: rnd(0.12, 0.24), ang: filamentDirection,
          a: rnd(0.018, 0.045), ph: rnd(0, 6.28), sp: rnd(0.006, 0.014)
        });
      }
    }

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      influenceRadius = Math.min(310, Math.max(185, W * 0.17));
      cursor.x = cursor.tx = cursor.lastX = W * 0.5;
      cursor.y = cursor.ty = cursor.lastY = H * 0.5;
      renderDpr = Math.min(DPR, MOBILE ? 1.15 : 1.5);
      canvas.width = Math.max(1, Math.round(W * renderDpr));
      canvas.height = Math.max(1, Math.round(H * renderDpr));
      ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      updateSafeZone();
      nebulaSource = buildNebulaSource();
      nebulaLayer.width = Math.max(1, Math.round(W * 0.55));
      nebulaLayer.height = Math.max(1, Math.round(H * 0.55));
      nebulaCtx.setTransform(1, 0, 0, 1, 0, 0);
      vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.78);
      vignette.addColorStop(0, "rgba(3,3,5,0)");
      vignette.addColorStop(1, "rgba(3,3,5,0.54)");
      buildStars();
      if (REDUCED) draw(0, 1);
    }

    function drawNebula(t, camScale) {
      var lw = nebulaLayer.width, lh = nebulaLayer.height;
      var sx = lw / Math.max(1, W), sy = lh / Math.max(1, H);
      nebulaCtx.clearRect(0, 0, lw, lh);
      nebulaCtx.globalCompositeOperation = "source-over";
      nebulaCtx.imageSmoothingEnabled = true;
      nebulaCtx.imageSmoothingQuality = "high";

      var driftX = REDUCED ? 0 : Math.sin(t * 0.035) * 6 + offset.x * -7 + cursor.vx * -0.16;
      var driftY = REDUCED ? 0 : Math.cos(t * 0.028) * 5 + offset.y * -5 + cursor.vy * -0.16;
      var breathe = REDUCED ? 1 : 1 + Math.sin(t * 0.055) * 0.014;

      nebulaCtx.save();
      nebulaCtx.translate(lw / 2 + driftX * sx, lh / 2 + driftY * sy);
      nebulaCtx.rotate(REDUCED ? 0 : Math.sin(t * 0.018) * 0.018);
      nebulaCtx.scale(breathe * camScale, breathe * camScale);
      nebulaCtx.drawImage(nebulaSource, -lw * 0.62, -lh * 0.62, lw * 1.24, lh * 1.24);
      nebulaCtx.restore();

      nebulaCtx.save();
      nebulaCtx.globalAlpha = 0.34;
      nebulaCtx.translate(lw / 2 - driftX * sx * 0.42, lh / 2 - driftY * sy * 0.42);
      nebulaCtx.rotate(REDUCED ? 0 : -Math.sin(t * 0.014) * 0.012);
      nebulaCtx.scale((1.04 - (breathe - 1)) * camScale, (1.04 - (breathe - 1)) * camScale);
      nebulaCtx.drawImage(nebulaSource, -lw * 0.62, -lh * 0.62, lw * 1.24, lh * 1.24);
      nebulaCtx.restore();

      nebulaCtx.globalCompositeOperation = "destination-out";
      nebulaCtx.save();
      nebulaCtx.translate(safe.cx * sx, safe.cy * sy);
      nebulaCtx.scale(safe.rx * sx, safe.ry * sy);
      var mask = nebulaCtx.createRadialGradient(0, 0, 0.66, 0, 0, 1.18);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(0.72, "rgba(0,0,0,0.96)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      nebulaCtx.fillStyle = mask;
      nebulaCtx.beginPath();
      nebulaCtx.arc(0, 0, 1.2, 0, 6.28318);
      nebulaCtx.fill();
      nebulaCtx.restore();
      nebulaCtx.globalCompositeOperation = "source-over";

      ctx.drawImage(nebulaLayer, 0, 0, W, H);
    }

    function updateLayer(layer, step) {
      if (REDUCED) return;
      for (var i = 0; i < layer.length; i++) {
        var s = layer[i];
        var dx = s.x - cursor.x;
        var dy = s.y - cursor.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (cursor.active && dist < influenceRadius) {
          var falloff = 1 - dist / influenceRadius;
          var field = falloff * falloff * s.depth;
          var speed = Math.min(30, Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy));
          s.vx += (cursor.vx * 0.020 + (-dy / dist) * speed * 0.006) * field * step;
          s.vy += (cursor.vy * 0.020 + ( dx / dist) * speed * 0.006) * field * step;
        }
        s.vx += (s.bx - s.x) * (0.0022 + s.depth * 0.0016) * step;
        s.vy += (s.by - s.y) * (0.0022 + s.depth * 0.0016) * step;
        var settle = Math.pow(0.925 - s.depth * 0.012, step);
        s.vx *= settle;
        s.vy *= settle;
        s.x += s.vx * step;
        s.y += s.vy * step;
      }
    }

    function drawLayer(layer, ox, oy, t, introMul, safeDim, stretch) {
      for (var i = 0; i < layer.length; i++) {
        var s = layer[i];
        var tw = REDUCED ? 1 : 0.76 + 0.24 * Math.sin(t * s.tw + s.ph);
        var a = s.a * tw * introMul;
        if (safeDim && inSafe(s.x, s.y, 0.96)) a *= 0.35;
        if (a < 0.012) continue;
        ctx.fillStyle = "rgba(" + s.color + "," + a.toFixed(3) + ")";
        var px = s.x + ox, py = s.y + oy;
        var motion = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        if (stretch && motion > 0.16) {
          ctx.strokeStyle = "rgba(" + s.color + "," + (a * 0.46).toFixed(3) + ")";
          ctx.lineWidth = Math.max(0.55, s.r * 0.7);
          ctx.beginPath(); ctx.moveTo(px - s.vx * 2.8, py - s.vy * 2.8); ctx.lineTo(px, py); ctx.stroke();
        }
        if (s.r < 0.78) ctx.fillRect(px, py, s.r, s.r);
        else { ctx.beginPath(); ctx.arc(px, py, s.r, 0, 6.28318); ctx.fill(); }
      }
    }

    function drawBright(layer, ox, oy, t, introMul) {
      for (var i = 0; i < layer.length; i++) {
        var s = layer[i];
        var tw = REDUCED ? 1 : 0.72 + 0.28 * Math.sin(t * s.tw + s.ph);
        var a = s.a * tw * introMul;
        if (inSafe(s.x, s.y, 1.02)) a *= 0.06;
        if (a < 0.015) continue;
        var h = s.halo * (0.82 + 0.18 * tw);
        ctx.globalAlpha = a * 0.36;
        ctx.drawImage(haloSprite, s.x + ox - h, s.y + oy - h, h * 2, h * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(" + s.color + "," + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, 6.28318);
        ctx.fill();
      }
    }

    function drawFilaments(t, fade) {
      if (REDUCED) return;
      ctx.lineWidth = 0.65;
      for (var i = 0; i < filaments.length; i++) {
        var f = filaments[i];
        var x = f.x + t * f.sp * 0.004;
        if (x - f.len > 1.15) x -= 1.55;
        var x1 = x * W + offset.x * -3;
        var y1 = f.y * H + offset.y * -2;
        var x2 = x1 + Math.cos(f.ang) * f.len * W;
        var y2 = y1 + Math.sin(f.ang) * f.len * W;
        if (inSafe((x1 + x2) / 2, (y1 + y2) / 2, 1.05)) continue;
        var pulse = 0.65 + 0.35 * Math.sin(t * 0.18 + f.ph);
        var g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "rgba(185,192,204,0)");
        g.addColorStop(0.48, "rgba(185,192,204," + (f.a * pulse * fade).toFixed(3) + ")");
        g.addColorStop(1, "rgba(185,192,204,0)");
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 12, x2, y2);
        ctx.stroke();
      }
    }

    function draw(t, fade) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030305";
      ctx.fillRect(0, 0, W, H);

      var breathe = REDUCED ? 1 : 1 + Math.sin(t * 0.075) * 0.012;
      drawNebula(t, breathe);

      var ox = offset.x, oy = offset.y;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(breathe, breathe);
      ctx.translate(-W / 2, -H / 2);
      drawLayer(stars.back, ox * -0.7, oy * -0.5, t, intro * fade, true, false);
      drawLayer(stars.dust, ox * -1.8, oy * -1.4, t * 1.08, intro * fade, true, false);
      drawLayer(stars.mid, ox * -2.6, oy * -2.0, t * 0.82, intro * fade, true, true);
      drawBright(stars.bright, ox * -11, oy * -9, t * 0.66, intro * fade);
      drawFilaments(t, intro * fade);
      ctx.restore();

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }

    function frame(now) {
      if (!running) return;
      rafId = requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = Math.min(50, now - last);
      last = now;
      var t = (now - t0) / 1000;

      if (!REDUCED) {
        intro += (1 - intro) * Math.min(1, dt * 0.0011);
        if (intro > 0.995) intro = 1;
      }

      if (!MOBILE && !REDUCED) {
        smooth.x += (target.x - smooth.x) * 0.024;
        smooth.y += (target.y - smooth.y) * 0.024;
        var dx = (smooth.x - 0.5) - offset.x;
        var dy = (smooth.y - 0.5) - offset.y;
        velocity.x += dx * dt * 0.0012;
        velocity.y += dy * dt * 0.0012;
        var damping = Math.exp(-dt * 0.016);
        velocity.x *= damping;
        velocity.y *= damping;
        offset.x += velocity.x * dt * 0.012;
        offset.y += velocity.y * dt * 0.012;
        cursor.x += (cursor.tx - cursor.x) * Math.min(1, dt * 0.012);
        cursor.y += (cursor.ty - cursor.y) * Math.min(1, dt * 0.012);
        cursor.vx *= Math.exp(-dt * 0.0048);
        cursor.vy *= Math.exp(-dt * 0.0048);
        if (now - cursor.lastAt > 1500 && Math.abs(cursor.vx) + Math.abs(cursor.vy) < 0.08) cursor.active = false;
        var step = Math.min(2.4, dt / 16.667);
        updateLayer(stars.back, step);
        updateLayer(stars.dust, step);
        updateLayer(stars.mid, step);
        updateLayer(stars.bright, step);
      }

      var fade = 1;
      if (!REDUCED) {
        var sp = clamp01(window.scrollY / Math.max(1, H * 1.05));
        fade = 1 - sp * sp * (3 - 2 * sp) * 0.92;
      }
      draw(t, fade);
    }

    function startSky() {
      if (REDUCED || running || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    function stopSky() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (!MOBILE && !REDUCED) {
      window.addEventListener("mousemove", function (e) {
        target.x = e.clientX / Math.max(1, window.innerWidth);
        target.y = e.clientY / Math.max(1, window.innerHeight);
        var r = canvas.getBoundingClientRect();
        var nx = e.clientX - r.left, ny = e.clientY - r.top;
        var now = performance.now();
        if (cursor.lastAt) {
          var eventStep = Math.max(8, Math.min(40, now - cursor.lastAt));
          cursor.vx = cursor.vx * 0.45 + (nx - cursor.lastX) * (16.667 / eventStep) * 0.55;
          cursor.vy = cursor.vy * 0.45 + (ny - cursor.lastY) * (16.667 / eventStep) * 0.55;
          var cursorSpeed = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);
          if (cursorSpeed > 34) { cursor.vx *= 34 / cursorSpeed; cursor.vy *= 34 / cursorSpeed; }
        }
        cursor.tx = nx; cursor.ty = ny; cursor.lastX = nx; cursor.lastY = ny; cursor.lastAt = now; cursor.active = true;
      }, { passive: true });
      window.addEventListener("mouseleave", function () {
        target.x = 0.5;
        target.y = 0.5;
        cursor.tx = W * 0.5; cursor.ty = H * 0.5; cursor.active = false;
      }, { passive: true });
    }

    var visIO = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) startSky(); else stopSky();
    }, { threshold: 0 });
    visIO.observe(canvas);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopSky(); else if (visible) startSky();
    });
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", function () {
      window.requestAnimationFrame(updateSafeZone);
    }, { passive: true });

    resize();
    startSky();
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
      var p = progress();

      var shouldOn = p > 0.12;
      if (shouldOn !== copyOn) { copyOn = shouldOn; if (copy) copy.classList.toggle("on", copyOn); }

      ctx.clearRect(0, 0, W, H);
      var density = Math.pow(1 - p, 0.82);
      var slow = 0.28 + (1 - p) * 0.72;
      frags.forEach(function (f, i) {
        if (i / frags.length > density * 1.15) return;
        var drift = REDUCED ? 0 : t * 0.00002 * f.sp * slow;
        var cx = ((f.x + drift) % 1.2 - 0.1) * W;
        var cy = f.y * H + Math.sin(t * 0.0003 * f.sp + f.ph) * 10 * slow;
        var spread = 1 + p * 2.2;
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

  /* ---------------- Somewhere cinematic scroll chapter ---------------- */
  var sw = document.querySelector(".somewhere");
  if (sw) initSomewhere(sw);

  function initSomewhere(section) {
    var intro = section.querySelector(".sw-intro");
    var space = section.querySelector(".sw-space");
    var dust = section.querySelector(".sw-dust");
    var visualA = section.querySelector(".sw-visual-a");
    var visualB = section.querySelector(".sw-visual-b");
    var visualC = section.querySelector(".sw-visual-c");
    var visualD = section.querySelector(".sw-visual-d");
    var finalCopy = section.querySelector(".sw-final");
    var lightTraces = section.querySelectorAll(".sw-light-trace");
    if (!intro || !visualA || !visualB || !visualC || !visualD || !finalCopy) return;

    var visible = false;
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(section);

    function seg(p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); }
    function ease(x) { return x * x * (3 - 2 * x); }
    function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

    var pointer = { x: 0.5, y: 0.5 };
    var soft = { x: 0, y: 0 };
    var drift = { x: 0, y: 0 };
    var vel = { x: 0, y: 0 };
    if (!MOBILE && !REDUCED) {
      section.addEventListener("mousemove", function (e) {
        var r = section.getBoundingClientRect();
        pointer.x = (e.clientX - r.left) / Math.max(1, r.width);
        pointer.y = (e.clientY - r.top) / Math.max(1, window.innerHeight);
      }, { passive: true });
      section.addEventListener("mouseleave", function () {
        pointer.x = 0.5;
        pointer.y = 0.5;
      }, { passive: true });
    }

    function setVisual(el, x, y, scale, opacity, blur, rotate) {
      el.style.opacity = opacity.toFixed(3);
      el.style.transform = "translate(-50%, -50%) translate(" + x.toFixed(2) + "vw, " + y.toFixed(2) + "vh) rotate(" + rotate.toFixed(3) + "deg) scale(" + scale.toFixed(4) + ")";
      el.style.filter = blur > 0.02 ? "blur(" + blur.toFixed(2) + "px) saturate(0.72) brightness(0.80)" : "saturate(0.72) brightness(0.80)";
      el.style.visibility = opacity <= 0.002 ? "hidden" : "visible";
    }

    function update() {
      var r = section.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));

      if (!MOBILE && !REDUCED) {
        soft.x += ((pointer.x - 0.5) - soft.x) * 0.022;
        soft.y += ((pointer.y - 0.5) - soft.y) * 0.022;
        vel.x += (soft.x - drift.x) * 0.018;
        vel.y += (soft.y - drift.y) * 0.018;
        vel.x *= 0.90;
        vel.y *= 0.90;
        drift.x += vel.x;
        drift.y += vel.y;
      }
      var px = drift.x * 6;
      var py = drift.y * 4;

      var introOut = ease(seg(p, 0.10, 0.20));
      intro.style.opacity = (1 - introOut).toFixed(3);
      intro.style.transform = "translateY(" + (-34 * introOut).toFixed(2) + "px) scale(" + (1 - introOut * 0.02).toFixed(4) + ")";
      intro.style.filter = "blur(" + (introOut * 5).toFixed(2) + "px)";
      intro.style.visibility = introOut >= 0.995 ? "hidden" : "visible";

      var atmosphereIn = ease(seg(p, 0.08, 0.24));
      var atmosphereOut = ease(seg(p, 0.91, 1.0));
      space.style.opacity = (0.45 + atmosphereIn * 0.55 - atmosphereOut * 0.42).toFixed(3);
      dust.style.opacity = ((0.35 + atmosphereIn * 0.65) * (1 - atmosphereOut)).toFixed(3);
      dust.style.transform = "translate(" + (-px * 0.65).toFixed(2) + "px," + (-py * 0.65).toFixed(2) + "px)";

      /* Shot 1 — Arrival: a wide horizon enters from the left. */
      var aIn = easeOut(seg(p, 0.14, 0.27));
      var aOut = ease(seg(p, MOBILE ? 0.34 : 0.38, MOBILE ? 0.43 : 0.49));
      var aOpacity = aIn * (1 - aOut);
      var aX = -78 + aIn * 66 - aOut * 18 + px * 0.55;
      var aY = 5 - aOut * 3 + py * 0.35;
      setVisual(visualA, aX, aY, 1 + aIn * 0.03, aOpacity, (1 - aIn) * 2.2 + aOut * 2.6, -0.35);

      /* Shot 2 — Crossing: moonlit atmosphere travels in opposition. */
      var bIn = easeOut(seg(p, 0.29, 0.42));
      var bSettle = ease(seg(p, 0.40, 0.49));
      var bOut = ease(seg(p, MOBILE ? 0.50 : 0.54, MOBILE ? 0.58 : 0.64));
      var bOpacity = bIn * (1 - bOut);
      var bX = 74 - bIn * 63 - bSettle * 8 + px * 0.28;
      var bY = -4 + bSettle * 3 + py * 0.22;
      var bScale = 0.92 + bIn * 0.11 + bSettle * 0.08;
      setVisual(visualB, bX, bY, bScale, bOpacity, (1 - bIn) * 2 + (1 - bSettle) * 0.4, 0.28);

      /* Shot 3 — Place / Sound: the silver trace appears inside a deeper field. */
      var cIn = easeOut(seg(p, 0.46, 0.58));
      var cGrow = ease(seg(p, 0.54, 0.65));
      var cOut = ease(seg(p, MOBILE ? 0.65 : 0.68, MOBILE ? 0.73 : 0.77));
      var cOpacity = cIn * (1 - cOut);
      var cX = -62 + cIn * 55 - cOut * 14 + px * 0.16;
      var cY = 8 - cIn * 4 + py * 0.12;
      setVisual(visualC, cX, cY, 0.78 + cIn * 0.16 + cGrow * 0.13, cOpacity, 1.8 - cIn * 1.2 + cOut * 2.2, -0.18);

      /* Shot 4 — Immersion: one visual takes over the viewport, then recedes. */
      var dIn = easeOut(seg(p, 0.68, 0.78));
      var dFill = ease(seg(p, 0.74, 0.86));
      var dOut = ease(seg(p, 0.91, 0.975));
      var dOpacity = dIn * (1 - dOut);
      var dScale = 0.72 + dIn * 0.18 + dFill * (MOBILE ? 0.18 : 0.22) - dOut * 0.08;
      setVisual(visualD, px * 0.08, py * 0.08, dScale, dOpacity, (1 - dIn) * 2.4 + dOut * 2.8, 0.08);

      for (var i = 0; i < lightTraces.length; i++) {
        var traceIn = ease(seg(p, 0.50 + i * 0.18, 0.64 + i * 0.16));
        var shift = (traceIn - 0.5) * (MOBILE ? 24 : 58);
        lightTraces[i].style.transform = "translateX(" + shift.toFixed(2) + "px) rotate(-2deg) skewX(-12deg)";
        lightTraces[i].style.opacity = (0.12 + traceIn * 0.48).toFixed(3);
      }

      var finalIn = ease(seg(p, 0.92, 0.975));
      finalCopy.style.opacity = finalIn.toFixed(3);
      finalCopy.style.transform = "translateY(" + ((1 - finalIn) * 22).toFixed(2) + "px)";
      finalCopy.style.filter = "blur(" + ((1 - finalIn) * 4).toFixed(2) + "px)";
      finalCopy.style.visibility = finalIn <= 0.002 ? "hidden" : "visible";
    }

    if (REDUCED) return;
    var ticking = false;
    function requestUpdate() {
      if (!visible || ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    update();
  }
})();
