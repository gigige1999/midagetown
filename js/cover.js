/* 全屏开场：程序化像素城堡封面 */
window.CoverArt = (function () {
  "use strict";
  var canvas = null, ctx = null, raf = null, last = 0, time = 0;
  var W = 480, H = 270;

  function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function px(x, y, c) { R(x, y, 1, 1, c); }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  }

  function sky() {
    var bands = [
      ["#141a30", 0, 46], ["#1b2340", 46, 34], ["#2a2b4a", 34, 28],
      ["#433552", 28, 24], ["#6a4354", 24, 22], ["#8e5450", 22, 20],
      ["#b96a4e", 20, 18], ["#d98a56", 18, 16], ["#e8a866", 16, 14]
    ];
    var y = 0;
    for (var i = 0; i < bands.length; i++) { R(0, y, W, bands[i][1], bands[i][0]); y += bands[i][1]; }
  }

  function stars() {
    for (var i = 0; i < 60; i++) {
      var x = (i * 73) % W;
      var y = (i * 37) % 110;
      var a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.6 + i));
      ctx.globalAlpha = a;
      px(x, y, i % 5 === 0 ? "#ffe9b0" : "#dfe6ef");
      if (i % 9 === 0) { px(x - 1, y, "#cfd8e4"); px(x + 1, y, "#cfd8e4"); px(x, y - 1, "#cfd8e4"); px(x, y + 1, "#cfd8e4"); }
    }
    ctx.globalAlpha = 1;
  }

  function moon() {
    var cx = 386, cy = 56;
    var g = ctx.createRadialGradient(cx, cy, 12, cx, cy, 46);
    g.addColorStop(0, "rgba(255,233,176,0.20)");
    g.addColorStop(0.5, "rgba(255,220,150,0.08)");
    g.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f7e6bd"; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e6d3a8"; ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#efdcb2"; ctx.beginPath(); ctx.arc(cx + 5, cy + 5, 2, 0, Math.PI * 2); ctx.fill();
  }

  function clouds() {
    for (var i = 0; i < 4; i++) {
      var cx = ((time * (6 + i * 2) + i * 130) % (W + 90)) - 60;
      var cy = 54 + i * 17;
      var s = 0.7 + i * 0.16;
      ctx.globalAlpha = 0.20 + i * 0.03;
      R(cx, cy, 44 * s, 6 * s, "#d8c6c0");
      R(cx + 8 * s, cy - 4 * s, 26 * s, 5 * s, "#e4d2c8");
      R(cx + 16 * s, cy - 7 * s, 16 * s, 4 * s, "#efdccd");
    }
    ctx.globalAlpha = 1;
  }

  function ridge(baseY, color, amp, seed, step) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += (step || 4)) {
      var h = amp * (0.55 + 0.30 * Math.sin(x * 0.021 + seed) + 0.22 * Math.sin(x * 0.047 + seed * 2.3));
      ctx.lineTo(x, baseY - h);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function mountains() {
    ridge(176, "#2b3446", 34, 1.2);
    ridge(192, "#232c3a", 26, 3.4);
    ridge(206, "#1b2430", 16, 5.1);
  }

  function forest() {
    for (var i = 0; i < 30; i++) {
      var x = i * 17 + 3;
      var base = 208 + (i % 3) * 2;
      var h = 12 + (i * 11) % 12;
      R(x, base - h, 2, h, "#152019");
      for (var k = 0; k < 4; k++) {
        var w = Math.max(2, 9 - k * 2);
        R(x + 1 - w / 2, base - h + 2 + k * 3, w, 3, k % 2 ? "#1a2a22" : "#1f3128");
      }
    }
  }

  function flag(x, y, h, color, phase) {
    R(x, y - h, 2, h, "#3a2a1d");
    var wave = Math.sin(time * 3 + phase) * 1.6;
    for (var i = 0; i < 10; i++) {
      R(x + 2 + i, y - h + 2 + Math.sin(time * 3 + phase + i * 0.4) * 1.2, 1, 6, color);
      R(x + 2 + i, y - h + 2 + Math.sin(time * 3 + phase + i * 0.4) * 1.2, 1, 1, "#f0d28a");
    }
    px(x + 2 + wave, y - h, "#f0d28a");
  }

  function litWindow(x, y, w, h, phase) {
    var flick = 0.72 + 0.28 * Math.sin(time * 5 + phase);
    R(x - 1, y - 1, w + 2, h + 2, "#2b2118");
    ctx.globalAlpha = 0.16 * flick;
    ctx.fillStyle = "#ffcf72";
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    R(x, y, w, h, "#3a2a1a");
    R(x + 1, y + 1, w - 2, h - 2, "#ffcf72");
    R(x + 1, y + 1, w - 2, 1, "#ffe9b0");
    R(x + Math.floor(w / 2), y + 1, 1, h - 2, "#8a5a2e");
  }

  function stoneTexture(x, y, w, h, seed) {
    var n = 0;
    for (var yy = y + 3; yy < y + h - 2; yy += 6) {
      R(x, yy, w, 1, "rgba(22,18,16,0.30)");
      var off = (n % 2) * 6;
      for (var xx = x + 3 + off; xx < x + w - 3; xx += 12) {
        if (((xx * 7 + yy * 13 + seed) % 5) === 0) R(xx, yy - 4, 5, 3, "rgba(255,238,206,0.06)");
        if (((xx * 3 + yy * 5 + seed) % 7) === 0) R(xx, yy - 4, 4, 3, "rgba(12,10,9,0.18)");
      }
      n++;
    }
  }

  function merlons(x, y, w, color) {
    for (var i = 0; i * 9 + 6 <= w; i++) {
      R(x + i * 9, y - 6, 6, 7, color);
      R(x + i * 9, y - 6, 6, 1, "rgba(255,240,210,0.10)");
      R(x + i * 9 + 5, y - 6, 1, 7, "rgba(10,8,7,0.35)");
    }
  }

  function archWindow(x, y, w, h, phase, lit) {
    R(x - 1, y - 1, w + 2, h + 2, "#241b15");
    R(x, y + 1, w, h - 1, "#2d241d");
    if (lit) {
      var flick = 0.7 + 0.3 * Math.sin(time * 5 + phase);
      ctx.globalAlpha = 0.10 * flick;
      ctx.fillStyle = "#ffcf72";
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      R(x + 1, y + 2, w - 2, h - 3, "#ffcf72");
      R(x + 1, y + 2, w - 2, 2, "#ffe9b0");
      R(x + Math.floor(w / 2), y + 2, 1, h - 3, "#8a5a2e");
      R(x + 1, y + Math.floor(h / 2) + 1, w - 2, 1, "#8a5a2e");
      px(x + 1, y + 1, "#ffcf72");
      px(x + w - 2, y + 1, "#ffcf72");
    } else {
      R(x + 1, y + 2, w - 2, h - 3, "#1a1512");
      px(x + 1, y + 1, "#2d241d");
      px(x + w - 2, y + 1, "#2d241d");
    }
  }

  function coneRoof(cx, baseY, halfW, height, phase) {
    for (var r = 0; r < height; r++) {
      var w = Math.floor(halfW * (1 - r / height));
      var color = (r % 4 === 0) ? "#7d566a" : (r % 4 === 2 ? "#5f4154" : "#6d4a5e");
      R(cx - w, baseY - r, w * 2, 1, color);
      R(cx - w, baseY - r, 1, 1, "#4a3240");
    }
    R(cx - 1, baseY - height - 6, 2, 7, "#c9a24e");
    R(cx - 2, baseY - height - 6, 4, 2, "#f0d28a");
  }

  function castle() {
    var base = 208;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#0b0a12";
    ctx.beginPath(); ctx.ellipse(240, base + 5, 96, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 外墙与城垛
    R(164, 168, 152, 40, "#4b4a44");
    stoneTexture(164, 168, 152, 40, 3);
    R(164, 168, 152, 3, "#63625a");
    R(164, 205, 152, 3, "#33322d");
    merlons(164, 168, 152, "#3f3e38");

    // 侧塔
    tower(170, 126, 30, 82, 0.4);
    tower(280, 126, 30, 82, 1.7);

    // 主堡
    R(204, 94, 72, 114, "#4e4d47");
    stoneTexture(204, 94, 72, 114, 7);
    R(204, 94, 72, 3, "#65645c");
    R(204, 94, 3, 114, "#3b3a34");
    R(273, 94, 3, 114, "#3b3a34");
    merlons(204, 94, 72, "#41403a");

    // 大门：拱门、闸门、暖光、台阶
    R(222, 160, 36, 46, "#241c16");
    R(225, 164, 30, 42, "#2f241c");
    ctx.beginPath();
    ctx.arc(240, 172, 15, Math.PI, 0);
    ctx.fillStyle = "#2f241c"; ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffb45e";
    ctx.beginPath(); ctx.arc(240, 190, 15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    for (var g = 0; g < 6; g++) R(226 + g * 5, 172, 2, 34, "#4b3322");
    for (var g2 = 0; g2 < 5; g2++) R(225, 176 + g2 * 6, 30, 1, "#4b3322");
    R(222, 158, 36, 3, "#8a623b");
    R(228, 209, 24, 3, "#6b5442");
    R(224, 212, 32, 3, "#5e4a3a");

    // 窗户
    archWindow(212, 108, 8, 11, 0.3, true);
    archWindow(234, 104, 10, 13, 1.1, true);
    archWindow(258, 108, 8, 11, 2.2, true);
    archWindow(212, 136, 8, 10, 2.9, true);
    archWindow(258, 136, 8, 10, 0.8, false);
    archWindow(182, 146, 7, 9, 1.6, true);
    archWindow(299, 146, 7, 9, 2.4, true);
    archWindow(191, 176, 7, 9, 0.5, false);
    archWindow(290, 176, 7, 9, 1.9, false);

    // 中央塔楼
    R(226, 60, 28, 36, "#53524c");
    stoneTexture(226, 60, 28, 36, 11);
    R(226, 60, 28, 3, "#6a6961");
    merlons(226, 60, 28, "#45443e");
    coneRoof(240, 58, 19, 16, 0);
    flag(239, 36, 20, "#a54a3c", 0);

    // 塔顶旗
    flag(171, 122, 20, "#46647f", 1.2);
    flag(303, 122, 20, "#8e3731", 2.6);

    // 主堡旗帜与藤蔓
    R(232, 118, 18, 30, "#7d2f2b");
    R(234, 120, 14, 26, "#9c3a34");
    R(238, 124, 6, 10, "#f0d28a");
    R(236, 136, 10, 2, "#f0d28a");
    R(239, 120, 2, 26, "rgba(240,210,138,0.55)");
    for (var v = 0; v < 16; v++) {
      var vx = 206 + (v * 7) % 12;
      var vy = 126 + v * 5;
      px(vx, vy, "#4f6e3d");
      if (v % 2 === 0) px(vx + 1, vy + 1, "#5f7f47");
    }

    // 城垛火把
    [178, 300].forEach(function (x, i) {
      R(x, 160, 2, 10, "#3a2a1d");
      R(x - 1, 156, 4, 5, "#f2c56d");
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(time * 6 + i);
      ctx.fillStyle = "#ffcf72";
      ctx.beginPath(); ctx.arc(x + 1, 158, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function tower(x, y, w, h, phase) {
    R(x, y, w, h, "#4b4a44");
    stoneTexture(x, y, w, h, 5 + phase);
    R(x, y, w, 3, "#605f57");
    R(x, y, 3, h, "#3b3a34");
    R(x + w - 3, y, 3, h, "#3b3a34");
    merlons(x, y, w, "#3f3e38");
    coneRoof(x + w / 2, y, w / 2 + 5, 13, phase);
    archWindow(x + w / 2 - 3, y + 22, 7, 9, phase, true);
    archWindow(x + w / 2 - 3, y + 48, 7, 9, phase + 1.4, false);
  }

  function foreground() {
    R(0, 206, W, 64, "#243b2c");
    R(0, 214, W, 56, "#1d3326");
    // 路面
    for (var i = 0; i < 10; i++) {
      var w = 26 + i * 9;
      R(240 - w / 2, 208 + i * 6, w, 6, i % 2 ? "#6b5442" : "#5e4a3a");
    }
    // 草与灯
    for (var g = 0; g < 40; g++) {
      var gx = (g * 53) % W;
      var gy = 214 + (g * 17) % 52;
      if (Math.abs(gx - 240) < 34 && gy > 210) continue;
      R(gx, gy, 1, 3, "#38583f");
    }
    [214, 266].forEach(function (x, idx) {
      R(x, 216, 2, 16, "#3a2a1d");
      R(x - 2, 212, 6, 5, "#f2c56d");
      ctx.globalAlpha = 0.18 + 0.05 * Math.sin(time * 4 + idx);
      ctx.fillStyle = "#ffcf72";
      ctx.beginPath(); ctx.arc(x + 1, 214, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function fireflies() {
    for (var i = 0; i < 14; i++) {
      var x = 90 + ((i * 61 + time * (4 + i % 3)) % 300);
      var y = 190 + Math.sin(time * 0.8 + i) * 14 + (i % 4) * 6;
      ctx.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2 + i));
      px(x, y, "#f0e2a0");
      if (i % 3 === 0) { px(x - 1, y, "#d8c987"); px(x + 1, y, "#d8c987"); }
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!ctx || !canvas) return;
    var s = Math.max(canvas.width / W, canvas.height / H);
    var ox = (canvas.width - W * s) / 2;
    var oy = (canvas.height - H * s) / 2;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    sky(); stars(); moon(); clouds(); mountains(); forest();
    ctx.save();
    ctx.translate(240, 196);
    ctx.scale(0.9, 0.9);
    ctx.translate(-240, -208);
    castle();
    ctx.restore();
    foreground(); fireflies();
  }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    time += dt;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function init(c) {
    canvas = c;
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  return { init: init, stop: stop, draw: draw };
})();
