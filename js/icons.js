/* =========================================================
   城堡物语 · 像素图标 / 肖像绘制
   所有图像在运行时用 Canvas 生成，零外部图片依赖
   ========================================================= */
window.Icons = (function () {
  "use strict";

  const C = {
    ink: "#2b1c13",
    inkSoft: "#4a3222",
    gold: "#e3b24b",
    goldLight: "#ffe59a",
    goldDark: "#a97427",
    woodDark: "#4e3421",
    wood: "#7a5433",
    woodLight: "#ab7c4c",
    bark: "#5b3b24",
    stoneDark: "#545b5b",
    stone: "#858b83",
    stoneLight: "#b8bbae",
    leafDark: "#34543b",
    leaf: "#5c7d4b",
    leafLight: "#87a45e",
    wheat: "#dfb357",
    wheatLight: "#f3d98c",
    cream: "#f2e2ba",
    creamShade: "#d6bb85",
    paper: "#f7e9c7",
    red: "#a84b3c",
    redDark: "#732f29",
    blue: "#45657f",
    blueDark: "#2f485d",
    purple: "#765579",
    skin: "#e0aa7d",
    skinLight: "#f0c79b",
    skinDark: "#b98058",
    white: "#f5eeda",
    shadow: "rgba(30,20,12,0.25)"
  };

  const ROLE_COLOR = {
    wood: "#4d6b4a",
    food: "#8a7d3f",
    stone: "#6d716c",
    tavern: "#a45b3f",
    tower: "#4c6377",
    library: "#4a5f86",
    market: "#7b567e",
    npc: "#504034",
    player: "#8c3a33"
  };

  const iconCache = Object.create(null);
  const buildingCache = Object.create(null);
  const portraitCache = Object.create(null);

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { c: c, x: ctx };
  }

  function R(x, px, py, pw, ph, color) {
    x.fillStyle = color;
    x.fillRect(px | 0, py | 0, pw | 0, ph | 0);
  }

  function circle(x, cx, cy, r, color) {
    x.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      x.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
    }
  }

  function ring(x, cx, cy, r, color, thick) {
    x.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      const spanIn = Math.max(0, r - (thick || 1));
      const inner = Math.floor(Math.sqrt(Math.max(0, spanIn * spanIn - dy * dy)));
      if (span > inner) {
        x.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
        if (inner > 0) {
          x.clearRect(cx - inner, cy + dy, inner * 2 + 1, 1);
        }
      }
    }
  }

  function grid(x, rows, palette, ox, oy, scale) {
    scale = scale || 1;
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const col = palette[row[i]];
        if (col) R(x, ox + i * scale, oy + j * scale, scale, scale, col);
      }
    }
  }

  /* ---------- 小像素图 ---------- */

  const GRID = {
    star: [
      "............",
      ".....kk.....",
      "....kggk....",
      "....kggk....",
      "..kkkggkkk..",
      ".kggggggggk.",
      "..kggggggk..",
      "...kggggk...",
      "..kggkkggk..",
      ".kggk..kggk.",
      ".kgk....kgk.",
      ".kk......kk."
    ],
    heart: [
      "............",
      "............",
      "...kk..kk...",
      "..krrkkrrk..",
      ".krrrrrrrrk.",
      ".krrrrrrrrk.",
      ".krrrrrrrrk.",
      "..krrrrrrk..",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............"
    ],
    check: [
      "............",
      "..........k.",
      ".........kgk",
      "........kggk",
      ".k.....kggk.",
      ".kgk..kggk..",
      "..kgkkggk...",
      "...kgggk....",
      "....kgk.....",
      ".....k......",
      "............",
      "............"
    ],
    sparkle: [
      "............",
      ".....kk.....",
      ".....kk.....",
      "...kkllkk...",
      ".kkllllllkk.",
      "..kllllllk..",
      "...kllllk...",
      "..kllkkllk..",
      "..klk..klk..",
      "..kk....kk..",
      "............",
      "............"
    ],
    arrow: [
      "............",
      "............",
      ".....kk.....",
      ".....kgk....",
      ".....kggk...",
      "kkkkkkgggk..",
      "kgggggggggk.",
      "kkkkkkgggk..",
      ".....kggk...",
      ".....kgk....",
      ".....kk.....",
      "............"
    ],
    close: [
      "............",
      "............",
      "..kk....kk..",
      ".kllk..kllk.",
      "..kllkkllk..",
      "...kllllk...",
      "....kllk....",
      "...kllllk...",
      "..kllkkllk..",
      ".kllk..kllk.",
      "..kk....kk..",
      "............"
    ]
  };

  /* ---------- 绘图工具 ---------- */

  function drawCoin(x) {
    circle(x, 12, 12, 10, C.ink);
    circle(x, 12, 12, 8, C.goldDark);
    circle(x, 12, 12, 7, C.gold);
    circle(x, 11, 10, 5, C.goldLight);
    // 中心小皇冠
    R(x, 8, 12, 9, 4, C.goldDark);
    R(x, 8, 10, 2, 2, C.goldDark);
    R(x, 11, 9, 2, 3, C.goldDark);
    R(x, 14, 10, 2, 2, C.goldDark);
    R(x, 9, 13, 1, 2, C.gold);
    R(x, 12, 13, 1, 2, C.gold);
    R(x, 15, 13, 1, 2, C.gold);
    R(x, 7, 6, 2, 2, "#fff3c2");
    R(x, 16, 17, 2, 1, "#c08a2f");
  }

  function drawWood(x) {
    // 底层原木
    R(x, 2, 15, 19, 7, C.ink);
    R(x, 3, 15, 17, 5, C.wood);
    R(x, 3, 15, 17, 1, C.woodLight);
    R(x, 4, 18, 15, 1, C.bark);
    R(x, 19, 14, 4, 8, C.ink);
    R(x, 20, 15, 3, 6, C.woodLight);
    R(x, 21, 16, 2, 1, C.bark);
    R(x, 21, 18, 2, 1, C.bark);
    // 中层原木
    R(x, 4, 9, 19, 7, C.ink);
    R(x, 5, 9, 17, 5, C.woodLight);
    R(x, 5, 9, 17, 1, "#c4925c");
    R(x, 6, 13, 15, 1, C.bark);
    R(x, 20, 8, 4, 8, C.ink);
    R(x, 21, 9, 3, 6, "#d6a56a");
    R(x, 22, 10, 1, 1, C.bark);
    R(x, 22, 12, 1, 1, C.bark);
    // 顶层小原木
    R(x, 7, 4, 12, 5, C.ink);
    R(x, 8, 4, 10, 3, "#8b603a");
    R(x, 8, 4, 10, 1, "#bc8c57");
    R(x, 17, 3, 4, 5, C.ink);
    R(x, 18, 4, 2, 3, "#d6a56a");
    R(x, 18, 5, 1, 2, C.bark);
    // 小叶子
    R(x, 3, 9, 2, 1, C.leaf);
    R(x, 2, 8, 2, 1, C.leafLight);
  }

  function drawStone(x) {
    // 小石头
    R(x, 2, 16, 7, 5, C.ink);
    R(x, 3, 16, 5, 3, C.stone);
    R(x, 3, 16, 4, 1, C.stoneLight);
    // 大石头
    R(x, 8, 8, 12, 13, C.ink);
    R(x, 9, 8, 10, 11, C.stone);
    R(x, 10, 7, 8, 3, C.stone);
    R(x, 10, 8, 7, 2, C.stoneLight);
    R(x, 16, 11, 3, 7, C.stoneDark);
    R(x, 11, 15, 2, 2, C.stoneDark);
    R(x, 13, 17, 3, 2, C.stoneLight);
    R(x, 18, 15, 3, 4, C.ink);
    R(x, 19, 15, 2, 3, C.stoneDark);
    // 苔藓
    R(x, 9, 8, 3, 2, C.leaf);
    R(x, 8, 9, 1, 1, C.leafLight);
    R(x, 11, 7, 1, 1, C.leafLight);
  }

  function drawFood(x) {
    // 麦秆
    for (let i = 0; i < 5; i++) {
      const bx = 5 + i * 3;
      R(x, bx, 9 - (i === 2 ? 3 : i === 1 || i === 3 ? 1 : 0), 2, 13, C.ink);
      R(x, bx, 10 - (i === 2 ? 3 : i === 1 || i === 3 ? 1 : 0), 1, 10, C.wheat);
      R(x, bx, 7 - (i === 2 ? 2 : 0), 1, 2, C.leafLight);
    }
    // 麦穗
    for (let i = 0; i < 5; i++) {
      const bx = 4 + i * 3;
      const top = 5 + (i === 1 || i === 3 ? 1 : 0);
      R(x, bx, top, 3, 2, C.ink);
      R(x, bx + 1, top + 1, 2, 1, C.wheatLight);
      R(x, bx - 1, top + 3, 3, 2, C.ink);
      R(x, bx, top + 4, 2, 1, C.wheat);
      R(x, bx + 2, top + 5, 3, 2, C.ink);
      R(x, bx + 2, top + 6, 2, 1, C.wheatLight);
    }
    // 捆带
    R(x, 7, 15, 10, 4, C.ink);
    R(x, 8, 15, 8, 2, C.red);
    R(x, 8, 17, 8, 1, C.redDark);
    R(x, 10, 18, 2, 3, C.red);
    R(x, 13, 18, 2, 3, C.redDark);
  }

  function drawRenown(x) {
    // 皇冠
    R(x, 4, 11, 16, 9, C.ink);
    R(x, 5, 12, 14, 6, C.gold);
    R(x, 5, 12, 14, 1, C.goldLight);
    R(x, 6, 16, 12, 1, C.goldDark);
    R(x, 5, 7, 4, 6, C.ink);
    R(x, 6, 7, 2, 4, C.gold);
    R(x, 10, 5, 4, 8, C.ink);
    R(x, 11, 5, 2, 6, C.goldLight);
    R(x, 15, 7, 4, 6, C.ink);
    R(x, 16, 7, 2, 4, C.gold);
    R(x, 3, 19, 18, 2, C.ink);
    R(x, 6, 13, 2, 2, C.red);
    R(x, 11, 12, 2, 2, C.blue);
    R(x, 16, 13, 2, 2, C.red);
    R(x, 17, 4, 1, 2, C.goldLight);
    R(x, 4, 9, 1, 1, C.goldLight);
  }

  function drawHammer(x) {
    // 木柄
    for (let i = 0; i < 12; i++) {
      R(x, 4 + i, 19 - i, 4, 3, C.ink);
      R(x, 5 + i, 19 - i, 2, 1, i < 2 ? C.woodLight : C.wood);
    }
    // 锤头
    R(x, 12, 5, 10, 7, C.ink);
    R(x, 13, 6, 8, 5, C.stone);
    R(x, 14, 6, 6, 2, C.stoneLight);
    R(x, 14, 10, 6, 1, C.stoneDark);
    R(x, 20, 7, 1, 3, C.stoneDark);
    R(x, 11, 7, 2, 3, C.woodDark);
  }

  function drawPeople(x) {
    // 后一个人
    R(x, 12, 6, 8, 8, C.ink);
    R(x, 13, 7, 6, 6, C.skinDark);
    R(x, 13, 6, 6, 3, "#6b5138");
    R(x, 10, 14, 12, 7, C.ink);
    R(x, 11, 14, 10, 6, "#5f6f7a");
    // 前一个人
    R(x, 4, 9, 9, 9, C.ink);
    R(x, 5, 10, 7, 7, C.skin);
    R(x, 5, 9, 7, 3, "#5b3b25");
    R(x, 2, 18, 14, 4, C.ink);
    R(x, 3, 18, 12, 3, C.leaf);
    R(x, 3, 21, 12, 1, C.leafDark);
    R(x, 7, 14, 1, 1, C.ink);
    R(x, 10, 14, 1, 1, C.ink);
  }

  function drawBluePrint(x) {
    R(x, 4, 3, 16, 18, C.ink);
    R(x, 5, 4, 14, 16, C.paper);
    R(x, 16, 3, 4, 4, C.cream);
    R(x, 18, 4, 2, 2, C.creamShade);
    R(x, 7, 7, 10, 1, C.blue);
    R(x, 7, 10, 7, 1, C.blueDark);
    R(x, 7, 13, 4, 1, C.blue);
    // 小草图：城垛
    R(x, 7, 15, 9, 1, C.blueDark);
    R(x, 8, 12, 1, 4, C.blueDark);
    R(x, 12, 12, 1, 4, C.blueDark);
    R(x, 15, 12, 1, 4, C.blueDark);
    R(x, 8, 11, 2, 1, C.blueDark);
    R(x, 12, 11, 2, 1, C.blueDark);
    R(x, 15, 11, 1, 1, C.blueDark);
    R(x, 6, 18, 12, 1, C.creamShade);
  }

  function drawScroll(x) {
    R(x, 5, 4, 14, 16, C.ink);
    R(x, 6, 4, 12, 15, C.paper);
    R(x, 6, 4, 12, 2, C.creamShade);
    R(x, 3, 3, 18, 3, C.ink);
    R(x, 4, 4, 16, 1, C.cream);
    R(x, 3, 18, 18, 3, C.ink);
    R(x, 4, 18, 16, 1, C.creamShade);
    R(x, 8, 8, 8, 1, C.inkSoft);
    R(x, 8, 11, 8, 1, C.inkSoft);
    R(x, 8, 14, 5, 1, C.inkSoft);
    R(x, 15, 12, 2, 4, C.red);
    R(x, 16, 13, 1, 2, C.gold);
  }

  function drawBook(x) {
    R(x, 3, 5, 18, 14, C.ink);
    R(x, 4, 6, 16, 12, "#5d4936");
    R(x, 4, 6, 16, 2, "#806647");
    R(x, 4, 16, 16, 2, C.inkSoft);
    R(x, 11, 6, 2, 12, "#3f3024");
    R(x, 5, 7, 5, 2, C.gold);
    R(x, 13, 8, 6, 1, C.creamShade);
    R(x, 13, 10, 5, 1, C.creamShade);
    R(x, 16, 12, 3, 2, C.red);
  }

  function drawLock(x) {
    // 锁梁
    ring(x, 12, 10, 6, C.ink, 3);
    x.clearRect(8, 12, 8, 4);
    ring(x, 12, 9, 4, C.stone, 2);
    // 锁体
    R(x, 5, 10, 14, 11, C.ink);
    R(x, 6, 11, 12, 9, C.goldDark);
    R(x, 6, 11, 12, 1, C.gold);
    R(x, 6, 16, 12, 4, "#8a5c21");
    R(x, 11, 13, 3, 5, C.ink);
    R(x, 12, 15, 1, 2, C.goldLight);
    R(x, 7, 12, 1, 1, C.goldLight);
  }

  function drawClock(x) {
    circle(x, 12, 13, 9, C.ink);
    circle(x, 12, 13, 7, C.goldDark);
    circle(x, 12, 13, 6, C.cream);
    ring(x, 12, 13, 6, C.gold, 1);
    R(x, 10, 3, 4, 3, C.ink);
    R(x, 11, 2, 2, 2, C.gold);
    R(x, 11, 9, 2, 5, C.inkSoft);
    R(x, 12, 12, 4, 2, C.red);
    R(x, 8, 7, 2, 1, C.goldLight);
    R(x, 11, 12, 1, 1, C.ink);
  }

  function drawSun(x) {
    circle(x, 12, 12, 5, C.goldLight);
    circle(x, 12, 12, 4, C.gold);
    R(x, 11, 1, 2, 3, C.gold);
    R(x, 11, 20, 2, 3, C.gold);
    R(x, 1, 11, 3, 2, C.gold);
    R(x, 20, 11, 3, 2, C.gold);
    R(x, 4, 4, 2, 2, C.goldLight);
    R(x, 18, 4, 2, 2, C.goldLight);
    R(x, 4, 18, 2, 2, C.goldLight);
    R(x, 18, 18, 2, 2, C.goldLight);
    R(x, 9, 9, 2, 1, C.goldLight);
  }

  function drawCloud(x) {
    R(x, 5, 12, 16, 7, C.ink);
    R(x, 8, 8, 11, 8, C.ink);
    R(x, 6, 13, 14, 5, "#b9c8c7");
    R(x, 8, 9, 10, 6, "#d7e1d8");
    R(x, 9, 9, 7, 3, "#eef1e2");
    R(x, 4, 14, 3, 3, "#a9b9b8");
    R(x, 18, 14, 3, 3, "#a9b9b8");
  }

  function drawRain(x) {
    drawCloud(x);
    R(x, 7, 20, 1, 3, "#6e9fc0");
    R(x, 11, 21, 1, 2, "#6e9fc0");
    R(x, 15, 20, 1, 3, "#6e9fc0");
    R(x, 19, 21, 1, 2, "#6e9fc0");
  }

  function drawLeaf(x) {
    R(x, 9, 3, 3, 4, C.ink);
    R(x, 8, 4, 3, 7, C.ink);
    R(x, 10, 4, 2, 5, C.wheat);
    R(x, 9, 9, 6, 7, C.ink);
    R(x, 10, 9, 5, 5, "#c9823e");
    R(x, 9, 14, 5, 4, C.ink);
    R(x, 10, 14, 3, 3, "#e0a14b");
    R(x, 13, 10, 2, 2, "#f0c46a");
    R(x, 7, 17, 5, 2, C.ink);
    R(x, 8, 16, 3, 1, "#b06a32");
    R(x, 10, 8, 1, 6, "#8d5a2b");
  }

  function drawCat(x) {
    R(x, 7, 6, 10, 9, C.ink);
    R(x, 8, 7, 8, 7, "#3d3430");
    R(x, 6, 3, 4, 5, C.ink);
    R(x, 7, 4, 2, 3, "#3d3430");
    R(x, 14, 3, 4, 5, C.ink);
    R(x, 15, 4, 2, 3, "#3d3430");
    R(x, 9, 10, 2, 2, C.gold);
    R(x, 14, 10, 2, 2, C.gold);
    R(x, 10, 11, 1, 2, C.ink);
    R(x, 15, 11, 1, 2, C.ink);
    R(x, 12, 13, 1, 1, "#b97868");
    R(x, 11, 15, 4, 3, C.ink);
    R(x, 12, 15, 2, 2, "#3d3430");
    R(x, 5, 8, 2, 1, "#3d3430");
    R(x, 2, 17, 20, 2, C.ink);
  }

  function drawBell(x) {
    R(x, 10, 2, 4, 3, C.ink);
    R(x, 11, 3, 2, 2, C.goldDark);
    R(x, 9, 5, 6, 2, C.ink);
    R(x, 7, 7, 10, 8, C.ink);
    R(x, 8, 8, 8, 6, C.gold);
    R(x, 8, 8, 5, 2, C.goldLight);
    R(x, 6, 14, 12, 3, C.ink);
    R(x, 7, 14, 10, 2, C.goldDark);
    R(x, 11, 17, 2, 3, C.ink);
    R(x, 11, 19, 2, 2, C.goldDark);
    R(x, 16, 8, 2, 1, C.goldLight);
  }

  function drawHelp(x) {
    circle(x, 12, 12, 9, C.ink);
    circle(x, 12, 12, 8, "#f0dfb4");
    R(x, 8, 7, 8, 3, C.ink);
    R(x, 14, 8, 3, 5, C.ink);
    R(x, 11, 11, 4, 3, C.ink);
    R(x, 11, 14, 2, 3, C.ink);
    R(x, 11, 18, 2, 2, C.ink);
    R(x, 9, 8, 5, 1, "#f8efd8");
  }

  function drawCrown(x) {
    R(x, 3, 12, 18, 7, C.ink);
    R(x, 4, 13, 16, 5, C.gold);
    R(x, 4, 13, 16, 1, C.goldLight);
    R(x, 4, 7, 5, 7, C.ink);
    R(x, 5, 7, 3, 5, C.gold);
    R(x, 10, 4, 4, 10, C.ink);
    R(x, 11, 4, 2, 8, C.goldLight);
    R(x, 15, 7, 5, 7, C.ink);
    R(x, 16, 7, 3, 5, C.gold);
    R(x, 2, 19, 20, 2, C.ink);
    R(x, 7, 14, 2, 2, C.red);
    R(x, 11, 13, 2, 2, C.blue);
    R(x, 16, 14, 2, 2, C.red);
  }

  function drawCrest(x) {
    // 盾牌
    R(x, 4, 3, 16, 15, C.ink);
    R(x, 5, 4, 14, 12, "#3d5b43");
    R(x, 7, 18, 10, 2, C.ink);
    R(x, 9, 20, 6, 2, C.ink);
    R(x, 11, 22, 2, 1, C.ink);
    R(x, 6, 4, 12, 2, "#587659");
    R(x, 5, 4, 2, 10, "#587659");
    R(x, 16, 7, 2, 8, "#2e4634");
    // 城塔
    R(x, 9, 8, 6, 8, C.cream);
    R(x, 8, 7, 8, 2, C.cream);
    R(x, 9, 5, 2, 2, C.cream);
    R(x, 12, 5, 2, 2, C.cream);
    R(x, 11, 11, 2, 4, C.ink);
    R(x, 9, 9, 1, 2, C.blue);
    R(x, 14, 9, 1, 2, C.blue);
    // 皇冠
    R(x, 8, 16, 8, 2, C.gold);
    R(x, 8, 15, 1, 2, C.goldLight);
    R(x, 11, 14, 2, 3, C.gold);
    R(x, 15, 15, 1, 2, C.goldLight);
    // 小星星
    R(x, 6, 8, 1, 1, C.gold);
    R(x, 17, 10, 1, 1, C.gold);
  }

  function drawPause(x) {
    R(x, 6, 5, 4, 14, C.ink);
    R(x, 14, 5, 4, 14, C.ink);
    R(x, 7, 6, 2, 12, C.cream);
    R(x, 15, 6, 2, 12, C.cream);
  }

  function drawPlay(x) {
    const rows = [4, 6, 8, 10, 12, 10, 8, 6, 4];
    for (let i = 0; i < rows.length; i++) {
      R(x, 7, 4 + i * 2, rows[i], 2, C.ink);
      R(x, 8, 5 + i * 2, Math.max(1, rows[i] - 2), 1, C.cream);
    }
  }

  function drawSpeed(x) {
    function chevron(ox) {
      for (let i = 0; i < 4; i++) {
        R(x, ox + i, 7 + i, 2, 2, C.ink);
        R(x, ox + i, 17 - i, 2, 2, C.ink);
      }
      for (let i = 0; i < 3; i++) {
        R(x, ox + 1 + i, 8 + i, 2, 2, C.cream);
        R(x, ox + 1 + i, 16 - i, 2, 2, C.cream);
      }
    }
    chevron(5);
    chevron(12);
  }

  function drawSound(x, off) {
    R(x, 3, 9, 5, 7, C.ink);
    R(x, 4, 10, 4, 5, C.cream);
    R(x, 8, 7, 3, 11, C.ink);
    R(x, 9, 8, 2, 9, C.cream);
    if (off) {
      for (let i = 0; i < 5; i++) {
        R(x, 14 + i, 8 + i, 2, 2, C.ink);
        R(x, 14 + i, 16 - i, 2, 2, C.ink);
      }
    } else {
      R(x, 14, 9, 2, 7, C.ink);
      R(x, 17, 7, 2, 11, C.ink);
      R(x, 15, 10, 1, 5, C.cream);
      R(x, 18, 8, 1, 9, C.cream);
    }
  }

  function drawBunting(x) {
    R(x, 2, 5, 20, 1, C.ink);
    const colors = [C.red, C.gold, C.blue, C.leaf, C.red];
    for (let i = 0; i < 5; i++) {
      const bx = 4 + i * 4;
      R(x, bx, 6, 3, 3, C.ink);
      R(x, bx + 1, 6, 2, 2, colors[i]);
      R(x, bx + 1, 9, 2, 2, C.ink);
      R(x, bx + 1, 9, 1, 1, colors[i]);
    }
    R(x, 7, 14, 10, 2, C.ink);
    R(x, 8, 14, 8, 1, C.gold);
    R(x, 10, 17, 4, 2, C.ink);
    R(x, 11, 17, 2, 1, C.gold);
  }

  function drawCart(x) {
    // 货箱
    R(x, 4, 9, 15, 10, C.ink);
    R(x, 5, 10, 13, 8, C.wood);
    R(x, 5, 10, 13, 2, C.woodLight);
    R(x, 8, 10, 1, 8, C.woodDark);
    R(x, 13, 10, 1, 8, C.woodDark);
    R(x, 6, 13, 3, 2, C.gold);
    R(x, 11, 13, 3, 2, C.goldLight);
    R(x, 15, 5, 2, 6, C.ink);
    R(x, 16, 5, 1, 5, C.woodLight);
    R(x, 14, 4, 5, 2, C.ink);
    R(x, 15, 4, 3, 1, C.woodLight);
    // 轮子
    circle(x, 8, 20, 3, C.ink);
    circle(x, 8, 20, 2, C.woodDark);
    R(x, 8, 20, 1, 1, C.gold);
    circle(x, 17, 20, 3, C.ink);
    circle(x, 17, 20, 2, C.woodDark);
    R(x, 17, 20, 1, 1, C.gold);
    // 车把
    R(x, 2, 11, 3, 2, C.ink);
    R(x, 2, 11, 2, 1, C.woodLight);
  }

  function drawToilet(x) {
    R(x, 5, 5, 14, 5, C.ink);
    R(x, 6, 6, 12, 3, C.cream);
    R(x, 7, 10, 10, 9, C.ink);
    R(x, 8, 11, 8, 7, "#d8d3c2");
    R(x, 9, 12, 6, 2, "#f5f0df");
    R(x, 9, 18, 6, 2, C.ink);
    R(x, 10, 19, 4, 2, "#b9b4a4");
    R(x, 16, 6, 3, 2, C.gold);
    R(x, 5, 8, 1, 8, "#8f8b7c");
  }

  function drawBath(x) {
    R(x, 3, 12, 18, 7, C.ink);
    R(x, 4, 13, 16, 5, "#d8d3c2");
    R(x, 6, 12, 12, 1, "#f5f0df");
    R(x, 5, 19, 2, 2, C.ink);
    R(x, 17, 19, 2, 2, C.ink);
    R(x, 8, 8, 1, 4, "#b9b4a4");
    R(x, 12, 6, 1, 6, "#b9b4a4");
    R(x, 16, 8, 1, 4, "#b9b4a4");
    R(x, 7, 4, 2, 2, "rgba(245,240,223,0.65)");
    R(x, 15, 3, 2, 2, "rgba(245,240,223,0.5)");
  }

  function drawDorm(x) {
    R(x, 4, 11, 18, 10, C.ink);
    R(x, 5, 12, 16, 8, C.woodDark);
    R(x, 6, 13, 14, 4, "#d8d3c2");
    R(x, 6, 13, 5, 3, C.cream);
    R(x, 5, 20, 2, 3, C.ink);
    R(x, 17, 20, 2, 3, C.ink);
    R(x, 18, 8, 2, 8, C.wood);
    R(x, 20, 6, 3, 3, C.gold);
  }

  const ICON_DRAWERS = {
    coin: drawCoin,
    wood: drawWood,
    stone: drawStone,
    food: drawFood,
    renown: drawRenown,
    hammer: drawHammer,
    people: drawPeople,
    blueprint: drawBluePrint,
    scroll: drawScroll,
    book: drawBook,
    lock: drawLock,
    clock: drawClock,
    sun: drawSun,
    cloud: drawCloud,
    rain: drawRain,
    leaf: drawLeaf,
    cat: drawCat,
    bell: drawBell,
    help: drawHelp,
    crown: drawCrown,
    crest: drawCrest,
    toilet: drawToilet,
    bath: drawBath,
    dorm: drawDorm,
    pause: drawPause,
    play: drawPlay,
    speed: drawSpeed,
    bunting: drawBunting,
    cart: drawCart
  };

  function renderIcon(name) {
    const { c, x } = makeCanvas(24, 24);
    if (ICON_DRAWERS[name]) {
      ICON_DRAWERS[name](x);
    } else if (name === "star") {
      grid(x, GRID.star, { k: C.ink, g: C.gold, l: C.goldLight }, 0, 0, 2);
    } else if (name === "heart") {
      grid(x, GRID.heart, { k: C.ink, r: C.red }, 0, 0, 2);
    } else if (name === "check") {
      grid(x, GRID.check, { k: C.ink, g: C.leaf }, 0, 0, 2);
    } else if (name === "sparkle") {
      grid(x, GRID.sparkle, { k: C.ink, l: C.goldLight }, 0, 0, 2);
    } else if (name === "arrow") {
      grid(x, GRID.arrow, { k: C.ink, g: C.gold }, 0, 0, 2);
    } else if (name === "close") {
      grid(x, GRID.close, { k: C.ink, l: C.cream }, 0, 0, 2);
    } else if (name === "soundOff") {
      drawSound(x, true);
    } else if (name === "sound") {
      drawSound(x, false);
    } else {
      drawHelp(x);
    }
    return c.toDataURL("image/png");
  }

  function icon(name) {
    if (!iconCache[name]) iconCache[name] = renderIcon(name);
    return iconCache[name];
  }

  /* ---------- 建筑小图标 ---------- */

  function drawBuildingIcon(id) {
    const { c, x } = makeCanvas(32, 32);
    // 统一的落地小阴影
    R(x, 4, 27, 24, 3, C.shadow);
    if (id === "lumber") {
      R(x, 4, 13, 19, 13, C.ink);
      R(x, 5, 14, 17, 11, C.wood);
      R(x, 5, 14, 17, 2, C.woodLight);
      R(x, 3, 10, 23, 5, C.ink);
      R(x, 4, 11, 21, 3, C.red);
      R(x, 4, 11, 21, 1, "#bf6a4e");
      R(x, 7, 18, 9, 7, C.ink);
      R(x, 8, 19, 7, 5, C.woodDark);
      R(x, 22, 16, 6, 3, C.ink);
      R(x, 22, 17, 5, 1, C.woodLight);
      R(x, 22, 20, 6, 3, C.ink);
      R(x, 22, 21, 5, 1, C.wood);
      R(x, 9, 20, 1, 1, C.gold);
      R(x, 24, 24, 4, 3, C.ink);
      R(x, 25, 24, 2, 2, C.stone);
    } else if (id === "farm") {
      // 麦田
      for (let i = 0; i < 6; i++) {
        const bx = 5 + i * 4;
        R(x, bx, 14, 2, 13, C.ink);
        R(x, bx, 15, 1, 11, C.wheat);
        R(x, bx - 1, 14, 3, 2, C.ink);
        R(x, bx, 14, 1, 1, C.wheatLight);
        R(x, bx - 1, 17, 3, 2, C.ink);
        R(x, bx, 17, 1, 1, C.wheat);
      }
      R(x, 3, 25, 26, 3, C.ink);
      R(x, 4, 25, 24, 1, "#8b6b3c");
      R(x, 22, 8, 4, 17, C.ink);
      R(x, 23, 9, 2, 15, C.wood);
      R(x, 20, 9, 8, 7, C.ink);
      R(x, 21, 10, 6, 5, C.straw || "#d6b05a");
      R(x, 22, 11, 1, 1, C.ink);
      R(x, 25, 11, 1, 1, C.ink);
      R(x, 23, 13, 2, 1, C.ink);
      R(x, 23, 6, 2, 3, C.ink);
      R(x, 24, 5, 5, 2, C.creamShade);
    } else if (id === "quarry") {
      R(x, 3, 18, 12, 9, C.ink);
      R(x, 4, 18, 10, 7, C.stone);
      R(x, 5, 18, 6, 3, C.stoneLight);
      R(x, 13, 15, 15, 12, C.ink);
      R(x, 14, 16, 13, 10, C.stoneDark);
      R(x, 15, 16, 9, 4, C.stone);
      R(x, 18, 21, 3, 3, C.stoneLight);
      R(x, 5, 23, 8, 3, "#7d6b4a");
      R(x, 8, 5, 2, 18, C.ink);
      R(x, 8, 5, 14, 2, C.ink);
      R(x, 22, 5, 2, 8, C.stoneDark);
      R(x, 21, 12, 4, 2, C.ink);
      R(x, 6, 4, 6, 2, C.stone);
      R(x, 24, 19, 5, 8, C.ink);
      R(x, 25, 20, 3, 6, C.wood);
    } else if (id === "tavern") {
      R(x, 5, 11, 22, 16, C.ink);
      R(x, 6, 12, 20, 14, "#8a6242");
      R(x, 3, 9, 26, 5, C.ink);
      R(x, 4, 10, 24, 3, C.red);
      R(x, 5, 10, 22, 1, "#c1694e");
      R(x, 8, 16, 7, 7, C.ink);
      R(x, 9, 17, 5, 5, "#f5ce73");
      R(x, 11, 17, 1, 5, C.ink);
      R(x, 9, 19, 5, 1, C.ink);
      R(x, 18, 16, 6, 11, C.ink);
      R(x, 19, 17, 4, 9, C.woodDark);
      R(x, 20, 20, 2, 3, C.gold);
      R(x, 22, 5, 4, 7, C.ink);
      R(x, 23, 2, 3, 5, C.stoneDark);
      R(x, 24, 1, 2, 2, "#d8d4c7");
      R(x, 2, 20, 3, 7, C.ink);
      R(x, 2, 21, 2, 5, C.wood);
    } else if (id === "library") {
      R(x, 6, 10, 20, 17, C.ink);
      R(x, 7, 11, 18, 15, C.stone);
      R(x, 8, 12, 16, 2, C.stoneLight);
      R(x, 4, 7, 24, 4, C.ink);
      R(x, 5, 8, 22, 2, C.blue);
      R(x, 9, 16, 5, 7, C.ink);
      R(x, 10, 17, 3, 5, "#f0c765");
      R(x, 18, 16, 5, 7, C.ink);
      R(x, 19, 17, 3, 5, "#f0c765");
      R(x, 15, 17, 2, 6, C.ink);
      R(x, 15, 18, 1, 4, C.creamShade);
      R(x, 13, 3, 6, 4, C.ink);
      R(x, 14, 2, 4, 3, C.gold);
      R(x, 15, 1, 2, 2, C.goldLight);
    } else if (id === "tower") {
      R(x, 10, 8, 12, 20, C.ink);
      R(x, 11, 9, 10, 18, C.stone);
      R(x, 12, 9, 8, 2, C.stoneLight);
      R(x, 8, 5, 16, 5, C.ink);
      R(x, 9, 6, 14, 3, C.wood);
      R(x, 7, 8, 3, 3, C.ink);
      R(x, 22, 8, 3, 3, C.ink);
      R(x, 14, 12, 4, 5, C.ink);
      R(x, 15, 13, 2, 3, "#f0c765");
      R(x, 14, 20, 4, 8, C.ink);
      R(x, 15, 21, 2, 7, C.woodDark);
      R(x, 11, 0, 2, 7, C.ink);
      R(x, 13, 0, 8, 4, C.red);
      R(x, 13, 0, 4, 2, "#c1694e");
      R(x, 6, 24, 4, 4, C.ink);
      R(x, 7, 25, 2, 2, C.leaf);
      R(x, 25, 22, 3, 5, C.ink);
      R(x, 26, 23, 1, 3, C.wood);
    } else if (id === "market") {
      R(x, 4, 14, 24, 13, C.ink);
      R(x, 5, 15, 22, 11, "#9a744b");
      R(x, 2, 8, 28, 6, C.ink);
      const cols = [C.red, C.cream, C.red, C.cream, C.red, C.cream, C.red];
      for (let i = 0; i < 7; i++) {
        R(x, 3 + i * 4, 9, 4, 4, cols[i]);
      }
      R(x, 3, 13, 26, 2, C.ink);
      R(x, 6, 17, 8, 8, C.ink);
      R(x, 7, 18, 6, 6, C.goldDark);
      R(x, 8, 19, 2, 2, C.gold);
      R(x, 19, 18, 7, 8, C.ink);
      R(x, 20, 19, 5, 6, C.wood);
      R(x, 23, 19, 1, 6, C.woodDark);
      R(x, 17, 20, 2, 2, C.leafLight);
      R(x, 25, 3, 2, 7, C.ink);
      R(x, 24, 4, 1, 4, C.gold);
      R(x, 26, 10, 3, 4, C.red);
    } else if (id === "chapel") {
      // 礼拜堂
      R(x, 7, 12, 18, 15, C.ink);
      R(x, 8, 13, 16, 13, C.stone);
      R(x, 9, 13, 14, 2, C.stoneLight);
      R(x, 4, 10, 24, 4, C.ink);
      R(x, 5, 11, 22, 2, C.blue);
      // 尖顶
      for (let y = 2; y <= 10; y++) {
        const half = 2 + Math.floor((y - 2) * 0.9);
        R(x, 16 - half, y, half * 2, 1, C.ink);
        if (y > 3) R(x, 16 - half + 1, y, Math.max(1, half * 2 - 2), 1, C.blueDark);
      }
      R(x, 15, 0, 2, 5, C.ink);
      R(x, 16, 0, 1, 4, C.gold);
      R(x, 13, 5, 6, 2, C.gold);
      R(x, 14, 4, 4, 1, C.goldLight);
      // 彩窗
      R(x, 13, 15, 6, 9, C.ink);
      R(x, 14, 16, 4, 7, "#e2b85c");
      R(x, 15, 16, 1, 7, "#a86254");
      R(x, 17, 16, 1, 4, "#4c6f86");
      R(x, 14, 16, 4, 1, "#f5d98a");
      R(x, 10, 18, 2, 6, C.ink);
      R(x, 21, 18, 2, 6, C.ink);
      R(x, 10, 18, 1, 5, "#e2c169");
      R(x, 21, 18, 1, 5, "#e2c169");
      R(x, 8, 27, 16, 2, C.ink);
      R(x, 9, 27, 14, 1, C.wood);
    }
    return c.toDataURL("image/png");
  }

  function buildingIcon(id) {
    if (!buildingCache[id]) buildingCache[id] = drawBuildingIcon(id);
    return buildingCache[id];
  }

  /* ---------- 角色肖像 ---------- */

  function drawPortrait(look, badgeColor) {
    const { c, x } = makeCanvas(40, 40);
    const bg = badgeColor || ROLE_COLOR.npc;
    R(x, 0, 0, 40, 40, C.ink);
    R(x, 1, 1, 38, 38, bg);
    // 背景斜纹
    for (let i = -10; i < 50; i += 6) {
      for (let j = 0; j < 40; j++) {
        const px = i + j;
        if (px >= 1 && px < 39 && (j % 6 < 2)) R(x, px, j, 1, 1, "rgba(255,240,200,0.06)");
      }
    }
    R(x, 1, 1, 38, 1, "rgba(255,240,200,0.16)");
    R(x, 1, 37, 38, 2, "rgba(0,0,0,0.18)");

    // 披风 / 肩部
    if (look.hat === "circlet") {
      R(x, 5, 13, 6, 19, C.ink);
      R(x, 6, 14, 4, 16, "#8e3833");
      R(x, 7, 15, 2, 10, "#a94b3c");
      R(x, 29, 13, 6, 19, C.ink);
      R(x, 30, 14, 4, 16, "#8e3833");
      R(x, 31, 15, 2, 10, "#a94b3c");
    }
    R(x, 7, 28, 26, 10, C.ink);
    R(x, 8, 29, 24, 9, look.clothes);
    R(x, 8, 29, 24, 2, look.clothesShade);
    R(x, 11, 31, 18, 7, look.clothes);
    R(x, 19, 30, 2, 8, look.accent);
    R(x, 17, 33, 6, 2, look.accent);
    R(x, 18, 33, 4, 1, "rgba(255,255,255,0.35)");
    // 领口
    R(x, 16, 27, 8, 3, C.ink);
    R(x, 17, 27, 6, 2, C.creamShade);

    // 脖子
    R(x, 15, 23, 10, 6, C.ink);
    R(x, 16, 23, 8, 5, look.skinShade);
    R(x, 16, 23, 8, 2, look.skin);

    // 耳朵
    R(x, 9, 15, 3, 5, C.ink);
    R(x, 10, 16, 2, 3, look.skinShade);
    R(x, 28, 15, 3, 5, C.ink);
    R(x, 28, 16, 2, 3, look.skinShade);

    // 头
    R(x, 12, 7, 16, 18, C.ink);
    R(x, 10, 10, 20, 12, C.ink);
    R(x, 13, 8, 14, 16, look.skin);
    R(x, 11, 11, 18, 10, look.skin);
    R(x, 13, 23, 14, 2, look.skinShade);
    R(x, 13, 8, 14, 2, look.skinLight);
    // 侧脸阴影
    R(x, 25, 11, 4, 10, look.skinShade);
    R(x, 27, 13, 2, 6, look.skinDark);
    R(x, 11, 12, 2, 8, look.skinLight);

    // 头发
    if (look.hat !== "helmet" && look.hat !== "toque") {
      R(x, 10, 6, 20, 5, C.ink);
      R(x, 11, 7, 18, 3, look.hair);
      R(x, 9, 9, 4, 11, C.ink);
      R(x, 10, 10, 3, 8, look.hair);
      R(x, 28, 9, 3, 11, C.ink);
      R(x, 28, 10, 2, 8, look.hairShade);
      if (look.hat === "none") {
        R(x, 12, 5, 15, 3, "#bdb7aa");
        R(x, 13, 5, 13, 1, "#ddd7c8");
      }
    }

    // 帽子
    if (look.hat === "cap") {
      R(x, 9, 5, 22, 6, C.ink);
      R(x, 10, 5, 20, 4, look.hatColor);
      R(x, 11, 5, 15, 1, "#6f8d68");
      R(x, 8, 9, 18, 3, C.ink);
      R(x, 9, 9, 16, 1, look.hatShade);
      R(x, 26, 6, 4, 3, look.hatShade);
      R(x, 12, 7, 2, 2, "#89a37c");
    } else if (look.hat === "straw") {
      R(x, 3, 8, 34, 5, C.ink);
      R(x, 4, 8, 32, 2, look.hatColor);
      R(x, 4, 10, 32, 2, look.hatShade);
      R(x, 11, 2, 18, 8, C.ink);
      R(x, 12, 3, 16, 6, look.hatColor);
      R(x, 13, 3, 10, 2, "#e0c47a");
      R(x, 12, 7, 16, 2, look.hatShade);
      R(x, 13, 8, 14, 2, C.red);
      R(x, 25, 10, 7, 2, C.leafDark);
      R(x, 27, 10, 4, 1, C.leafLight);
    } else if (look.hat === "bandana") {
      R(x, 9, 5, 22, 5, C.ink);
      R(x, 10, 6, 20, 3, look.hatColor);
      R(x, 10, 8, 20, 2, look.hatShade);
      R(x, 9, 9, 22, 2, C.ink);
      R(x, 28, 8, 4, 4, C.ink);
      R(x, 29, 8, 3, 3, look.hatShade);
      R(x, 8, 12, 3, 2, look.hairShade);
    } else if (look.hat === "toque") {
      R(x, 11, 1, 18, 8, C.ink);
      R(x, 12, 2, 16, 6, look.hatColor);
      R(x, 14, 1, 4, 3, look.hatShade);
      R(x, 20, 1, 4, 3, look.hatShade);
      R(x, 12, 6, 16, 3, look.hatShade);
      R(x, 9, 8, 22, 3, C.ink);
      R(x, 10, 8, 20, 1, look.hatColor);
      R(x, 13, 3, 3, 2, "#fffaf0");
    } else if (look.hat === "helmet") {
      R(x, 9, 4, 22, 8, C.ink);
      R(x, 10, 5, 20, 5, look.hatColor);
      R(x, 11, 5, 15, 2, "#c0c7c6");
      R(x, 8, 9, 24, 4, C.ink);
      R(x, 9, 9, 22, 2, look.hatShade);
      R(x, 18, 10, 4, 9, C.ink);
      R(x, 19, 10, 2, 7, look.hatColor);
      R(x, 19, 12, 2, 2, C.ink);
      R(x, 13, 13, 3, 2, C.ink);
      R(x, 24, 13, 3, 2, C.ink);
    } else if (look.hat === "hood") {
      R(x, 7, 6, 26, 26, C.ink);
      R(x, 8, 7, 24, 23, look.hatColor);
      R(x, 10, 8, 20, 22, look.clothes);
      R(x, 12, 9, 16, 17, look.skin);
      R(x, 9, 8, 4, 12, look.hatShade);
      R(x, 27, 8, 4, 12, look.hatShade);
      R(x, 11, 6, 18, 3, look.hatColor);
      R(x, 16, 26, 8, 7, look.hatColor);
      R(x, 10, 27, 5, 7, look.hatShade);
      R(x, 26, 27, 5, 7, look.hatShade);
      R(x, 13, 7, 14, 2, "#5d7898");
    } else if (look.hat === "beret") {
      R(x, 8, 3, 22, 7, C.ink);
      R(x, 8, 4, 22, 4, look.hatColor);
      R(x, 9, 3, 18, 2, "#9a729c");
      R(x, 9, 8, 22, 2, look.hatShade);
      R(x, 27, 2, 3, 4, C.ink);
      R(x, 28, 1, 5, 2, C.gold);
      R(x, 29, 0, 3, 2, C.goldLight);
      R(x, 10, 9, 20, 2, C.ink);
    } else if (look.hat === "circlet") {
      R(x, 11, 4, 18, 4, C.ink);
      R(x, 12, 4, 16, 3, look.hair);
      R(x, 10, 9, 20, 2, C.ink);
      R(x, 11, 9, 18, 1, look.hatColor);
      R(x, 18, 7, 4, 3, C.ink);
      R(x, 19, 7, 2, 2, look.hatColor);
      R(x, 19, 6, 1, 1, "#fff1b5");
      R(x, 27, 9, 2, 1, "#fff1b5");
      R(x, 9, 10, 2, 9, C.ink);
      R(x, 10, 10, 1, 8, look.hair);
    }

    // 五官
    const eyeY = 16;
    if (look.glasses) {
      R(x, 13, eyeY, 6, 4, C.ink);
      R(x, 21, eyeY, 6, 4, C.ink);
      R(x, 14, eyeY + 1, 4, 2, "rgba(230,240,235,0.35)");
      R(x, 22, eyeY + 1, 4, 2, "rgba(230,240,235,0.35)");
      R(x, 19, eyeY + 1, 2, 1, C.ink);
      R(x, 13, eyeY - 1, 6, 1, C.inkSoft);
      R(x, 21, eyeY - 1, 6, 1, C.inkSoft);
    }
    R(x, 14, eyeY + 1, 2, 2, C.ink);
    R(x, 23, eyeY + 1, 2, 2, C.ink);
    R(x, 14, eyeY + 1, 1, 1, "#f8f1dd");
    R(x, 23, eyeY + 1, 1, 1, "#f8f1dd");
    R(x, 13, eyeY - 2, 4, 1, look.hairShade);
    R(x, 22, eyeY - 2, 4, 1, look.hairShade);
    // 鼻子
    R(x, 19, 18, 2, 3, look.skinShade);
    R(x, 19, 20, 3, 1, look.skinDark);
    // 嘴
    if (look.beard === "brown" || look.beard === "grey") {
      R(x, 16, 23, 8, 3, look.beard === "grey" ? "#c6c0b1" : look.hair);
      R(x, 14, 22, 3, 4, look.beard === "grey" ? "#aaa496" : look.hairShade);
      R(x, 24, 22, 3, 4, look.beard === "grey" ? "#aaa496" : look.hairShade);
      R(x, 13, 22, 2, 3, look.beard === "grey" ? "#d5cfc0" : look.hairShade);
      R(x, 26, 22, 2, 3, look.beard === "grey" ? "#d5cfc0" : look.hairShade);
      R(x, 17, 21, 6, 2, look.beard === "grey" ? "#ddd7c7" : look.hair);
      R(x, 18, 22, 4, 1, "#5e3928");
      R(x, 17, 19, 3, 1, look.beard === "grey" ? "#ddd7c7" : look.hair);
      R(x, 21, 19, 3, 1, look.beard === "grey" ? "#ddd7c7" : look.hair);
    } else {
      R(x, 17, 21, 5, 1, C.inkSoft);
      R(x, 18, 22, 3, 1, "#b06b58");
      if (look.hat === "none") {
        R(x, 16, 20, 3, 2, "#d9d3c3");
        R(x, 22, 20, 3, 2, "#d9d3c3");
        R(x, 17, 21, 7, 2, "#e8e2d3");
      }
    }
    if (look.blush) {
      R(x, 12, 19, 3, 1, "rgba(201,106,91,0.55)");
      R(x, 26, 19, 2, 1, "rgba(201,106,91,0.55)");
    }
    if (look.monocle) {
      R(x, 21, 14, 7, 7, C.gold);
      x.clearRect(22, 15, 5, 5);
      R(x, 22, 15, 5, 1, "rgba(220,235,240,0.35)");
      R(x, 27, 19, 1, 4, C.goldDark);
      R(x, 28, 22, 3, 1, C.goldDark);
    }
    if (look.hat === "beret") {
      R(x, 8, 19, 1, 2, C.gold);
      R(x, 9, 21, 1, 1, C.goldLight);
    }
    // 斑
    if (look.hat === "straw") {
      R(x, 13, 19, 1, 1, "#b77a55");
      R(x, 15, 20, 1, 1, "#b77a55");
      R(x, 25, 19, 1, 1, "#b77a55");
      R(x, 27, 20, 1, 1, "#b77a55");
    }

    return c.toDataURL("image/png");
  }

  function maskedPortrait(type) {
    const key = "mask-" + (type ? type.id : "unknown");
    if (!portraitCache[key]) {
      const { c, x } = makeCanvas(40, 40);
      const color = type ? type.mask : "#d6a44e";
      R(x, 0, 0, 40, 40, C.ink);
      R(x, 1, 1, 38, 38, "#34302a");
      for (let i = -8; i < 48; i += 7) {
        for (let j = 0; j < 40; j++) {
          const px = i + j;
          if (px >= 1 && px < 39 && j % 7 < 2) R(x, px, j, 1, 1, "rgba(255,235,190,0.05)");
        }
      }
      // 斗篷
      R(x, 5, 25, 30, 14, C.ink);
      R(x, 6, 26, 28, 12, "#4a3f35");
      R(x, 8, 27, 24, 3, "#635548");
      // 兜帽
      R(x, 8, 5, 24, 27, C.ink);
      R(x, 9, 6, 22, 25, "#3d3831");
      R(x, 12, 8, 16, 18, "#292622");
      // 面具
      R(x, 11, 11, 18, 14, C.ink);
      R(x, 12, 12, 16, 12, color);
      R(x, 13, 12, 14, 2, "rgba(255,240,190,0.3)");
      R(x, 13, 15, 4, 3, "#2b211b");
      R(x, 23, 15, 4, 3, "#2b211b");
      R(x, 14, 16, 2, 1, "#f4e4b5");
      R(x, 24, 16, 2, 1, "#f4e4b5");
      R(x, 17, 21, 6, 1, "#5d4635");
      R(x, 18, 22, 4, 1, "#3b2c22");
      // 面具装饰
      R(x, 19, 8, 2, 3, color);
      R(x, 18, 7, 4, 1, C.gold);
      R(x, 12, 24, 16, 2, C.ink);
      // 羽毛
      R(x, 29, 7, 2, 8, "#7d5c3d");
      R(x, 31, 4, 5, 3, color);
      R(x, 32, 3, 3, 2, "#f0d28a");
      return c.toDataURL("image/png");
    }
    return portraitCache[key];
  }

  function portraitFor(worker) {
    const key = worker.id;
    if (!portraitCache[key]) {
      const color = ROLE_COLOR[worker.role] || ROLE_COLOR.npc;
      portraitCache[key] = drawPortrait(worker.look, color);
    }
    return portraitCache[key];
  }

  function npcPortrait(npcId) {
    const key = "npc-" + npcId;
    if (!portraitCache[key]) {
      const npc = window.GameData.NPCS[npcId];
      const color = npcId === "player" ? ROLE_COLOR.player : ROLE_COLOR.npc;
      portraitCache[key] = drawPortrait(npc.look, color);
    }
    return portraitCache[key];
  }

  function paintDataIcons(root) {
    const nodes = (root || document).querySelectorAll("[data-icon]");
    nodes.forEach(function (el) {
      const name = el.getAttribute("data-icon");
      if (!el.getAttribute("src") && name) {
        el.src = icon(name);
        el.alt = "";
        el.className += " pixel-icon";
      }
    });
  }

  return {
    icon: icon,
    buildingIcon: buildingIcon,
    portraitFor: portraitFor,
    npcPortrait: npcPortrait,
    maskedPortrait: maskedPortrait,
    paintDataIcons: paintDataIcons,
    ROLE_COLOR: ROLE_COLOR,
    C: C
  };
})();
