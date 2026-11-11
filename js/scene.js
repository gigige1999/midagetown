/* =========================================================
   城堡物语 · 像素场景
   720 × 405 逻辑像素，Canvas 2× 渲染
   ========================================================= */
window.CastleScene = (function () {
  "use strict";

  const D = window.GameData;
  const W = 720;
  const H = 405;

  const INK = "#2a2119";
  const INK_DEEP = "#17110c";
  const STONE = "#767a6d";
  const STONE_LIGHT = "#969a8b";
  const STONE_DARK = "#5b6055";
  const STONE_DEEP = "#454a42";
  const WOOD = "#795436";
  const WOOD_LIGHT = "#a4774a";
  const WOOD_DARK = "#4d3321";
  const ROOF = "#4b5557";
  const ROOF_DARK = "#343d40";
  const ROOF_LIGHT = "#637073";
  const RED = "#a3493b";
  const RED_LIGHT = "#c96a51";
  const GOLD = "#d9ab4a";
  const GOLD_LIGHT = "#f4d988";
  const CREAM = "#f1e2b8";
  const LEAF = "#5b7a4a";
  const LEAF_DARK = "#3b5636";
  const LEAF_LIGHT = "#84a05d";

  const BUILDING_BY_ID = {};
  D.BUILDINGS.forEach(function (b) { BUILDING_BY_ID[b.id] = b; });
  const WORKER_BY_ID = {};
  D.WORKERS.forEach(function (w) { WORKER_BY_ID[w.id] = w; });

  const HOME_POSITIONS = {
    lumber: [154, 305],
    farm: [205, 382],
    tavern: [262, 306],
    library: [578, 282],
    watchtower: [546, 292],
    quarry: [546, 334],
    market: [463, 388]
  };

  let canvas = null;
  let ctx = null;
  let frame = null;
  let tooltip = null;
  let stateRef = null;
  let time = 0;
  let bgLayer = null;
  const castleLayers = {};
  let hitAreas = [];
  let hover = null;
  let mouseX = 0;
  let mouseY = 0;
  let mouseIn = false;
  let handlers = {};
  let particles = [];
  let bellPulseT = 999;
  let starField = [];
  let leafField = [];
  let clouds = [];
  let rainDrops = [];
  let fireflyField = [];
  let flowerField = [];
  let tuftField = [];
  let cobbleField = [];

  /* ---------------------------------------------------------
     基础工具
     --------------------------------------------------------- */
  function R(c, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function makeLayer(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    return { canvas: cv, c: c };
  }

  function ellipse(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      c.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1);
    }
  }

  function circle(c, cx, cy, r, color) {
    c.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      c.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1);
    }
  }

  function outlineCircle(c, cx, cy, r, color, thickness) {
    const t = thickness || 1;
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      const inner = Math.max(0, r - t);
      const spanIn = Math.floor(Math.sqrt(Math.max(0, inner * inner - y * y)));
      if (span > spanIn && y >= -r + 1 && y <= r - 1) {
        if (spanIn > 0) {
          c.fillStyle = color;
          c.fillRect(Math.round(cx - span), Math.round(cy + y), 1, 1);
          c.fillRect(Math.round(cx + span), Math.round(cy + y), 1, 1);
        } else {
          c.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1);
        }
      }
    }
  }

  function shadow(c, cx, cy, rx, ry, alpha) {
    ellipse(c, cx, cy, rx, ry, "rgba(29,21,14," + (alpha == null ? 0.22 : alpha) + ")");
  }

  function dither(c, x, y, w, h, a, b, step) {
    const s = step || 2;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        c.fillStyle = ((xx + yy) % s === 0) ? a : b;
        c.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }

  function ditherBlocks(c, x, y, w, h, a, b, block) {
    const bs = block || 2;
    for (let yy = 0; yy < h; yy += bs) {
      for (let xx = 0; xx < w; xx += bs) {
        c.fillStyle = (((xx / bs) + (yy / bs)) % 2 === 0) ? a : b;
        c.fillRect(x + xx, y + yy, bs, bs);
      }
    }
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    function h(v) { const s = Math.round(clamp(v, 0, 255)).toString(16); return s.length < 2 ? "0" + s : s; }
    return "#" + h(r) + h(g) + h(b);
  }
  function mixColor(a, b, t) {
    const ca = hexToRgb(a); const cb = hexToRgb(b);
    return rgbToHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
  }

  function hourOf(state) {
    if (!state) return 10;
    return (6 + (state.dayProgress || 0) * 24) % 24;
  }

  function nightAmount(hour) {
    if (hour >= 20.5 || hour < 4.75) return 1;
    if (hour >= 18.3) return clamp((hour - 18.3) / 2.2, 0, 1);
    if (hour < 6.4) return clamp((6.4 - hour) / 1.65, 0, 1);
    return 0;
  }

  /* ---------------------------------------------------------
     天空
     --------------------------------------------------------- */
  const SKY_KEYS = [
    { h: 0, c: ["#0a1226", "#101d35", "#182741", "#23344b"] },
    { h: 4.2, c: ["#101a2e", "#1b2a41", "#354256", "#5c4f51"] },
    { h: 5.8, c: ["#313a56", "#776474", "#c3846c", "#ebb37c"] },
    { h: 7.4, c: ["#6ca8bb", "#97c6c5", "#c5dfcd", "#e9efd5"] },
    { h: 12, c: ["#5ea6c0", "#8cc5cd", "#bfdfd2", "#e9efd5"] },
    { h: 16.2, c: ["#6fa9bd", "#9cc8ca", "#cdddca", "#efe1c4"] },
    { h: 18.1, c: ["#555f7b", "#9b7278", "#d48769", "#f0b573"] },
    { h: 19.8, c: ["#232e4c", "#454862", "#735967", "#9d6c63"] },
    { h: 21.5, c: ["#0c1730", "#13233d", "#20314b", "#2f4058"] },
    { h: 24, c: ["#0a1226", "#101d35", "#182741", "#23344b"] }
  ];

  function skyColors(hour) {
    let a = SKY_KEYS[0];
    let b = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (hour >= SKY_KEYS[i].h && hour <= SKY_KEYS[i + 1].h) {
        a = SKY_KEYS[i]; b = SKY_KEYS[i + 1];
        break;
      }
    }
    const t = (hour - a.h) / Math.max(0.001, b.h - a.h);
    return a.c.map(function (col, i) { return mixColor(col, b.c[i], t); });
  }

  function drawSky(hour) {
    const colors = skyColors(hour);
    const bands = [
      [0, 92, colors[0]],
      [92, 46, colors[1]],
      [138, 48, colors[2]],
      [186, 48, colors[3]]
    ];
    bands.forEach(function (b) { R(ctx, 0, b[0], W, b[1], b[2]); });

    // 分色带之间用像素点阵过渡，避免硬邦邦的色块
    ditherBlocks(ctx, 0, 85, W, 13, colors[0], colors[1], 2);
    ditherBlocks(ctx, 0, 132, W, 12, colors[1], colors[2], 2);
    ditherBlocks(ctx, 0, 180, W, 11, colors[2], colors[3], 2);
    // 靠近地平线的一层暖光
    ditherBlocks(ctx, 0, 207, W, 26, "rgba(239,210,152,0.16)", "rgba(239,210,152,0)", 2);
    // 极淡的横向云气
    for (let i = 0; i < 4; i++) {
      const yy = 112 + i * 19 + Math.round(Math.sin(hour * 0.7 + i) * 3);
      ctx.globalAlpha = 0.05;
      R(ctx, 40 + i * 43, yy, 240 + (i % 2) * 90, 2, "#fff3d1");
      ctx.globalAlpha = 1;
    }
  }

  function drawStars(night, hour) {
    if (night < 0.12) return;
    for (let i = 0; i < starField.length; i++) {
      const s = starField[i];
      const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * s.tw + s.phase));
      const alpha = night * twinkle * s.a;
      if (s.y > 195) continue;
      ctx.globalAlpha = alpha;
      R(ctx, s.x, s.y, s.s, s.s, s.color);
      if (s.s > 1) {
        ctx.globalAlpha = alpha * 0.45;
        R(ctx, s.x - 1, s.y, 1, 1, "#e9e4ce");
        R(ctx, s.x + s.s, s.y, 1, 1, "#e9e4ce");
        R(ctx, s.x, s.y - 1, 1, 1, "#e9e4ce");
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSunMoon(hour, night) {
    const dayT = (hour - 6) / 12;
    if (dayT > 0 && dayT < 1) {
      const x = 58 + dayT * 604;
      const y = 196 - Math.sin(dayT * Math.PI) * 142;
      ctx.globalAlpha = 0.13;
      circle(ctx, x, y, 28, "#f5d18a");
      ctx.globalAlpha = 0.25;
      circle(ctx, x, y, 21, "#f4cc76");
      ctx.globalAlpha = 1;
      circle(ctx, x, y, 15, "#d2993e");
      circle(ctx, x, y - 1, 13, "#f0c96c");
      circle(ctx, x - 2, y - 2, 10, "#ffe39a");
      R(ctx, x - 7, y - 7, 4, 3, "#fff0ba");
      // 光芒
      const rays = [[-23, -2, 5, 2], [18, -2, 5, 2], [-2, -27, 2, 4], [-2, 22, 2, 4]];
      rays.forEach(function (r) { R(ctx, x + r[0], y + r[1], r[2], r[3], "rgba(255,219,139,0.5)"); });
    }
    if (night > 0.05) {
      const moonT = ((hour + 24 - 18) % 24) / 11.5;
      if (moonT >= 0 && moonT <= 1) {
        const x = 82 + moonT * 560;
        const y = 190 - Math.sin(moonT * Math.PI) * 132;
        ctx.globalAlpha = night * 0.2;
        circle(ctx, x, y, 22, "#dce5dc");
        ctx.globalAlpha = 1;
        circle(ctx, x, y, 13, "#c2c9bb");
        circle(ctx, x, y, 11, "#eef0d9");
        R(ctx, x - 5, y - 4, 3, 3, "#c8cfbd");
        R(ctx, x + 3, y + 1, 3, 2, "#d3d8c6");
        R(ctx, x - 1, y + 5, 2, 2, "#d3d8c6");
        R(ctx, x + 5, y - 6, 2, 2, "#dde2d0");
      }
    }
  }

  const CLOUD_PUFFS = [
    [-18, 2, 12], [0, -4, 17], [20, 0, 15], [38, 3, 10], [9, 8, 16], [-7, 9, 10], [30, 8, 12]
  ];

  function drawCloudShape(c, x, y, scale, base, light, dark) {
    c.globalAlpha = 0.95;
    CLOUD_PUFFS.forEach(function (p, i) {
      const r = Math.round(p[2] * scale);
      const px = Math.round(x + p[0] * scale);
      const py = Math.round(y + p[1] * scale);
      ellipse(c, px, py + 3, r, Math.round(r * 0.5), dark);
      ellipse(c, px, py, r, Math.round(r * 0.55), base);
      ellipse(c, px - 2, py - 2, Math.max(2, r - 3), Math.max(1, Math.round(r * 0.4)), light);
    });
    c.globalAlpha = 1;
  }

  function drawClouds(hour, weather) {
    const night = nightAmount(hour);
    const rainy = weather === "rain";
    const cloudy = weather === "cloudy" || rainy;
    const base = rainy ? "#7d878a" : cloudy ? "#b7c3bf" : "#d8e2d7";
    const light = rainy ? "#9aa4a5" : cloudy ? "#d6ded6" : "#f0f2e4";
    const dark = rainy ? "#626d71" : cloudy ? "#95a29f" : "#b5c8c7";
    const count = rainy ? clouds.length : cloudy ? clouds.length - 1 : clouds.length - 2;
    for (let i = 0; i < count; i++) {
      const cl = clouds[i];
      const drift = (cl.x + time * cl.speed * (rainy ? 1.7 : 1)) % (W + 180);
      const x = drift - 90;
      const y = cl.y;
      ctx.globalAlpha = rainy ? 0.85 : 0.75;
      drawCloudShape(ctx, x, y, cl.scale, base, light, dark);
      ctx.globalAlpha = 1;
    }
    if (night > 0.4) {
      ctx.fillStyle = "rgba(16,25,48,0.12)";
      ctx.fillRect(0, 0, W, 215);
    }
  }

  function drawBirds(hour, weather) {
    if (weather === "rain") return;
    const day = 1 - nightAmount(hour);
    if (day < 0.3) return;
    const alpha = 0.35 * day;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 3; i++) {
      const x = ((time * (8 + i * 2) + i * 230) % (W + 120)) - 60;
      const y = 68 + i * 24 + Math.sin(time * 0.6 + i) * 4;
      const flap = Math.floor(time * 5 + i) % 2;
      R(ctx, x, y, 1, 1, "#4b514a");
      R(ctx, x + 1, y - (flap ? 1 : 0), 2, 1, "#4b514a");
      R(ctx, x + 3, y, 1, 1, "#4b514a");
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------
     静态背景
     --------------------------------------------------------- */
  function drawPine(c, x, baseY, h, dark, light) {
    R(c, x - 1, baseY - 3, 2, 4, "#3b2a1e");
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const half = 1 + Math.floor(t * h * 0.34);
      R(c, x - half, baseY - h + i, half * 2 + 1, 1, dark);
      if ((i + x) % 7 === 0) R(c, x - half + 1, baseY - h + i, Math.max(1, half - 1), 1, light);
    }
  }

  function drawHill(c, baseY, amp, freq, phase, color, highlight, bottom) {
    for (let x = 0; x < W; x++) {
      const y = Math.round(baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 1.7) * amp * 0.32);
      R(c, x, y, 1, bottom - y, color);
      R(c, x, y, 1, 1, highlight);
    }
  }

  function isPath(x, y) {
    if (y < 248) return false;
    const mainHalf = 22 + ((y - 252) / 153) * 74;
    if (y >= 252 && Math.abs(x - (360 + Math.sin(y * 0.03) * 4)) < mainHalf + 4) return true;
    if (y >= 286 && y <= 326 && x > 72 && x < 360) {
      const cy = 304 + Math.sin((x - 72) * 0.02) * 4;
      if (Math.abs(y - cy) < 13) return true;
    }
    if (y >= 296 && y <= 338 && x > 360 && x < 630) {
      const cy = 314 + Math.sin((x - 360) * 0.018) * 4;
      if (Math.abs(y - cy) < 13) return true;
    }
    return false;
  }

  function drawTree(c, x, baseY, height, palette) {
    // 树干
    R(c, x - 5, baseY - height * 0.52, 10, height * 0.52, INK_DEEP);
    R(c, x - 3, baseY - height * 0.52, 6, height * 0.52, "#5c4027");
    R(c, x - 1, baseY - height * 0.52, 2, height * 0.48, "#7c5834");
    R(c, x - 9, baseY - height * 0.33, 5, 3, "#4a3320");
    R(c, x + 5, baseY - height * 0.40, 5, 3, "#4a3320");
    // 树冠冷影
    const clusters = [
      [0, -height * 0.78, 34], [-25, -height * 0.62, 24], [26, -height * 0.64, 26],
      [8, -height * 0.92, 23], [-13, -height * 0.87, 20]
    ];
    clusters.forEach(function (cl) {
      ellipse(c, x + cl[0] - 2, baseY + cl[1] + 4, cl[2], cl[2] * 0.72, palette.dark);
    });
    clusters.forEach(function (cl) {
      ellipse(c, x + cl[0], baseY + cl[1], cl[2] - 2, cl[2] * 0.64, palette.main);
    });
    clusters.forEach(function (cl) {
      ellipse(c, x + cl[0] - 5, baseY + cl[1] - 5, cl[2] * 0.55, cl[2] * 0.35, palette.light);
    });
    // 散落叶片
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4;
      const rr = 18 + (i % 5) * 9;
      const px = x + Math.cos(a) * rr;
      const py = baseY - height * 0.78 + Math.sin(a) * rr * 0.7;
      R(c, px, py, 2, 1, i % 3 === 0 ? palette.highlight : palette.light);
    }
  }

  function drawLowWall(c, x, y, w, seed) {
    const rng = mulberry32(seed || 77);
    // 墙基
    R(c, x, y + 7, w, 5, "#4b523f");
    R(c, x, y + 8, w, 3, "#667250");
    for (let xx = x; xx < x + w - 8; xx += 11) {
      if (rng() < 0.13) continue;
      const hh = 6 + Math.floor(rng() * 4);
      R(c, xx, y + 7 - hh, 10, hh, "#3e4536");
      R(c, xx + 1, y + 8 - hh, 8, hh - 1, rng() < 0.4 ? "#6b7161" : "#5d6454");
      R(c, xx + 1, y + 8 - hh, 6, 1, "#828877");
      if (rng() < 0.35) R(c, xx + 2, y + 8 - hh, 3, 1, "#7e905c");
      if (rng() < 0.25) R(c, xx + 4, y + 9, 2, 2, "#8b916f");
    }
    // 苔藓
    for (let i = 0; i < 18; i++) {
      if (rng() < 0.5) continue;
      R(c, x + rng() * w, y + 8 + rng() * 3, 2, 1, rng() < 0.35 ? "#8a9b60" : "#718451");
    }
  }

  function drawBush(c, x, y, s, tone) {
    const dark = tone === "gold" ? "#5a5435" : "#3c5738";
    const main = tone === "gold" ? "#8a7b42" : "#5d7949";
    const light = tone === "gold" ? "#b39d55" : "#829a5e";
    ellipse(c, x, y, 9 * s, 5 * s, dark);
    ellipse(c, x - 1, y - 2 * s, 7 * s, 4 * s, main);
    ellipse(c, x - 3 * s, y - 4 * s, 4 * s, 2 * s, light);
    R(c, x - 4 * s, y - 5 * s, 2, 1, light);
    R(c, x + 3 * s, y - 1, 2, 1, dark);
  }

  function drawSignpost(c, x, y) {
    R(c, x - 2, y - 26, 4, 27, "#3a2818");
    R(c, x - 1, y - 25, 2, 25, "#7d5838");
    R(c, x - 11, y - 23, 22, 10, "#3a2818");
    R(c, x - 10, y - 22, 20, 8, "#e2cca0");
    R(c, x - 8, y - 19, 16, 1, "#85643f");
    R(c, x - 8, y - 17, 11, 1, "#a38255");
    R(c, x + 6, y - 23, 3, 2, "#5b4328");
    R(c, x - 2, y - 5, 4, 2, "#3a2818");
    // 小皇冠
    R(c, x - 8, y - 20, 5, 1, "#b8872e");
    R(c, x - 8, y - 21, 1, 1, "#d9ab4a");
    R(c, x - 6, y - 21, 1, 1, "#d9ab4a");
    R(c, x - 4, y - 21, 1, 1, "#d9ab4a");
  }

  function createBackground() {
    const layer = makeLayer(W, H);
    const c = layer.c;
    const rng = mulberry32(192837);

    // 远山
    drawHill(c, 174, 12, 0.009, 1.2, "#82907c", "#9aa58e", 252);
    drawHill(c, 190, 14, 0.014, 3.4, "#6d8167", "#84977a", 252);
    drawHill(c, 207, 10, 0.022, 2.1, "#546b4c", "#6f855f", 240);

    // 远林
    for (let i = 0; i < 34; i++) {
      const x = Math.round(i * 22 + (i % 3) * 4 - 4);
      const h = 12 + Math.round(rng() * 18);
      drawPine(c, x, 230 + (i % 2), h, "#3d563e", "#58724e");
    }

    // 草地
    R(c, 0, 228, W, H - 228, "#5c7248");
    for (let y = 228; y < H; y += 8) {
      R(c, 0, y, W, 1, "rgba(92,116,69,0.35)");
    }
    // 地平线草沿
    for (let x = 0; x < W; x += 2) {
      const y = 227 + (x % 7 === 0 ? 1 : 0);
      R(c, x, y, 1, 3, "#7d9159");
      if (x % 6 === 0) R(c, x, y - 1, 1, 2, "#94a56a");
    }

    // 草地色块，让大片草地有一点呼吸
    const patchColors = ["rgba(104,128,76,0.35)", "rgba(83,108,64,0.3)", "rgba(126,143,86,0.22)"];
    for (let i = 0; i < 26; i++) {
      const px = 20 + rng() * (W - 40);
      const py = 250 + rng() * 135;
      ellipse(c, px, py, 18 + rng() * 42, 5 + rng() * 13, patchColors[i % 3]);
    }

    // 城堡后方的旧石墙
    drawLowWall(c, 0, 231, 276, 91);
    drawLowWall(c, 470, 231, 250, 137);

    // 侧边小径（先画，再让主路覆盖）
    for (let x = 70; x < 362; x++) {
      const cy = 304 + Math.sin((x - 70) * 0.02) * 4;
      R(c, x, cy - 11, 1, 22, "#71573c");
      R(c, x, cy - 9, 1, 18, "#9b7b56");
      if (x % 11 === 0) R(c, x, cy - 9, 1, 1, "#b1926b");
    }
    for (let x = 358; x < 634; x++) {
      const cy = 314 + Math.sin((x - 358) * 0.018) * 4;
      R(c, x, cy - 11, 1, 22, "#71573c");
      R(c, x, cy - 9, 1, 18, "#9b7b56");
      if (x % 12 === 0) R(c, x, cy - 9, 1, 1, "#b1926b");
    }

    // 城门广场
    ellipse(c, 360, 274, 82, 27, "#71573c");
    ellipse(c, 360, 273, 78, 24, "#a0805b");
    dither(c, 286, 254, 148, 36, "#a68761", "#987955", 3);

    // 主路
    for (let y = 250; y < H; y++) {
      const t = clamp((y - 252) / 153, 0, 1);
      const half = 22 + t * 76;
      const cx = 360 + Math.sin(y * 0.03) * 4;
      R(c, cx - half - 3, y, half * 2 + 6, 1, "#6e5439");
      R(c, cx - half, y, half * 2, 1, "#9d7d57");
      R(c, cx - half + 1, y, 2, 1, "#b2946b");
      R(c, cx + half - 3, y, 2, 1, "#826443");
      if (y % 17 === 0) R(c, cx - half + 3, y, half * 2 - 6, 1, "#8c6e4b");
    }

    // 石板
    cobbleField = [];
    for (let i = 0; i < 235; i++) {
      let x, y;
      const pick = rng();
      if (pick < 0.62) {
        y = 256 + Math.floor(rng() * 145);
        const t = clamp((y - 252) / 153, 0, 1);
        const half = 16 + t * 68;
        x = 360 + Math.sin(y * 0.03) * 4 + (rng() * 2 - 1) * half;
      } else if (pick < 0.81) {
        x = 80 + Math.floor(rng() * 274);
        y = 296 + Math.sin((x - 72) * 0.02) * 4 + (rng() * 2 - 1) * 8;
      } else {
        x = 370 + Math.floor(rng() * 256);
        y = 306 + Math.sin((x - 360) * 0.018) * 4 + (rng() * 2 - 1) * 8;
      }
      const w = 3 + Math.floor(rng() * 4);
      R(c, x, y, w + 1, 3, "#806444");
      R(c, x, y, w, 2, i % 4 === 0 ? "#b3946c" : "#a58660");
      R(c, x, y, 1, 1, "#c2a57a");
      cobbleField.push([x, y]);
    }

    // 草纹
    tuftField = [];
    for (let i = 0; i < 460; i++) {
      const x = Math.floor(rng() * W);
      const y = 232 + Math.floor(rng() * 170);
      if (isPath(x, y) && rng() < 0.86) continue;
      const h = 2 + Math.floor(rng() * 3);
      const col = i % 4 === 0 ? "#7f945c" : i % 4 === 1 ? "#526b40" : "#687f4f";
      R(c, x, y - h, 1, h, col);
      if (h > 2) {
        R(c, x - 1, y - h + 1, 1, 1, col);
        R(c, x + 1, y - h + 2, 1, 1, col);
      }
      tuftField.push([x, y, h]);
    }

    // 花
    flowerField = [];
    for (let i = 0; i < 42; i++) {
      const x = 10 + Math.floor(rng() * (W - 20));
      const y = 244 + Math.floor(rng() * 154);
      if (isPath(x, y) && rng() < 0.75) continue;
      const col = ["#e4c45e", "#e8e0c7", "#b95d51", "#9ba9d0"][i % 4];
      R(c, x, y, 1, 3, "#48653b");
      R(c, x - 1, y - 1, 3, 1, col);
      R(c, x, y - 2, 1, 1, col);
      R(c, x, y - 1, 1, 1, "#f4e4a0");
      flowerField.push([x, y, col]);
    }

    // 落叶
    for (let i = 0; i < 56; i++) {
      const x = Math.floor(rng() * W);
      const y = 246 + Math.floor(rng() * 152);
      if (isPath(x, y) && rng() < 0.4) continue;
      R(c, x, y, 2, 1, i % 3 === 0 ? "#a86d36" : i % 3 === 1 ? "#c18a42" : "#855b32");
    }

    // 主路两侧的草沿与小花
    for (let y = 258; y < 398; y += 6) {
      const t = clamp((y - 252) / 153, 0, 1);
      const half = 22 + t * 76;
      const cx = 360 + Math.sin(y * 0.03) * 4;
      if (rng() < 0.72) {
        const side = rng() < 0.5 ? -1 : 1;
        const gx = cx + side * (half + 4 + rng() * 8);
        R(c, gx, y, 1, 3, rng() < 0.5 ? "#7c9259" : "#536c41");
        if (rng() < 0.25) {
          R(c, gx - 1, y - 1, 3, 1, "#d9c267");
        }
      }
    }
    // 路牌
    drawSignpost(c, 281, 360);
    // 零散灌木
    drawBush(c, 246, 326, 0.9, "green");
    drawBush(c, 446, 342, 0.8, "gold");
    drawBush(c, 675, 298, 1.05, "green");
    drawBush(c, 52, 328, 0.8, "gold");

    // 树与灌木：先画远景大树，建筑会挡住一部分
    drawTree(c, 18, 284, 145, {
      dark: "#425b3b", main: "#5b7549", light: "#7d945b",
      highlight: "#c18a43"
    });
    drawTree(c, 701, 316, 94, {
      dark: "#40583a", main: "#607a4a", light: "#829b5e",
      highlight: "#c8994a"
    });
    // 墙角灌木
    for (let i = 0; i < 6; i++) {
      const x = 250 + i * 45;
      const y = 300 + (i % 2) * 4;
      ellipse(c, x, y, 8, 4, "#3c5738");
      ellipse(c, x - 1, y - 1, 6, 3, "#5d7949");
      R(c, x - 3, y - 3, 2, 1, "#829a5e");
    }

    return layer.canvas;
  }

  /* ---------------------------------------------------------
     城堡
     --------------------------------------------------------- */
  const CASTLE_WINDOWS = [
    { x: 293, y: 110, w: 12, h: 17, tier: 0 },
    { x: 293, y: 143, w: 12, h: 17, tier: 1 },
    { x: 437, y: 116, w: 12, h: 17, tier: 1 },
    { x: 437, y: 149, w: 12, h: 17, tier: 2 },
    { x: 319, y: 144, w: 13, h: 19, tier: 1 },
    { x: 407, y: 144, w: 13, h: 19, tier: 1 },
    { x: 361, y: 80, w: 20, h: 27, tier: 0 }
  ];

  function stoneBlock(c, x, y, w, h, damaged) {
    R(c, x - 2, y - 2, w + 4, h + 4, "#37332b");
    R(c, x, y, w, h, STONE);
    R(c, x, y, w, 2, STONE_LIGHT);
    R(c, x, y, 2, h, "#888c7e");
    R(c, x + w - 2, y, 2, h, STONE_DARK);
    R(c, x, y + h - 2, w, 2, STONE_DEEP);
    // 石缝
    for (let yy = y + 8; yy < y + h - 2; yy += 9) {
      R(c, x + 2, yy, w - 4, 1, "rgba(53,56,48,0.33)");
      const offset = ((yy / 9) | 0) % 2 === 0 ? 0 : 7;
      for (let xx = x + 8 + offset; xx < x + w - 4; xx += 15) {
        R(c, xx, yy - 7, 1, 7, "rgba(53,56,48,0.22)");
      }
    }
    // 高光石块
    R(c, x + 6, y + 14, 9, 3, "rgba(190,194,177,0.18)");
    R(c, x + 21, y + 32, 12, 2, "rgba(190,194,177,0.13)");
    if (damaged) {
      R(c, x + 7, y + 3, 5, 3, "#767a6d");
      R(c, x + w - 15, y + 2, 6, 3, "#6d7166");
    }
  }

  function crenellations(c, x, y, w, damaged, seed) {
    const rng = mulberry32(seed || 1);
    for (let mx = x; mx < x + w - 6; mx += 12) {
      if (damaged && rng() < 0.34) continue;
      R(c, mx - 1, y - 7, 8, 9, "#37332b");
      R(c, mx, y - 6, 6, 7, STONE);
      R(c, mx, y - 6, 6, 1, STONE_LIGHT);
      R(c, mx + 4, y - 5, 2, 6, STONE_DARK);
    }
  }

  function drawWindowRecess(c, win, boarded) {
    const x = win.x, y = win.y, w = win.w, h = win.h;
    R(c, x - 2, y - 2, w + 4, h + 4, "#3c3b32");
    R(c, x - 1, y - 1, w + 2, h + 2, "#5e6257");
    R(c, x, y, w, h, "#27312f");
    // 拱顶
    R(c, x + 2, y - 1, w - 4, 1, "#27312f");
    R(c, x + 4, y - 2, w - 8, 1, "#27312f");
    R(c, x - 1, y, 1, h, STONE_LIGHT);
    R(c, x + w, y, 1, h, STONE_DARK);
    if (boarded) {
      R(c, x - 2, y + 4, w + 4, 3, "#4a3321");
      R(c, x - 3, y + 11, w + 6, 2, "#5c4027");
      R(c, x + 2, y + 2, 2, h - 3, "#3a2818");
    }
  }

  function drawCastleLayer(stage) {
    const layer = makeLayer(W, H);
    const c = layer.c;
    const ruined = stage === 0;
    const mid = stage >= 2;

    shadow(c, 374, 272, 105, 11, 0.28);

    // 主堡
    stoneBlock(c, 300, 116, 144, 154, ruined);
    // 两侧塔楼
    stoneBlock(c, 281, stage === 0 ? 102 : 86, 45, stage === 0 ? 168 : 184, ruined);
    stoneBlock(c, 422, stage === 0 ? 122 : stage === 1 ? 104 : 92, 45, stage === 0 ? 148 : stage === 1 ? 166 : 178, ruined);
    // 中央上层
    stoneBlock(c, 338, 64, 66, 58, ruined);

    // 城垛
    crenellations(c, 300, 116, 36, ruined, 3);
    crenellations(c, 406, 116, 38, ruined, 5);
    crenellations(c, 283, stage === 0 ? 102 : 86, 42, ruined, 9);
    crenellations(c, 424, stage === 0 ? 122 : stage === 1 ? 104 : 92, 42, ruined || stage === 1, 11);

    // 中央尖顶
    const spireCx = 371;
    if (stage === 0) {
      // 断掉的尖顶
      for (let y = 52; y <= 66; y++) {
        const t = (y - 52) / 14;
        const half = 5 + t * 15;
        R(c, spireCx - half, y, half * 2, 1, ROOF_DARK);
      }
      R(c, 355, 53, 7, 4, ROOF);
      R(c, 379, 55, 5, 3, ROOF);
      R(c, 348, 42, 5, 3, "#5d6869");
      R(c, 385, 44, 4, 2, "#5d6869");
    } else {
      for (let y = 28; y <= 66; y++) {
        const t = (y - 28) / 38;
        const half = 4 + t * 32;
        R(c, spireCx - half, y, half * 2, 1, y < 36 ? ROOF_LIGHT : ROOF);
        R(c, spireCx - half, y, 2, 1, ROOF_DARK);
        R(c, spireCx + half - 2, y, 2, 1, ROOF_DARK);
        if (y % 6 === 0) R(c, spireCx - half + 4, y, half * 2 - 8, 1, "rgba(39,47,48,0.4)");
      }
      R(c, spireCx - 2, 22, 4, 7, "#3c3b32");
      R(c, spireCx - 1, 22, 2, 6, GOLD);
      R(c, spireCx - 2, 20, 4, 3, GOLD_LIGHT);
      // 金顶尖
      R(c, spireCx - 1, 16, 2, 5, "#554f3e");
      if (mid) R(c, spireCx - 2, 15, 4, 2, GOLD);
    }

    // 主堡屋顶阴影
    R(c, 300, 116, 144, 4, "rgba(36,35,28,0.32)");
    // 墙面的苔藓与风化
    const weatherRng = mulberry32(611);
    for (let i = 0; i < 34; i++) {
      const wx = 302 + weatherRng() * 138;
      const wy = 122 + weatherRng() * 138;
      R(c, wx, wy, 1 + weatherRng() * 3, 1, weatherRng() < 0.5 ? "rgba(120,135,95,0.28)" : "rgba(186,180,145,0.16)");
    }
    for (let i = 0; i < 8; i++) {
      R(c, 302 + weatherRng() * 30, 236 + weatherRng() * 22, 2, 1, "#69784e");
    }

    // 破损与裂缝
    if (ruined) {
      // 裂痕
      const crack = [[310, 126], [312, 133], [309, 139], [313, 146], [311, 154]];
      crack.forEach(function (p, i) { R(c, p[0], p[1], 2, 2, "#4f5248"); });
      R(c, 320, 164, 2, 14, "#4f5248");
      R(c, 322, 176, 5, 2, "#4f5248");
      R(c, 405, 180, 2, 16, "#4f5248");
      R(c, 405, 196, 6, 2, "#4f5248");
      R(c, 447, 156, 2, 18, "#4f5248");
      R(c, 444, 172, 5, 2, "#4f5248");
      // 缺失石块
      R(c, 301, 168, 7, 5, "#55594e");
      R(c, 429, 198, 6, 4, "#55594e");
      R(c, 350, 130, 5, 3, "#5d6156");
      // 藤蔓
      drawVine(c, 284, 148, 56, 0);
      drawVine(c, 316, 180, 45, 1);
      drawVine(c, 443, 138, 42, 2);
    } else if (stage === 1) {
      R(c, 320, 164, 2, 8, "#4f5248");
      R(c, 405, 184, 2, 8, "#4f5248");
      drawVine(c, 284, 172, 34, 0);
    }

    // 城门木廊：给灰色的主堡添一点暖色
    for (let y = 194; y <= 210; y++) {
      const tt = (y - 194) / 16;
      const half = 6 + tt * 29;
      R(c, 371 - half - 2, y, half * 2 + 4, 1, "#352417");
      R(c, 371 - half, y, half * 2, 1, y < 198 ? "#8c4a35" : "#703a2d");
      if (y % 4 === 0) R(c, 371 - half + 3, y, half * 2 - 6, 1, "#5b2f26");
    }
    R(c, 336, 208, 5, 17, "#3a2818");
    R(c, 337, 208, 3, 16, "#775333");
    R(c, 401, 208, 5, 17, "#3a2818");
    R(c, 402, 208, 3, 16, "#775333");
    R(c, 337, 206, 70, 3, "#3a2818");
    R(c, 340, 206, 64, 1, "#9c7047");
    R(c, 361, 198, 20, 11, "#2e3b50");
    R(c, 362, 199, 18, 9, "#45627c");
    R(c, 364, 198, 14, 2, GOLD);
    R(c, 366, 201, 10, 5, GOLD);
    R(c, 367, 202, 2, 2, GOLD_LIGHT);
    R(c, 373, 201, 2, 2, GOLD_LIGHT);
    R(c, 369, 204, 4, 2, "#7a571c");
    // 门侧壁柱
    R(c, 327, 178, 8, 94, "#3b3a31");
    R(c, 328, 179, 6, 91, "#64695b");
    R(c, 328, 179, 6, 2, "#878b79");
    R(c, 327, 200, 8, 3, "#555a4d");
    R(c, 327, 238, 8, 3, "#555a4d");
    R(c, 407, 178, 8, 94, "#3b3a31");
    R(c, 408, 179, 6, 91, "#5d6355");
    R(c, 408, 179, 6, 2, "#838777");
    R(c, 407, 200, 8, 3, "#4f5447");
    R(c, 407, 238, 8, 3, "#4f5447");
    // 箭窗
    R(c, 331, 214, 2, 12, "#2d3029");
    R(c, 411, 214, 2, 12, "#2d3029");

    // 大门
    const gateBoarded = stage === 0;
    R(c, 340, 208, 61, 64, "#37332b");
    for (let i = 0; i < 5; i++) {
      R(c, 344, 212 + i * 12, 53, 9, "#3f392d");
    }
    R(c, 348, 216, 46, 56, gateBoarded ? "#3b2a1a" : "#5c4025");
    for (let i = 0; i < 4; i++) R(c, 353 + i * 11, 218, 1, 52, "#3c2a19");
    R(c, 348, 238, 46, 3, "#2d2115");
    if (stage >= 2) {
      R(c, 352, 246, 38, 2, "#c49a43");
      R(c, 355, 244, 2, 6, GOLD);
      R(c, 385, 244, 2, 6, GOLD);
    }
    if (gateBoarded) {
      R(c, 342, 228, 58, 4, "#4a3320");
      R(c, 339, 250, 62, 3, "#4a3320");
      R(c, 346, 218, 3, 52, "#523922");
      R(c, 380, 212, 3, 58, "#523922");
    } else {
      // 门把手
      R(c, 381, 244, 3, 3, GOLD);
      R(c, 382, 245, 1, 1, "#f6e2a2");
    }

    // 台阶
    R(c, 338, 272, 66, 4, "#4d5048");
    R(c, 333, 276, 76, 4, "#5b5e52");
    R(c, 327, 280, 88, 4, "#66695b");
    dither(c, 327, 280, 88, 3, "#777a6a", "#5c6054", 3);

    // 窗户
    CASTLE_WINDOWS.forEach(function (win, i) {
      let boarded = false;
      if (stage === 0 && (i === 0 || i === 2 || i === 4 || i === 5)) boarded = true;
      if (stage === 1 && i === 5) boarded = true;
      if (win.x === 361) {
        // 钟楼拱窗
        R(c, win.x - 3, win.y - 3, win.w + 6, win.h + 6, "#3c3b32");
        R(c, win.x - 1, win.y - 1, win.w + 2, win.h + 2, STONE_LIGHT);
        R(c, win.x, win.y, win.w, win.h, "#1f2726");
        R(c, win.x + 4, win.y - 2, win.w - 8, 2, "#1f2726");
        R(c, win.x + 7, win.y - 4, win.w - 14, 2, "#1f2726");
        // 铜钟
        R(c, 367, win.y + 8, 2, 4, "#4e4020");
        R(c, 364, win.y + 12, 8, 6, "#8f6d2e");
        R(c, 365, win.y + 12, 6, 2, GOLD);
        R(c, 366, win.y + 18, 4, 2, "#6e5424");
        R(c, 367, win.y + 20, 2, 2, "#5e4720");
      } else {
        drawWindowRecess(c, win, boarded);
      }
    });

    // 挂旗
    if (stage >= 2) {
      drawBanner(c, 312, 140, 16, 48, stage >= 3);
      if (stage >= 3) drawBanner(c, 418, 140, 16, 48, true);
    }
    if (stage >= 4) {
      // 花箱
      [319, 407].forEach(function (bx) {
        R(c, bx - 1, 164, 16, 5, "#4a3321");
        R(c, bx + 1, 163, 12, 2, "#68482a");
        R(c, bx + 2, 161, 2, 2, "#b95d51");
        R(c, bx + 7, 160, 2, 3, "#e4c45e");
        R(c, bx + 11, 162, 2, 2, "#9ba9d0");
      });
      // 金色装饰线
      R(c, 336, 66, 70, 2, GOLD);
      R(c, 302, 118, 138, 2, "rgba(217,171,74,0.6)");
    }

    // 城门两侧小灯座
    R(c, 334, 226, 4, 8, "#3d3224");
    R(c, 331, 219, 10, 8, "#3a3022");
    R(c, 332, 220, 8, 6, "#5a452c");
    R(c, 334, 221, 4, 4, "#e8c367");
    R(c, 335, 219, 2, 2, "#f6dc8f");
    R(c, 402, 226, 4, 8, "#3d3224");
    R(c, 400, 219, 10, 8, "#3a3022");
    R(c, 401, 220, 8, 6, "#5a452c");
    R(c, 403, 221, 4, 4, "#e8c367");
    R(c, 404, 219, 2, 2, "#f6dc8f");

    return layer.canvas;
  }

  function drawVine(c, x, y, len, seed) {
    const rng = mulberry32(seed * 17 + 5);
    let vx = x;
    for (let i = 0; i < len; i += 3) {
      vx += rng() < 0.5 ? -1 : 1;
      R(c, vx, y + i, 1, 3, "#466238");
      if (i % 6 === 0) {
        R(c, vx - 2, y + i + 1, 2, 1, "#5f7d4b");
        R(c, vx + 1, y + i + 3, 3, 2, rng() < 0.4 ? "#7d955d" : "#527046");
      }
    }
  }

  function drawBanner(c, x, y, w, h, extra) {
    R(c, x, y, w, h, "#2e3c52");
    R(c, x + 1, y + 1, w - 2, h - 3, "#46647f");
    R(c, x + 2, y + 2, w - 4, 3, "#65829b");
    R(c, x, y, w, 2, GOLD);
    R(c, x, y + h - 2, 5, 2, "#2e3c52");
    R(c, x + 5, y + h - 2, 5, 2, "#2e3c52");
    R(c, x + 10, y + h - 2, 5, 2, "#2e3c52");
    R(c, x + 4, y + 10, 8, 7, GOLD);
    R(c, x + 5, y + 9, 2, 2, GOLD_LIGHT);
    R(c, x + 9, y + 9, 2, 2, GOLD_LIGHT);
    R(c, x + 7, y + 12, 2, 3, "#6f5120");
    if (extra) {
      R(c, x + 1, y + 6, 2, 22, "#87a1b8");
      R(c, x + w - 3, y + 6, 2, 22, "#87a1b8");
    }
  }

  function drawCastleFlags(stage) {
    if (stage >= 2) {
      drawFlag(300, 60, 16, 10, "#a54a3c", 0);
      drawFlag(444, 68, 16, 10, "#a54a3c", 1.8);
    }
    if (stage >= 1) {
      // 旗杆
      R(ctx, spirePoleX() - 1, stage >= 2 ? 9 : 14, 2, stage >= 2 ? 16 : 12, "#4b4332");
      if (stage >= 2) drawFlag(spirePoleX(), stage >= 3 ? 10 : 12, 18, 11, "#46647f", 0.9);
    }
  }
  function spirePoleX() { return 371; }

  function drawFlag(x, y, w, h, color, phase) {
    const wave = Math.sin(time * 3.2 + phase) * 1.8;
    for (let i = 0; i < h; i++) {
      const off = Math.round(Math.sin(time * 3.2 + phase + i * 0.7) * 1.2);
      R(ctx, x + off, y + i, w - Math.floor(i * 0.35), 1, i < 2 ? "#c56a52" : color);
    }
    R(ctx, x, y, 2, h, "#3b3123");
    R(ctx, x + 2, y + 2, w - 7, 1, "rgba(255,224,150,0.35)");
  }

  function drawCastleWindows(stage, night, lights) {
    if (night < 0.16) return;
    CASTLE_WINDOWS.forEach(function (win, i) {
      let lit = stage >= 2 || (stage === 1 && i % 2 === 0);
      if (stage === 0) lit = i === 6; // 钟楼微光
      if (!lit) return;
      if (win.x === 361) {
        lights.push({ x: win.x + 4, y: win.y + 8, w: 12, h: 12, kind: "window", color: "#e8bf62", glow: 17 });
      } else {
        lights.push({ x: win.x + 2, y: win.y + 2, w: win.w - 4, h: win.h - 4, kind: "window", color: "#f2cc73", glow: 14 });
      }
    });
    // 城门口灯
    lights.push({ x: 333, y: 223, w: 6, h: 5, kind: "lamp", color: "#f7cc68", glow: 19 });
    lights.push({ x: 401, y: 223, w: 6, h: 5, kind: "lamp", color: "#f7cc68", glow: 19 });
  }

  function getCastleStage(state) {
    if (!state || !state.buildings) return 0;
    let built = 0;
    D.BUILDINGS.forEach(function (b) {
      if (state.buildings[b.id] && state.buildings[b.id].status === "built") built++;
    });
    if (built >= 7) return 4;
    if (built >= 5) return 3;
    if (built >= 3) return 2;
    if (built >= 1) return 1;
    return 0;
  }

  function castleLayer(stage) {
    if (!castleLayers[stage]) castleLayers[stage] = drawCastleLayer(stage);
    return castleLayers[stage];
  }

  /* ---------------------------------------------------------
     建筑绘制
     --------------------------------------------------------- */
  function plotCenter(plot) { return plot.x + plot.w / 2; }

  function drawRubble(plot, available) {
    const cx = plotCenter(plot);
    const base = plot.baseY - 2;
    const rng = mulberry32((plot.x * 13 + plot.y * 7) | 0);
    shadow(ctx, cx, base, Math.min(58, plot.w * 0.38), 7, 0.22);
    ellipse(ctx, cx, base - 3, Math.min(50, plot.w * 0.34), 8, "#6b543a");
    ellipse(ctx, cx - 3, base - 4, Math.min(42, plot.w * 0.28), 6, "#7a6145");

    // 旧地基：告诉玩家这里曾经/将会有一座建筑
    const fw = Math.min(104, plot.w * 0.62);
    const fy = base - 10;
    for (let x = cx - fw / 2; x < cx + fw / 2; x += 8) {
      if (rng() < 0.18) continue;
      const w = 6 + Math.floor(rng() * 3);
      R(ctx, x, fy, w + 1, 5, "#3e3b31");
      R(ctx, x + 1, fy + 1, w - 1, 3, rng() < 0.35 ? "#737767" : "#5c6155");
      R(ctx, x + 1, fy + 1, Math.max(2, w - 3), 1, "#898d7b");
    }
    // 残墙
    R(ctx, cx - fw / 2 + 3, fy - 8, 22, 9, "#3c3d34");
    R(ctx, cx - fw / 2 + 4, fy - 7, 20, 7, "#686d5e");
    R(ctx, cx - fw / 2 + 4, fy - 7, 13, 1, "#8b9080");
    R(ctx, cx - fw / 2 + 15, fy - 10, 9, 11, "#3c3d34");
    R(ctx, cx - fw / 2 + 16, fy - 9, 7, 9, "#5b6052");
    R(ctx, cx + fw / 2 - 26, fy - 5, 21, 7, "#3c3d34");
    R(ctx, cx + fw / 2 - 25, fy - 4, 19, 5, "#626759");
    R(ctx, cx + fw / 2 - 25, fy - 4, 11, 1, "#858a78");

    // 断裂的梁木
    R(ctx, cx - 35, base - 8, 26, 3, "#3f2d1c");
    R(ctx, cx - 33, base - 7, 22, 2, "#795536");
    R(ctx, cx - 24, base - 13, 3, 7, "#4f3621");
    R(ctx, cx + 10, base - 5, 21, 3, "#4a3320");
    R(ctx, cx + 12, base - 4, 17, 1, "#805c3a");

    // 碎石堆
    const stones = 6 + Math.floor(rng() * 4);
    for (let i = 0; i < stones; i++) {
      const x = cx - 34 + Math.floor(rng() * 68);
      const y = base - 5 - Math.floor(rng() * 11);
      const w = 4 + Math.floor(rng() * 7);
      const h = 3 + Math.floor(rng() * 5);
      R(ctx, x, y, w, h, "#4a4d43");
      R(ctx, x + 1, y + 1, w - 2, h - 2, i % 2 ? STONE : STONE_DARK);
      R(ctx, x + 1, y + 1, Math.max(1, w - 4), 1, STONE_LIGHT);
    }

    // 野草与藤蔓
    for (let i = 0; i < 13; i++) {
      const x = cx - 38 + Math.floor(rng() * 78);
      const y = base - 3 - Math.floor(rng() * 6);
      const h = 3 + Math.floor(rng() * 5);
      R(ctx, x, y - h, 1, h, i % 2 ? "#5e7c48" : "#486338");
      if (h > 4) {
        R(ctx, x - 1, y - h + 1, 1, 1, "#78935c");
        R(ctx, x + 1, y - h + 2, 1, 2, "#6b8653");
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = cx - 38 + rng() * 76;
      R(ctx, x, base - 15 - rng() * 4, 1, 5, "#466238");
      if (i % 2 === 0) R(ctx, x - 1, base - 14, 2, 1, "#6f8d54");
    }

    // 工地告示牌（只在蓝图解锁后出现）
    if (available) {
      const sx = cx + Math.min(34, plot.w * 0.3);
      R(ctx, sx, base - 29, 3, 28, "#3d2c1b");
      R(ctx, sx + 1, base - 29, 1, 27, "#735231");
      R(ctx, sx - 10, base - 32, 23, 15, "#3a2817");
      R(ctx, sx - 9, base - 31, 21, 12, "#f1e2b8");
      R(ctx, sx - 7, base - 28, 15, 1, "#7b5c38");
      R(ctx, sx - 7, base - 25, 10, 1, "#a38154");
      R(ctx, sx - 7, base - 22, 13, 1, "#a38154");
      R(ctx, sx + 7, base - 33, 3, 3, GOLD);
      R(ctx, sx - 7, base - 33, 2, 2, GOLD);
      R(ctx, sx - 5, base - 35, 1, 4, GOLD);
      R(ctx, sx - 2, base - 34, 1, 2, "#9b7a4d");
    }
  }

  function drawScaffold(plot) {
    const x = plot.x + 9;
    const y = plot.baseY - 67;
    const w = plot.w - 18;
    const base = plot.baseY - 2;
    // 后柱
    R(ctx, x, y, 3, base - y, "#3b2a1a");
    R(ctx, x + 1, y, 1, base - y, "#7d5939");
    R(ctx, x + w - 3, y, 3, base - y, "#3b2a1a");
    R(ctx, x + w - 2, y, 1, base - y, "#7d5939");
    // 横梁
    for (let i = 0; i < 3; i++) {
      const yy = y + 8 + i * 22;
      R(ctx, x - 2, yy, w + 4, 3, "#3b2a1a");
      R(ctx, x - 2, yy, w + 4, 1, "#8d6742");
      R(ctx, x + 2, yy + 3, 2, 2, "#5f4328");
    }
    // 斜撑
    R(ctx, x + 7, y + 14, 2, 2, "#765334");
    R(ctx, x + 9, y + 16, 2, 2, "#765334");
    R(ctx, x + 11, y + 18, 2, 2, "#765334");
    // 绳索
    R(ctx, x + 2, y + 5, w - 4, 1, "#b6a079");
    R(ctx, x + 2, y + 49, w - 4, 1, "#b6a079");
    // 小吊桶
    R(ctx, x + w - 14, y + 31, 7, 6, "#3b2a1a");
    R(ctx, x + w - 13, y + 32, 5, 4, "#80603e");
    R(ctx, x + w - 12, y + 32, 3, 1, "#a47e52");
  }

  function drawFarm(t, staffed, ghost) {
    const plot = BUILDING_BY_ID.farm.plot;
    shadow(ctx, 121, 382, 82, 7, 0.2);
    // 后篱笆
    for (let x = 38; x <= 204; x += 20) {
      R(ctx, x, 326, 3, 18, "#3c2a19");
      R(ctx, x + 1, 327, 1, 16, "#7b5838");
      R(ctx, x + 1, 329, 2, 3, "#5f4228");
    }
    R(ctx, 36, 331, 168, 2, "#3c2a19");
    R(ctx, 36, 331, 168, 1, "#8b6842");
    R(ctx, 36, 337, 168, 1, "#5e4228");
    // 土垄
    const rows = [
      { y: 341, w: 132 }, { y: 349, w: 144 }, { y: 357, w: 156 },
      { y: 365, w: 168 }, { y: 373, w: 178 }
    ];
    rows.forEach(function (row, ri) {
      const x = 121 - row.w / 2;
      R(ctx, x, row.y, row.w, 7, "#5c432c");
      R(ctx, x + 1, row.y + 1, row.w - 2, 5, ri % 2 ? "#7e5d3e" : "#755537");
      R(ctx, x + 2, row.y + 1, row.w - 5, 1, "#8f6c49");
      for (let sx = x + 6; sx < x + row.w - 4; sx += 7) {
        const sway = Math.round(Math.sin(t * 1.6 + sx * 0.12 + ri) * (staffed ? 1 : 0.4));
        const hh = staffed ? 6 + ((sx + ri * 3) % 4) : 4 + ((sx + ri) % 3);
        R(ctx, sx + sway, row.y - hh, 1, hh, staffed ? "#b38a42" : "#8d8645");
        R(ctx, sx + sway - 1, row.y - hh, 3, 1, staffed ? "#dbb55e" : "#b0aa69");
        R(ctx, sx + sway, row.y - hh - 2, 1, 2, staffed ? "#e6c675" : "#c0b77c");
        if (sx % 14 === 0) {
          R(ctx, sx + sway - 1, row.y - hh + 1, 1, 1, "#f0d99a");
        }
      }
    });
    // 稻草人
    R(ctx, 184, 304, 3, 44, "#3d2a1a");
    R(ctx, 179, 312, 13, 2, "#4d3521");
    R(ctx, 184, 315, 3, 18, "#734f31");
    R(ctx, 178, 320, 15, 8, "#96704a");
    R(ctx, 179, 320, 13, 2, "#b28a5b");
    R(ctx, 174, 323, 23, 3, "#49331f");
    R(ctx, 176, 323, 19, 1, "#a37c4f");
    R(ctx, 182, 302, 9, 6, "#4a3421");
    R(ctx, 183, 299, 7, 4, "#cba85a");
    R(ctx, 181, 302, 11, 2, "#d8b766");
    R(ctx, 185, 305, 1, 1, "#43301e");
    R(ctx, 189, 305, 1, 1, "#43301e");
    R(ctx, 187, 307, 2, 1, "#704a2a");
    if (staffed) {
      // 停在草帽上的小鸟
      R(ctx, 181, 296, 3, 2, "#3d3b34");
      R(ctx, 182, 295, 2, 1, "#4f4b40");
      R(ctx, 183, 297, 1, 1, "#c9a24e");
      R(ctx, 180, 297, 1, 1, "#2f2d28");
    }
    // 篮子
    R(ctx, 44, 369, 13, 8, "#3e2b19");
    R(ctx, 45, 370, 11, 6, "#8f653a");
    R(ctx, 46, 369, 9, 2, "#b1844b");
    R(ctx, 47, 367, 2, 2, "#c9a24e");
    R(ctx, 51, 366, 2, 3, "#d9b45e");
    R(ctx, 55, 368, 2, 2, "#a87738");
  }

  function drawLumber(t, staffed, ghost) {
    shadow(ctx, 103, 300, 51, 7, 0.24);
    // 棚屋
    const roofCx = 92;
    for (let y = 238; y <= 254; y++) {
      const t2 = (y - 238) / 16;
      const half = 8 + t2 * 19;
      R(ctx, roofCx - half, y, half * 2, 1, "#3a2818");
      if (y > 240) R(ctx, roofCx - half + 2, y, half * 2 - 4, 1, y < 246 ? "#8f4c37" : "#74402f");
    }
    R(ctx, 63, 252, 57, 42, "#3a2818");
    R(ctx, 65, 254, 53, 38, "#7a5638");
    for (let x = 69; x < 118; x += 7) {
      R(ctx, x, 256, 1, 34, "#5e4129");
      if (x % 14 === 0) R(ctx, x + 1, 258, 1, 30, "#8c6644");
    }
    R(ctx, 62, 252, 5, 46, "#3a2818");
    R(ctx, 63, 254, 3, 42, "#6b492d");
    R(ctx, 116, 252, 5, 46, "#3a2818");
    R(ctx, 117, 254, 3, 42, "#6b492d");
    // 门洞
    R(ctx, 81, 266, 23, 28, "#2d2116");
    R(ctx, 83, 268, 19, 26, "#4c3420");
    R(ctx, 86, 271, 2, 23, "#61442a");
    R(ctx, 92, 268, 2, 26, "#3a291a");
    R(ctx, 99, 270, 1, 22, "#61442a");
    // 招牌
    R(ctx, 104, 256, 14, 13, "#3b2a19");
    R(ctx, 105, 257, 12, 10, "#e9d6a9");
    R(ctx, 108, 259, 1, 6, "#6e4e2d");
    R(ctx, 109, 258, 4, 2, "#7e8580");
    R(ctx, 109, 264, 4, 1, "#7e8580");
    // 原木堆
    R(ctx, 118, 282, 38, 16, "#422d1c");
    for (let i = 0; i < 3; i++) {
      const y = 282 + i * 5;
      R(ctx, 120 + i * 2, y, 32 - i * 2, 5, "#3a2818");
      R(ctx, 121 + i * 2, y + 1, 29 - i * 2, 3, i % 2 ? "#8d633c" : "#7d5734");
      R(ctx, 122 + i * 2, y + 1, 23 - i * 2, 1, "#b07e4e");
      ellipse(ctx, 151, y + 2, 3, 2, "#d4a56c");
      R(ctx, 151, y + 2, 1, 1, "#8c6135");
    }
    // 树桩与锯木架
    ellipse(ctx, 78, 297, 13, 5, "#3f2d1c");
    ellipse(ctx, 78, 296, 11, 4, "#8b623b");
    ellipse(ctx, 78, 296, 8, 2, "#b98b58");
    R(ctx, 92, 287, 17, 2, "#3e2b1a");
    R(ctx, 94, 289, 2, 9, "#3e2b1a");
    R(ctx, 94, 289, 1, 8, "#7b5737");
    R(ctx, 105, 289, 2, 9, "#3e2b1a");
    R(ctx, 105, 289, 1, 8, "#7b5737");
    // 烟与工作火花
    if (staffed) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.5 + i * 0.3) % 1;
        ctx.globalAlpha = (1 - ph) * 0.5;
        R(ctx, 102 + Math.sin(t * 2 + i) * 3, 280 - ph * 10, 2, 2, "#d5bc8c");
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawTavern(t, staffed, ghost, lights) {
    shadow(ctx, 212, 300, 45, 7, 0.25);
    // 烟囱
    R(ctx, 231, 185, 13, 26, "#3b3a31");
    R(ctx, 232, 186, 11, 24, "#6f7165");
    R(ctx, 231, 183, 13, 3, "#3b3a31");
    R(ctx, 233, 184, 9, 1, "#96998a");
    R(ctx, 232, 190, 11, 1, "#55594f");
    // 屋顶
    for (let y = 196; y <= 216; y++) {
      const tt = (y - 196) / 20;
      const half = 8 + tt * 38;
      R(ctx, 212 - half, y, half * 2, 1, "#3b2a1c");
      if (y > 198) R(ctx, 212 - half + 2, y, half * 2 - 4, 1, y < 204 ? "#a95743" : "#8d4638");
      if (y % 5 === 0) R(ctx, 212 - half + 3, y, half * 2 - 6, 1, "#6d342b");
    }
    R(ctx, 166, 214, 92, 4, "#3b2a1c");
    R(ctx, 168, 214, 88, 2, "#7c3c30");
    // 上层
    R(ctx, 174, 218, 76, 24, "#3b2a1c");
    R(ctx, 176, 219, 72, 22, "#d6c49d");
    R(ctx, 176, 219, 72, 2, "#e5d4ad");
    R(ctx, 180, 221, 3, 19, "#5f4329");
    R(ctx, 241, 221, 3, 19, "#5f4329");
    R(ctx, 209, 219, 4, 22, "#5f4329");
    R(ctx, 176, 232, 72, 2, "#6a4a2c");
    // 下层
    R(ctx, 178, 242, 70, 44, "#3b2a1c");
    R(ctx, 180, 243, 66, 42, "#caB58d");
    R(ctx, 180, 243, 66, 2, "#ddcba1");
    for (let x = 184; x < 244; x += 12) R(ctx, x, 245, 2, 40, "#5d4228");
    R(ctx, 180, 263, 66, 2, "#6b4a2c");
    // 石基
    R(ctx, 176, 286, 74, 10, "#3b3a31");
    R(ctx, 178, 287, 70, 8, "#696b5f");
    R(ctx, 178, 287, 70, 2, "#8d9081");
    for (let x = 184; x < 244; x += 10) R(ctx, x, 291, 1, 4, "#54574d");
    // 门
    R(ctx, 202, 258, 20, 30, "#3b2a1c");
    R(ctx, 204, 260, 16, 28, "#5b3f26");
    R(ctx, 208, 263, 1, 22, "#765535");
    R(ctx, 214, 263, 1, 22, "#765535");
    R(ctx, 217, 273, 2, 2, GOLD);
    // 窗户
    function tavernWindow(x, y) {
      R(ctx, x - 2, y - 2, 18, 18, "#3b2a1c");
      R(ctx, x - 1, y - 1, 16, 16, "#6a4a2d");
      R(ctx, x, y, 14, 14, "#2d3431");
      R(ctx, x + 6, y, 2, 14, "#7b5a37");
      R(ctx, x, y + 6, 14, 2, "#7b5a37");
      lights.push({ x: x + 1, y: y + 1, w: 12, h: 12, kind: "window", color: "#f6ce73", glow: 18 });
    }
    tavernWindow(185, 240);
    tavernWindow(225, 240);
    // 花箱
    R(ctx, 183, 254, 18, 5, "#49321e");
    R(ctx, 184, 253, 16, 2, "#6d4c2b");
    R(ctx, 186, 251, 2, 2, "#c05d4e");
    R(ctx, 192, 250, 2, 3, "#e0bc5c");
    R(ctx, 197, 252, 2, 2, "#97a4c7");
    // 招牌
    R(ctx, 249, 234, 2, 2, "#3b2a1b");
    R(ctx, 251, 235, 20, 2, "#3b2a1b");
    R(ctx, 251, 235, 20, 1, "#785535");
    const swing = Math.round(Math.sin(time * 2.1) * 1);
    R(ctx, 256 + swing, 237, 14, 15, "#3b2a1b");
    R(ctx, 257 + swing, 238, 12, 13, "#dfc58c");
    R(ctx, 260 + swing, 241, 6, 7, "#7b5635");
    R(ctx, 261 + swing, 242, 4, 2, "#f2d98f");
    R(ctx, 262 + swing, 244, 2, 3, "#a37c3d");
    // 木桶
    R(ctx, 166, 278, 10, 11, "#3a2818");
    R(ctx, 167, 279, 8, 9, "#835c39");
    R(ctx, 167, 281, 8, 1, "#4c3420");
    R(ctx, 167, 285, 8, 1, "#4c3420");
    // 灯
    R(ctx, 247, 250, 2, 10, "#3b2a1b");
    R(ctx, 244, 258, 8, 7, "#3b2a1b");
    R(ctx, 246, 260, 4, 4, "#f3c96a");
    lights.push({ x: 245, y: 259, w: 6, h: 6, kind: "lamp", color: "#f6cd6e", glow: 20 });
    if (staffed && !ghost) {
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.22 + i * 0.24) % 1;
        const x = 237 + Math.sin(t * 0.9 + i * 1.7) * 4 + ph * 5;
        const y = 182 - ph * 32;
        ctx.globalAlpha = (1 - ph) * 0.42;
        circle(ctx, x, y, 2 + ph * 3, "#cfc6b2");
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawLibrary(t, staffed, ghost, lights) {
    shadow(ctx, 618, 274, 42, 6, 0.23);
    // 塔身
    R(ctx, 594, 208, 50, 64, "#37332b");
    R(ctx, 596, 209, 46, 62, STONE);
    R(ctx, 596, 209, 46, 2, STONE_LIGHT);
    R(ctx, 640, 209, 2, 62, STONE_DARK);
    for (let y = 217; y < 270; y += 8) {
      R(ctx, 598, y, 42, 1, "rgba(55,58,50,0.32)");
      for (let x = 602 + ((y / 8) % 2) * 6; x < 638; x += 13) {
        R(ctx, x, y - 6, 1, 6, "rgba(55,58,50,0.18)");
      }
    }
    // 屋顶
    for (let y = 192; y <= 210; y++) {
      const tt = (y - 192) / 18;
      const half = 6 + tt * 28;
      R(ctx, 619 - half, y, half * 2, 1, "#2f3431");
      if (y > 194) R(ctx, 619 - half + 2, y, half * 2 - 4, 1, y < 200 ? "#4b5f75" : "#3d4e60");
    }
    R(ctx, 590, 209, 58, 3, "#2a2d2a");
    R(ctx, 592, 207, 54, 2, "#5b6e7e");
    // 小圆顶与望远镜
    R(ctx, 608, 180, 22, 14, "#2f3431");
    R(ctx, 610, 181, 18, 12, "#45586b");
    R(ctx, 610, 181, 18, 2, "#6f8394");
    R(ctx, 618, 174, 3, 8, "#3c3222");
    R(ctx, 621, 171, 12, 3, "#4b4231");
    R(ctx, 631, 169, 4, 4, "#8c845f");
    R(ctx, 610, 179, 18, 3, "#3b3c32");
    // 窗户
    function libWindow(x, y) {
      R(ctx, x - 2, y - 2, 16, 22, "#37332b");
      R(ctx, x - 1, y - 1, 14, 20, "#6e7165");
      R(ctx, x, y, 12, 18, "#27312f");
      R(ctx, x + 2, y - 1, 8, 1, "#27312f");
      R(ctx, x + 5, y + 2, 2, 16, "#5b5e52");
      R(ctx, x, y + 8, 12, 2, "#5b5e52");
      lights.push({ x: x + 1, y: y + 1, w: 10, h: 16, kind: "window", color: "#f1c869", glow: 17 });
    }
    libWindow(604, 220);
    libWindow(628, 220);
    // 门
    R(ctx, 611, 250, 17, 23, "#37332b");
    R(ctx, 613, 251, 13, 21, "#4a3521");
    R(ctx, 618, 260, 2, 2, GOLD);
    // 书堆与长椅
    R(ctx, 580, 260, 13, 12, "#3b2a1a");
    R(ctx, 581, 259, 11, 3, "#d4c294");
    R(ctx, 582, 255, 9, 3, "#a54a3c");
    R(ctx, 581, 252, 11, 3, "#4f6d8b");
    R(ctx, 583, 250, 8, 2, "#d9c68f");
    R(ctx, 582, 263, 9, 6, "#8e6b42");
    R(ctx, 584, 264, 5, 4, "#d9c895");
    // 常春藤
    drawVine(ctx, 594, 220, 42, 2);
    if (staffed && !ghost) {
      const sx = 634 + Math.sin(t * 1.7) * 3;
      const sy = 184 + Math.cos(t * 1.4) * 2;
      R(ctx, sx, sy, 1, 1, GOLD_LIGHT);
      R(ctx, sx - 2, sy + 2, 1, 1, "rgba(244,217,136,0.7)");
    }
  }

  function drawWatchtower(t, staffed, ghost, lights) {
    shadow(ctx, 518, 286, 39, 7, 0.24);
    // 塔身
    R(ctx, 496, 174, 42, 110, "#34322a");
    R(ctx, 498, 176, 38, 106, "#6c7064");
    R(ctx, 498, 176, 38, 2, "#8d9183");
    R(ctx, 534, 176, 2, 106, "#555a50");
    for (let y = 184; y < 280; y += 9) {
      R(ctx, 500, y, 34, 1, "rgba(50,53,46,0.32)");
      for (let x = 504 + ((y / 9) % 2) * 7; x < 532; x += 14) {
        R(ctx, x, y - 7, 1, 7, "rgba(50,53,46,0.2)");
      }
    }
    // 塔基
    R(ctx, 490, 274, 54, 12, "#37342b");
    R(ctx, 492, 275, 50, 10, "#5d6054");
    R(ctx, 492, 275, 50, 2, "#7d8172");
    // 木制瞭望台
    R(ctx, 486, 160, 58, 18, "#3a2818");
    R(ctx, 488, 161, 54, 15, "#80603e");
    for (let x = 490; x < 540; x += 8) R(ctx, x, 162, 1, 13, "#5a3f28");
    R(ctx, 486, 158, 58, 3, "#4b3420");
    R(ctx, 486, 158, 58, 1, "#a67d50");
    // 屋顶
    for (let y = 146; y <= 160; y++) {
      const tt = (y - 146) / 14;
      const half = 7 + tt * 29;
      R(ctx, 515 - half, y, half * 2, 1, "#34302a");
      if (y > 147) R(ctx, 515 - half + 2, y, half * 2 - 4, 1, y < 152 ? "#8f4b38" : "#733d2e");
    }
    // 旗杆
    R(ctx, 514, 105, 2, 43, "#3a2f21");
    R(ctx, 513, 104, 4, 2, GOLD);
    drawFlag(516, 108, 17, 11, "#a54b3c", 0.4);
    // 窗与门
    function towerWindow(x, y, h, lit) {
      R(ctx, x - 2, y - 2, 14, h + 4, "#37332b");
      R(ctx, x - 1, y - 1, 12, h + 2, "#5d6054");
      R(ctx, x, y, 10, h, "#262e2d");
      R(ctx, x + 4, y, 2, h, "#555a50");
      if (lit) lights.push({ x: x + 1, y: y + 1, w: 8, h: h - 2, kind: "window", color: "#edc267", glow: 14 });
    }
    towerWindow(508, 198, 15, true);
    towerWindow(511, 236, 12, false);
    R(ctx, 508, 260, 18, 18, "#37332b");
    R(ctx, 510, 261, 14, 17, "#4b3521");
    R(ctx, 516, 270, 2, 2, GOLD);
    // 梯子
    R(ctx, 542, 186, 2, 78, "#3b2a1a");
    R(ctx, 551, 186, 2, 78, "#3b2a1a");
    for (let y = 192; y < 264; y += 9) {
      R(ctx, 543, y, 9, 2, "#6e4f32");
      R(ctx, 543, y, 9, 1, "#967048");
    }
    // 火把
    R(ctx, 489, 250, 2, 11, "#3b2a1a");
    R(ctx, 486, 247, 8, 6, "#3b2a1a");
    R(ctx, 488, 249, 4, 4, "#f1c25c");
    lights.push({ x: 488, y: 248, w: 5, h: 5, kind: "lamp", color: "#f5c765", glow: 18 });
    if (staffed && !ghost) {
      R(ctx, 521, 117, 2, 2, "#f5d98c");
    }
  }

  function drawQuarry(t, staffed, ghost) {
    shadow(ctx, 594, 326, 55, 7, 0.22);
    // 岩层
    R(ctx, 548, 294, 92, 32, "#3f4138");
    for (let i = 0; i < 4; i++) {
      const x = 548 + i * 20;
      const y = 292 + (i % 2) * 4;
      R(ctx, x, y, 23, 34, "#4a4d43");
      R(ctx, x + 1, y + 1, 21, 30, i % 2 ? "#777a6c" : "#6d7164");
      R(ctx, x + 2, y + 1, 12, 2, "#929584");
      R(ctx, x + 3, y + 9, 10, 2, "rgba(50,53,46,0.28)");
    }
    // 大石块
    R(ctx, 556, 304, 42, 20, "#3c3d34");
    R(ctx, 558, 305, 38, 17, "#83867a");
    R(ctx, 560, 305, 24, 3, "#a1a492");
    R(ctx, 568, 311, 16, 2, "#6c7064");
    // 吊车
    R(ctx, 622, 248, 4, 78, "#3b2a1a");
    R(ctx, 623, 249, 2, 76, "#8b6742");
    R(ctx, 597, 252, 30, 4, "#3b2a1a");
    R(ctx, 598, 252, 28, 2, "#9b754b");
    R(ctx, 618, 255, 2, 13, "#6f5032");
    R(ctx, 600, 256, 2, 10, "#6f5032");
    R(ctx, 625, 258, 14, 3, "#3b2a1a");
    R(ctx, 626, 259, 12, 1, "#7d5a38");
    R(ctx, 607, 256, 1, 30, "#b7a076");
    const sway = staffed ? Math.round(Math.sin(t * 1.4) * 2) : 0;
    R(ctx, 604 + sway, 286, 7, 7, "#3b2a1a");
    R(ctx, 605 + sway, 287, 5, 5, "#7c7f72");
    R(ctx, 606 + sway, 287, 3, 1, "#a2a492");
    // 手推车
    R(ctx, 538, 314, 25, 8, "#3b2a1a");
    R(ctx, 539, 315, 23, 5, "#765434");
    R(ctx, 542, 312, 16, 6, "#4c3320");
    R(ctx, 543, 311, 14, 3, "#8f6a45");
    circle(ctx, 544, 324, 3, "#3b2a1a");
    circle(ctx, 544, 324, 2, "#7d7f72");
    circle(ctx, 557, 324, 3, "#3b2a1a");
    circle(ctx, 557, 324, 2, "#7d7f72");
    // 镐
    R(ctx, 606, 298, 2, 16, "#3e2d1c");
    R(ctx, 603, 297, 9, 2, "#6f746a");
    R(ctx, 601, 299, 3, 2, "#555b53");
    if (staffed && !ghost) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i * 0.3) % 1;
        ctx.globalAlpha = (1 - ph) * 0.5;
        R(ctx, 590 + Math.sin(t * 2 + i) * 6, 316 - ph * 12, 2, 2, "#c9b895");
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawMarket(t, staffed, ghost, lights) {
    shadow(ctx, 565, 386, 75, 7, 0.2);
    function stall(cx, topY, w, colorA, colorB) {
      const left = cx - w / 2;
      // 后柱
      R(ctx, left + 3, topY, 3, 370 - topY, "#3b2a1a");
      R(ctx, left + w - 6, topY, 3, 370 - topY, "#3b2a1a");
      // 棚顶
      for (let y = topY; y < topY + 10; y++) {
        const inset = (y - topY) * 0.6;
        R(ctx, cx - w / 2 - 2 + inset, y, w - inset * 2, 1, "#3a2818");
        if (y > topY + 1 && y < topY + 8) {
          for (let x = left + 2; x < left + w - 2; x += 8) {
            R(ctx, x + inset, y, 7, 1, ((x / 8) | 0) % 2 ? colorA : colorB);
          }
        }
      }
      R(ctx, left - 2, topY + 9, w + 4, 3, "#3a2818");
      R(ctx, left, topY + 9, w, 1, "#8e6c47");
      // 柜台
      R(ctx, left + 2, 364, w - 4, 12, "#3b2a1a");
      R(ctx, left + 3, 365, w - 6, 8, "#8c663f");
      R(ctx, left + 3, 365, w - 6, 2, "#b18151");
      for (let x = left + 7; x < left + w - 5; x += 10) R(ctx, x, 368, 1, 5, "#5d4228");
      // 货品
      for (let i = 0; i < 3; i++) {
        const gx = left + 8 + i * 12;
        R(ctx, gx, 359, 6, 5, "#3b2a1a");
        R(ctx, gx + 1, 359, 4, 4, ["#d8b45e", "#b65744", "#7f9b5f"][i]);
        R(ctx, gx + 1, 359, 3, 1, "#ead79a");
      }
    }
    stall(499, 332, 45, "#b75644", "#efdfb9");
    stall(551, 338, 48, "#4b6a83", "#efdfb9");
    stall(613, 346, 50, "#5c7a53", "#efdfb9");
    // 中央招牌
    R(ctx, 546, 308, 3, 17, "#3b2a1a");
    R(ctx, 542, 306, 34, 14, "#3b2a1a");
    R(ctx, 543, 307, 32, 11, "#efdfb9");
    R(ctx, 556, 309, 7, 7, GOLD);
    R(ctx, 557, 310, 5, 4, GOLD_LIGHT);
    R(ctx, 559, 311, 1, 2, "#8e6528");
    // 悬挂小旗
    for (let i = 0; i < 5; i++) {
      const fx = 489 + i * 30;
      R(ctx, fx, 326, 1, 4, "#3b2a1a");
      R(ctx, fx, 330, 10, 5, ["#b75644", "#d8b45e", "#4b6a83", "#5c7a53", "#b75644"][i]);
      R(ctx, fx, 330, 10, 1, "#f1e0b7");
    }
    // 木箱
    R(ctx, 632, 370, 14, 14, "#3b2a1a");
    R(ctx, 633, 371, 12, 12, "#7b5737");
    R(ctx, 637, 371, 1, 12, "#4f351f");
    R(ctx, 633, 376, 12, 1, "#4f351f");
    R(ctx, 474, 372, 10, 12, "#3b2a1a");
    R(ctx, 475, 373, 8, 10, "#8a623b");
    // 灯笼
    R(ctx, 527, 348, 2, 12, "#3b2a1a");
    R(ctx, 523, 356, 9, 8, "#3b2a1a");
    R(ctx, 525, 358, 5, 5, "#f1c766");
    lights.push({ x: 524, y: 357, w: 7, h: 7, kind: "lamp", color: "#f5ce6e", glow: 21 });
    lights.push({ x: 606, y: 364, w: 7, h: 7, kind: "lamp", color: "#f2c766", glow: 18 });
    R(ctx, 610, 356, 2, 12, "#3b2a1a");
    R(ctx, 606, 364, 9, 8, "#3b2a1a");
    R(ctx, 608, 366, 5, 5, "#efc365");
  }

  const BUILDING_DRAWERS = {
    lumber: drawLumber,
    farm: drawFarm,
    tavern: drawTavern,
    library: drawLibrary,
    watchtower: drawWatchtower,
    quarry: drawQuarry,
    market: drawMarket
  };

  function drawBuilding(b, bState, t, lights) {
    const plot = b.plot;
    const status = bState.status;
    const staffed = !!(b.worker && stateRef && stateRef.workers && stateRef.workers[b.worker] && stateRef.workers[b.worker].hired);
    const drawer = BUILDING_DRAWERS[b.id];

    if (status === "locked") {
      drawRubble(plot, false);
      return;
    }

    if (status === "available") {
      drawRubble(plot, true);
      // 蓝图虚影
      ctx.globalAlpha = 0.28;
      drawer(t, false, true, []);
      ctx.globalAlpha = 1;
      return;
    }

    if (status === "building") {
      drawRubble(plot, false);
      ctx.globalAlpha = 0.32;
      drawer(t, false, true, []);
      ctx.globalAlpha = 1;
      drawScaffold(plot);
      return;
    }

    // built
    drawer(t, staffed, false, lights);
  }

  function drawWell() {
    shadow(ctx, 360, 340, 28, 6, 0.2);
    R(ctx, 336, 329, 48, 12, "#39362d");
    R(ctx, 338, 330, 44, 9, "#6c6e61");
    R(ctx, 338, 330, 44, 2, "#8d9081");
    R(ctx, 338, 336, 44, 2, "#585b51");
    R(ctx, 344, 332, 32, 2, "#2d3029");
    R(ctx, 345, 332, 30, 1, "#4f5248");
    // 立柱
    R(ctx, 341, 300, 4, 30, "#3b2a1a");
    R(ctx, 342, 300, 2, 30, "#7c5838");
    R(ctx, 375, 300, 4, 30, "#3b2a1a");
    R(ctx, 376, 300, 2, 30, "#7c5838");
    // 小屋顶
    for (let y = 288; y <= 302; y++) {
      const tt = (y - 288) / 14;
      const half = 5 + tt * 24;
      R(ctx, 360 - half, y, half * 2, 1, "#3b2a1a");
      if (y > 289) R(ctx, 360 - half + 2, y, half * 2 - 4, 1, y < 295 ? "#8f4b38" : "#713d2f");
    }
    // 横梁与绳桶
    R(ctx, 343, 308, 34, 2, "#3b2a1a");
    R(ctx, 343, 308, 34, 1, "#83603d");
    R(ctx, 368, 310, 1, 10, "#b8a076");
    R(ctx, 365, 319, 7, 5, "#3b2a1a");
    R(ctx, 366, 320, 5, 3, "#87603a");
    // 水光
    R(ctx, 352, 332, 7, 1, "#839b8e");
    R(ctx, 361, 333, 4, 1, "#718b80");
    // 小花
    R(ctx, 331, 337, 1, 3, "#486339");
    R(ctx, 330, 335, 3, 1, "#e4c45e");
    R(ctx, 390, 338, 1, 2, "#486339");
    R(ctx, 389, 336, 3, 1, "#9ba9d0");
  }

  function drawLamp(x, baseY, lights) {
    shadow(ctx, x, baseY, 8, 3, 0.2);
    R(ctx, x - 2, baseY - 32, 4, 32, "#3b2a1a");
    R(ctx, x - 1, baseY - 32, 2, 31, "#755334");
    R(ctx, x - 5, baseY - 37, 10, 8, "#3b2a1a");
    R(ctx, x - 3, baseY - 35, 6, 5, "#efc56a");
    R(ctx, x - 4, baseY - 38, 8, 2, "#3b2a1a");
    R(ctx, x - 3, baseY - 39, 6, 1, "#8e693f");
    lights.push({ x: x - 3, y: baseY - 35, w: 6, h: 5, kind: "lamp", color: "#f6ce70", glow: 20 });
  }

  /* ---------------------------------------------------------
     人物
     --------------------------------------------------------- */
  function drawHat(c, x, y, look, dir) {
    const hx = x - 4;
    const hy = y - 22;
    switch (look.hat) {
      case "cap":
        R(c, hx, hy + 1, 9, 3, "#241b12");
        R(c, hx, hy + 1, 8, 2, look.hatColor);
        R(c, hx - 2, hy + 3, 12, 2, "#241b12");
        R(c, hx - 1, hy + 3, 10, 1, look.hatShade);
        break;
      case "straw":
        R(c, hx - 3, hy + 2, 15, 2, "#241b12");
        R(c, hx - 2, hy + 2, 13, 1, look.hatColor);
        R(c, hx, hy - 1, 9, 3, "#241b12");
        R(c, hx + 1, hy - 1, 7, 2, look.hatColor);
        R(c, hx + 2, hy + 1, 5, 1, "#7f6234");
        break;
      case "bandana":
        R(c, hx, hy, 9, 3, "#241b12");
        R(c, hx, hy, 8, 2, look.hatColor);
        R(c, hx + 7, hy + 1, 3, 2, look.hatColor);
        break;
      case "toque":
        R(c, hx - 1, hy - 3, 11, 7, "#241b12");
        R(c, hx, hy - 2, 9, 5, look.hatColor);
        R(c, hx + 1, hy - 4, 4, 2, "#f5ecd8");
        R(c, hx, hy + 3, 9, 2, look.hatShade);
        break;
      case "helmet":
        R(c, hx - 1, hy - 1, 11, 5, "#241b12");
        R(c, hx, hy, 9, 3, look.hatColor);
        R(c, hx + 2, hy + 3, 2, 5, look.hatColor);
        R(c, hx - 1, hy + 4, 11, 1, "#241b12");
        break;
      case "hood":
        R(c, hx - 2, hy - 2, 13, 11, "#241b12");
        R(c, hx - 1, hy - 1, 11, 9, look.hatColor);
        R(c, hx + 1, hy + 1, 7, 7, "#e1b48c");
        break;
      case "beret":
        R(c, hx - 1, hy, 11, 3, "#241b12");
        R(c, hx - 1, hy, 10, 2, look.hatColor);
        R(c, hx + 6, hy - 2, 3, 3, "#3b2a1a");
        R(c, hx + 7, hy - 3, 3, 1, GOLD);
        break;
      case "circlet":
        R(c, hx, hy + 2, 9, 2, "#241b12");
        R(c, hx + 1, hy + 2, 7, 1, GOLD);
        R(c, hx + 4, hy + 1, 2, 2, GOLD_LIGHT);
        break;
      default:
        break;
    }
  }

  function drawTool(c, role, x, y, dir) {
    switch (role) {
      case "wood":
        R(c, x, y - 8, 1, 8, "#4a3320");
        R(c, x - 2, y - 10, 5, 3, "#4a4d45");
        R(c, x - 1, y - 10, 3, 1, "#8b9086");
        break;
      case "food":
        R(c, x, y - 7, 1, 8, "#4a3320");
        R(c, x - 2, y - 8, 4, 2, "#7c8276");
        break;
      case "stone":
        R(c, x, y - 7, 1, 8, "#4a3320");
        R(c, x - 3, y - 9, 7, 2, "#5f645b");
        R(c, x - 3, y - 9, 2, 3, "#7f8578");
        break;
      case "tavern":
      case "cook":
        R(c, x - 1, y - 6, 6, 2, "#4a3320");
        R(c, x + 1, y - 8, 2, 2, "#d8b96a");
        R(c, x + 4, y - 8, 2, 2, "#b65744");
        break;
      case "library":
      case "scholar":
        R(c, x - 1, y - 8, 4, 5, "#3b2a1a");
        R(c, x, y - 7, 3, 3, "#efe1b9");
        R(c, x + 1, y - 7, 1, 3, "#8c6e48");
        break;
      case "tower":
      case "guard":
        R(c, x, y - 14, 1, 15, "#4a3a28");
        R(c, x - 1, y - 15, 3, 2, "#8b9184");
        break;
      case "market":
      case "merchant":
        R(c, x - 1, y - 7, 3, 3, GOLD);
        R(c, x, y - 6, 1, 1, "#f6e2a2");
        break;
      default:
        break;
    }
  }

  function drawCharacter(c, x, y, look, opts) {
    const walking = opts && opts.walking;
    const phase = opts && opts.phase != null ? opts.phase : 0;
    const staffed = !!(opts && opts.staffed);
    const role = opts && opts.role;
    const dir = opts && opts.dir ? opts.dir : 1;
    const bob = walking ? Math.round(Math.sin(phase * 2.2) * 0.8) : 0;
    const step = walking ? Math.round(Math.sin(phase * 5)) : 0;
    const yy = Math.round(y + bob);

    shadow(c, x, y - 1, 7, 2, 0.24);

    // 披风
    if (look.hat === "circlet") {
      R(c, x - 6, yy - 16, 12, 14, "#251a12");
      R(c, x - 5, yy - 15, 10, 12, "#8f3b34");
      R(c, x - 4, yy - 15, 7, 7, "#a84b3d");
      R(c, x - 5, yy - 4, 10, 2, "#6e2b27");
    }

    // 腿
    R(c, x - 3 + step, yy - 5, 3, 5, "#2b1c12");
    R(c, x - 2 + step, yy - 5, 2, 4, "#42301f");
    R(c, x + 1 - step, yy - 5, 3, 5, "#2b1c12");
    R(c, x + 2 - step, yy - 5, 2, 4, "#42301f");

    // 身体
    R(c, x - 5, yy - 14, 11, 10, "#2b1c12");
    R(c, x - 4, yy - 13, 9, 8, look.clothes);
    R(c, x - 4, yy - 13, 9, 2, look.clothesShade);
    R(c, x - 4, yy - 6, 9, 1, look.accent);
    R(c, x - 1, yy - 12, 2, 6, look.accent);

    // 手臂
    R(c, x - 7, yy - 12, 2, 6, "#2b1c12");
    R(c, x - 6, yy - 12, 1, 5, look.clothesShade);
    R(c, x + 6, yy - 12, 2, 6, "#2b1c12");
    R(c, x + 6, yy - 12, 1, 5, look.clothes);

    // 头部
    R(c, x - 5, yy - 22, 11, 10, "#2b1c12");
    R(c, x - 4, yy - 21, 9, 8, look.skin);
    R(c, x - 4, yy - 21, 9, 1, look.skinShade);
    R(c, x + 3, yy - 20, 2, 6, look.skinShade);
    // 耳朵
    R(c, x - 6, yy - 18, 2, 2, "#2b1c12");
    R(c, x - 5, yy - 18, 1, 1, look.skinShade);
    R(c, x + 5, yy - 18, 2, 2, "#2b1c12");
    R(c, x + 5, yy - 18, 1, 1, look.skinShade);
    // 五官
    const eyeY = yy - 17;
    R(c, x - 3 + (dir > 0 ? 0 : 0), eyeY, 1, 2, "#2d2118");
    R(c, x + 2, eyeY, 1, 2, "#2d2118");
    if (look.glasses) {
      R(c, x - 4, eyeY - 1, 3, 1, "#5b4b35");
      R(c, x + 2, eyeY - 1, 3, 1, "#5b4b35");
      R(c, x - 4, eyeY, 1, 2, "#5b4b35");
      R(c, x + 4, eyeY, 1, 2, "#5b4b35");
    }
    R(c, x, eyeY + 3, 1, 1, look.skinShade);
    if (look.beard) {
      R(c, x - 3, yy - 14, 7, 2, look.beard === "grey" ? "#bcb6a6" : "#5a3b26");
      R(c, x - 2, yy - 13, 5, 1, look.beard === "grey" ? "#d8d1c1" : "#6e4a2f");
    } else {
      R(c, x - 1, yy - 14, 3, 1, "#8d5a46");
    }
    // 头发
    if (look.hat !== "helmet" && look.hat !== "toque") {
      R(c, x - 5, yy - 22, 11, 3, "#2b1c12");
      R(c, x - 4, yy - 22, 9, 2, look.hair);
      R(c, x - 5, yy - 20, 2, 4, look.hairShade);
      R(c, x + 4, yy - 20, 2, 4, look.hairShade);
    }
    drawHat(c, x, yy, look, dir);
    drawTool(c, role, x + (dir > 0 ? 7 : -8), yy, dir);

    if (staffed && opts && opts.sparkle) {
      const sx = x + (dir > 0 ? 7 : -8);
      const sy = yy - 12 - Math.round(Math.sin(time * 2 + phase) * 2);
      R(c, sx, sy, 1, 1, GOLD_LIGHT);
      R(c, sx - 1, sy + 1, 1, 1, "rgba(244,217,136,0.6)");
    }
  }

  function workerPosition(worker, idx, idleIdx) {
    const hired = !!(stateRef && stateRef.workers && stateRef.workers[worker.id] && stateRef.workers[worker.id].hired);
    const area = worker.area && BUILDING_BY_ID[worker.area];
    const areaBuilt = area && stateRef && stateRef.buildings && stateRef.buildings[area.id] && stateRef.buildings[area.id].status === "built";
    if (hired && worker.scene === "outdoor" && areaBuilt) {
      const base = HOME_POSITIONS[area.id] || [360, 340];
      const ph = hashString(worker.id) * 6.28;
      const dx = Math.sin(time * 0.55 + ph) * 3;
      return {
        x: base[0] + dx,
        y: base[1],
        assigned: true,
        dir: base[0] > 360 ? -1 : 1,
        phase: time * 1.2 + ph
      };
    }
    const baseX = 300 + idleIdx * 22;
    const baseY = 352 + (idleIdx % 2) * 4;
    const ph = hashString(worker.id) * 6.28;
    return {
      x: baseX + Math.sin(time * 0.35 + ph) * 6,
      y: baseY,
      assigned: false,
      dir: Math.cos(time * 0.35 + ph) >= 0 ? 1 : -1,
      phase: time * 2 + ph,
      walking: true
    };
  }

  function drawWorkers(t, lights) {
    if (!stateRef || !stateRef.workers) return;
    let idleIdx = 0;
    const chars = [];
    D.WORKERS.forEach(function (worker) {
      const w = stateRef.workers[worker.id];
      if (!w || !w.hired || worker.scene !== "outdoor") return;
      const pos = workerPosition(worker, 0, idleIdx);
      if (!pos.assigned) idleIdx++;
      chars.push({ type: "worker", worker: worker, pos: pos });
    });
    // 主人公
    chars.push({
      type: "player",
      pos: { x: 431, y: 300, dir: -1, phase: time * 1.4 },
      look: D.NPCS.player.look
    });
    // 城堡猫
    chars.push({ type: "cat", pos: { x: 405, y: 306 } });

    chars.sort(function (a, b) { return a.pos.y - b.pos.y; });

    chars.forEach(function (ch) {
      if (ch.type === "worker") {
        drawCharacter(ctx, ch.pos.x, ch.pos.y, ch.worker.look, {
          walking: ch.pos.walking,
          phase: ch.pos.phase,
          staffed: ch.pos.assigned,
          role: ch.worker.role,
          dir: ch.pos.dir,
          sparkle: ch.pos.assigned
        });
        hitAreas.push({
          type: "worker", id: ch.worker.id,
          x: ch.pos.x - 8, y: ch.pos.y - 26, w: 16, h: 28
        });
      } else if (ch.type === "player") {
        drawCharacter(ctx, ch.pos.x, ch.pos.y, ch.look, {
          walking: false, phase: ch.pos.phase, staffed: false, role: "player", dir: ch.pos.dir
        });
        hitAreas.push({ type: "player", x: ch.pos.x - 8, y: ch.pos.y - 26, w: 16, h: 28 });
      } else if (ch.type === "cat") {
        drawCat(ch.pos.x, ch.pos.y, t);
        hitAreas.push({ type: "cat", x: ch.pos.x - 12, y: ch.pos.y - 14, w: 24, h: 18 });
      }
    });
  }

  function drawOutdoorSoldiers(t) {
    if (!stateRef || !stateRef.genericResidents) return;
    const soldiers = stateRef.genericResidents.filter(function (r) { return (r.klass || "resident") === "soldier"; });
    if (!soldiers.length) return;
    const count = Math.min(4, soldiers.length);
    for (let i = 0; i < count; i++) {
      let x, y;
      if (i < 2) {
        x = i === 0 ? 336 : 384;
        y = 308 + Math.sin(t * 1.1 + i * 2) * 1;
      } else {
        const p = (t * 10 + i * 42) % 170;
        x = 250 + p;
        y = 358 + Math.sin(t * 0.8 + i) * 1;
      }
      shadow(ctx, x, y, 6, 2, 0.16);
      drawGuestSprite(x, y, soldiers[i], t, i * 2.4);
    }
  }

  function drawCat(x, y, t) {
    shadow(ctx, x, y - 1, 10, 3, 0.2);
    // 小垫子
    ellipse(ctx, x, y - 2, 11, 4, "#7e3d35");
    ellipse(ctx, x, y - 3, 9, 3, "#a34b3e");
    R(ctx, x + 2, y - 6, 13, 4, "#2d2724");
    ellipse(ctx, x + 7, y - 5, 8, 4, "#3b3430");
    ellipse(ctx, x + 7, y - 8, 4, 3, "#3b3430");
    R(ctx, x + 2, y - 11, 3, 4, "#3b3430");
    R(ctx, x + 3, y - 12, 2, 2, "#2d2724");
    R(ctx, x + 9, y - 12, 3, 4, "#3b3430");
    R(ctx, x + 10, y - 13, 2, 2, "#2d2724");
    // 闭眼
    R(ctx, x + 5, y - 8, 2, 1, "#d8b96a");
    R(ctx, x + 9, y - 8, 2, 1, "#d8b96a");
    R(ctx, x + 7, y - 6, 1, 1, "#b98578");
    // 尾巴摆动
    const tw = Math.round(Math.sin(t * 1.4) * 2);
    R(ctx, x + 13, y - 4, 5, 1, "#2d2724");
    R(ctx, x + 17, y - 5 + tw, 2, 2, "#2d2724");
    R(ctx, x + 18, y - 6 + tw, 1, 2, "#3b3430");
  }

  function drawChicken(x, y, t, phase, color) {
    const peck = Math.sin(t * 2.6 + phase) > 0.55 ? 1 : 0;
    const bob = Math.round(Math.sin(t * 1.8 + phase) * 1);
    shadow(ctx, x, y - 1, 5, 2, 0.18);
    R(ctx, x - 3, y - 7 + bob, 6, 5, "#3b2f22");
    R(ctx, x - 2, y - 6 + bob, 4, 3, color);
    R(ctx, x + 1, y - 9 + bob, 3, 3, "#3b2f22");
    R(ctx, x + 1, y - 8 + bob, 2, 2, color);
    R(ctx, x + 3, y - 10 + bob, 1, 2, "#b64b3c");
    R(ctx, x + 4, y - 7 + bob + peck, 2, 1, "#d7a33f");
    R(ctx, x + 1, y - 10 + bob, 1, 1, "#e2d8b6");
    R(ctx, x - 2, y - 2 + bob, 1, 2, "#8c653b");
    R(ctx, x + 1, y - 2 + bob, 1, 2, "#8c653b");
    R(ctx, x - 4, y - 6 + bob, 2, 2, "#6b7f68");
  }

  function drawFarmLife(t) {
    if (!stateRef || !stateRef.buildings) return;
    const farm = stateRef.buildings.farm;
    if (!farm || farm.status !== "built") return;
    const day = 1 - nightAmount(hourOf(stateRef));
    if (day < 0.25) return;
    drawChicken(62 + Math.sin(t * 0.4) * 10, 383, t, 0.4, "#efe5c8");
    drawChicken(153 + Math.cos(t * 0.33 + 1.2) * 8, 386, t, 2.1, "#d3af67");
    drawChicken(190 + Math.sin(t * 0.28 + 2.4) * 5, 374, t, 3.4, "#e6d5b1");
  }

  function drawButterflies(t) {
    const hour = hourOf(stateRef);
    const day = 1 - nightAmount(hour);
    if (day < 0.35 || (stateRef && stateRef.weather === "rain")) return;
    const spots = [[232, 318], [318, 360], [482, 338], [620, 314]];
    for (let i = 0; i < spots.length; i++) {
      const x = spots[i][0] + Math.sin(t * 0.8 + i * 1.7) * 12;
      const y = spots[i][1] + Math.cos(t * 1.1 + i) * 6 - 8;
      const wing = Math.sin(t * 8 + i) > 0 ? 1 : 0;
      ctx.globalAlpha = 0.7;
      R(ctx, x - 2, y, 2, 1, i % 2 ? "#e1d38d" : "#c9d8e4");
      R(ctx, x + 1, y, 2, 1 + wing, i % 2 ? "#d8c46f" : "#a9c1d6");
      R(ctx, x, y, 1, 1, "#4f4531");
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------
     环境细节 / 天气 / 光照
     --------------------------------------------------------- */
  function drawLeaves(t, night) {
    if (night > 0.75) return;
    leafField.forEach(function (l, i) {
      const x = (l.x + t * l.speed + Math.sin(t * 0.8 + l.phase) * 12) % (W + 40) - 20;
      const y = (l.y + t * l.fall + Math.sin(t * 1.1 + l.phase) * 6) % 430 - 12;
      ctx.globalAlpha = 0.28 + l.a;
      R(ctx, x, y, 2, 1, l.color);
      R(ctx, x + 1, y + 1, 1, 1, l.color);
      ctx.globalAlpha = 1;
    });
  }

  function drawRain(t) {
    ctx.globalAlpha = 0.42;
    rainDrops.forEach(function (d, i) {
      const x = ((d.x + t * 22) % (W + 80)) - 40;
      const y = ((d.y + t * (220 + i % 40)) % 420) + 20;
      R(ctx, x, y, 1, 6 + (i % 4), "#8fb6c5");
      if (i % 7 === 0) R(ctx, x + 1, y + 7, 1, 2, "#c6e0e5");
      if (i % 13 === 0) R(ctx, x - 6, 150 + (i % 30), 1, 2, "rgba(143,182,197,0.5)");
    });
    ctx.globalAlpha = 1;
    // 水洼反光
    for (let i = 0; i < 5; i++) {
      const x = (i * 147 + t * 3) % W;
      R(ctx, x, 365 + (i % 3) * 8, 8 + (i % 4) * 3, 1, "rgba(160,190,196,0.2)");
    }
  }

  function drawSmokeAndParticles(t) {
    // 炊烟
    if (stateRef && stateRef.buildings) {
      const tavernB = stateRef.buildings.tavern;
      if (tavernB && tavernB.status === "built" && tavernB.staff) {
        for (let i = 0; i < 4; i++) {
          const ph = (t * 0.18 + i * 0.26) % 1;
          const x = 237 + Math.sin(t * 0.8 + i * 2.2) * 5 + ph * 8;
          const y = 180 - ph * 40;
          ctx.globalAlpha = (1 - ph) * 0.35;
          circle(ctx, x, y, 2 + ph * 4, i % 2 ? "#d8cfbb" : "#c4bca9");
          ctx.globalAlpha = 1;
        }
      }
    }
    drawLeaves(t, nightAmount(hourOf(stateRef)));
  }

  function drawFireflies(night) {
    if (night < 0.4) return;
    for (let i = 0; i < fireflyField.length; i++) {
      const f = fireflyField[i];
      const x = f.x + Math.sin(time * 0.5 + f.phase) * 14;
      const y = f.y + Math.cos(time * 0.66 + f.phase) * 8;
      const a = night * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 1.7 + f.phase)));
      ctx.globalAlpha = a * 0.25;
      circle(ctx, x, y, 3, "#d8e486");
      ctx.globalAlpha = a;
      R(ctx, x, y, 1, 1, "#f4eda1");
    }
    ctx.globalAlpha = 1;
  }

  function drawLighting(state, t) {
    const hour = hourOf(state);
    const night = nightAmount(hour);
    if (night > 0.01) {
      const a = night * 0.37;
      ctx.fillStyle = "rgba(8,14,34," + a.toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    // 傍晚暖色
    if (hour > 16.8 && hour < 19.2) {
      const a = Math.sin(clamp((hour - 16.8) / 2.4, 0, 1) * Math.PI) * 0.09;
      ctx.fillStyle = "rgba(218,126,76," + a.toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    // 雨天冷色
    if (state && state.weather === "rain") {
      ctx.fillStyle = "rgba(60,76,84,0.09)";
      ctx.fillRect(0, 0, W, H);
    }
    return night;
  }

  function drawLights(night) {
    if (night < 0.15) return;
    lightsForFrame.forEach(function (l) {
      if (l.kind === "window") {
        ctx.globalAlpha = 0.9;
        R(ctx, l.x, l.y, l.w, l.h, l.color);
        ctx.globalAlpha = 0.8;
        R(ctx, l.x + 1, l.y + 1, Math.max(1, l.w - 2), 2, "#ffe7a1");
        // 窗棂
        R(ctx, l.x + Math.floor(l.w / 2), l.y, 1, l.h, "rgba(61,46,30,0.65)");
        R(ctx, l.x, l.y + Math.floor(l.h / 2), l.w, 1, "rgba(61,46,30,0.65)");
        drawGlow(l.x + l.w / 2, l.y + l.h / 2, l.glow || 16, l.color, 0.2 * night);
      } else {
        ctx.globalAlpha = night;
        R(ctx, l.x, l.y, l.w, l.h, l.color);
        ctx.globalAlpha = 1;
        drawGlow(l.x + l.w / 2, l.y + l.h / 2, l.glow || 18, l.color, 0.25 * night);
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawGlow(x, y, r, color, alpha) {
    for (let ring = 3; ring >= 1; ring--) {
      const rr = Math.ceil(r * ring / 3);
      ctx.globalAlpha = alpha * (ring === 1 ? 0.5 : ring === 2 ? 0.2 : 0.1);
      circle(ctx, x, y, rr, color);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------
     标记 / 悬停 / 粒子
     --------------------------------------------------------- */
  function drawMarkers() {
    if (!stateRef || !stateRef.buildings) return;
    D.BUILDINGS.filter(function (b) { return b.scene === "outdoor"; }).forEach(function (b) {
      const bs = stateRef.buildings[b.id];
      if (!bs) return;
      const plot = b.plot;
      const cx = plotCenter(plot);
      if (bs.status === "available") {
        const bob = Math.round(Math.sin(time * 2.2 + plot.x) * 2);
        const y = plot.y + 18 + bob;
        // 绳
        R(ctx, cx, y + 11, 1, 13, "#3b2a1a");
        // 气泡
        R(ctx, cx - 8, y - 10, 17, 18, "#251a12");
        R(ctx, cx - 6, y - 8, 13, 14, CREAM);
        R(ctx, cx - 6, y - 8, 13, 2, "#fff1ce");
        R(ctx, cx - 1, y - 5, 2, 6, "#6d4a2a");
        R(ctx, cx - 1, y + 2, 2, 2, "#6d4a2a");
        R(ctx, cx - 1, y + 9, 3, 2, CREAM);
        R(ctx, cx, y + 11, 1, 1, "#251a12");
        // 闪烁
        const sp = Math.sin(time * 3 + plot.x);
        if (sp > 0.6) {
          R(ctx, cx + 12, y - 8, 2, 1, GOLD_LIGHT);
          R(ctx, cx + 13, y - 9, 1, 3, GOLD_LIGHT);
        }
      } else if (bs.status === "building") {
        const barW = Math.min(72, plot.w - 20);
        const bx = cx - barW / 2;
        const by = plot.y + 12;
        R(ctx, bx - 2, by - 2, barW + 4, 11, "#24180f");
        R(ctx, bx, by, barW, 7, "#d3b98a");
        const fill = Math.round(barW * clamp(bs.progress || 0, 0, 1));
        R(ctx, bx, by, fill, 7, "#c28e3d");
        R(ctx, bx, by, fill, 1, "#efd18b");
        R(ctx, bx - 4, by, 2, 7, "#6a4a2c");
      } else if (bs.status === "built" && b.worker && !(stateRef && stateRef.workers && stateRef.workers[b.worker] && stateRef.workers[b.worker].hired)) {
        const bob = Math.round(Math.sin(time * 1.7 + plot.y) * 1);
        const y = plot.y + 14 + bob;
        R(ctx, cx - 6, y - 6, 13, 10, "#3b2a1a");
        R(ctx, cx - 5, y - 5, 11, 8, "#dfc99c");
        R(ctx, cx - 1, y - 3, 2, 4, "#7e6242");
        R(ctx, cx - 1, y + 2, 2, 2, "#7e6242");
        R(ctx, cx - 2, y + 4, 5, 1, "#3b2a1a");
      }
    });
  }

  function drawHoverHighlight() {
    if (!hover) return;
    if (hover.type === "building") {
      const b = BUILDING_BY_ID[hover.id];
      if (!b) return;
      const p = b.plot;
      const pad = 4;
      const x = p.x - pad, y = p.y - pad, w = p.w + pad * 2, h = p.h + pad * 2;
      ctx.globalAlpha = 0.08;
      R(ctx, x, y, w, h, "#ffe49a");
      ctx.globalAlpha = 1;
      const c = "#f0cf7a";
      const s = 7;
      R(ctx, x, y, s, 2, c); R(ctx, x, y, 2, s, c);
      R(ctx, x + w - s, y, s, 2, c); R(ctx, x + w - 2, y, 2, s, c);
      R(ctx, x, y + h - 2, s, 2, c); R(ctx, x, y + h - s, 2, s, c);
      R(ctx, x + w - s, y + h - 2, s, 2, c); R(ctx, x + w - 2, y + h - s, 2, s, c);
    } else if (hover.type === "worker" || hover.type === "cat" || hover.type === "player") {
      const h = hover;
      R(ctx, h.x + 2, h.y + h.h - 1, h.w - 4, 1, GOLD_LIGHT);
      R(ctx, h.x + 4, h.y + h.h, h.w - 8, 1, "rgba(244,217,136,0.55)");
    }
  }

  function spawnBurst(x, y, colors, count, type) {
    const n = count || 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const sp = 20 + Math.random() * 40;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 15,
        g: 55,
        life: 0.7 + Math.random() * 0.7,
        max: 1.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() < 0.35 ? 2 : 1,
        type: type || "spark"
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= 0.985;
    }
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.type === "heart") {
        R(ctx, p.x - 2, p.y - 2, 2, 2, "#c66658");
        R(ctx, p.x + 1, p.y - 2, 2, 2, "#c66658");
        R(ctx, p.x - 1, p.y, 2, 2, "#d97b68");
        R(ctx, p.x + 1, p.y + 1, 1, 1, "#a94b3c");
      } else {
        R(ctx, p.x, p.y, p.size, p.size, p.color);
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawBellPulse() {
    if (bellPulseT > 1.5) return;
    const k = bellPulseT / 1.5;
    for (let i = 0; i < 3; i++) {
      const r = 8 + k * 70 + i * 9;
      ctx.globalAlpha = (1 - k) * (0.55 - i * 0.12);
      outlineCircle(ctx, 371, 96, r, "#ffe29a", 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawPennantLine(x1, y1, x2, y2, phase) {
    const count = 6;
    for (let i = 0; i <= count; i++) {
      const tt = i / count;
      const x = x1 + (x2 - x1) * tt;
      const y = y1 + (y2 - y1) * tt + Math.sin(tt * Math.PI) * 8;
      R(ctx, x, y, 1, 1, "rgba(240,218,168,0.7)");
      if (i < count) {
        const colors = ["#b65744", "#d8b45e", "#4b6a83", "#5c7a53"];
        R(ctx, x, y + 1, 6, 4, colors[i % colors.length]);
        R(ctx, x, y + 5, 3, 2, colors[i % colors.length]);
      }
    }
  }


  /* ---------------------------------------------------------
     城堡内部
     --------------------------------------------------------- */
  const IN = {
    ink: "#251812",
    wallDark: "#3b2a21",
    wall: "#6b5141",
    wallLight: "#99755d",
    wallHi: "#ba9271",
    floorStone: "#7a6250",
    floorStoneDark: "#614b3d",
    floorWood: "#805c3e",
    floorWoodLight: "#a07650",
    rug: "#8f3932",
    rugLight: "#b15042",
    rugGold: "#d3a44b",
    woodDark: "#3b281b",
    wood: "#6e4a2e",
    woodLight: "#9b6c45",
    gold: "#d6a449",
    candle: "#ffd37a",
    fire: "#f2a144",
    fireLight: "#ffe3a0"
  };

  function interiorArchWall(x, y, w, h) {
    R(ctx, x - 3, y - 3, w + 6, h + 6, "#2a1d17");
    R(ctx, x, y, w, h, IN.wall);
    R(ctx, x, y, w, 3, IN.wallLight);
    R(ctx, x, y, 2, h, IN.wallHi);
    R(ctx, x, y + h - 3, w, 3, IN.wallDark);
    for (let yy = y + 7; yy < y + h - 2; yy += 7) {
      R(ctx, x + 2, yy, w - 4, 1, "rgba(45,31,24,0.32)");
      const off = ((yy / 7) | 0) % 2 ? 6 : 0;
      for (let xx = x + 8 + off; xx < x + w - 4; xx += 14) R(ctx, xx, yy - 5, 1, 5, "rgba(45,31,24,0.2)");
    }
  }

  function interiorStoneFloor(x, y, w, h, tint) {
    const base = tint || IN.floorStone;
    const rng = mulberry32((x * 31 + y * 17) | 0);
    R(ctx, x, y, w, h, base);
    for (let yy = y; yy < y + h; yy += 8) {
      for (let xx = x; xx < x + w; xx += 10) {
        const roll = rng();
        const col = roll < 0.18 ? "#856d59" : roll < 0.35 ? "#6d5746" : roll < 0.5 ? "#7f6653" : base;
        R(ctx, xx + 1, yy + 1, 9, 7, col);
        R(ctx, xx + 1, yy + 1, 9, 1, "rgba(220,196,156,0.1)");
      }
      R(ctx, x, yy, w, 1, "rgba(40,28,21,0.26)");
    }
    R(ctx, x, y, w, 2, "rgba(220,190,150,0.14)");
  }

  function interiorWoodFloor(x, y, w, h) {
    R(ctx, x, y, w, h, IN.floorWood);
    const rng = mulberry32((x * 7 + y * 23) | 0);
    for (let yy = y + 5; yy < y + h; yy += 7) {
      R(ctx, x, yy, w, 1, "rgba(50,32,20,0.4)");
      for (let xx = x + 3; xx < x + w; xx += 9) {
        if (rng() < 0.25) R(ctx, xx, yy - 6, 8, 1, "rgba(210,167,115,0.11)");
      }
      for (let xx = x + 12 + (yy % 14); xx < x + w; xx += 22) R(ctx, xx, yy - 5, 1, 5, "rgba(53,35,22,0.2)");
    }
    R(ctx, x, y, w, 2, IN.floorWoodLight);
  }

  function interiorRug(x, y, w, h) {
    R(ctx, x, y, w, h, "#4a2e24");
    R(ctx, x + 2, y + 2, w - 4, h - 4, IN.rug);
    R(ctx, x + 4, y + 4, w - 8, h - 8, "rgba(220,160,88,0.16)");
    for (let xx = x + 8; xx < x + w - 8; xx += 14) {
      R(ctx, xx, y + 5, 5, 2, "rgba(241,205,137,0.45)");
      R(ctx, xx, y + h - 7, 5, 2, "rgba(241,205,137,0.45)");
    }
  }

  function interiorBed(x, y, w, h, side) {
    R(ctx, x - 2, y - 2, w + 4, h + 4, IN.ink);
    R(ctx, x, y, w, h, IN.wood);
    R(ctx, x, y, w, 2, IN.woodLight);
    R(ctx, x + 2, y + 3, w - 4, h - 6, "#d9c69c");
    R(ctx, x + 3, y + 3, w - 6, h - 11, "#b6c0ab");
    R(ctx, x + 3, y + 3, w - 6, 4, "#e7dcc0");
    R(ctx, x + 2, y + h - 10, w - 4, 7, side === "red" ? "#9c4439" : "#4d6479");
    R(ctx, x + 2, y + h - 5, w - 4, 2, "#6e302a");
    R(ctx, x + 3, y + 5, w - 6, 2, "#f0e6ce");
    R(ctx, x + 1, y - 1, 3, 2, IN.gold);
  }

  function interiorTable(x, y, w, h) {
    R(ctx, x - 1, y - 1, w + 2, h + 2, IN.ink);
    R(ctx, x, y, w, h, IN.wood);
    R(ctx, x, y, w, 2, IN.woodLight);
    R(ctx, x + 2, y + h - 2, w - 4, 1, "#4c301f");
    // 桌上的汤与蜡烛
    R(ctx, x + w * 0.32, y + h * 0.4, 4, 3, "#b88a4f");
    R(ctx, x + w * 0.32 + 1, y + h * 0.28, 2, 2, "#eac578");
    R(ctx, x + w * 0.68, y + h * 0.35, 2, 2, IN.candle);
  }

  function interiorChair(x, y, face) {
    R(ctx, x, y, 9, 10, IN.ink);
    R(ctx, x + 1, y + 1, 7, 8, IN.wood);
    R(ctx, x + 2, y + 2, 5, 2, IN.woodLight);
    if (face === "down") R(ctx, x + 1, y, 7, 2, IN.woodDark);
    if (face === "up") R(ctx, x + 1, y + 8, 7, 2, IN.woodDark);
  }

  function interiorShelf(x, y, w, h) {
    R(ctx, x - 2, y - 2, w + 4, h + 4, IN.ink);
    R(ctx, x, y, w, h, IN.woodDark);
    R(ctx, x + 1, y + 1, w - 2, h - 2, IN.wood);
    for (let yy = y + 5; yy < y + h - 2; yy += 6) {
      R(ctx, x + 2, yy, w - 4, 1, "#3d2718");
      for (let xx = x + 4; xx < x + w - 4; xx += 5) {
        R(ctx, xx, yy - 4, 3, 4, ["#b45142", "#4e6d82", "#d0a34d", "#6c7d54"][(xx + yy) % 4]);
      }
    }
  }

  function interiorBarrel(x, y) {
    R(ctx, x, y, 12, 14, IN.ink);
    R(ctx, x + 1, y + 1, 10, 12, "#8a5c37");
    R(ctx, x + 1, y + 4, 10, 1, "#4c3320");
    R(ctx, x + 1, y + 9, 10, 1, "#4c3320");
    R(ctx, x + 3, y + 2, 2, 9, "#ad7b4d");
  }

  function interiorCrate(x, y, s) {
    R(ctx, x, y, s, s, IN.ink);
    R(ctx, x + 1, y + 1, s - 2, s - 2, "#7d5637");
    R(ctx, x + 1, y + 1, s - 2, 1, "#a77b4d");
    R(ctx, x + 2, y + 2, 1, s - 4, "#5a3b25");
    R(ctx, x + s - 3, y + 2, 1, s - 4, "#5a3b25");
  }

  function interiorSack(x, y) {
    R(ctx, x, y, 11, 9, IN.ink);
    R(ctx, x + 1, y + 1, 9, 7, "#c1aa7d");
    R(ctx, x + 2, y, 7, 3, "#d5bf8e");
    R(ctx, x + 4, y + 2, 3, 1, "#8e744d");
  }

  function interiorCandle(x, y, t, bright) {
    R(ctx, x, y, 3, 7, "#efe1bd");
    R(ctx, x + 1, y - 2, 1, 3, bright ? IN.candle : "#6f6046");
    if (bright) {
      R(ctx, x, y - 1, 2, 1, "#ffecad");
      const flick = Math.sin(t * 7 + x) > 0 ? 1 : 0;
      R(ctx, x + 1, y - 3 - flick, 1, 1, IN.fireLight);
    }
  }

  function interiorFireplace(x, y, w, h, t, lit) {
    R(ctx, x - 3, y - 3, w + 6, h + 6, IN.ink);
    R(ctx, x, y, w, h, "#5f5144");
    R(ctx, x + 2, y + 2, w - 4, h - 4, "#3b3128");
    R(ctx, x + 5, y + 5, w - 10, h - 10, "#211a16");
    R(ctx, x, y, w, 3, "#89735e");
    R(ctx, x - 2, y - 3, 5, 5, "#4d3b2d");
    R(ctx, x + w - 3, y - 3, 5, 5, "#4d3b2d");
    // 柴火
    R(ctx, x + 10, y + h - 13, w - 20, 4, "#4b301e");
    R(ctx, x + 12, y + h - 16, w - 24, 3, "#6a4227");
    if (lit) {
      for (let i = 0; i < 5; i++) {
        const fx = x + 13 + i * ((w - 26) / 4);
        const fh = 6 + (i % 3) * 3 + Math.round(Math.sin(t * 8 + i * 1.7) * 2);
        R(ctx, fx, y + h - 14 - fh, 4, fh, i % 2 ? IN.fire : "#e87936");
        R(ctx, fx + 1, y + h - 14 - fh + 2, 2, Math.max(2, fh - 4), IN.fireLight);
      }
      ctx.globalAlpha = 0.1;
      circle(ctx, x + w / 2, y + h - 7, w * 0.7, IN.fire);
      ctx.globalAlpha = 1;
    }
  }

  function interiorBanner(x, y, w, h, color) {
    R(ctx, x - 1, y - 1, w + 2, h + 2, IN.ink);
    R(ctx, x, y, w, h, color);
    R(ctx, x + 1, y + 1, w - 2, 3, "rgba(255,235,178,0.22)");
    R(ctx, x, y + h, 5, 4, color);
    R(ctx, x + w - 5, y + h, 5, 4, color);
    R(ctx, x + w / 2 - 2, y + 7, 5, 6, IN.gold);
    R(ctx, x + w / 2 - 1, y + 8, 3, 3, "#f1d28a");
  }

  function interiorRubble(x, y, w, h, seed) {
    const rng = mulberry32(seed);
    for (let i = 0; i < 18; i++) {
      const px = x + rng() * w;
      const py = y + rng() * h;
      const s = 2 + Math.floor(rng() * 5);
      R(ctx, px, py, s, s - 1, rng() < 0.5 ? "#4b4137" : "#5d5245");
      R(ctx, px, py, Math.max(1, s - 2), 1, "#7d6e5c");
    }
    for (let i = 0; i < 4; i++) {
      const px = x + 8 + rng() * (w - 22);
      const py = y + 6 + rng() * (h - 16);
      R(ctx, px, py, 16, 3, IN.ink);
      R(ctx, px + 1, py + 1, 14, 1, IN.wood);
    }
  }

  function interiorRoomDark(rect, alpha) {
    ctx.globalAlpha = alpha;
    R(ctx, rect.x, rect.y, rect.w, rect.h, "#0d1119");
    ctx.globalAlpha = 1;
  }

  function interiorPillar(x, y, t) {
    R(ctx, x - 4, y - 4, 24, 24, "#2a1d17");
    R(ctx, x - 2, y - 2, 20, 20, "#806352");
    R(ctx, x - 2, y - 2, 20, 3, "#b18c6b");
    R(ctx, x - 2, y - 2, 3, 20, "#99765c");
    R(ctx, x + 14, y - 2, 4, 20, "#564034");
    R(ctx, x - 2, y + 14, 20, 4, "#4c372b");
    R(ctx, x + 3, y + 3, 10, 2, "#a58365");
    R(ctx, x + 8, y + 6, 2, 2, "#5a4030");
    // 小火把
    R(ctx, x + 6, y + 10, 6, 3, "#3b2a1e");
    R(ctx, x + 8, y + 7, 2, 3, "#5a4030");
    R(ctx, x + 8, y + 5, 2, 2, IN.fire);
    R(ctx, x + 9, y + 4, 1, 1, IN.fireLight);
  }

  function interiorSconce(x, y, t) {
    R(ctx, x - 3, y, 7, 3, "#3b2a1e");
    R(ctx, x - 1, y + 3, 3, 5, "#57402e");
    R(ctx, x, y - 2, 2, 4, IN.candle);
    R(ctx, x, y - 4, 2, 2, IN.fire);
    R(ctx, x + 1, y - 5, 1, 1, IN.fireLight);
  }

  function drawIndoorWindow(x, y, w, h, color) {
    R(ctx, x - 3, y - 3, w + 6, h + 6, "#2b1e17");
    R(ctx, x - 1, y - 1, w + 2, h + 2, "#8e6e52");
    R(ctx, x, y, w, h, "#3b3028");
    R(ctx, x + 3, y + 3, w - 6, h - 6, color || "#e7bd62");
    R(ctx, x + 4, y + 4, w - 8, 3, "#f7e1a3");
    R(ctx, x + Math.floor(w / 2), y + 2, 2, h - 4, "#4b3a2d");
    R(ctx, x + 2, y + Math.floor(h / 2), w - 4, 2, "#4b3a2d");
    R(ctx, x - 1, y, 3, 3, "#c19a64");
    R(ctx, x + w - 2, y, 3, 3, "#c19a64");
  }

  function drawFlowerVase(x, y, t) {
    R(ctx, x, y, 9, 10, IN.ink);
    R(ctx, x + 1, y + 1, 7, 8, "#7a5d44");
    R(ctx, x + 2, y + 2, 5, 3, "#a5825e");
    R(ctx, x + 4, y - 4, 1, 5, "#4e693d");
    R(ctx, x + 2, y - 6, 2, 2, "#d85f54");
    R(ctx, x + 6, y - 7, 2, 2, "#e6c05c");
    R(ctx, x + 4, y - 5, 2, 2, "#e8e0c7");
    if (t) R(ctx, x + 7, y - 2, 1, 1, "#f0d98a");
  }

  function drawChapelWindow(t) {
    // 顶部彩窗，让礼拜堂成为视觉中心
    R(ctx, 326, 12, 68, 34, "#2b1e17");
    R(ctx, 330, 15, 60, 28, "#4d3a2c");
    const cols = ["#b85d50", "#d4a348", "#5a7c92", "#b85d50", "#d4a348"];
    for (let i = 0; i < 5; i++) {
      R(ctx, 334 + i * 11, 18, 9, 22, cols[i]);
      R(ctx, 335 + i * 11, 19, 7, 4, "#f1d897");
      R(ctx, 336 + i * 11, 24, 5, 10, "#f0c56b");
    }
    R(ctx, 362, 15, 4, 28, "#3a2b20");
    R(ctx, 330, 29, 60, 2, "#3a2b20");
    R(ctx, 326, 11, 68, 2, "#9a704f");
    R(ctx, 326, 43, 68, 2, "#5c4030");
    // 拱形
    R(ctx, 338, 8, 44, 5, "#2b1e17");
    R(ctx, 348, 5, 24, 4, "#2b1e17");
  }

  function drawStudy(t, built) {
    const r = { x: 26, y: 28, w: 176, h: 116 };
    interiorWoodFloor(r.x, r.y, r.w, r.h);
    interiorRug(r.x + 58, r.y + 53, 66, 46);
    if (built) {
      interiorShelf(r.x + 6, r.y + 6, 54, 22);
      interiorShelf(r.x + 6, r.y + 32, 26, 44);
      interiorTable(r.x + 76, r.y + 62, 44, 18);
      interiorChair(r.x + 92, r.y + 84, "down");
      interiorCandle(r.x + 103, r.y + 66, t, true);
      interiorCandle(r.x + 52, r.y + 40, t, true);
      drawFlowerVase(r.x + 24, r.y + 94, t);
      // 散落的书
      R(ctx, r.x + 125, r.y + 35, 9, 3, "#a54b3c");
      R(ctx, r.x + 128, r.y + 39, 9, 3, "#4e6d82");
      R(ctx, r.x + 131, r.y + 43, 8, 2, "#d0a34d");
      drawCharacter(ctx, r.x + 148, r.y + 108, WORKER_BY_ID.ink.look, { phase: t * 1.3, staffed: true, role: "scholar", dir: -1, sparkle: true });
    } else {
      interiorRubble(r.x + 20, r.y + 20, r.w - 35, r.h - 38, 501);
      interiorRoomDark(r, 0.58);
      R(ctx, r.x + 44, r.y + 18, 30, 3, IN.woodDark);
      R(ctx, r.x + 48, r.y + 21, 3, 18, IN.woodDark);
    }
  }

  function drawChapel(t, built) {
    const r = { x: 220, y: 28, w: 280, h: 116 };
    interiorStoneFloor(r.x, r.y, r.w, r.h, "#645346");
    interiorRug(r.x + 114, r.y + 14, 52, 98);
    if (built) {
      // 祭坛
      R(ctx, r.x + 116, r.y + 20, 48, 20, IN.ink);
      R(ctx, r.x + 118, r.y + 21, 44, 16, "#d3c196");
      R(ctx, r.x + 122, r.y + 24, 36, 3, "#f2e2bb");
      R(ctx, r.x + 136, r.y + 14, 8, 7, IN.gold);
      R(ctx, r.x + 138, r.y + 16, 4, 3, "#fff0b0");
      interiorCandle(r.x + 121, r.y + 36, t, true);
      interiorCandle(r.x + 157, r.y + 36, t, true);
      // 两侧长椅
      for (let i = 0; i < 3; i++) {
        R(ctx, r.x + 54, r.y + 60 + i * 18, 42, 5, IN.ink);
        R(ctx, r.x + 55, r.y + 61 + i * 18, 40, 3, IN.wood);
        R(ctx, r.x + 55, r.y + 61 + i * 18, 40, 1, IN.woodLight);
        R(ctx, r.x + 186, r.y + 60 + i * 18, 42, 5, IN.ink);
        R(ctx, r.x + 187, r.y + 61 + i * 18, 40, 3, IN.wood);
        R(ctx, r.x + 187, r.y + 61 + i * 18, 40, 1, IN.woodLight);
      }
      // 彩色窗与立柱
      R(ctx, r.x + 125, r.y - 2, 30, 22, "#3a3027");
      for (let i = 0; i < 3; i++) {
        R(ctx, r.x + 128 + i * 8, r.y + 1, 6, 17, ["#b95d51", "#4e6d82", "#d0a34d"][i]);
        R(ctx, r.x + 129 + i * 8, r.y + 2, 4, 4, "#f2dfa5");
      }
      interiorBanner(r.x + 14, r.y + 10, 18, 42, "#8e3731");
      interiorBanner(r.x + r.w - 34, r.y + 10, 18, 42, "#8e3731");
      interiorCandle(r.x + 34, r.y + 50, t, true);
      interiorCandle(r.x + r.w - 36, r.y + 50, t, true);
    } else {
      interiorRubble(r.x + 30, r.y + 24, r.w - 60, r.h - 40, 902);
      interiorRoomDark(r, 0.52);
      R(ctx, r.x + 112, r.y + 25, 54, 3, IN.woodDark);
      R(ctx, r.x + 120, r.y + 28, 3, 20, IN.woodDark);
    }
  }

  function drawBarracks(t, built) {
    const r = { x: 518, y: 28, w: 176, h: 116 };
    interiorStoneFloor(r.x, r.y, r.w, r.h, "#6a594a");
    interiorRug(r.x + 58, r.y + 64, 64, 36);
    if (built) {
      // 武器架与盾
      R(ctx, r.x + 20, r.y + 8, 55, 4, IN.ink);
      for (let i = 0; i < 4; i++) {
        R(ctx, r.x + 24 + i * 12, r.y + 10, 2, 22, "#6e4a2e");
        R(ctx, r.x + 22 + i * 12, r.y + 9, 5, 3, "#a5afa8");
      }
      R(ctx, r.x + 124, r.y + 9, 22, 24, IN.ink);
      R(ctx, r.x + 126, r.y + 11, 18, 20, "#5d6e7a");
      R(ctx, r.x + 130, r.y + 15, 10, 3, "#d6a449");
      interiorBed(r.x + 20, r.y + 62, 38, 44, "red");
      interiorBed(r.x + 122, r.y + 62, 38, 44, "blue");
      interiorCrate(r.x + 77, r.y + 88, 18);
      interiorCandle(r.x + 148, r.y + 44, t, true);
      drawCharacter(ctx, r.x + 158, r.y + 108, WORKER_BY_ID.irondan.look, { phase: t * 1.1, staffed: true, role: "guard", dir: -1, sparkle: true });
    } else {
      interiorRubble(r.x + 18, r.y + 26, r.w - 40, r.h - 44, 1201);
      interiorRoomDark(r, 0.58);
    }
  }

  function drawStoreroom(t, built) {
    const r = { x: 26, y: 158, w: 176, h: 98 };
    interiorStoneFloor(r.x, r.y, r.w, r.h, "#665547");
    if (built) {
      interiorShelf(r.x + 8, r.y + 8, 76, 30);
      interiorShelf(r.x + 8, r.y + 44, 34, 40);
      interiorBarrel(r.x + 112, r.y + 54);
      interiorBarrel(r.x + 128, r.y + 52);
      interiorSack(r.x + 145, r.y + 34);
      interiorSack(r.x + 148, r.y + 46);
      interiorCrate(r.x + 60, r.y + 74, 16);
      interiorCrate(r.x + 80, r.y + 76, 14);
      interiorTable(r.x + 92, r.y + 16, 30, 13);
      interiorCandle(r.x + 108, r.y + 19, t, true);
      drawCharacter(ctx, r.x + 158, r.y + 92, WORKER_BY_ID.goldbell.look, { phase: t * 1.2, staffed: true, role: "market", dir: -1, sparkle: true });
    } else {
      interiorRubble(r.x + 18, r.y + 16, r.w - 36, r.h - 30, 1401);
      interiorRoomDark(r, 0.58);
    }
  }

  function drawKitchen(t, built) {
    const r = { x: 26, y: 272, w: 176, h: 104 };
    interiorStoneFloor(r.x, r.y, r.w, r.h, "#5f5043");
    if (built) {
      interiorFireplace(r.x + 10, r.y + 16, 42, 42, t, true);
      // 大锅
      R(ctx, r.x + 62, r.y + 32, 24, 12, IN.ink);
      R(ctx, r.x + 63, r.y + 33, 22, 9, "#66665c");
      R(ctx, r.x + 66, r.y + 30, 16, 2, "#88867a");
      R(ctx, r.x + 69, r.y + 28, 10, 2, "#3e3e37");
      // 操作台与食材
      interiorTable(r.x + 70, r.y + 58, 68, 26);
      R(ctx, r.x + 81, r.y + 54, 7, 5, "#5d7c4a");
      R(ctx, r.x + 91, r.y + 53, 7, 6, "#c05d4c");
      R(ctx, r.x + 104, r.y + 55, 8, 4, "#d6b55f");
      R(ctx, r.x + 119, r.y + 53, 5, 7, "#d8d0b8");
      // 挂锅
      for (let i = 0; i < 3; i++) {
        R(ctx, r.x + 120 + i * 12, r.y + 22, 7, 3, "#3d3024");
        R(ctx, r.x + 122 + i * 12, r.y + 25, 3, 4, "#7b5a3b");
      }
      interiorBarrel(r.x + 148, r.y + 72);
      interiorCandle(r.x + 144, r.y + 42, t, true);
      drawCharacter(ctx, r.x + 146, r.y + 100, WORKER_BY_ID.pudding.look, { phase: t * 1.4, staffed: true, role: "tavern", dir: -1, sparkle: true });
    } else {
      interiorRubble(r.x + 18, r.y + 20, r.w - 36, r.h - 34, 1601);
      interiorRoomDark(r, 0.58);
    }
  }

  function drawHall(t) {
    const r = { x: 220, y: 158, w: 280, h: 218 };
    interiorStoneFloor(r.x, r.y, r.w, r.h, "#6b5a4b");
    interiorRug(r.x + 54, r.y + 66, 172, 132);
    // 壁炉
    interiorFireplace(r.x + 108, r.y + 3, 64, 34, t, true);
    // 纹章与旗帜
    R(ctx, r.x + 132, r.y + 8, 16, 18, "#4e3a25");
    R(ctx, r.x + 134, r.y + 10, 12, 14, IN.gold);
    R(ctx, r.x + 138, r.y + 13, 4, 6, "#8e3731");
    interiorBanner(r.x + 30, r.y + 16, 20, 48, "#8e3731");
    interiorBanner(r.x + 230, r.y + 16, 20, 48, "#8e3731");
    // 长桌与椅子
    R(ctx, r.x + 78, r.y + 104, 124, 38, "rgba(37,24,15,0.22)");
    interiorTable(r.x + 80, r.y + 102, 120, 36);
    for (let i = 0; i < 4; i++) {
      interiorChair(r.x + 76, r.y + 104 + i * 10, "right");
      interiorChair(r.x + 202, r.y + 104 + i * 10, "left");
    }
    interiorChair(r.x + 104, r.y + 88, "down");
    interiorChair(r.x + 166, r.y + 88, "down");
    interiorCandle(r.x + 118, r.y + 110, t, true);
    interiorCandle(r.x + 160, r.y + 110, t, true);
    // 餐具与花
    for (let i = 0; i < 4; i++) {
      R(ctx, r.x + 92 + i * 24, r.y + 112, 7, 4, "#d7c69d");
      R(ctx, r.x + 94 + i * 24, r.y + 111, 3, 1, "#f1e3b6");
      R(ctx, r.x + 100 + i * 24, r.y + 115, 2, 2, "#9b6b36");
    }
    drawFlowerVase(r.x + 150, r.y + 92, t);
    drawFlowerVase(r.x + 42, r.y + 150, t);
    // 书架与盔甲
    interiorShelf(r.x + 14, r.y + 82, 40, 42);
    R(ctx, r.x + 244, r.y + 88, 7, 30, "#3b3026");
    R(ctx, r.x + 240, r.y + 108, 15, 8, "#777f7a");
    R(ctx, r.x + 242, r.y + 117, 11, 15, "#5d6664");
    R(ctx, r.x + 245, r.y + 126, 5, 11, "#4e5754");
    R(ctx, r.x + 247, r.y + 94, 2, 15, "#9a6a3f");
    R(ctx, r.x + 244, r.y + 92, 7, 3, "#b9b7a5");
    // 吊灯
    R(ctx, r.x + 137, r.y + 58, 2, 14, "#3f3122");
    R(ctx, r.x + 120, r.y + 68, 40, 2, "#3f3122");
    for (let i = 0; i < 5; i++) {
      R(ctx, r.x + 123 + i * 8, r.y + 66, 2, 4, IN.candle);
      R(ctx, r.x + 123 + i * 8, r.y + 64, 2, 1, IN.fireLight);
    }
    // 大门
    R(ctx, r.x + 92, r.y + 188, 56, 30, "#2a1d16");
    R(ctx, r.x + 96, r.y + 190, 48, 28, "#5b3d26");
    R(ctx, r.x + 100, r.y + 192, 40, 2, "#8b623b");
    for (let i = 0; i < 4; i++) R(ctx, r.x + 99 + i * 12, r.y + 194, 2, 24, "#452f1e");
    R(ctx, r.x + 118, r.y + 208, 3, 3, IN.gold);
    // 火把
    R(ctx, r.x + 84, r.y + 176, 2, 14, "#3d3024");
    R(ctx, r.x + 80, r.y + 170, 9, 7, "#3d3024");
    R(ctx, r.x + 83, r.y + 172, 3, 3, IN.fire);
    R(ctx, r.x + 154, r.y + 176, 2, 14, "#3d3024");
    R(ctx, r.x + 150, r.y + 170, 9, 7, "#3d3024");
    R(ctx, r.x + 153, r.y + 172, 3, 3, IN.fire);
    // 主角与猫
    drawCharacter(ctx, 449, 360, D.NPCS.player.look, { phase: t * 1.4, staffed: false, role: "player", dir: -1 });
    drawCat(292, 361, t);
  }

  function drawBedroom(t) {
    const r = { x: 518, y: 158, w: 176, h: 98 };
    interiorWoodFloor(r.x, r.y, r.w, r.h);
    interiorRug(r.x + 38, r.y + 58, 100, 30);
    // 四柱床
    R(ctx, r.x + 12, r.y + 14, 50, 52, IN.ink);
    R(ctx, r.x + 14, r.y + 16, 46, 48, IN.wood);
    R(ctx, r.x + 16, r.y + 20, 42, 40, "#d9c69c");
    R(ctx, r.x + 17, r.y + 34, 40, 24, "#9c4439");
    R(ctx, r.x + 19, r.y + 18, 36, 7, "#e8ddc4");
    R(ctx, r.x + 12, r.y + 10, 4, 58, IN.woodDark);
    R(ctx, r.x + 58, r.y + 10, 4, 58, IN.woodDark);
    R(ctx, r.x + 12, r.y + 8, 50, 4, "#3c2a1d");
    // 梳妆台与浴桶
    interiorShelf(r.x + 76, r.y + 12, 30, 24);
    R(ctx, r.x + 118, r.y + 46, 26, 18, IN.ink);
    R(ctx, r.x + 119, r.y + 47, 24, 15, "#806b56");
    R(ctx, r.x + 122, r.y + 49, 18, 4, "#9cac9d");
    interiorCandle(r.x + 150, r.y + 30, t, true);
    interiorCandle(r.x + 48, r.y + 70, t, true);
    drawCat(r.x + 146, r.y + 82, t);
  }

  function drawQuarters(t) {
    const r = { x: 518, y: 272, w: 176, h: 104 };
    interiorStoneFloor(r.x, r.y, r.w, r.h, "#665648");
    interiorRug(r.x + 44, r.y + 54, 92, 34);
    interiorBed(r.x + 16, r.y + 14, 34, 38, "blue");
    interiorBed(r.x + 130, r.y + 14, 34, 38, "red");
    interiorChest(r.x + 76, r.y + 24);
    interiorBarrel(r.x + 148, r.y + 72);
    interiorCandle(r.x + 97, r.y + 42, t, true);
    drawCat(r.x + 68, r.y + 92, t);
  }

  function interiorChest(x, y) {
    R(ctx, x, y, 24, 15, IN.ink);
    R(ctx, x + 1, y + 1, 22, 13, "#7d5637");
    R(ctx, x + 2, y + 2, 20, 4, "#a1794d");
    R(ctx, x + 2, y + 6, 20, 1, "#4e3420");
    R(ctx, x + 11, y + 5, 3, 6, IN.gold);
  }

  function drawInteriorDust(t) {
    for (let i = 0; i < 28; i++) {
      const x = 80 + ((i * 97 + t * (2 + i % 3)) % 570);
      const y = 50 + ((i * 53 + Math.sin(t * 0.4 + i) * 20) % 300);
      ctx.globalAlpha = 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.4 + i));
      R(ctx, x, y, 1, 1, "#f1dfb3");
    }
    ctx.globalAlpha = 1;
  }

  function drawInteriorVignette() {
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.025 * (5 - i);
      R(ctx, i * 8, 0, 1, H, "#090604");
      R(ctx, W - i * 8 - 1, 0, 1, H, "#090604");
      R(ctx, 0, i * 8, W, 1, "#090604");
      R(ctx, 0, H - i * 8 - 1, W, 1, "#090604");
    }
    ctx.globalAlpha = 1;
  }

  function maskedLook(type) {
    return {
      skin: "#d8ae86", skinShade: "#b88763", hair: "#3b2a22", hairShade: "#2a1d17",
      hat: "none", hatColor: type.mask, hatShade: "#3b2a21",
      clothes: type.mask, clothesShade: "#4a3c31", accent: "#d6a44a",
      beard: false, glasses: false, blush: false
    };
  }

  function drawMaskedResident(x, y, type, t, phase) {
    const look = maskedLook(type);
    drawCharacter(ctx, x, y, look, { phase: t * 1.3 + phase, staffed: false, role: type.id, dir: Math.sin(t * 0.4 + phase) > 0 ? 1 : -1 });
    // 面具覆盖在脸上
    R(ctx, x - 4, y - 20, 9, 5, "#251812");
    R(ctx, x - 3, y - 19, 7, 4, type.mask);
    R(ctx, x - 2, y - 18, 1, 1, "#2b1c13");
    R(ctx, x + 2, y - 18, 1, 1, "#2b1c13");
    R(ctx, x - 1, y - 16, 3, 1, "rgba(50,30,20,0.65)");
    R(ctx, x - 2, y - 22, 5, 1, "#d6a449");
    R(ctx, x + 4, y - 21, 2, 5, "#6d4e34");
  }

  function expansionRoomSlot(floorIndex, typeId) {
    if (!stateRef || !stateRef.expansionFloors) return null;
    const rooms = stateRef.expansionFloors[floorIndex] || {};
    for (let i = 0; i < D.EXPANSION_SLOTS.length; i++) {
      const slot = D.EXPANSION_SLOTS[i];
      const room = rooms[slot.id];
      if (room && room.type === typeId) return slot;
    }
    return null;
  }

  function drawGuestSprite(x, y, r, t, phase) {
    const klass = r.klass || "resident";
    if (klass === "resident") {
      const type = D.MASK_TYPES.filter(function (m) { return m.id === r.type; })[0] || D.MASK_TYPES[0];
      drawMaskedResident(x, y, type, t, phase);
      return;
    }
    const configs = {
      soldier: {
        look: { skin: "#c98e63", skinShade: "#a16b47", hair: "#3b2a22", hairShade: "#2a1d17", hat: "helmet", hatColor: "#8d9495", hatShade: "#5f6868", clothes: "#59616c", clothesShade: "#3d454f", accent: "#a54a3c", beard: "brown", glasses: false, blush: false },
        role: "guard"
      },
      minister: {
        look: { skin: "#dfa77d", skinShade: "#b97d55", hair: "#4a3527", hairShade: "#30251d", hat: "beret", hatColor: "#71556f", hatShade: "#4c3a4d", clothes: "#8a6b3c", clothesShade: "#5f4928", accent: "#d3b35e", beard: false, glasses: true, blush: true },
        role: "scholar"
      },
      missionary: {
        look: { skin: "#e0b083", skinShade: "#b88763", hair: "#4a3527", hairShade: "#30251d", hat: "hood", hatColor: "#6a5b3e", hatShade: "#4a3f2b", clothes: "#7a6848", clothesShade: "#554830", accent: "#d6a449", beard: false, glasses: false, blush: false },
        role: "merchant"
      }
    };
    const cfg = configs[klass] || configs.resident;
    drawCharacter(ctx, x, y, cfg.look, { phase: t * 1.2 + phase, staffed: false, role: cfg.role, dir: Math.sin(t * 0.4 + phase) > 0 ? 1 : -1 });
    const classColors = { resident: "#d6a449", soldier: "#aeb3a7", minister: "#b08caf", missionary: "#f0d28a" };
    R(ctx, x - 3, y - 28, 7, 3, "rgba(24,16,11,.8)");
    R(ctx, x - 1, y - 27, 3, 2, classColors[klass] || classColors.resident);
    // 职业小道具
    if (klass === "soldier") {
      R(ctx, x - 11, y - 13, 2, 15, "#3b2a1a");
      R(ctx, x - 13, y - 15, 6, 4, "#aeb3a7");
      R(ctx, x + 8, y - 10, 4, 9, "#6f7d8b");
      R(ctx, x + 9, y - 9, 2, 5, "#d6a449");
    } else if (klass === "minister") {
      R(ctx, x - 8, y - 10, 7, 9, "#e2d3b4");
      R(ctx, x - 6, y - 8, 3, 1, "#8b6b43");
      R(ctx, x - 6, y - 5, 3, 1, "#8b6b43");
      R(ctx, x + 6, y - 16, 2, 6, "#d3b35e");
    } else if (klass === "missionary") {
      R(ctx, x - 1, y - 18, 2, 8, "#d6a449");
      R(ctx, x - 4, y - 15, 8, 2, "#d6a449");
    }
  }

  function drawMaskedWanderers(t, mode) {
    if (!stateRef || !stateRef.genericResidents || !stateRef.genericResidents.length) return;
    const guests = mode === "expansion"
      ? stateRef.genericResidents.filter(function (r) { return (r.floor || 0) === (stateRef.currentFloor || 0); })
      : stateRef.genericResidents;
    guests.slice(0, mode === "expansion" ? 14 : 5).forEach(function (r, i) {
      const klass = r.klass || "resident";
      let x, y;
      if (mode === "expansion") {
        const prefs = klass === "soldier" ? ["armory"] : klass === "minister" ? ["meeting", "study"] : klass === "missionary" ? ["chapel"] : ["guest", "dining"];
        let slot = null;
        for (let p = 0; p < prefs.length && !slot; p++) slot = expansionRoomSlot(stateRef.currentFloor || 0, prefs[p]);
        if (slot) {
          x = slot.x + 22 + (i % 3) * Math.max(16, (slot.w - 44) / 2) + Math.sin(t * 0.45 + i * 1.7) * 6;
          y = slot.y + slot.h - 20 + Math.sin(t * 0.8 + i) * 2;
        } else {
          x = 60 + (i % 7) * 88 + Math.sin(t * 0.25 + i * 1.7) * 12;
          y = 196 + (i % 2) * 20;
        }
      } else {
        x = 300 + (i % 3) * 42 + Math.sin(t * 0.32 + i * 2.1) * 14;
        y = 330 - (i % 2) * 12;
      }
      drawGuestSprite(x, y, r, t, i * 2.3);
    });
  }

  function floorSkinData(id) {
    const skins = {
      stone: { base: "#6e5a49", a: "#766252", b: "#615244", corridor: "#4b2f26", runner: "#8c3f34", accent: "#d6a449", name: "灰石砖" },
      wood: { base: "#7c5939", a: "#8b653f", b: "#69492d", corridor: "#5b422a", runner: "#4e6b42", accent: "#c9a24e", name: "暖木地板" },
      checker: { base: "#8f8677", a: "#d2c6ad", b: "#4e4942", corridor: "#3f3a34", runner: "#6d5b74", accent: "#d6d0bd", name: "黑白棋盘" },
      moss: { base: "#64705a", a: "#718061", b: "#526048", corridor: "#3f4b3b", runner: "#5b7c4a", accent: "#a7bd76", name: "青苔石砖" },
      royal: { base: "#6f4e4b", a: "#8e5a51", b: "#3d2e31", corridor: "#3a1f26", runner: "#8f2f3d", accent: "#d6a449", name: "皇家红石" }
    };
    return skins[id] || skins.stone;
  }

  function drawSkinFloorBase(x, y, w, h, skin) {
    const p = floorSkinData(skin);
    R(ctx, x, y, w, h, p.base);
    const step = skin === "checker" ? 14 : 12;
    for (let yy = y; yy < y + h; yy += step) {
      for (let xx = x; xx < x + w; xx += step) {
        const odd = ((Math.floor((xx - x) / step) + Math.floor((yy - y) / step)) % 2) === 0;
        if (skin === "checker") R(ctx, xx, yy, step - 1, step - 1, odd ? p.a : p.b);
        else if (skin === "wood") {
          if (Math.floor((yy - y) / 5) !== Math.floor((yy - y - 1) / 5)) R(ctx, xx, yy, step, 1, p.b);
        } else if (skin === "moss") {
          if ((xx + yy) % 23 === 0) R(ctx, xx, yy, 4, 3, p.accent);
          else if (odd) R(ctx, xx, yy, step, 1, "rgba(90,110,80,.16)");
        } else if (skin === "royal") {
          R(ctx, xx, yy, step, 1, odd ? "rgba(214,164,73,.18)" : "rgba(45,30,32,.2)");
          if ((xx + yy) % 29 === 0) R(ctx, xx, yy, 3, 3, "#c39a51");
        } else {
          if (odd) R(ctx, xx, yy, step, 1, "rgba(45,35,28,.12)");
        }
      }
    }
  }

  function drawSkinRoomOverlay(skin, x, y, w, h, alpha) {
    if (skin === "stone") return;
    ctx.save();
    ctx.globalAlpha = alpha || 0.28;
    const p = floorSkinData(skin);
    if (skin === "checker") {
      for (let yy = y; yy < y + h; yy += 14) for (let xx = x; xx < x + w; xx += 14) {
        const odd = ((Math.floor((xx - x) / 14) + Math.floor((yy - y) / 14)) % 2) === 0;
        R(ctx, xx, yy, 13, 13, odd ? p.a : p.b);
      }
    } else if (skin === "wood") {
      R(ctx, x, y, w, h, "rgba(180,120,60,.14)");
      for (let yy = y; yy < y + h; yy += 7) R(ctx, x, yy, w, 1, "rgba(70,40,20,.3)");
    } else if (skin === "moss") {
      R(ctx, x, y, w, h, "rgba(94,126,78,.2)");
      for (let i = 0; i < 8; i++) R(ctx, x + (i * 37) % w, y + (i * 23) % h, 5, 3, "rgba(150,175,105,.28)");
    } else if (skin === "royal") {
      R(ctx, x, y, w, h, "rgba(120,45,50,.18)");
      for (let yy = y; yy < y + h; yy += 10) R(ctx, x, yy, w, 1, "rgba(214,164,73,.22)");
    }
    ctx.restore();
  }

  function drawRoomUpgradeFurniture(type, level, x, y, w, h, t) {
    if (level <= 1) return;
    const cx = x + w / 2;
    // 地毯：二级起明显出现
    const rug = type.id === "chapel" ? "#6d5b74" : type.id === "armory" ? "#6d4a39" : "#8a4c3c";
    R(ctx, x + 7, y + h - 26, w - 14, 13, "#3d2a1c");
    R(ctx, x + 9, y + h - 24, w - 18, 9, rug);
    R(ctx, x + 11, y + h - 22, w - 22, 1, "rgba(242,208,135,.55)");
    // 盆栽
    R(ctx, x + w - 22, y + 14, 10, 8, "#a86e43");
    R(ctx, x + w - 21, y + 11, 8, 7, "#61834e");
    R(ctx, x + w - 18, y + 8, 4, 5, "#7a9b5d");
    // 边桌与烛台
    R(ctx, x + 8, y + 24, 13, 3, "#5a3d25");
    R(ctx, x + 9, y + 27, 2, 9, "#4a3220");
    R(ctx, x + 18, y + 27, 2, 9, "#4a3220");
    R(ctx, x + 13, y + 17, 2, 7, "#d9c18e");
    R(ctx, x + 12, y + 15, 4, 3, "#f2c56d");
    if (level >= 3) {
      // 三级：吊灯、壁旗、柜子
      R(ctx, cx - 13, y + 7, 26, 2, "#4a3220");
      for (let i = 0; i < 4; i++) {
        R(ctx, cx - 11 + i * 7, y + 9, 2, 6, "#6e4a2c");
        R(ctx, cx - 12 + i * 7, y + 15, 4, 2, "#f2c56d");
      }
      R(ctx, x + 7, y + 10, 2, 18, "#3b2a1a");
      R(ctx, x + 9, y + 11, 12, 12, type.id === "chapel" ? "#8d668c" : "#a54a3c");
      R(ctx, x + 11, y + 13, 8, 8, type.id === "chapel" ? "#d9c18e" : "#e0b05a");
      R(ctx, x + w - 26, y + h - 45, 18, 17, "#5b3e29");
      R(ctx, x + w - 24, y + h - 43, 14, 5, "#8a623b");
    }
    // 容量房：升级后多出床
    if (type.capacity) {
      const extra = level - 1;
      for (let i = 0; i < extra; i++) {
        const bx = x + 8 + i * 28;
        const by = y + 42 + (i % 2) * 9;
        if (bx + 26 > x + w - 8) break;
        R(ctx, bx, by, 25, 13, "#3b2a1a");
        R(ctx, bx + 2, by + 2, 21, 9, "#b89a6e");
        R(ctx, bx + 4, by + 3, 12, 3, "#eee2c4");
        R(ctx, bx + 2, by + 9, 21, 2, type.id === "soldier_quarters" ? "#59616c" : "#8a4c3c");
        R(ctx, bx - 2, by + 16, 2, 4, "#5b3e29");
      }
    } else if (type.defense) {
      // 武器架
      R(ctx, x + w - 30, y + 38, 3, 28, "#4a3220");
      R(ctx, x + w - 24, y + 40, 18, 2, "#8b6e48");
      R(ctx, x + w - 20, y + 42, 2, 18, "#9aa0a0");
      R(ctx, x + w - 14, y + 42, 2, 20, "#9aa0a0");
    } else if (type.id === "library" || type.id === "study" || type.id === "minister_office") {
      R(ctx, x + 7, y + h - 58, 26, 20, "#5b3e29");
      for (let i = 0; i < 3; i++) R(ctx, x + 9, y + h - 55 + i * 6, 21, 1, "#c9a26a");
    }
  }

  function drawRoomLevelDecor(level, x, y, w, h, t) {
    if (!level || level <= 1) return;
    // 升级后的金边、地毯与烛光
    R(ctx, x + 4, y + 3, w - 8, 2, level >= 3 ? "#e6c675" : "#a98b5d");
    R(ctx, x + 4, y + 5, w - 8, 1, "rgba(255,240,190,.25)");
    if (level >= 2) {
      interiorCandle(x + 12, y + h - 14, t, true);
      interiorCandle(x + w - 16, y + h - 14, t, true);
      drawGlow(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, "#ffb45e", 0.08);
    }
    if (level >= 3) {
      R(ctx, x + w - 18, y + 8, 4, 4, "#d6a449");
      R(ctx, x + w - 16, y + 6, 1, 2, "#ffe5a0");
      R(ctx, x + 7, y + 8, 3, 10, "#8e3731");
      R(ctx, x + 8, y + 9, 1, 8, "#f0d28a");
    }
  }

  function drawExpansionRoom(type, slot, t, level, skin) {
    const x = slot.x, y = slot.y, w = slot.w, h = slot.h;
    R(ctx, x - 4, y - 4, w + 8, h + 8, "#2a1d17");
    R(ctx, x - 2, y - 2, w + 4, h + 4, "#695242");
    R(ctx, x, y, w, h, "#6e5a49");
    R(ctx, x, y, w, 2, "#a48569");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (!type) {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#5c4b3e");
      interiorRubble(x + 18, y + 18, w - 36, h - 32, slot.x * 17 + slot.y);
      interiorRoomDark({ x: x + 4, y: y + 4, w: w - 8, h: h - 8 }, 0.42);
      R(ctx, x + 12, y + 10, 2, h - 20, "#3d2c1e");
      R(ctx, x + 13, y + 11, 1, h - 22, "#876445");
      drawSkinRoomOverlay(skin, x, y, w, h);
      ctx.restore();
      return;
    }
    if (w < 100) {
      // 小型位：紧凑家具，避免被裁切成碎片
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#625347");
      const cx = x + w / 2;
      if (type.id === "toilet") {
        R(ctx, cx - 13, y + 22, 26, 48, "#d9d5c7");
        R(ctx, cx - 10, y + 28, 20, 16, "#f3eedf");
        R(ctx, cx - 8, y + 46, 16, 16, "#b7b3a6");
        R(ctx, cx - 5, y + 38, 10, 4, "#9d9a8e");
        R(ctx, cx - 10, y + 20, 20, 3, "#5d5347");
      } else if (type.id === "dining") {
        R(ctx, cx - 22, y + 38, 44, 16, "#3b2a1a");
        R(ctx, cx - 20, y + 39, 40, 12, "#8a623b");
        R(ctx, cx - 24, y + 40, 5, 12, "#5b4029");
        R(ctx, cx + 19, y + 40, 5, 12, "#5b4029");
        R(ctx, cx - 2, y + 32, 6, 5, "#d6a449");
        interiorCandle(cx + 14, y + 34, t, true);
      } else if (type.id === "garden") {
        R(ctx, cx - 25, y + 24, 50, 24, "#3c2a1d");
        R(ctx, cx - 24, y + 25, 48, 21, "#4f633b");
        for (let i = 0; i < 3; i++) {
          R(ctx, cx - 18 + i * 14, y + 28, 2, 8, "#5d7c4a");
          R(ctx, cx - 19 + i * 14, y + 26, 4, 4, i % 2 ? "#d4a44b" : "#c15c4f");
        }
        drawFlowerVase(cx - 8, y + 80, t);
      } else if (type.id === "missionary_cell") {
        interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#6b6052");
        R(ctx, cx - 24, y + 26, 44, 24, "#3b2a1a");
        R(ctx, cx - 22, y + 28, 40, 20, "#6b4c30");
        R(ctx, cx - 18, y + 32, 24, 12, "#d8d3c2");
        R(ctx, cx - 16, y + 33, 20, 3, "#efe5cc");
        R(ctx, cx - 18, y + 44, 24, 2, "#5b7b9d");
        R(ctx, cx + 16, y + 26, 2, 14, "#d6a449");
        R(ctx, cx + 13, y + 30, 8, 2, "#d6a449");
        interiorCandle(cx - 2, y + 64, t, true);
      } else if (type.id === "residence") {
        interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
        R(ctx, cx - 24, y + 24, 48, 26, "#3b2a1a");
        R(ctx, cx - 22, y + 26, 44, 22, "#6b4c30");
        R(ctx, cx - 18, y + 30, 26, 14, "#d8d3c2");
        R(ctx, cx - 16, y + 31, 22, 3, "#efe5cc");
        R(ctx, cx - 18, y + 44, 26, 2, "#a35f4e");
        R(ctx, cx + 12, y + 30, 8, 10, "#8a623b");
        R(ctx, cx - 16, y + 62, 32, 4, "#a87a45");
        drawFlowerVase(cx + 20, y + 62, t);
      } else if (type.id === "workshop") {
        R(ctx, cx - 26, y + 36, 48, 16, "#3b2a1a");
        R(ctx, cx - 24, y + 37, 44, 12, "#8a623b");
        R(ctx, cx - 14, y + 30, 3, 18, "#3b2a1c");
        R(ctx, cx - 5, y + 28, 12, 4, "#7d8580");
        R(ctx, cx + 10, y + 30, 2, 18, "#3b2a1c");
        interiorCandle(cx + 18, y + 50, t, true);
      } else if (type.id === "library") {
        R(ctx, cx - 25, y + 20, 50, 28, "#3b2a1c");
        R(ctx, cx - 22, y + 23, 44, 4, "#d8d3c2");
        for (let i = 0; i < 4; i++) R(ctx, cx - 19 + i * 10, y + 24, 4, 6, ["#a35f4e", "#5b7b9d", "#748f5b", "#d6a449"][i]);
        R(ctx, cx - 18, y + 58, 34, 14, "#8a623b");
        interiorCandle(cx + 18, y + 48, t, true);
      } else if (type.id === "bath") {
        R(ctx, cx - 26, y + 36, 52, 20, "#3b2a1a");
        R(ctx, cx - 24, y + 38, 48, 16, "#d8d3c2");
        R(ctx, cx - 20, y + 40, 40, 4, "#eef3ef");
        R(ctx, cx - 12, y + 30, 1, 6, "#bfc9bd");
        R(ctx, cx, y + 28, 1, 8, "#bfc9bd");
        R(ctx, cx + 12, y + 30, 1, 6, "#bfc9bd");
      } else {
        R(ctx, cx - 22, y + 38, 44, 15, "#3b2a1c");
        R(ctx, cx - 20, y + 39, 40, 11, "#8a623b");
      }
      R(ctx, x + 4, y + 4, w - 8, 2, "#a48569");
      drawSkinRoomOverlay(skin, x, y, w, h);
      drawRoomUpgradeFurniture(type, level, x, y, w, h, t);
      drawRoomLevelDecor(level, x, y, w, h, t);
      ctx.restore();
      return;
    }
    if (type.id === "toilet") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#7a8178");
      // 两个隔间
      for (let i = 0; i < 2; i++) {
        const px = x + 18 + i * 58;
        R(ctx, px, y + 16, 44, 54, "#4a4139");
        R(ctx, px + 2, y + 18, 40, 50, "#d9d5c7");
        R(ctx, px + 9, y + 30, 22, 22, "#b7b3a6");
        R(ctx, px + 12, y + 33, 16, 6, "#f3eedf");
        R(ctx, px + 12, y + 40, 16, 8, "#9d9a8e");
        R(ctx, px + 6, y + 62, 30, 3, "#6f6a5e");
      }
      R(ctx, x + 122, y + 72, 24, 16, "#5d5347");
      R(ctx, x + 126, y + 68, 16, 5, "#e7e0ce");
      R(ctx, x + 128, y + 66, 2, 7, "#8d897e");
      interiorCandle(x + 136, y + 46, t, true);
    } else if (type.id === "bath") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#71847e");
      interiorRug(x + 18, y + 56, w - 36, 40);
      interiorTable(x + 34, y + 28, 92, 24, "stone");
      R(ctx, x + 40, y + 24, 4, 22, "#3b2a1c");
      R(ctx, x + 116, y + 24, 4, 22, "#3b2a1c");
      R(ctx, x + 52, y + 12, 1, 14, "#bfc9bd");
      R(ctx, x + 82, y + 8, 1, 18, "#bfc9bd");
      R(ctx, x + 108, y + 14, 1, 12, "#bfc9bd");
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.35 + Math.sin(t * 1.5 + i) * 0.1;
        circle(ctx, x + 58 + i * 18, y + 8 + Math.sin(t * 2 + i) * 3, 1.5, "#e1eadf");
        ctx.globalAlpha = 1;
      }
      drawFlowerVase(x + 18, y + 84, t);
      interiorCandle(x + 136, y + 40, t, true);
    } else if (type.id === "dorm") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      // 四张上下铺
      for (let i = 0; i < 4; i++) {
        const px = x + 10 + (i % 2) * 76;
        const py = y + 18 + Math.floor(i / 2) * 38;
        R(ctx, px, py, 68, 30, "#3b2a1c");
        R(ctx, px + 2, py + 2, 64, 26, "#6b4c30");
        R(ctx, px + 6, py + 8, 26, 18, "#d8d3c2");
        R(ctx, px + 8, py + 9, 22, 4, "#efe5cc");
        R(ctx, px + 6, py + 22, 26, 2, "#a35f4e");
        R(ctx, px + 38, py + 8, 24, 18, "#c9c2af");
        R(ctx, px + 40, py + 9, 20, 4, "#e8dfc8");
        R(ctx, px + 38, py + 22, 24, 2, "#5b7a50");
      }
      R(ctx, x + 150, y + 10, 2, 20, "#3b2a1c");
      R(ctx, x + 144, y + 8, 12, 9, "#e2c58d");
      R(ctx, x + 147, y + 11, 6, 2, "#7a5a38");
    } else if (type.id === "library") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      interiorShelf(x + 14, y + 14, 58, 34);
      interiorShelf(x + 90, y + 14, 58, 34);
      interiorTable(x + 35, y + 60, 92, 20);
      interiorChair(x + 28, y + 64, "right");
      interiorChair(x + 132, y + 64, "left");
      R(ctx, x + 58, y + 54, 18, 5, "#efe5cc");
      R(ctx, x + 62, y + 49, 10, 5, "#c15c4f");
      interiorCandle(x + 78, y + 50, t, true);
      drawFlowerVase(x + 18, y + 88, t);
    } else if (type.id === "guest") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      interiorBed(x + 12, y + 22, 40, 52, "blue");
      interiorBed(x + 94, y + 22, 40, 52, "red");
      interiorRug(x + 45, y + 58, 68, 28);
      interiorCandle(x + 80, y + 38, t, true);
      interiorShelf(x + 58, y + 14, 40, 18);
      drawFlowerVase(x + 14, y + 86, t);
    } else if (type.id === "dining") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#6a5747");
      interiorTable(x + 28, y + 42, 104, 28);
      for (let i = 0; i < 4; i++) {
        interiorChair(x + 20, y + 44 + i * 10, "right");
        interiorChair(x + 136, y + 44 + i * 10, "left");
      }
      interiorCandle(x + 62, y + 44, t, true);
      interiorCandle(x + 100, y + 44, t, true);
      interiorCandle(x + 80, y + 30, t, true);
      for (let i = 0; i < 4; i++) {
        R(ctx, x + 39 + i * 22, y + 48, 7, 3, "#d7c69d");
        R(ctx, x + 42 + i * 22, y + 47, 2, 1, "#f1e3b6");
      }
    } else if (type.id === "workshop") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      interiorTable(x + 24, y + 30, 60, 22);
      R(ctx, x + 34, y + 24, 4, 18, "#3b2a1c");
      R(ctx, x + 41, y + 22, 4, 20, "#3b2a1c");
      R(ctx, x + 49, y + 28, 11, 4, "#7d8580");
      interiorShelf(x + 98, y + 14, 52, 30);
      interiorBarrel(x + 136, y + 75);
      interiorCrate(x + 26, y + 76, 18);
      interiorCrate(x + 48, y + 82, 14);
      R(ctx, x + 84, y + 80, 24, 3, "#4b3725");
      R(ctx, x + 94, y + 68, 3, 15, "#4b3725");
      interiorCandle(x + 70, y + 56, t, true);
    } else if (type.id === "garden") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#5f6b4f");
      interiorRug(x + 52, y + 52, 58, 30);
      for (let i = 0; i < 3; i++) {
        const px = x + 12 + i * 36;
        R(ctx, px, y + 18, 28, 26, "#3c2a1d");
        R(ctx, px + 1, y + 19, 26, 23, "#4f633b");
        for (let j = 0; j < 4; j++) {
          R(ctx, px + 5 + (j % 2) * 10, y + 24 + Math.floor(j / 2) * 8, 2, 4, "#5d7c4a");
          R(ctx, px + 4 + (j % 2) * 10, y + 22 + Math.floor(j / 2) * 8, 4, 3, ["#d4a44b", "#c15c4f", "#e4dac0", "#93a6c8"][j]);
        }
      }
      drawFlowerVase(x + 20, y + 84, t);
      drawFlowerVase(x + 132, y + 84, t);
      drawBush(ctx, x + 82, y + 82, 0.7, "green");
    } else if (type.id === "residence") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      interiorBed(x + 12, y + 20, 42, 52, "red");
      interiorRug(x + 56, y + 56, w - 72, 30);
      interiorTable(x + 62, y + 30, 38, 18);
      interiorChair(x + 56, y + 34, "right");
      interiorShelf(x + w - 42, y + 14, 30, 20);
      drawFlowerVase(x + 14, y + 84, t);
    } else if (type.id === "soldier_quarters") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#5d5b52");
      for (let i = 0; i < 2; i++) {
        const px = x + 12 + i * 52;
        R(ctx, px, y + 28, 42, 24, "#3b2a1c");
        R(ctx, px + 2, y + 30, 38, 20, "#6b4c30");
        R(ctx, px + 5, y + 34, 18, 12, "#d8d3c2");
        R(ctx, px + 7, y + 35, 14, 3, "#efe5cc");
        R(ctx, px + 26, y + 34, 12, 12, "#c9c2af");
        R(ctx, px + 6, y + 52, 2, 8, "#3b2a1a");
        R(ctx, px + 34, y + 52, 2, 8, "#3b2a1a");
      }
      R(ctx, x + w - 36, y + 58, 20, 26, "#3b2a1a");
      R(ctx, x + w - 34, y + 60, 16, 22, "#6f7d8b");
      R(ctx, x + w - 27, y + 65, 3, 10, "#d6a449");
      R(ctx, x + 18, y + 70, 34, 3, "#3b2a1a");
      R(ctx, x + 20, y + 72, 30, 1, "#8a623b");
      interiorCandle(x + 70, y + 24, t, true);
    } else if (type.id === "minister_office") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      interiorShelf(x + 10, y + 12, 48, 28);
      interiorTable(x + 28, y + 54, w - 56, 22);
      interiorChair(x + 20, y + 58, "right");
      interiorChair(x + w - 28, y + 58, "left");
      R(ctx, x + 44, y + 50, 18, 5, "#efe5cc");
      R(ctx, x + 47, y + 45, 8, 5, "#8e3731");
      R(ctx, x + 72, y + 48, 3, 8, "#e2c58d");
      interiorCandle(x + 76, y + 50, t, true);
      R(ctx, x + w - 30, y + 14, 20, 18, "#3b2a1a");
      R(ctx, x + w - 28, y + 16, 16, 14, "#d7c69d");
      R(ctx, x + w - 24, y + 20, 8, 1, "#8a623b");
    } else if (type.id === "missionary_cell") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#6b6052");
      interiorBed(x + 14, y + 26, 38, 46, "blue");
      interiorRug(x + 52, y + 56, w - 66, 28);
      R(ctx, x + w - 38, y + 18, 18, 22, "#3b2a1a");
      R(ctx, x + w - 36, y + 20, 14, 18, "#e2d3b4");
      R(ctx, x + w - 30, y + 24, 2, 8, "#d6a449");
      R(ctx, x + w - 34, y + 27, 10, 2, "#d6a449");
      interiorCandle(x + 58, y + 70, t, true);
      drawFlowerVase(x + 16, y + 82, t);
    } else if (type.id === "armory") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#5d5b52");
      // 武器架
      R(ctx, x + 10, y + 14, 2, 57, "#3b2a1a");
      R(ctx, x + 12, y + 14, 1, 57, "#8a623b");
      for (let i = 0; i < 4; i++) {
        R(ctx, x + 14, y + 18 + i * 12, 34, 2, "#4b3725");
        R(ctx, x + 24, y + 14 + i * 12, 2, 20, "#b9b3a4");
        R(ctx, x + 20, y + 12 + i * 12, 10, 3, "#7d8580");
      }
      // 盾牌与盔甲
      R(ctx, x + 62, y + 18, 26, 28, "#3b2a1a");
      R(ctx, x + 64, y + 20, 22, 24, "#6f7d8b");
      R(ctx, x + 73, y + 26, 4, 12, "#d6a449");
      R(ctx, x + 66, y + 30, 18, 2, "#d6a449");
      R(ctx, x + 96, y + 24, 18, 32, "#3b2a1a");
      R(ctx, x + 98, y + 26, 14, 28, "#8d9495");
      R(ctx, x + 101, y + 21, 8, 5, "#aeb3a7");
      interiorTable(x + 28, y + 75, 54, 18);
      R(ctx, x + 36, y + 70, 4, 12, "#3b2a1a");
      R(ctx, x + 48, y + 68, 10, 4, "#7d8580");
      interiorCandle(x + 128, y + 56, t, true);
    } else if (type.id === "study") {
      interiorWoodFloor(x + 4, y + 4, w - 8, h - 8);
      interiorShelf(x + 10, y + 12, 52, 36);
      interiorShelf(x + 70, y + 12, 52, 36);
      interiorTable(x + 22, y + 58, 92, 24);
      interiorChair(x + 14, y + 62, "right");
      interiorChair(x + 122, y + 62, "left");
      R(ctx, x + 48, y + 52, 18, 5, "#efe5cc");
      R(ctx, x + 53, y + 48, 8, 4, "#c15c4f");
      R(ctx, x + 80, y + 48, 3, 8, "#e2c58d");
      interiorCandle(x + 76, y + 50, t, true);
      drawFlowerVase(x + 12, y + 88, t);
    } else if (type.id === "meeting") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#6a5747");
      interiorRug(x + 18, y + 55, w - 36, 38);
      interiorTable(x + 34, y + 38, w - 68, 30);
      for (let i = 0; i < 5; i++) {
        interiorChair(x + 24, y + 40 + i * 7, "right");
        interiorChair(x + w - 32, y + 40 + i * 7, "left");
      }
      interiorCandle(x + 52, y + 40, t, true);
      interiorCandle(x + w - 52, y + 40, t, true);
      R(ctx, x + w / 2 - 8, y + 16, 16, 18, "#3b2a1a");
      R(ctx, x + w / 2 - 6, y + 18, 12, 14, "#8e3731");
      R(ctx, x + w / 2 - 1, y + 22, 2, 7, "#d6a449");
      R(ctx, x + w / 2 - 4, y + 24, 8, 2, "#d6a449");
    } else if (type.id === "chapel") {
      interiorStoneFloor(x + 4, y + 4, w - 8, h - 8, "#6b5c4f");
      drawChapelWindow(x + w / 2 - 22, y + 8, 44, 28, t);
      // 长椅
      for (let i = 0; i < 3; i++) {
        R(ctx, x + 22, y + 64 + i * 13, w - 44, 5, "#3b2a1a");
        R(ctx, x + 24, y + 64 + i * 13, w - 48, 2, "#8a623b");
        R(ctx, x + 22, y + 69 + i * 13, 3, 6, "#5b4029");
        R(ctx, x + w - 25, y + 69 + i * 13, 3, 6, "#5b4029");
      }
      R(ctx, x + w / 2 - 20, y + 46, 40, 14, "#3b2a1a");
      R(ctx, x + w / 2 - 18, y + 47, 36, 11, "#d7c69d");
      R(ctx, x + w / 2 - 1, y + 40, 2, 10, "#d6a449");
      R(ctx, x + w / 2 - 5, y + 43, 10, 2, "#d6a449");
      interiorCandle(x + 18, y + 46, t, true);
      interiorCandle(x + w - 18, y + 46, t, true);
    }
    drawSkinRoomOverlay(skin, x, y, w, h);
    drawRoomUpgradeFurniture(type, level, x, y, w, h, t);
    drawRoomLevelDecor(level, x, y, w, h, t);
    ctx.restore();
  }
  function drawExpansion(state, dt) {
    const floor = (state && state.currentFloor) || 0;
    const rooms = state && state.expansionFloors ? state.expansionFloors[floor] || {} : {};
    const skinState = state && state.floorSkins ? state.floorSkins[floor] : null;
    const skin = skinState && skinState.selected ? skinState.selected : "stone";
    const skinData = floorSkinData(skin);
    R(ctx, 0, 0, W, H, "#18110e");
    R(ctx, 4, 4, W - 8, H - 8, "#261c16");
    interiorArchWall(8, 8, W - 16, H - 16);
    R(ctx, 18, 18, W - 36, H - 36, "#4b3a31");
    drawSkinFloorBase(20, 20, W - 40, H - 40, skin);
    // 楼层走廊
    R(ctx, 20, 168, W - 40, 52, skinData.corridor);
    R(ctx, 22, 170, W - 44, 48, skinData.runner);
    for (let x = 42; x < W - 42; x += 24) {
      R(ctx, x, 174, 10, 2, "rgba(239,205,140,0.28)");
      R(ctx, x, 212, 10, 2, "rgba(239,205,140,0.28)");
    }
    // 楼层标牌
    R(ctx, 286, 178, 148, 32, "#2b1d15");
    R(ctx, 288, 180, 144, 28, "#3c2b1d");
    R(ctx, 288, 180, 144, 2, "#876b49");
    ctx.fillStyle = "#f0d28a";
    ctx.font = "12px FusionPixel, FusionPixelExtra, monospace";
    ctx.textAlign = "center";
    ctx.fillText("F" + (floor + 1) + "  ·  第 " + (floor + 1) + " 层  ·  " + skinData.name, 360, 200);
    ctx.textAlign = "left";
    D.EXPANSION_SLOTS.forEach(function (slot) {
      const room = rooms[slot.id];
      const type = room ? D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0] : null;
      drawExpansionRoom(type, slot, time, room ? room.level || 1 : 1, skin);
    });
    // 楼梯
    R(ctx, 318, 352, 84, 32, "#2b1e17");
    for (let i = 0; i < 6; i++) {
      R(ctx, 324 + i, 356 + i * 4, 72 - i * 2, 3, i % 2 ? "#8c6b4a" : "#6d4e33");
    }
    R(ctx, 306, 348, 12, 36, "#3b2a1b");
    R(ctx, 402, 348, 12, 36, "#3b2a1b");
    // 壁灯
    [56, 226, 396, 566].forEach(function (x) {
      interiorSconce(x, 42, time);
      interiorSconce(x, 356, time);
    });
    const lights = [];
    lights.push({ x: 360, y: 194, r: 60, color: "#ffb45e", a: 0.18 });
    lights.push({ x: 100, y: 90, r: 26, color: "#f2c56d", a: 0.1 });
    lights.push({ x: 560, y: 300, r: 26, color: "#f2c56d", a: 0.1 });
    lights.push({ x: 360, y: 210, r: 36, color: "#ffd58c", a: 0.12 });
    lights.forEach(function (l) { drawGlow(l.x, l.y, l.r, l.color, l.a); });
    drawMaskedWanderers(time, "expansion");
    drawInteriorDust(time);
    drawInteriorVignette();
    drawParticles();
  }
  function drawLandCrop(crop, growth, ready, x, y, w, h, t) {
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const yy = y + 16 + r * 20;
      R(ctx, x + 10, yy, w - 20, 1, "rgba(45,30,18,.35)");
      for (let i = 0; i < 5; i++) {
        const xx = x + 18 + i * ((w - 36) / 4);
        if (!growth && !ready) {
          R(ctx, xx, yy - 2, 2, 2, "#5b4324");
        } else if (!ready) {
          R(ctx, xx, yy - 7, 2, 7, "#5f7f4b");
          R(ctx, xx - 3, yy - 7, 3, 2, "#7d9b61");
          R(ctx, xx + 2, yy - 9, 3, 2, "#7d9b61");
        } else {
          R(ctx, xx - 1, yy - 10, 3, 10, "#4f6e3d");
          if (crop === "wheat") {
            R(ctx, xx - 4, yy - 15, 8, 7, "#d9b45a");
            R(ctx, xx - 2, yy - 17, 4, 3, "#e8cb79");
          } else if (crop === "carrot") {
            R(ctx, xx - 3, yy - 8, 6, 7, "#d97b46");
            R(ctx, xx - 2, yy - 11, 4, 4, "#6c904f");
          } else if (crop === "pumpkin") {
            ellipse(ctx, xx, yy - 9, 8, 6, "#d18a3f");
            R(ctx, xx - 1, yy - 15, 2, 4, "#5f7d46");
          } else {
            R(ctx, xx - 3, yy - 12, 6, 6, "#7e9d62");
            R(ctx, xx - 1, yy - 15, 3, 3, "#d8c76c");
          }
        }
      }
    }
    if (ready) {
      ctx.globalAlpha = 0.2 + 0.1 * Math.sin(t * 3);
      R(ctx, x + 3, y + 3, w - 6, h - 6, "#f5d47a");
      ctx.globalAlpha = 1;
    }
  }

  function drawLandScene(state, dt) {
    const hour = hourOf(state);
    const night = nightAmount(hour);
    drawSky(hour);
    drawStars(night, hour);
    drawSunMoon(hour, night);
    drawClouds(hour, state ? state.weather : "clear");
    // 远山与草地
    R(ctx, 0, 190, W, 215, "#73905f");
    for (let i = 0; i < 6; i++) {
      ellipse(ctx, 60 + i * 125, 210 + (i % 2) * 12, 85, 30, "#668254");
    }
    R(ctx, 0, 220, W, 6, "#8ba06e");
    // 土路
    R(ctx, 0, 360, W, 45, "#8a6a48");
    R(ctx, 0, 366, W, 3, "#a8875c");
    // 农舍
    R(ctx, 28, 128, 112, 88, "#6d4a2f");
    R(ctx, 24, 120, 120, 14, "#8d3f32");
    for (let i = 0; i < 5; i++) R(ctx, 28 + i * 24, 124, 22, 6, i % 2 ? "#a65442" : "#7e352b");
    R(ctx, 44, 154, 24, 24, "#d9c18e");
    R(ctx, 47, 157, 18, 18, "#6e8790");
    R(ctx, 82, 158, 30, 58, "#4b3222");
    R(ctx, 85, 162, 24, 50, "#725034");
    R(ctx, 121, 92, 8, 50, "#4a3422");
    for (let i = 0; i < 3; i++) R(ctx, 116, 94 + i * 13, 18, 2, "#8b6e48");
    // 围栏
    for (let x = 160; x < 700; x += 22) {
      R(ctx, x, 112, 3, 24, "#5b432a");
      R(ctx, x + 3, 116, 19, 2, "#795b39");
    }
    R(ctx, 160, 112, 3, 250, "#5b432a");
    R(ctx, 697, 112, 3, 250, "#5b432a");
    // 田地
    (state && state.land ? state.land.plots : []).forEach(function (plot, i) {
      const r = D.LAND_PLOT_RECTS[i];
      if (!plot.unlocked) {
        R(ctx, r.x, r.y, r.w, r.h, "#607b4e");
        R(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, "#6f8a5b");
        for (let k = 0; k < 7; k++) R(ctx, r.x + 9 + k * 18, r.y + 12, 2, 3, "#8ba46e");
        for (let k = 0; k < 5; k++) R(ctx, r.x + 12 + k * 24, r.y + 34, 2, 2, "#8ba46e");
        R(ctx, r.x, r.y, r.w, 2, "#4b3320");
        R(ctx, r.x, r.y + r.h - 2, r.w, 2, "#4b3320");
        // 四角木桩 + 中间木牌
        [[r.x + 4, r.y + 4], [r.x + r.w - 7, r.y + 4], [r.x + 4, r.y + r.h - 16], [r.x + r.w - 7, r.y + r.h - 16]].forEach(function (p) {
          R(ctx, p[0], p[1], 3, 14, "#4b3320");
          R(ctx, p[0] + 1, p[1] + 1, 1, 12, "#8a623b");
        });
        R(ctx, r.x + 30, r.y + 27, 80, 28, "#4b3320");
        R(ctx, r.x + 33, r.y + 30, 74, 22, "#c2a06b");
        ctx.fillStyle = "#4b3320"; ctx.font = "11px FusionPixel, FusionPixelExtra, monospace"; ctx.textAlign = "center";
        ctx.fillText("待开垦", r.x + 70, r.y + 46); ctx.textAlign = "left";
        return;
      }
      R(ctx, r.x, r.y, r.w, r.h, "#5d4028");
      R(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, "#6f5032");
      for (let k = 1; k < 4; k++) R(ctx, r.x + 4, r.y + k * 20, r.w - 8, 1, "#4b3320");
      if (plot.crop) {
        drawLandCrop(plot.crop, plot.growth, plot.ready, r.x, r.y, r.w, r.h, time);
      } else {
        for (let k = 0; k < 4; k++) R(ctx, r.x + 16 + k * 28, r.y + 30, 2, 2, "#98744a");
      }
      R(ctx, r.x, r.y, 2, r.h, "#4b3320");
      R(ctx, r.x + r.w - 2, r.y, 2, r.h, "#4b3320");
    });
    // 草垛与树，填满地图边缘
    for (let i = 0; i < 4; i++) {
      const hx = 20 + i * 188, hy = 388 - (i % 2) * 5;
      ellipse(ctx, hx, hy, 20, 8, "#b9934f");
      R(ctx, hx - 13, hy - 9, 26, 10, "#c9a45b");
      R(ctx, hx - 11, hy - 12, 22, 4, "#ddbc72");
      R(ctx, hx - 2, hy - 12, 2, 20, "#8a623b");
    }
    for (let i = 0; i < 5; i++) {
      const tx = i < 2 ? 12 + i * 36 : 650 + (i - 2) * 26;
      const ty = 242 + (i % 3) * 38;
      R(ctx, tx, ty - 28, 6, 30, "#4a3320");
      ellipse(ctx, tx + 3, ty - 34, 24, 14, "#3f5f3a");
      ellipse(ctx, tx - 8, ty - 30, 16, 11, "#4a7044");
      ellipse(ctx, tx + 14, ty - 30, 16, 11, "#4a7044");
    }
    // 木牌
    R(ctx, 294, 76, 132, 34, "#4b3320");
    R(ctx, 298, 80, 124, 26, "#d9c18e");
    ctx.fillStyle = "#4b3320"; ctx.font = "12px FusionPixel, FusionPixelExtra, monospace"; ctx.textAlign = "center";
    ctx.fillText("风息堡领地", 360, 98);
    ctx.textAlign = "left";
    // 草与花
    for (let i = 0; i < 26; i++) {
      const x = 12 + (i * 83) % 700;
      const y = 220 + (i * 37) % 160;
      if (x > 160 && x < 680 && y > 110 && y < 350) continue;
      R(ctx, x, y, 2, 5, "#527040");
      if (i % 4 === 0) R(ctx, x - 1, y - 2, 4, 2, ["#d9c25e", "#d97f6a", "#d8d1e2"][i % 3]);
    }
  }

  function drawInterior(state, dt) {
    // 背景与外墙
    R(ctx, 0, 0, W, H, "#1b1310");
    R(ctx, 4, 4, W - 8, H - 8, "#2a1e18");
    interiorArchWall(8, 8, W - 16, H - 16);
    R(ctx, 18, 18, W - 36, H - 36, "#4b3a31");
    R(ctx, 20, 20, W - 40, H - 40, IN.floorStoneDark);

    const st = state && state.buildings ? state.buildings : {};
    const built = function (id) { return st[id] && st[id].status === "built"; };

    // 房间地板
    interiorWoodFloor(26, 28, 176, 116);
    interiorStoneFloor(220, 28, 280, 116, "#645346");
    interiorStoneFloor(518, 28, 176, 116, "#6a594a");
    interiorStoneFloor(26, 158, 176, 98, "#665547");
    interiorStoneFloor(220, 158, 280, 218, "#6b5a4b");
    interiorWoodFloor(518, 158, 176, 98);
    interiorStoneFloor(26, 272, 176, 104, "#5f5043");
    interiorStoneFloor(518, 272, 176, 104, "#665648");

    const interiorSkin = state && state.interiorSkin && state.interiorSkin.selected ? state.interiorSkin.selected : "stone";
    const interiorSkinData = floorSkinData(interiorSkin);
    drawSkinRoomOverlay(interiorSkin, 20, 20, W - 40, H - 40, 0.15);
    if (interiorSkin !== "stone") {
      R(ctx, 306, 178, 108, 182, interiorSkinData.runner);
      R(ctx, 310, 182, 100, 174, interiorSkinData.runner);
      R(ctx, 306, 178, 108, 3, interiorSkinData.accent);
      R(ctx, 306, 357, 108, 3, interiorSkinData.accent);
      for (let yy = 190; yy < 350; yy += 18) R(ctx, 312, yy, 96, 1, "rgba(255,240,200,.18)");
    }

    // 内墙
    interiorArchWall(206, 20, 10, 365);
    interiorArchWall(504, 20, 10, 365);
    interiorArchWall(20, 148, 190, 10);
    interiorArchWall(510, 148, 190, 10);
    interiorArchWall(20, 260, 190, 10);
    interiorArchWall(510, 260, 190, 10);
    interiorArchWall(216, 148, 288, 10);
    interiorArchWall(216, 264, 288, 10);

    // 门洞与门框
    function doorH(x, y) {
      R(ctx, x, y - 1, 28, 12, "#2d2119");
      R(ctx, x + 2, y, 24, 9, "#5b3e29");
      R(ctx, x + 4, y + 2, 20, 1, "#8e6643");
      R(ctx, x + 13, y + 4, 2, 3, IN.gold);
    }
    function doorV(x, y) {
      R(ctx, x - 1, y, 12, 28, "#2d2119");
      R(ctx, x, y + 2, 9, 24, "#5b3e29");
      R(ctx, x + 2, y + 4, 1, 20, "#8e6643");
      R(ctx, x + 5, y + 13, 2, 3, IN.gold);
    }
    doorV(206, 76);
    doorV(206, 190);
    doorV(206, 304);
    doorV(504, 76);
    doorV(504, 190);
    doorV(504, 304);
    doorH(92, 148);
    doorH(92, 260);
    doorH(586, 148);
    doorH(586, 260);
    doorH(330, 148);
    doorH(330, 264);

    // 石柱与壁灯：强化石堡的厚重感
    interiorPillar(200, 142, time);
    interiorPillar(200, 255, time);
    interiorPillar(500, 142, time);
    interiorPillar(500, 255, time);
    interiorSconce(214, 62, time);
    interiorSconce(214, 204, time);
    interiorSconce(214, 326, time);
    interiorSconce(506, 62, time);
    interiorSconce(506, 204, time);
    interiorSconce(506, 326, time);
    drawIndoorWindow(70, 13, 32, 20, "#b6c7a5");
    drawIndoorWindow(592, 13, 32, 20, "#b8c7a9");

    // 房间装饰
    drawStudy(time, built("study"));
    drawChapel(time, built("chapel"));
    drawBarracks(time, built("barracks"));
    drawStoreroom(time, built("storeroom"));
    drawKitchen(time, built("kitchen"));
    drawHall(time);
    drawBedroom(time);
    drawQuarters(time);

    // 房间升级：金色饰边与额外烛光
    D.BUILDINGS.filter(function (b) { return b.scene === "indoor"; }).forEach(function (b) {
      const bs = st[b.id];
      if (!bs || bs.status !== "built" || (bs.level || 1) <= 1) return;
      const r = b.rect;
      R(ctx, r.x + 4, r.y + 4, r.w - 8, 1, "rgba(216,174,92,0.55)");
      const lv = Math.min(3, bs.level - 1);
      for (let i = 0; i < lv; i++) {
        interiorCandle(r.x + 16 + i * 26, r.y + r.h - 16, time, true);
      }
      if (bs.level >= 4) {
        R(ctx, r.x + r.w - 22, r.y + 8, 4, 4, "#d6a449");
        R(ctx, r.x + r.w - 20, r.y + 6, 1, 2, "#ffe5a0");
      }
    });

    // 礼拜堂彩窗与暖色空气
    drawChapelWindow(time);
    ctx.globalAlpha = 0.09;
    R(ctx, 0, 0, W, H, "#ffb35f");
    ctx.globalAlpha = 1;

    // 取暖与烛光
    const lights = [];
    lights.push({ x: 360, y: 183, r: 48, color: "#ffb45e", a: 0.24 });
    lights.push({ x: 64, y: 306, r: 40, color: "#ffb45e", a: 0.2 });
    lights.push({ x: 360, y: 44, r: 46, color: "#f2c56d", a: 0.2 });
    lights.push({ x: 360, y: 210, r: 38, color: "#ffd58c", a: 0.16 });
    lights.push({ x: 86, y: 30, r: 22, color: "#cfe0a8", a: 0.1 });
    lights.push({ x: 608, y: 30, r: 22, color: "#cfe0a8", a: 0.1 });
    lights.push({ x: 212, y: 154, r: 20, color: "#f3b566", a: 0.12 });
    lights.push({ x: 508, y: 154, r: 20, color: "#f3b566", a: 0.12 });
    lights.push({ x: 212, y: 266, r: 20, color: "#f3b566", a: 0.12 });
    lights.push({ x: 508, y: 266, r: 20, color: "#f3b566", a: 0.12 });
    if (built("chapel")) {
      lights.push({ x: 360, y: 64, r: 30, color: "#f2c56d", a: 0.16 });
    }
    if (built("study")) lights.push({ x: 146, y: 120, r: 22, color: "#f3ca75", a: 0.15 });
    if (built("barracks")) lights.push({ x: 646, y: 100, r: 22, color: "#f3ca75", a: 0.15 });
    if (built("storeroom")) lights.push({ x: 158, y: 242, r: 22, color: "#f3ca75", a: 0.14 });
    if (built("kitchen")) lights.push({ x: 150, y: 348, r: 22, color: "#f3ca75", a: 0.14 });
    lights.forEach(function (l) { drawGlow(l.x, l.y, l.r, l.color, l.a); });

    // 戴面具的居民会在主厅里走动
    drawMaskedWanderers(time, "indoor");

    // 室内尘埃
    drawInteriorDust(time);

    // 临时建筑灰尘/标记
    ["study", "chapel", "barracks", "storeroom", "kitchen"].forEach(function (id) {
      const b = BUILDING_BY_ID[id];
      if (!b) return;
      const bs = st[id];
      if (bs && (bs.status === "building" || bs.status === "available")) {
        const r = b.rect;
        if (bs.status === "building") {
          R(ctx, r.x + 8, r.y + 8, 3, r.h - 16, "#3c2b1c");
          R(ctx, r.x + 8, r.y + 8, 2, r.h - 16, "#8d6844");
          R(ctx, r.x + r.w - 11, r.y + 8, 3, r.h - 16, "#3c2b1c");
          R(ctx, r.x + r.w - 10, r.y + 8, 2, r.h - 16, "#8d6844");
          R(ctx, r.x + 8, r.y + 20, r.w - 16, 3, "#3c2b1c");
          R(ctx, r.x + 9, r.y + 21, r.w - 18, 1, "#a0784e");
        }
      }
    });

    // 房间边缘阴影
    drawInteriorVignette();
    drawParticles();
  }

  function drawTradeCart(x, baseY, t) {
    shadow(ctx, x, baseY, 30, 6, 0.23);
    // 车轮
    circle(ctx, x - 18, baseY - 6, 7, "#2b1c12");
    circle(ctx, x - 18, baseY - 6, 5, "#6d4a2e");
    circle(ctx, x - 18, baseY - 6, 1, "#c9a24e");
    circle(ctx, x + 18, baseY - 6, 7, "#2b1c12");
    circle(ctx, x + 18, baseY - 6, 5, "#6d4a2e");
    circle(ctx, x + 18, baseY - 6, 1, "#c9a24e");
    // 车板与货箱
    R(ctx, x - 28, baseY - 25, 56, 8, "#3b2a1a");
    R(ctx, x - 26, baseY - 24, 52, 5, "#8d6844");
    R(ctx, x - 26, baseY - 24, 52, 1, "#b18352");
    R(ctx, x - 20, baseY - 34, 19, 10, "#3b2a1a");
    R(ctx, x - 19, baseY - 33, 17, 8, "#9a7045");
    R(ctx, x - 17, baseY - 33, 3, 7, "#72502f");
    R(ctx, x - 10, baseY - 35, 6, 3, "#d8b55c");
    R(ctx, x + 4, baseY - 33, 16, 9, "#3b2a1a");
    R(ctx, x + 5, baseY - 32, 14, 7, "#7d5938");
    R(ctx, x + 8, baseY - 34, 8, 2, "#c8a15a");
    // 车顶条纹
    R(ctx, x - 22, baseY - 45, 44, 3, "#3b2a1a");
    R(ctx, x - 20, baseY - 44, 40, 1, "#b5a477");
    R(ctx, x - 22, baseY - 45, 3, 14, "#3b2a1a");
    R(ctx, x + 19, baseY - 45, 3, 14, "#3b2a1a");
    // 小旗
    R(ctx, x + 20, baseY - 53, 2, 10, "#3b2a1a");
    R(ctx, x + 22, baseY - 53, 9, 5, "#a54b3c");
    R(ctx, x + 22, baseY - 53, 9, 1, "#d37b60");
  }

  function drawSmithy(t, lights) {
    shadow(ctx, 620, 274, 42, 6, 0.24);
    // 石墙
    R(ctx, 586, 214, 68, 60, "#37332b");
    R(ctx, 588, 215, 64, 58, "#6d6b60");
    R(ctx, 588, 215, 64, 2, "#918d7e");
    R(ctx, 650, 215, 2, 58, "#56564d");
    for (let y = 223; y < 270; y += 8) R(ctx, 590, y, 60, 1, "rgba(48,44,37,0.3)");
    // 屋顶
    for (let y = 196; y <= 216; y++) {
      const tt = (y - 196) / 20;
      const half = 6 + tt * 34;
      R(ctx, 620 - half, y, half * 2, 1, "#35251b");
      if (y > 198) R(ctx, 620 - half + 2, y, half * 2 - 4, 1, y < 204 ? "#8a4b37" : "#6f3b2d");
    }
    // 烟囱与烟
    R(ctx, 633, 180, 10, 24, "#3b3a32");
    R(ctx, 634, 181, 8, 22, "#77766a");
    R(ctx, 632, 178, 12, 3, "#3b3a32");
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.18 + i * 0.25) % 1;
      ctx.globalAlpha = (1 - ph) * 0.35;
      circle(ctx, 638 + Math.sin(t * 0.7 + i) * 4 + ph * 7, 177 - ph * 28, 2 + ph * 3, "#c9c1af");
      ctx.globalAlpha = 1;
    }
    // 炉火窗
    R(ctx, 601, 232, 18, 18, "#2c2119");
    R(ctx, 603, 234, 14, 14, "#3c3027");
    for (let i = 0; i < 3; i++) {
      R(ctx, 606 + i * 4, 238, 3, 7 + Math.round(Math.sin(t * 7 + i) * 2), i % 2 ? "#f09a3f" : "#ffd071");
    }
    lights.push({ x: 610, y: 244, w: 14, h: 12, kind: "window", color: "#f3b45b", glow: 22 });
    // 门
    R(ctx, 630, 244, 14, 30, "#3b2a1a");
    R(ctx, 632, 246, 10, 28, "#5b4129");
    R(ctx, 639, 256, 2, 2, GOLD);
    // 铁砧与武器架
    R(ctx, 574, 264, 17, 8, "#3b2a1a");
    R(ctx, 575, 265, 15, 5, "#6d7168");
    R(ctx, 580, 262, 6, 4, "#4b4f48");
    R(ctx, 656, 222, 3, 30, "#3b2a1a");
    R(ctx, 651, 218, 14, 3, "#3b2a1a");
    R(ctx, 653, 218, 9, 1, "#9a7044");
    for (let i = 0; i < 3; i++) {
      R(ctx, 653 + i * 4, 222, 1, 20, "#6d4a2e");
      R(ctx, 651 + i * 4, 220, 4, 2, "#aeb3a7");
    }
    // 招牌
    R(ctx, 586, 250, 2, 18, "#3b2a1a");
    R(ctx, 578, 246, 22, 12, "#3b2a1a");
    R(ctx, 579, 247, 20, 10, "#e2c58d");
    R(ctx, 586, 250, 5, 2, "#6f746b");
    R(ctx, 588, 248, 2, 6, "#4f4534");
  }

  function drawFishStall(t) {
    const x = 470, baseY = 270;
    shadow(ctx, 516, baseY, 46, 7, 0.24);
    R(ctx, 476, 218, 82, 38, "#3b2a1a");
    R(ctx, 478, 220, 78, 34, "#5d5144");
    // 蓝白条纹遮阳棚
    for (let i = 0; i < 6; i++) {
      R(ctx, 476 + i * 14, 212, 15, 10, i % 2 ? "#d8e0dc" : "#4f7488");
      R(ctx, 476 + i * 14, 220, 15, 3, "rgba(25,18,12,.22)");
    }
    R(ctx, 472, 212, 90, 3, "#2b1c12");
    // 柜台与鱼箱
    R(ctx, 476, 242, 82, 10, "#3b2a1a");
    R(ctx, 478, 243, 78, 7, "#8a623b");
    R(ctx, 484, 228, 28, 12, "#3b2a1a");
    R(ctx, 486, 229, 24, 9, "#b8c9cc");
    for (let i = 0; i < 3; i++) {
      R(ctx, 489 + i * 7, 231, 5, 3, "#8fa6ab");
      R(ctx, 491 + i * 7, 232, 2, 1, "#e7d7b4");
    }
    R(ctx, 520, 228, 26, 14, "#3b2a1a");
    R(ctx, 522, 229, 22, 11, "#95734c");
    R(ctx, 527, 231, 12, 6, "#d0b083");
    // 挂鱼
    for (let i = 0; i < 3; i++) {
      const fx = 526 + i * 10;
      R(ctx, fx, 218, 1, 5, "#4b3725");
      R(ctx, fx - 3, 223, 8, 3, "#b2c1c1");
      R(ctx, fx + 4, 224, 3, 2, "#8fa6ab");
      R(ctx, fx - 1, 224, 2, 1, "#2b2119");
    }
    R(ctx, 474, 252, 3, 18, "#3b2a1a");
    R(ctx, 556, 252, 3, 18, "#3b2a1a");
  }

  function drawFlowerStall(t) {
    const x = 214, baseY = 382;
    shadow(ctx, 258, baseY, 44, 7, 0.22);
    R(ctx, 218, 334, 80, 38, "#3b2a1a");
    R(ctx, 220, 336, 76, 34, "#6d5238");
    // 绿色遮阳棚
    for (let i = 0; i < 6; i++) {
      R(ctx, 216 + i * 14, 326, 15, 10, i % 2 ? "#e8ddbd" : "#5c7d4f");
      R(ctx, 216 + i * 14, 334, 15, 3, "rgba(25,18,12,.22)");
    }
    R(ctx, 214, 326, 88, 3, "#2b1c12");
    // 花桶
    for (let i = 0; i < 4; i++) {
      const px = 224 + i * 18;
      R(ctx, px, 348, 14, 14, "#3b2a1a");
      R(ctx, px + 1, 350, 12, 11, "#8a623b");
      for (let j = 0; j < 4; j++) {
        R(ctx, px + 3 + (j % 2) * 6, 343 + Math.floor(j / 2) * 5, 4, 4, ["#d96c5c", "#e6c05c", "#d9d1e2", "#8db1d1"][j]);
        R(ctx, px + 4 + (j % 2) * 6, 347 + Math.floor(j / 2) * 5, 1, 3, "#5d7c4a");
      }
    }
    R(ctx, 216, 366, 3, 16, "#3b2a1a");
    R(ctx, 297, 366, 3, 16, "#3b2a1a");
  }

  function drawShopSign(x, baseY, t) {
    shadow(ctx, x, baseY, 12, 3, 0.2);
    R(ctx, x - 1, baseY - 30, 3, 30, "#3b2a1a");
    R(ctx, x, baseY - 29, 2, 28, "#7b5736");
    R(ctx, x - 11, baseY - 38, 23, 14, "#3b2a1a");
    R(ctx, x - 10, baseY - 37, 21, 12, "#f1e2b8");
    R(ctx, x - 7, baseY - 34, 15, 1, "#805f3b");
    R(ctx, x - 7, baseY - 31, 10, 1, "#a38154");
    R(ctx, x - 8, baseY - 21, 2, 2, GOLD);
    // 小木箱
    R(ctx, x + 8, baseY - 9, 11, 8, "#3b2a1a");
    R(ctx, x + 9, baseY - 8, 9, 6, "#8a623b");
    R(ctx, x + 13, baseY - 8, 1, 6, "#5b4029");
  }

  function drawShops(t, lights) {
    if (!stateRef || !stateRef.shops) return;
    D.SHOPS.forEach(function (shop) {
      const st = stateRef.shops[shop.id] ? stateRef.shops[shop.id].status : "locked";
      if (st === "locked") return;
      if (st === "available") {
        drawShopSign(shop.plot.x + shop.plot.w / 2, shop.plot.baseY - 8, t);
        return;
      }
      if (shop.id === "bakery") {
        drawTavern(t, true, false, lights);
      } else if (shop.id === "general") {
        drawMarket(t, true, false, lights);
      } else if (shop.id === "smithy") {
        drawSmithy(t, lights);
      } else if (shop.id === "fishmonger") {
        drawFishStall(t);
      } else if (shop.id === "flower") {
        drawFlowerStall(t);
      }
    });
  }

  function currentPrestigeLevel() {
    return stateRef && stateRef.castleLevel ? stateRef.castleLevel : 1;
  }

  function drawPrestigeDecor(t) {
    const lv = currentPrestigeLevel();
    if (lv < 2) return;
    // 花箱
    [302, 420].forEach(function (x) {
      R(ctx, x - 7, 272, 16, 6, "#3b2a1a");
      R(ctx, x - 6, 273, 14, 4, "#5d4129");
      for (let i = 0; i < 5; i++) {
        R(ctx, x - 5 + i * 3, 270, 1, 3, "#5f7c4a");
        R(ctx, x - 6 + i * 3, 269, 2, 2, i % 2 ? "#d4a44b" : "#c15c4f");
      }
    });
    if (lv >= 3) {
      // 门前火盆
      [292, 432].forEach(function (x) {
        R(ctx, x - 4, 266, 9, 8, "#3b2a1a");
        R(ctx, x - 3, 267, 7, 6, "#7b5736");
        const f = 2 + Math.round(Math.sin(t * 8 + x) * 1);
        R(ctx, x - 2, 262 - f, 5, 3 + f, "#e88c3a");
        R(ctx, x - 1, 263 - f, 3, 2 + f, "#ffd071");
        drawGlow(x, 266, 26, "#ffad55", 0.14);
      });
      // 金线装饰
      R(ctx, 300, 152, 144, 1, GOLD);
      R(ctx, 300, 154, 144, 1, "rgba(214,164,73,0.35)");
    }
    if (lv >= 4) {
      // 两侧石像
      [276, 462].forEach(function (x) {
        R(ctx, x - 5, 260, 11, 4, "#4b453b");
        R(ctx, x - 4, 250, 9, 10, "#77705f");
        R(ctx, x - 2, 244, 5, 6, "#8b8370");
        R(ctx, x - 1, 242, 3, 3, "#a49a82");
        R(ctx, x - 7, 264, 15, 2, "#3b332a");
      });
      // 金色窗框
      [316, 348, 392, 424].forEach(function (x) {
        R(ctx, x, 178, 2, 2, GOLD_LIGHT);
        R(ctx, x + 12, 178, 2, 2, GOLD_LIGHT);
      });
      // 更多旗帜
      drawFlag(286, 92, 14, 22, "#46647f", 0.5);
      drawFlag(446, 96, 14, 22, "#46647f", 2.1);
    }
    if (lv >= 5) {
      // 彩灯与金冠
      for (let i = 0; i < 5; i++) {
        const x = 286 + i * 38;
        const y = 226 + Math.sin(t * 1.4 + i) * 2;
        R(ctx, x, y, 3, 3, i % 2 ? "#f0c968" : "#d86a4f");
        drawGlow(x + 1, y + 1, 12, "#ffcf72", 0.08);
      }
      R(ctx, 354, 42, 34, 4, GOLD);
      R(ctx, 360, 36, 6, 7, GOLD_LIGHT);
      R(ctx, 370, 34, 5, 9, GOLD_LIGHT);
      R(ctx, 380, 36, 6, 7, GOLD_LIGHT);
      if (Math.sin(t * 1.7) > 0.8) R(ctx, 410, 100, 2, 2, "#fff0b0");
    }
    if (lv >= 6) {
      // 王冠之城：两侧加建塔楼与金色王冠
      [248, 472].forEach(function (x, idx) {
        R(ctx, x, 122, 28, 148, "#2a2119");
        R(ctx, x + 2, 124, 24, 146, "#7a7261");
        for (let yy = 132; yy < 264; yy += 9) R(ctx, x + 3, yy, 22, 1, "rgba(46,41,33,0.32)");
        // 塔顶
        for (let yy = 96; yy <= 124; yy++) {
          const half = 3 + (yy - 96) / 28 * 13;
          R(ctx, x + 14 - half, yy, half * 2, 1, yy < 104 ? "#7b4f5c" : "#4b3a54");
        }
        R(ctx, x + 13, 86, 2, 12, "#3b2a1a");
        R(ctx, x + 15, 93, 9, 6, idx ? "#46647f" : "#a54a3c");
        R(ctx, x + 14, 90, 4, 3, GOLD_LIGHT);
        // 金窗
        R(ctx, x + 9, 156, 10, 16, "#3b2a1c");
        R(ctx, x + 11, 158, 6, 12, "#e1b45e");
        R(ctx, x + 12, 159, 4, 3, "#fff0b0");
        // 塔基花箱
        R(ctx, x - 3, 266, 34, 5, "#3b2a1a");
        R(ctx, x - 2, 267, 32, 3, "#5d4129");
        for (let i = 0; i < 6; i++) R(ctx, x + 1 + i * 5, 264, 2, 3, i % 2 ? "#d4a44b" : "#c15c4f");
      });
      // 大门金色拱饰
      R(ctx, 350, 232, 42, 2, GOLD);
      R(ctx, 356, 228, 30, 2, GOLD_LIGHT);
      // 两侧灯串
      for (let i = 0; i < 6; i++) {
        const x = 258 + i * 40;
        const y = 230 + Math.sin(t * 1.6 + i) * 2;
        R(ctx, x, y, 3, 3, i % 2 ? "#f0c968" : "#d86a4f");
        drawGlow(x + 1, y + 1, 13, "#ffcf72", 0.07);
      }
    }
  }

  function drawProgressMilestones(t) {
    if (!stateRef || !stateRef.buildings) return;
    let count = 0;
    D.BUILDINGS.forEach(function (b) { if (stateRef.buildings[b.id] && stateRef.buildings[b.id].status === "built") count++; });
    const stage = Math.min(8, count);
    if (stage >= 1) {
      // 门灯
      [346, 374].forEach(function (x) {
        R(ctx, x - 3, 252, 7, 10, "#3b2a1a");
        R(ctx, x - 2, 253, 5, 8, "#8a623b");
        R(ctx, x - 2, 248, 5, 5, "#f0c968");
        drawGlow(x, 250, 18, "#ffcf72", 0.10);
      });
    }
    if (stage >= 2) {
      // 门楣上的第一面蓝色小旗
      R(ctx, 357, 206, 2, 18, "#3b2a1a");
      drawFlag(359, 208, 18, 11, "#46647f", 0.4);
    }
    if (stage >= 3) {
      // 庭院花圃
      [306, 414].forEach(function (x) {
        R(ctx, x - 10, 278, 20, 5, "#3b2a1a");
        R(ctx, x - 9, 279, 18, 3, "#5d4129");
        for (let i = 0; i < 5; i++) {
          R(ctx, x - 8 + i * 4, 275, 1, 4, "#5f7c4a");
          R(ctx, x - 9 + i * 4, 274, 2, 2, i % 2 ? "#d4a44b" : "#c15c4f");
        }
      });
    }
    if (stage >= 4) {
      // 城门彩旗
      for (let i = 0; i < 7; i++) {
        const x = 318 + i * 14;
        const y = 214 + Math.sin(i * 0.9) * 2;
        R(ctx, x, y, 2, 6, "#4b3a2a");
        R(ctx, x, y + 5, 5, 5, i % 2 ? "#a54a3c" : "#46647f");
      }
    }
    if (stage >= 5) {
      // 城门上方的大幅旗帜
      R(ctx, 342, 168, 36, 42, "#2b1c13");
      R(ctx, 344, 170, 32, 38, "#8e3731");
      R(ctx, 345, 171, 30, 2, "#d6a449");
      R(ctx, 345, 203, 30, 2, "#d6a449");
      R(ctx, 356, 180, 8, 8, "#d6a449");
      R(ctx, 359, 178, 2, 12, "#f0d28a");
      R(ctx, 355, 182, 10, 2, "#f0d28a");
      drawGlow(360, 190, 24, "#ffcf72", 0.06);
    }
    if (stage >= 6) {
      // 更多亮窗与金色门环
      [318, 396].forEach(function (x) {
        R(ctx, x, 182, 12, 14, "#2b1c13");
        R(ctx, x + 2, 184, 8, 10, "#e1b45e");
        R(ctx, x + 3, 185, 6, 3, "#fff0b0");
      });
      R(ctx, 350, 246, 2, 2, GOLD);
      R(ctx, 368, 246, 2, 2, GOLD);
    }
    if (stage >= 7) {
      // 门前石像
      [292, 428].forEach(function (x) {
        R(ctx, x - 7, 268, 15, 4, "#3b332a");
        R(ctx, x - 5, 248, 11, 20, "#77705f");
        R(ctx, x - 3, 241, 7, 8, "#8b8370");
        R(ctx, x - 1, 239, 3, 3, "#a49a82");
      });
    }
    if (stage >= 8) {
      // 金冠与全城彩灯
      R(ctx, 350, 224, 20, 3, GOLD);
      R(ctx, 354, 219, 4, 6, GOLD_LIGHT);
      R(ctx, 361, 217, 4, 8, GOLD_LIGHT);
      R(ctx, 368, 219, 4, 6, GOLD_LIGHT);
      for (let i = 0; i < 5; i++) {
        R(ctx, 312 + i * 24, 230 + Math.sin(t + i) * 2, 3, 3, i % 2 ? "#f0c968" : "#d86a4f");
      }
    }
  }

  function drawBuildingLevelProps(b, bs, t) {
    const lv = bs.level || 1;
    if (lv <= 1) return;
    const p = b.plot;
    if (b.id === "lumber") {
      for (let i = 0; i < Math.min(3, lv - 1); i++) {
        const x = p.x - 6 + i * 9;
        R(ctx, x, 291, 16, 4, "#3b2a1a");
        R(ctx, x + 1, 292, 14, 2, i % 2 ? "#8a623b" : "#a47a4a");
        R(ctx, x + 3, 291, 2, 4, "#5d4129");
      }
      if (lv >= 3) {
        R(ctx, p.x + 86, 272, 3, 24, "#3b2a1a");
        R(ctx, p.x + 80, 270, 15, 3, "#7b5736");
      }
    } else if (b.id === "farm") {
      for (let i = 0; i < Math.min(3, lv - 1); i++) {
        const y = 338 - i * 5;
        R(ctx, 34, y, 176, 3, "#4f3d28");
        for (let sx = 38; sx < 206; sx += 9) R(ctx, sx, y - 3, 1, 3, "#a98042");
      }
    } else if (b.id === "quarry") {
      for (let i = 0; i < Math.min(3, lv - 1); i++) {
        const x = p.x + 8 + i * 14;
        R(ctx, x, 300, 12, 7, "#3b3b34");
        R(ctx, x + 1, 299, 10, 5, i % 2 ? "#8a8980" : "#6f7168");
        R(ctx, x + 3, 297, 5, 3, "#a3a396");
      }
      if (lv >= 3) {
        R(ctx, p.x + 92, 252, 3, 28, "#3b2a1a");
        R(ctx, p.x + 82, 249, 23, 3, "#3b2a1a");
        R(ctx, p.x + 86, 252, 1, 18, "#8a623b");
      }
    }
    // 等级金点
    for (let i = 0; i < lv; i++) {
      R(ctx, p.x + 5 + i * 4, p.baseY - 12, 2, 2, i < lv - 1 ? GOLD : GOLD_LIGHT);
    }
  }

  /* ---------------------------------------------------------
     主绘制
     --------------------------------------------------------- */
  let lightsForFrame = [];

  function draw(dt, state) {
    if (!ctx) return;
    stateRef = state;
    time += dt;
    updateParticles(dt);
    bellPulseT += dt;

    const hour = hourOf(state);
    const night = nightAmount(hour);
    const stage = getCastleStage(state);

    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    hitAreas = [];

    if (state && state.view === "land") {
      hideTooltip();
      drawLandScene(state, dt);
      return;
    }
    if (state && state.view === "indoor") {
      hideTooltip();
      drawInterior(state, dt);
      return;
    }
    if (state && state.view === "expansion") {
      hideTooltip();
      drawExpansion(state, dt);
      return;
    }

    // 天空与远景
    drawSky(hour);
    drawStars(night, hour);
    drawSunMoon(hour, night);
    drawClouds(hour, state ? state.weather : "clear");
    drawBirds(hour, state ? state.weather : "clear");
    if (!bgLayer) bgLayer = createBackground();
    ctx.drawImage(bgLayer, 0, 0);
    ctx.drawImage(castleLayer(stage), 0, 0);

    // 城堡动态
    drawCastleFlags(stage);
    drawProgressMilestones(time);
    drawPrestigeDecor(time);

    // 建筑
    lightsForFrame = [];
    const buildingStates = state && state.buildings ? state.buildings : {};
    const sorted = D.BUILDINGS.filter(function (b) { return b.scene === "outdoor"; }).sort(function (a, b) { return a.plot.baseY - b.plot.baseY; });
    // 城堡热区先加入，优先级最低
    hitAreas.push({ type: "castle", x: 284, y: 52, w: 180, h: 222 });
    sorted.forEach(function (b) {
      const bs = buildingStates[b.id] || { status: "locked", progress: 0 };
      drawBuilding(b, bs, time, lightsForFrame);
      drawBuildingLevelProps(b, bs, time);
      hitAreas.push({
        type: "building", id: b.id,
        x: b.plot.x, y: b.plot.y, w: b.plot.w, h: b.plot.h
      });
    });

    drawShops(time, lightsForFrame);

    // 城堡窗户灯光点
    const castleLights = [];
    drawCastleWindows(stage, night, castleLights);
    lightsForFrame = lightsForFrame.concat(castleLights);

    // 前景道具与人物
    drawWell();
    drawLamp(276, 317, lightsForFrame);
    drawLamp(470, 333, lightsForFrame);
    drawFarmLife(time);
    drawButterflies(time);
    drawTradeCart(452, 372, time);
    drawSmokeAndParticles(time);
    drawWorkers(time, lightsForFrame);
    drawOutdoorSoldiers(time);

    // 全城张灯结彩
    if (stage >= 4) {
      drawPennantLine(250, 222, 300, 204, 0.2);
      drawPennantLine(476, 200, 540, 219, 1.4);
      lightsForFrame.push({ x: 250, y: 222, w: 3, h: 3, kind: "lamp", color: "#f2cf7a", glow: 12 });
      lightsForFrame.push({ x: 536, y: 219, w: 3, h: 3, kind: "lamp", color: "#f2cf7a", glow: 12 });
    }

    if (state && state.weather === "rain") drawRain(time);

    // 夜色、灯光
    drawLighting(state, time);
    drawLights(night);
    drawFireflies(night);
    drawParticles();
    drawBellPulse();

    // UI 标记
    drawMarkers();
    drawHoverHighlight();

    // 记录灯光（用于下一帧无影响）
    // 夜间窗光已在 drawLights 绘制
  }

  /* ---------------------------------------------------------
     交互
     --------------------------------------------------------- */
  function logicalPos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { x: x, y: y, cx: e.clientX, cy: e.clientY };
  }

  function findHover(pos) {
    for (let i = hitAreas.length - 1; i >= 0; i--) {
      const a = hitAreas[i];
      if (pos.x >= a.x && pos.x <= a.x + a.w && pos.y >= a.y && pos.y <= a.y + a.h) return a;
    }
    return null;
  }

  function buildingInfo(b, bs) {
    const w = b.worker && WORKER_BY_ID[b.worker];
    const staff = w && stateRef && stateRef.workers && stateRef.workers[w.id] && stateRef.workers[w.id].hired ? w : null;
    if (bs.status === "built") {
      return {
        title: b.name,
        sub: staff ? staff.name + " · 正在工作" : "尚未有居民",
        hint: "点击查看详情"
      };
    }
    if (bs.status === "building") {
      return {
        title: b.name + " · 建造中",
        sub: Math.floor((bs.progress || 0) * 100) + "% · 木匠们正忙着",
        hint: "点击查看"
      };
    }
    if (bs.status === "available") {
      return { title: b.name, sub: "蓝图已解锁 · 可以建造", hint: "点击查看建造条件" };
    }
    return { title: b.name, sub: "废墟 · 尚未解锁", hint: "点击查看" };
  }

  function tooltipHTML(target, pos) {
    if (!target) return null;
    if (target.type === "building") {
      const b = BUILDING_BY_ID[target.id];
      const bs = (stateRef && stateRef.buildings && stateRef.buildings[target.id]) || { status: "locked" };
      const info = buildingInfo(b, bs);
      return '<div class="tt-title">' + info.title + "</div>" +
        '<div class="tt-sub">' + info.sub + "</div>" +
        '<div class="tt-hint">' + info.hint + "</div>";
    }
    if (target.type === "worker") {
      const w = WORKER_BY_ID[target.id];
      const a = w.area && BUILDING_BY_ID[w.area];
      return '<div class="tt-title">' + w.name + " · " + w.roleName + "</div>" +
        '<div class="tt-sub">' + (a ? "在「" + a.name + "」自动工作" : "正在城堡里忙碌") + "</div>" +
        '<div class="tt-hint">点击查看居民</div>';
    }
    if (target.type === "cat") {
      return '<div class="tt-title">城堡猫</div><div class="tt-sub">它把这里当成了家。</div><div class="tt-hint">点击摸一摸</div>';
    }
    if (target.type === "player") {
      return '<div class="tt-title">你 · 风息堡主人</div><div class="tt-sub">今天也要把城堡修好。</div><div class="tt-hint">点击打开手记</div>';
    }
    if (target.type === "castle") {
      const stage = getCastleStage(stateRef);
      const stageNames = ["沉睡的废墟", "第一缕炊烟", "修补的屋顶", "旗帜重新升起", "灯火与钟声"];
      return '<div class="tt-title">风息堡</div><div class="tt-sub">复兴阶段：<b>' + stageNames[stage] + '</b></div><div class="tt-hint">点击查看城堡</div>';
    }
    return null;
  }

  function showTooltip(target, pos) {
    if (!tooltip) return;
    const html = tooltipHTML(target, pos);
    if (!html) { hideTooltip(); return; }
    tooltip.innerHTML = html;
    tooltip.classList.add("show");
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = pos.cx + 16;
    let top = pos.cy + 16;
    if (left + tw > fw - 8) left = pos.cx - tw - 16;
    if (top + th > fh - 8) top = pos.cy - th - 16;
    left = clamp(left, 8, fw - tw - 8);
    top = clamp(top, 8, fh - th - 8);
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove("show");
  }

  function onMove(e) {
    const pos = logicalPos(e);
    mouseX = pos.x; mouseY = pos.y; mouseIn = true;
    const target = findHover(pos);
    const changed = !hover || !target || hover.type !== target.type || hover.id !== target.id;
    hover = target;
    canvas.classList.toggle("pointer", !!target);
    if (target) {
      showTooltip(target, { cx: e.clientX - canvas.getBoundingClientRect().left, cy: e.clientY - canvas.getBoundingClientRect().top });
    } else {
      hideTooltip();
    }
    if (changed && handlers.onHover) handlers.onHover(target);
  }

  function onClick(e) {
    const pos = logicalPos(e);
    const target = findHover(pos);
    if (!target) return;
    if (target.type === "building") {
      if (handlers.onBuilding) handlers.onBuilding(target.id);
    } else if (target.type === "worker") {
      if (handlers.onWorker) handlers.onWorker(target.id);
    } else if (target.type === "cat") {
      petCat();
      if (handlers.onCat) handlers.onCat();
    } else if (target.type === "player") {
      if (handlers.onPlayer) handlers.onPlayer();
    } else if (target.type === "castle") {
      if (handlers.onCastle) handlers.onCastle();
    }
  }

  function onLeave() {
    mouseIn = false;
    hover = null;
    hideTooltip();
    canvas.classList.remove("pointer");
  }

  /* ---------------------------------------------------------
     初始化与公开接口
     --------------------------------------------------------- */
  function init(canvasEl, opts) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    frame = canvas.parentElement;
    tooltip = document.getElementById("sceneTooltip");
    handlers = opts || {};

    // 预置环境元素
    const rng = mulberry32(99331);
    starField = [];
    for (let i = 0; i < 95; i++) {
      starField.push({
        x: Math.floor(rng() * W),
        y: Math.floor(rng() * 195),
        s: rng() < 0.15 ? 2 : 1,
        a: 0.35 + rng() * 0.6,
        tw: 0.8 + rng() * 2,
        phase: rng() * 6.28,
        color: rng() < 0.25 ? "#f3ddad" : "#d9e2d8"
      });
    }
    leafField = [];
    for (let i = 0; i < 28; i++) {
      leafField.push({
        x: rng() * W, y: rng() * 260,
        speed: 2 + rng() * 5, fall: 5 + rng() * 7,
        phase: rng() * 6.28, a: rng() * 0.5,
        color: ["#b97b3e", "#d39a4f", "#996231", "#7f8e52"][i % 4]
      });
    }
    clouds = [
      { x: 30, y: 62, scale: 1.2, speed: 2.0 },
      { x: 260, y: 42, scale: 0.8, speed: 1.2 },
      { x: 500, y: 78, scale: 1.0, speed: 1.6 },
      { x: 650, y: 36, scale: 0.7, speed: 0.8 },
      { x: 390, y: 110, scale: 0.55, speed: 0.5 }
    ];
    rainDrops = [];
    for (let i = 0; i < 85; i++) {
      rainDrops.push({ x: rng() * (W + 80), y: rng() * 420 });
    }
    fireflyField = [];
    for (let i = 0; i < 18; i++) {
      fireflyField.push({
        x: 100 + rng() * 520,
        y: 280 + rng() * 100,
        phase: rng() * 6.28
      });
    }
    bgLayer = createBackground();

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", hideTooltip);
    canvas.addEventListener("pointerdown", function () {
      if (!stateRef) return;
    });
  }

  function petCat() {
    spawnBurst(405, 298, ["#d97b68", "#c66658", "#f0b3a2"], 8, "heart");
    if (window.GameAudio) window.GameAudio.sfx("cat");
  }

  function burstBuilding(id) {
    const b = BUILDING_BY_ID[id];
    if (!b) return;
    if (b.plot) {
      spawnBurst(plotCenter(b.plot), b.plot.baseY - 34, ["#f2d17a", "#fff0b6", "#d9ab4a", "#8fae73"], 22, "spark");
    } else if (b.rect) {
      spawnBurst(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2, ["#f2d17a", "#fff0b6", "#d9ab4a", "#f0b46d"], 26, "spark");
    }
  }

  function bellPulse() {
    bellPulseT = 0;
  }

  function setWeather() {
    // 天气由 state 驱动，这里保留接口
  }

  return {
    init: init,
    draw: draw,
    petCat: petCat,
    burstBuilding: burstBuilding,
    bellPulse: bellPulse,
    hideTooltip: hideTooltip
  };
})();
