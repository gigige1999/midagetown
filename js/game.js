/* =========================================================
   城堡物语 v2 · 主逻辑
   简化循环：雇人 → 建造 → 生产 → 行商卖钱 → 进入城堡修房间
   ========================================================= */
(function () {
  "use strict";

  const D = window.GameData;
  const I = window.Icons;
  const A = window.GameAudio;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  const RES_ORDER = ["gold", "wood", "stone", "food"];
  const WORKER_MAP = {};
  D.WORKERS.forEach(function (w) { WORKER_MAP[w.id] = w; });
  const BUILDING_MAP = {};
  D.BUILDINGS.forEach(function (b) { BUILDING_MAP[b.id] = b; });

  let state = null;
  let started = false;
  let lastFrame = 0;
  let muted = false;
  let saveExists = false;
  let tradeNote = "";
  let lastFocus = null;
  let resizeObserver = null;
  let toastSeq = 0;

  const ui = {
    tab: "build",
    modalOpen: false,
    dialogueOpen: false,
    startHidden: false,
    guideSig: "",
    ledgerAccum: 0,
    questCheckAccum: 0,
    guideCheckAccum: 0,
    guideUiAccum: 0,
    uiAccum: 0,
    audioAccum: 0,
    saveAccum: 0,
    dailyAccum: 0,
    lastSavedAt: 0,
    lastRes: {},
    lastWeather: "",
    lastSoundMuted: null,
    highlightWorker: null,
    highlightArea: null,
    guideTarget: null,
    dialogue: null,
    festivalPrevSpeed: 1,
    lastMealDay: 0,
    hintIndex: 0,
    sidebarCollapsed: false,
    tradeTab: "sell",
    debugMode: false
  };

  /* =========================================================
     初始化
     ========================================================= */
  function init() {
    muted = safeStorageGet(D.MUTE_KEY) === "1";
    I.paintDataIcons();
    buildResourceStrip();
    const steward = $("#stewardPortrait");
    if (steward) steward.src = I.npcPortrait("samuel");
    initScene();
    bindEvents();
    detectSave();
    const previewSave = peekSave();
    state = (previewSave && normalizeState(previewSave)) || createInitialState();
    setSpeedButtons(1);
    renderAll(true);
    fitScene();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(fitScene);
      const holder = $("#sceneHolder");
      if (holder) resizeObserver.observe(holder);
    }
    window.addEventListener("resize", fitScene);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitScene);
    requestAnimationFrame(loop);
    updateSoundButton();
    updateStartScreen(peekSave());
  }

  function initScene() {
    window.CastleScene.init($("#scene"), {
      onBuilding: function (id) {
        const b = BUILDING_MAP[id];
        if (b && b.scene === "indoor") return;
        openAreaModal(id);
      },
      onWorker: function (id) {
        if (!started) return;
        ui.tab = "people";
        ui.highlightWorker = id;
        renderLedger(true);
        updateTabs();
        const w = WORKER_MAP[id];
        if (w) toast("已打开居民页，可以查看" + w.name + "。", "neutral", "people");
      },
      onCat: function () {
        if (!started) return;
        toast("呼噜呼噜……猫在阳光下翻了个身。它不负责生产，但负责让大家觉得像家。", "good", "heart");
      },
      onPlayer: function () {
        if (!started) return;
        ui.tab = "journal";
        renderLedger(true);
        updateTabs();
        toast("你翻开手记。城堡的每一步都记在这里。", "neutral", "book");
      },
      onCastle: function () {
        if (!started || ui.modalOpen) return;
        openCastleModal();
      }
    });
  }

  function buildResourceStrip() {
    const strip = $("#resourceStrip");
    strip.innerHTML = RES_ORDER.map(function (key) {
      const r = D.RESOURCES[key];
      return '<div class="resource-pill" data-res-pill="' + key + '" title="' + r.name + "：" + r.hint + '">' +
        '<img src="' + I.icon(r.icon) + '" alt="">' +
        '<div class="res-copy"><span class="res-name">' + r.name + '</span>' +
        '<span class="res-value" id="resVal-' + key + '">0</span>' +
        '<span class="res-rate" id="resRate-' + key + '">' + (key === "gold" ? "靠行商" : "+0/分") + "</span></div></div>";
    }).join("");
    RES_ORDER.forEach(function (k) { ui.lastRes[k] = 0; });
  }

  /* =========================================================
     状态
     ========================================================= */
  function createInitialState() {
    const workers = {};
    D.WORKERS.forEach(function (w) { workers[w.id] = { hired: false }; });
    const buildings = {};
    D.BUILDINGS.forEach(function (b) { buildings[b.id] = { status: "locked", progress: 0, level: 1 }; });
    return {
      version: D.VERSION,
      day: 1,
      dayProgress: (D.START_HOUR - 6) / 24,
      speed: 1,
      weather: "clear",
      view: "outdoor",
      resources: { gold: 45, wood: 25, stone: 5, food: 10 },
      workers: workers,
      buildings: buildings,
      guideIndex: 0,
      interiorUnlocked: false,
      expansionUnlocked: false,
      menus: [],
      shops: { bakery: { status: "locked" }, smithy: { status: "locked" }, general: { status: "locked" }, fishmonger: { status: "locked" }, flower: { status: "locked" } },
      expansionFloors: [{}],
      expansionFloorCount: 1,
      floorSkins: { 0: { owned: ["stone"], selected: "stone" } },
      interiorSkin: { owned: ["stone"], selected: "stone" },
      land: { plots: [
        { unlocked: true, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null },
        { unlocked: false, crop: null, growth: 0, ready: false, plantedDay: null }
      ], shops: [null, null], cropsSeen: {} },
      currentFloor: 0,
      trade: { day: 1, bought: { wood: 0, stone: 0, food: 0 } },
      genericResidents: [],
      nextGenericId: 1,
      flags: { introSeen: false, enteredCastle: false, festivalHeld: false, festivalDay: null, chapelBuilt: false },
      lastMeal: { day: 1, fed: true, upkeep: 0, residents: 0 },
      stats: { hired: 0, built: 0, soldWood: 0, soldStone: 0, soldFood: 0, playSeconds: 0 },
      log: [
        { day: 1, text: "你回到了风息堡。这里只剩断墙和一间还没塌的厨房。", kind: "good" },
        { day: 1, text: "老管家塞缪尔说：先请木匠，修伐木场，再把木头卖给行商。", kind: "info" }
      ],
      startedAt: Date.now(),
      lastSavedAt: 0
    };
  }

  function normalizeState(raw) {
    if (!raw || raw.version !== D.VERSION) return null;
    const base = createInitialState();
    const s = Object.assign(base, raw);
    s.resources = Object.assign({}, base.resources, raw.resources || {});
    Object.keys(base.resources).forEach(function (k) {
      const n = Number(s.resources[k]);
      s.resources[k] = isFinite(n) ? Math.max(0, n) : 0;
    });
    s.workers = {};
    D.WORKERS.forEach(function (w) {
      const saved = raw.workers && raw.workers[w.id] ? raw.workers[w.id] : {};
      s.workers[w.id] = { hired: !!saved.hired };
    });
    s.buildings = {};
    D.BUILDINGS.forEach(function (b) {
      const saved = raw.buildings && raw.buildings[b.id] ? raw.buildings[b.id] : {};
      let status = ["locked", "available", "building", "built"].indexOf(saved.status) >= 0 ? saved.status : "locked";
      s.buildings[b.id] = {
        status: status,
        progress: status === "built" ? 1 : clamp(Number(saved.progress) || 0, 0, 0.999),
        level: clamp(Math.floor(Number(saved.level) || 1), 1, D.MAX_BUILDING_LEVEL)
      };
    });
    s.day = Math.max(1, Number(s.day) || 1);
    s.dayProgress = clamp(Number(s.dayProgress) || 0, 0, 0.9999);
    s.speed = [0, 1, 2, 3].indexOf(Number(s.speed)) >= 0 ? Number(s.speed) : 1;
    s.weather = ["clear", "cloudy", "rain"].indexOf(s.weather) >= 0 ? s.weather : "clear";
    s.view = ["outdoor", "indoor", "expansion", "land"].indexOf(s.view) >= 0 ? s.view : "outdoor";
    s.guideIndex = clamp(Number(s.guideIndex) || 0, 0, D.GUIDE.length);
    s.flags = Object.assign({ introSeen: true, enteredCastle: false, festivalHeld: false, festivalDay: null, chapelBuilt: false }, raw.flags || {});
    s.lastMeal = Object.assign({ day: 1, fed: true, upkeep: 0, residents: 0 }, raw.lastMeal || {});
    s.stats = Object.assign({ hired: 0, built: 0, soldWood: 0, soldStone: 0, soldFood: 0, playSeconds: 0 }, raw.stats || {});
    if (!Array.isArray(s.log)) s.log = base.log;

    // 修复解锁关系
    D.BUILDINGS.forEach(function (b) {
      const bs = s.buildings[b.id];
      if (b.scene === "outdoor") {
        const w = b.worker && s.workers[b.worker];
        if (statusSafe(bs) === "locked" && w && w.hired) bs.status = "available";
        if (bs.status === "built" && b.worker) s.workers[b.worker].hired = true;
      } else {
        if (bs.status === "built" && b.worker) s.workers[b.worker].hired = true;
      }
    });
    s.interiorUnlocked = !!s.interiorUnlocked || D.countOutdoorBuilt(s) >= 2;
    D.BUILDINGS.forEach(function (b) {
      if (b.scene === "indoor") {
        const bs = s.buildings[b.id];
        if (bs.status === "locked" && s.interiorUnlocked && b.id !== "chapel") bs.status = "available";
        if (b.id === "chapel") {
          const fourRooms = ["kitchen", "study", "barracks", "storeroom"].every(function (id) {
            return s.buildings[id].status === "built";
          });
          if (fourRooms && bs.status === "locked") bs.status = "available";
        }
      }
    });
    if (!s.interiorUnlocked && s.view === "indoor") s.view = "outdoor";
    if (s.buildings.chapel.status === "built") s.flags.chapelBuilt = true;
    // 新系统：菜单、商铺、扩建、面具居民
    s.menus = Array.isArray(raw.menus) ? raw.menus.filter(function (id) {
      return D.MENUS.some(function (m) { return m.id === id; });
    }) : [];
    const shopBase = { bakery: "locked", smithy: "locked", general: "locked" };
    s.shops = {};
    D.SHOPS.forEach(function (shop) {
      const saved = raw.shops && raw.shops[shop.id] && raw.shops[shop.id].status;
      s.shops[shop.id] = { status: ["locked", "available", "built"].indexOf(saved) >= 0 ? saved : "locked" };
    });
    function cleanFloor(src) {
      const out = {};
      D.EXPANSION_SLOTS.forEach(function (slot) {
        const saved = src && src[slot.id];
        const type = saved && D.EXPANSION_ROOMS.some(function (r) { return r.id === saved.type; }) ? saved.type : null;
        out[slot.id] = type ? { type: type, level: clamp(Math.floor(Number(saved.level) || 1), 1, 5) } : null;
      });
      return out;
    }
    if (Array.isArray(raw.expansionFloors) && raw.expansionFloors.length) {
      s.expansionFloors = raw.expansionFloors.slice(0, D.MAX_FLOORS).map(cleanFloor);
    } else if (raw.expansionRooms) {
      // v3 存档迁移：6 个旧位置 → 第一层前 6 个位置
      const legacy = {};
      ["e1","e2","e3","e4","e5","e6"].forEach(function (id, i) {
        if (raw.expansionRooms[id]) legacy["s" + (i + 1)] = raw.expansionRooms[id];
      });
      s.expansionFloors = [cleanFloor(legacy)];
    } else {
      s.expansionFloors = [cleanFloor({})];
    }
    if (!s.expansionFloors.length) s.expansionFloors = [cleanFloor({})];
    s.expansionFloorCount = clamp(Math.floor(Number(raw.expansionFloorCount) || 1), 1, D.MAX_FLOORS);
    // 有房间的楼层必须计入解锁层数
    s.expansionFloors.forEach(function (floor, i) {
      if (Object.keys(floor).some(function (k) { return !!floor[k]; })) s.expansionFloorCount = Math.max(s.expansionFloorCount, i + 1);
    });
    s.currentFloor = clamp(Number(raw.currentFloor) || 0, 0, s.expansionFloorCount - 1);
    s.floorSkins = {};
    const rawSkins = raw.floorSkins || {};
    Object.keys(rawSkins).forEach(function (key) {
      const idx = Number(key);
      if (!isFinite(idx) || idx < 0 || idx >= D.MAX_FLOORS) return;
      const src = rawSkins[key] || {};
      const owned = Array.isArray(src.owned) ? src.owned.filter(function (id) {
        return D.FLOOR_SKINS.some(function (sk) { return sk.id === id; });
      }) : [];
      if (owned.indexOf("stone") < 0) owned.push("stone");
      const selected = D.FLOOR_SKINS.some(function (sk) { return sk.id === src.selected; }) && owned.indexOf(src.selected) >= 0 ? src.selected : "stone";
      s.floorSkins[idx] = { owned: owned, selected: selected };
    });
    if (!s.floorSkins[0]) s.floorSkins[0] = { owned: ["stone"], selected: "stone" };
    const rawInterior = raw.interiorSkin || {};
    const interiorOwned = Array.isArray(rawInterior.owned) ? rawInterior.owned.filter(function (id) {
      return D.FLOOR_SKINS.some(function (sk) { return sk.id === id; });
    }) : [];
    if (interiorOwned.indexOf("stone") < 0) interiorOwned.push("stone");
    s.interiorSkin = {
      owned: interiorOwned,
      selected: D.FLOOR_SKINS.some(function (sk) { return sk.id === rawInterior.selected; }) && interiorOwned.indexOf(rawInterior.selected) >= 0 ? rawInterior.selected : "stone"
    };
    const rawLand = raw.land || {};
    const rawPlots = Array.isArray(rawLand.plots) ? rawLand.plots : [];
    s.land = { plots: [] };
    for (let i = 0; i < D.LAND_PLOT_RECTS.length; i++) {
      const src = rawPlots[i] || {};
      const crop = D.CROPS.some(function (c) { return c.id === src.crop; }) ? src.crop : null;
      s.land.plots.push({
        unlocked: i === 0 ? true : !!src.unlocked,
        crop: src.unlocked ? crop : null,
        growth: clamp(Number(src.growth) || 0, 0, 4),
        ready: !!(src.unlocked && crop && src.ready),
        plantedDay: Number(src.plantedDay) || null
      });
    }
    const rawLandShops = Array.isArray(rawLand.shops) ? rawLand.shops : [];
    s.land.shops = [0, 1].map(function (i) {
      const id = rawLandShops[i];
      return D.LAND_SHOPS.some(function (sh) { return sh.id === id; }) ? id : null;
    });
    s.land.cropsSeen = {};
    Object.keys(rawLand.cropsSeen || {}).forEach(function (id) {
      if (D.CROPS.some(function (c) { return c.id === id; })) s.land.cropsSeen[id] = true;
    });
    s.genericResidents = Array.isArray(raw.genericResidents) ? raw.genericResidents.filter(function (r) {
      return r && D.MASK_TYPES.some(function (m) { return m.id === r.type; });
    }).map(function (r) {
      const klass = D.GUEST_CLASSES.some(function (c) { return c.id === r.klass; }) ? r.klass : "resident";
      return {
        id: Number(r.id) || 0,
        type: r.type,
        klass: klass,
        floor: clamp(Number(r.floor) || 0, 0, D.MAX_FLOORS - 1),
        variant: Number(r.variant) || 0,
        name: String(r.name || "面具居民")
      };
    }) : [];
    s.nextGenericId = Math.max(1, Number(raw.nextGenericId) || 1);
    s.trade = Object.assign({ day: s.day, bought: { wood: 0, stone: 0, food: 0 } }, raw.trade || {});
    s.trade.bought = Object.assign({ wood: 0, stone: 0, food: 0 }, s.trade.bought || {});
    Object.keys(s.trade.bought).forEach(function (k) {
      s.trade.bought[k] = Math.max(0, Math.floor(Number(s.trade.bought[k]) || 0));
    });
    if (s.trade.day !== s.day) s.trade = { day: s.day, bought: { wood: 0, stone: 0, food: 0 } };
    s.expansionUnlocked = !!raw.expansionUnlocked || ["kitchen","study","barracks","storeroom","chapel"].every(function (id) {
      return s.buildings[id] && s.buildings[id].status === "built";
    });
    if (s.view === "expansion" && !s.expansionUnlocked) s.view = "outdoor";
    refreshShopUnlocks(s);
    if (s.buildings.chapel.status === "built") s.flags.chapelBuilt = true;
    s.version = D.VERSION;
    return s;
  }

  function statusSafe(bs) { return bs ? bs.status : "locked"; }

  function peekSave() {
    try {
      const raw = localStorage.getItem(D.SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === D.VERSION ? parsed : null;
    } catch (e) { return null; }
  }

  function detectSave() {
    const saved = peekSave();
    saveExists = !!saved;
    updateStartScreen(saved);
  }

  function saveState(silent) {
    if (!started || !state) return;
    try {
      state.lastSavedAt = Date.now();
      localStorage.setItem(D.SAVE_KEY, JSON.stringify(state));
      saveExists = true;
      ui.lastSavedAt = state.lastSavedAt;
      if (!silent) updateSaveStatus();
    } catch (e) {
      const el = $("#saveStatus");
      if (el) el.textContent = "无法写入自动存档";
    }
  }

  function updateSaveStatus() {
    const el = $("#saveStatus");
    if (!el) return;
    if (!ui.lastSavedAt) { el.textContent = "自动存档已开启"; return; }
    const d = new Date(ui.lastSavedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    el.textContent = "已保存 · " + hh + ":" + mm;
  }

  function safeStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* =========================================================
     开始 / 继续
     ========================================================= */
  function updateStartScreen(saved) {
    const continueBtn = $("#continueBtn");
    if (!continueBtn) return;
    if (saved) {
      continueBtn.hidden = false;
      continueBtn.textContent = "继续经营 · 第 " + saved.day + " 天";
      continueBtn.classList.remove("btn-ghost");
      continueBtn.classList.add("btn-gold");
      const newBtn = $("#newGameBtn");
      if (newBtn) { newBtn.classList.remove("btn-gold"); newBtn.classList.add("btn-ghost"); }
      const foot = $(".start-foot");
      if (foot) foot.textContent = "已有城堡存档 · 选择新故事会覆盖旧存档";
    } else {
      continueBtn.hidden = true;
    }
  }

  function ensureAudio() {
    try {
      A.init();
      A.setMuted(muted);
      A.startMusic();
      updateAudioEnvironment();
    } catch (e) { /* ignore */ }
    updateSoundButton();
  }

  function hideStart() {
    if (ui.startHidden) return;
    ui.startHidden = true;
    const screen = $("#startScreen");
    screen.classList.add("hidden");
    setTimeout(function () { screen.style.display = "none"; }, 500);
  }

  function beginNewGame() {
    closeModal(true);
    hideStart();
    ensureAudio();
    state = createInitialState();
    started = true;
    state.speed = 1;
    ui.tab = "build";
    ui.guideSig = "";
    ui.lastSavedAt = 0;
    ui.highlightWorker = null;
    ui.highlightArea = null;
    setSpeedButtons(1);
    renderAll(true);
    saveState(true);
    showIntroDialogue();
  }

  function continueGame() {
    const saved = peekSave();
    const loaded = saved && normalizeState(saved);
    if (!loaded) { beginNewGame(); return; }
    closeModal(true);
    hideStart();
    ensureAudio();
    state = loaded;
    started = true;
    state.speed = 1;
    ui.tab = "build";
    ui.guideSig = "";
    ui.lastSavedAt = saved.lastSavedAt || 0;
    setSpeedButtons(1);
    renderAll(true);
    updateSaveStatus();
    toast("欢迎回来，殿下。风息堡等了你 " + state.day + " 天。", "gold", "crest");
  }

  function showIntroDialogue() {
    showDialogue({
      npc: "samuel",
      lines: [
        "殿下，您终于回来了。风息堡只剩断墙，地窖里还剩一点木材和金币。",
        "先在城门口请木匠巴特。修好伐木场，他就会自动生产木材。",
        "木材不仅能修房子，也能卖给门口的行商换金币。有了金币，才能请石匠、农夫，打开更多区域。",
        "记住：每个人每天都要吃饭。吃得饱，大家干活才更快。城堡里还有很多房间在等我们。"
      ],
      onDone: function () {
        state.flags.introSeen = true;
        addLog("塞缪尔把城堡钥匙交给了你。", "good");
        renderAll(true);
        saveState();
        toast("点击金色按钮就能雇佣巴特，不用自己找。", "gold", "people");
      }
    });
  }

  /* =========================================================
     循环
     ========================================================= */
  function loop(now) {
    const dt = Math.min(0.08, Math.max(0, (now - lastFrame) / 1000)) || 0;
    lastFrame = now;
    if (started && !ui.modalOpen && !ui.dialogueOpen && state && state.speed > 0) {
      updateGame(dt * state.speed);
    }
    if (window.CastleScene) window.CastleScene.draw(dt, state);
    if (started) updateRealtimeUI(dt);
    requestAnimationFrame(loop);
  }

  function updateGame(dt) {
    if (!state) return;
    state.stats.playSeconds += dt;
    state.dayProgress += dt / D.DAY_LENGTH;
    while (state.dayProgress >= 1) {
      state.dayProgress -= 1;
      onNewDay();
    }
    produce(dt);
    D.BUILDINGS.forEach(function (b) {
      const bs = state.buildings[b.id];
      if (bs.status !== "building") return;
      bs.progress += dt / b.time;
      if (bs.progress >= 1) {
        bs.progress = 1;
        completeBuilding(b);
      }
    });
    ui.guideCheckAccum += dt;
    if (ui.guideCheckAccum >= 0.35) {
      ui.guideCheckAccum = 0;
      checkGuide();
    }
    ui.saveAccum += dt;
    if (ui.saveAccum >= 5) {
      ui.saveAccum = 0;
      saveState(true);
    }
  }

  function produce(dt) {
    const eff = efficiencyInfo();
    D.BUILDINGS.forEach(function (b) {
      const bs = state.buildings[b.id];
      if (bs.status !== "built") return;
      if (!b.worker || !state.workers[b.worker] || !state.workers[b.worker].hired) return;
      let mult = eff.multiplier * outputMultiplier(b) * (b.id === "farm" && state.weather === "rain" ? 1.25 : 1);
      if (b.id === "farm") mult *= 1 + expansionBonuses().foodBonus;
      Object.keys(b.output || {}).forEach(function (res) {
        state.resources[res] = (state.resources[res] || 0) + b.output[res] * mult * dt;
      });
    });
    state.resources.gold += (residentGoldRate() + shopIncomeRate()) * dt;
  }

  function buildingLevel(id) {
    return state.buildings[id] ? state.buildings[id].level || 1 : 1;
  }

  function outputMultiplier(b) {
    return 1 + 0.30 * (buildingLevel(b.id) - 1);
  }

  function kitchenFoodReduction() {
    const built = state.buildings.kitchen.status === "built";
    if (!built) return 0;
    return 1 + Math.floor((buildingLevel("kitchen") - 1) / 2);
  }

  function studyProductionBonus() {
    if (state.buildings.study.status !== "built") return 0;
    return 0.05 * (buildingLevel("study") - 1);
  }

  function storeroomSellBonus() {
    if (state.buildings.storeroom.status !== "built") return 0;
    return 0.10 * (buildingLevel("storeroom") - 1);
  }

  function roomSatisfactionBonus() {
    let n = 0;
    ["kitchen","study","barracks","storeroom","chapel"].forEach(function (id) {
      if (state.buildings[id].status === "built") n += (buildingLevel(id) - 1) * 2;
    });
    return n;
  }

  function upgradeCost(b) {
    const lv = buildingLevel(b.id);
    if (lv >= D.MAX_BUILDING_LEVEL) return null;
    if (b.id === "lumber") return { wood: 12 * lv, gold: 10 * lv };
    if (b.id === "farm") return { wood: 10 * lv, gold: 10 * lv, food: 4 * lv };
    if (b.id === "quarry") return { wood: 14 * lv, stone: 8 * lv, gold: 12 * lv };
    return { wood: 10 * lv, stone: 8 * lv, gold: 22 * lv };
  }

  function upgradeEffectText(b) {
    const lv = buildingLevel(b.id);
    if (lv >= D.MAX_BUILDING_LEVEL) return "已达到最高等级。";
    if (b.scene === "outdoor") return "产速 +30%（升级后 Lv." + (lv + 1) + "）。";
    if (b.id === "kitchen") return "每日口粮减免增加，满意度 +2。";
    if (b.id === "study") return "全城生产 +5%，满意度 +2。";
    if (b.id === "barracks") return "居民满意度 +2，驻守更安稳。";
    if (b.id === "storeroom") return "出售价格 +10%，满意度 +2。";
    if (b.id === "chapel") return "居民满意度 +2，城堡威望提高。";
    return "房间效果提高，满意度 +2。";
  }

  function upgradeBuilding(id) {
    if (!started) return;
    const b = BUILDING_MAP[id];
    const bs = state.buildings[id];
    if (!b || !bs || bs.status !== "built") { toast("先建成这个区域。", "bad", "lock"); return; }
    if (buildingLevel(id) >= D.MAX_BUILDING_LEVEL) { toast("已经达到最高等级。", "bad", "star"); return; }
    const cost = upgradeCost(b);
    if (!canAfford(cost)) { toast("扩建材料不够，还差：" + missingCostsText(cost), "bad", "hammer"); return; }
    payCost(cost);
    bs.level = buildingLevel(id) + 1;
    addLog("「" + b.name + "」扩建到 Lv." + bs.level + "。", "good");
    toast(b.name + " 升级到 Lv." + bs.level + "！" + upgradeEffectText(Object.assign({}, b, { scene: b.scene })), "gold", "star");
    A.sfx("complete");
    closeModal(true);
    ui.guideSig = "";
    renderAll(true);
    saveState();
  }

  function openUpgradeModal(id) {
    const b = BUILDING_MAP[id];
    const bs = state.buildings[id];
    if (!b || !bs || bs.status !== "built") return;
    const lv = buildingLevel(id);
    if (lv >= D.MAX_BUILDING_LEVEL) { toast(b.name + "已经达到 Lv." + D.MAX_BUILDING_LEVEL + "。", "good", "star"); return; }
    const cost = upgradeCost(b);
    const afford = canAfford(cost);
    openModal(
      modalHead(b.icon, b.scene === "indoor" ? "城堡房间 · 升级" : "庭院区域 · 扩建", b.name + " · Lv." + lv + " → Lv." + (lv + 1), "升级不需要重新施工，立刻生效。") +
      '<div class="modal-body"><div class="upgrade-preview"><div><span>当前等级</span><b>Lv.' + lv + "</b></div><div><span>下一等级</span><b>Lv." + (lv + 1) + "</b></div></div>" +
      '<div class="requirement"><img src="' + I.icon("sparkle") + '" alt="">' + upgradeEffectText(b) + "</div>" +
      '<div class="cost-row">' + costHTML(cost, true) + "</div>" +
      '<div class="modal-actions"><span class="modal-note">' + (afford ? "材料充足，可以立刻升级。" : "材料不足：" + missingCostsText(cost)) + "</span>" +
      '<button class="btn btn-ghost" data-action="close-modal">稍后</button>' +
      '<button class="btn btn-gold" data-action="upgrade-confirm" data-id="' + id + '"' + (afford ? "" : " disabled") + '>立刻升级</button></div></div>'
    );
  }

  function satisfactionInfo() {
    let score = 60;
    const reasons = [];
    const fed = state.lastMeal.fed !== false;
    if (fed) { score += 15; reasons.push({ label: "吃饱", value: 15, good: true }); }
    else { score -= 30; reasons.push({ label: "饿肚子", value: -30, good: false }); }
    const rooms = countResidents();
    const free = residentCapacity() - rooms;
    if (rooms > 0 && free >= 2) { score += 5; reasons.push({ label: "空间宽裕", value: 5, good: true }); }
    if (rooms > 0 && free <= 0) { score -= 5; reasons.push({ label: "空间已满", value: -5, good: false }); }
    let menuBonus = Math.min(20, state.menus.length * 4);
    menuBonus += Math.round(menuAffinity("missionary") * 100);
    if (menuBonus) { score += menuBonus; reasons.push({ label: "菜单丰富", value: menuBonus, good: true }); }
    const exp = expansionBonuses();
    if (exp.satisfaction) {
      score += exp.satisfaction;
      reasons.push({ label: "扩建层设施", value: exp.satisfaction, good: exp.satisfaction >= 0 });
    }
    const roomBonus = roomSatisfactionBonus();
    if (roomBonus) { score += roomBonus; reasons.push({ label: "房间升级", value: roomBonus, good: true }); }
    const shopCount = D.SHOPS.filter(function (sh) { return state.shops[sh.id].status === "built"; }).length;
    if (shopCount) { score += Math.min(3, shopCount); reasons.push({ label: "商铺服务", value: Math.min(3, shopCount), good: true }); }
    let guestSat = 0;
    state.genericResidents.forEach(function (r) { guestSat += guestClass(r.klass || "resident").satisfaction || 0; });
    if (guestSat) { score += Math.min(12, guestSat); reasons.push({ label: "客人满意度", value: Math.min(12, guestSat), good: true }); }
    if (state.expansionUnlocked && countResidents() > 0 && missionaryCount() === 0) {
      score -= 8;
      reasons.push({ label: "没有传教士", value: -8, good: false, detail: "居民产能 -20%" });
    }
    const missing = occupiedFloorsWithMissingFacilities();
    if (missing.length) {
      // 已在扩建层满意度中扣除，这里只作为说明
      reasons.push({ label: "缺少基础房间（效率下降）", value: -missingFacilityCount() * 8, good: false, detail: missing.map(function (m) { return "F" + m.floor + " 缺" + m.missing.join("/"); }).join("，") });
    }
    if (missing.length) score = Math.min(score, 72 - Math.min(10, missing.length * 4));
    score = clamp(Math.round(score), 0, 100);
    let mood = "满意";
    if (score < 25) mood = "想离开";
    else if (score < 45) mood = "不安";
    else if (score < 65) mood = "一般";
    else if (score < 85) mood = "满意";
    else mood = "非常满意";
    return { score: score, mood: mood, reasons: reasons, missing: missing };
  }

  function satisfactionMultiplier() {
    return 0.75 + satisfactionInfo().score / 100 * 0.45;
  }

  function countExpansionRoomsAll() {
    let n = 0;
    state.expansionFloors.forEach(function (rooms) {
      D.EXPANSION_SLOTS.forEach(function (slot) { if (rooms[slot.id]) n++; });
    });
    return n;
  }

  const CASTLE_STAGE_NAMES = ["断墙", "第一盏灯", "庭院苏醒", "旗帜升起", "石墙重立", "炊烟与书页", "兵营号角", "金顶初现", "风息重光"];

  function castleProgressStage() {
    return Math.min(8, D.countBuilt(state));
  }

  function castlePrestige() {
    let p = D.countHired(state) * 12 + state.genericResidents.length * 5;
    D.BUILDINGS.forEach(function (b) {
      const bs = state.buildings[b.id];
      if (bs.status === "built") p += b.scene === "outdoor" ? 18 : 22;
      p += (bs.level || 1) > 1 ? ((bs.level || 1) - 1) * 8 : 0;
    });
    D.SHOPS.forEach(function (sh) {
      if (state.shops[sh.id] && state.shops[sh.id].status === "built") p += 12;
    });
    p += countExpansionRoomsAll() * 8;
    state.expansionFloors.forEach(function (rooms) {
      D.EXPANSION_SLOTS.forEach(function (slot) {
        if (rooms[slot.id]) p += (roomLevel(rooms[slot.id]) - 1) * 6;
      });
    });
    p += Math.max(0, state.expansionFloorCount - 1) * 30;
    p += state.menus.length * 4;
    return Math.round(p);
  }

  function castleLevelInfo() {
    const prestige = castlePrestige();
    let current = D.CASTLE_LEVELS[0];
    let next = null;
    D.CASTLE_LEVELS.forEach(function (l) {
      if (prestige >= l.min) current = l;
      else if (!next) next = l;
    });
    return { level: current.level, name: current.name, prestige: prestige, next: next };
  }

  function efficiencyInfo() {
    let bonus = 0;
    D.WORKERS.forEach(function (w) {
      if (state.workers[w.id] && state.workers[w.id].hired) bonus += w.bonus;
    });
    bonus += expansionBonuses().productionBonus + shopBonuses().productionBonus + studyProductionBonus() + ministerBonus() + menuAffinity("minister");
    const residents = countResidents();
    const fed = state.lastMeal.fed !== false;
    const sat = satisfactionInfo();
    const facilityPenalty = Math.max(0.55, 1 - missingFacilityCount() * 0.08);
    const multiplier = residents === 0 ? 1 : (1 + bonus) * (fed ? 1.1 : 0.7) * (0.75 + sat.score / 100 * 0.45) * facilityPenalty * missionaryPenalty();
    return {
      bonus: bonus,
      fed: fed,
      multiplier: multiplier,
      percent: Math.round((multiplier - 1) * 100),
      residents: residents,
      capacity: residentCapacity(),
      satisfaction: sat
    };
  }

  function countResidents() {
    return D.countHired(state) + state.genericResidents.length;
  }

  function menuMultiplier() {
    let mult = 1;
    state.menus.forEach(function (id) {
      const m = D.MENUS.filter(function (x) { return x.id === id; })[0];
      if (m) mult += m.bonus;
    });
    return mult * (1 + classCount("cook") * 0.05);
  }

  function floorRooms(index) {
    if (!state.expansionFloors[index]) state.expansionFloors[index] = {};
    return state.expansionFloors[index];
  }

  function currentFloorRooms() {
    return floorRooms(state.currentFloor || 0);
  }

  function floorRoomCount(index) {
    const rooms = state.expansionFloors[index] || {};
    return D.EXPANSION_SLOTS.filter(function (slot) { return !!rooms[slot.id]; }).length;
  }

  function floorHasType(index, typeId) {
    const rooms = state.expansionFloors[index] || {};
    return D.EXPANSION_SLOTS.some(function (slot) {
      return rooms[slot.id] && rooms[slot.id].type === typeId;
    });
  }

  function floorRoomTypes(index) {
    const rooms = state.expansionFloors[index] || {};
    return D.EXPANSION_SLOTS.map(function (slot) {
      const room = rooms[slot.id];
      return room ? D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0] : null;
    }).filter(Boolean);
  }

  function roomLevel(room) {
    return clamp(Math.floor(Number(room && room.level) || 1), 1, 3);
  }

  function roomScale(room) {
    return 1 + (roomLevel(room) - 1) * 0.35;
  }

  function roomCapacity(type, room) {
    if (!type) return 0;
    return (type.capacity || 0) + (type.capacity ? roomLevel(room) - 1 : 0);
  }

  function floorRoomsDetailed(index) {
    const rooms = state.expansionFloors[index] || {};
    return D.EXPANSION_SLOTS.map(function (slot) {
      const room = rooms[slot.id];
      if (!room) return null;
      const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0];
      return type ? { slot: slot, room: room, type: type } : null;
    }).filter(Boolean);
  }

  function floorFacilities(index) {
    const entries = floorRoomsDetailed(index);
    const types = entries.map(function (e) { return e.type; });
    return {
      rooms: types.length,
      toilet: types.some(function (t) { return t.basic === "toilet"; }),
      dining: types.some(function (t) { return t.basic === "dining"; }),
      beds: entries.reduce(function (n, e) { return n + roomCapacity(e.type, e.room); }, 0),
      satisfaction: entries.reduce(function (n, e) { return n + (e.type.satisfaction || 0) + (roomLevel(e.room) - 1) * 2; }, 0)
    };
  }

  function roomUpgradeCost(type, room) {
    const lv = roomLevel(room);
    return {
      wood: Math.ceil((type.cost.wood || 0) * 0.5 * lv),
      stone: Math.ceil((type.cost.stone || 0) * 0.5 * lv),
      gold: Math.ceil((type.cost.gold || 0) * 0.6 * lv)
    };
  }

  function roomUpgradeEffect(type, room) {
    const next = Math.min(3, roomLevel(room) + 1);
    const cap = roomCapacity(type, { level: next });
    return "升级到 Lv." + next + "：床位 " + cap +
      (type.residentBonus ? " · 居民收入 +" + Math.round(type.residentBonus * (1 + (next - 1) * 0.35) * 100) + "%" : "") +
      (type.productionBonus ? " · 生产 +" + Math.round(type.productionBonus * (1 + (next - 1) * 0.35) * 100) + "%" : "") +
      (type.defense ? " · 防御 +" + (type.defense + (next - 1) * 3) : "") +
      " · 满意度 +" + ((type.satisfaction || 0) + (next - 1) * 2);
  }

  function upgradeExpansionRoom(slotId) {
    const room = currentFloorRooms()[slotId];
    if (!room) return;
    const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0];
    if (!type) return;
    if (roomLevel(room) >= 3) { toast("这间房已经达到 Lv.3。", "bad", "star"); return; }
    const cost = roomUpgradeCost(type, room);
    if (!canAfford(cost)) { toast("升级材料不够，还差：" + missingCostsText(cost), "bad", "hammer"); return; }
    payCost(cost);
    room.level = roomLevel(room) + 1;
    addLog("扩建层第 " + (state.currentFloor + 1) + " 层的「" + type.name + "」升级到 Lv." + room.level + "。", "good");
    toast(type.name + " 升级到 Lv." + room.level + "！" + roomUpgradeEffect(type, { level: room.level - 1 }), "gold", "star");
    A.sfx("complete");
    closeModal(true);
    ui.guideSig = "";
    renderAll(true);
    saveState();
  }

  function guestClass(id) {
    return D.GUEST_CLASSES.filter(function (c) { return c.id === id; })[0] || D.GUEST_CLASSES[0];
  }

  function guestsOnFloor(index) {
    return state.genericResidents.filter(function (r) { return (r.floor || 0) === index; });
  }

  function floorBeds(index) {
    return floorRoomsDetailed(index).reduce(function (n, e) { return n + roomCapacity(e.type, e.room); }, 0);
  }

  function floorFreeBeds(index) {
    return Math.max(0, floorBeds(index) - guestsOnFloor(index).length);
  }

  function classCount(id) {
    return state.genericResidents.filter(function (r) { return (r.klass || "resident") === id; }).length;
  }

  function classCountOnFloor(floor, id) {
    return state.genericResidents.filter(function (r) { return (r.floor || 0) === floor && (r.klass || "resident") === id; }).length;
  }

  function requirementsMet(index, klass) {
    return klass.requirements.every(function (typeId) { return floorHasType(index, typeId); });
  }

  function defenseValue() {
    let defense = classCount("soldier") * 15;
    state.expansionFloors.forEach(function (rooms, floorIndex) {
      D.EXPANSION_SLOTS.forEach(function (slot) {
        const room = rooms[slot.id];
        if (!room) return;
        const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0];
        if (type && type.defense) defense += type.defense + (roomLevel(room) - 1) * 3;
      });
    });
    if (state.buildings.barracks.status === "built") defense += 5 + buildingLevel("barracks") * 2;
    if (state.workers.irondan.hired) defense += 8;
    defense *= 1 + menuAffinity("soldier");
    return Math.round(defense);
  }

  function requiredSoldiers() {
    return countResidents() <= 0 ? 0 : Math.max(1, Math.ceil(countResidents() / 4));
  }

  function missionaryCount() { return classCount("missionary"); }

  function missionaryPenalty() {
    if (!state || !state.expansionUnlocked) return 1;
    return countResidents() > 0 && missionaryCount() === 0 ? 0.8 : 1;
  }

  function ministerBonus() { return classCount("minister") * 0.06; }

  function guestIncome(r) {
    return guestClass(r.klass || "resident").income || 0;
  }

  function menuAffinity(klassId) {
    return state.menus.reduce(function (n, id) {
      const m = D.MENUS.filter(function (x) { return x.id === id; })[0];
      return n + (m && m.affinity && m.affinity[klassId] ? m.affinity[klassId] : 0);
    }, 0);
  }

  function classUnlockMet(klass) {
    if (!klass.unlock) return true;
    if (klass.unlock.crops) return Object.keys((state.land && state.land.cropsSeen) || {}).length >= klass.unlock.crops;
    if (klass.unlock.menus) return state.menus.length >= klass.unlock.menus;
    return true;
  }

  function classUnlockText(klass) {
    if (!klass.unlock) return "";
    if (klass.unlock.crops) return "收获 " + klass.unlock.crops + " 种作物后解锁";
    if (klass.unlock.menus) return "拥有 " + klass.unlock.menus + " 道菜谱后解锁";
    return "";
  }

  function menuUpkeep() {
    return state.menus.reduce(function (n, id) {
      const m = D.MENUS.filter(function (x) { return x.id === id; })[0];
      return n + (m ? (m.dailyFood || 1) : 0);
    }, 0);
  }

  function expansionBonuses() {
    let capacity = 0, residentBonus = 0, productionBonus = 0, foodBonus = 0, satisfaction = 0;
    state.expansionFloors.forEach(function (rooms, index) {
      D.EXPANSION_SLOTS.forEach(function (slot) {
        const room = rooms[slot.id];
        if (!room) return;
        const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0];
        if (!type) return;
        const scale = roomScale(room);
        capacity += type.capacity ? roomCapacity(type, room) : 0;
        residentBonus += (type.residentBonus || 0) * scale;
        productionBonus += (type.productionBonus || 0) * scale;
        foodBonus += (type.foodBonus || 0) * scale;
        satisfaction += (type.satisfaction || 0) + (roomLevel(room) - 1) * 2;
      });
      const f = floorFacilities(index);
      if (f.rooms > 0) {
        if (!f.toilet) satisfaction -= 14;
        if (!f.dining) satisfaction -= 14;
      }
    });
    return { capacity: capacity, residentBonus: residentBonus, productionBonus: productionBonus, foodBonus: foodBonus, satisfaction: satisfaction };
  }

  function missingFacilityCount() {
    return occupiedFloorsWithMissingFacilities().reduce(function (n, f) { return n + f.missing.length; }, 0);
  }

  function occupiedFloorsWithMissingFacilities() {
    const out = [];
    for (let i = 0; i < state.expansionFloorCount; i++) {
      const f = floorFacilities(i);
      if (f.rooms <= 0) continue;
      const missing = [];
      if (!f.toilet) missing.push("厕所");
      if (!f.dining) missing.push("餐厅");
      if (missing.length) out.push({ floor: i + 1, missing: missing });
    }
    return out;
  }

  function shopBonuses() {
    let residentBonus = 0, productionBonus = 0, income = 0;
    D.SHOPS.forEach(function (shop) {
      if (state.shops[shop.id] && state.shops[shop.id].status === "built") {
        residentBonus += shop.residentBonus || 0;
        productionBonus += shop.productionBonus || 0;
        income += shop.income || 0;
      }
    });
    (state.land && state.land.shops || []).forEach(function (id) {
      const shop = id ? landShopById(id) : null;
      if (!shop) return;
      residentBonus += shop.residentBonus || 0;
      income += shop.income || 0;
    });
    return { residentBonus: residentBonus, productionBonus: productionBonus, income: income };
  }

  function residentCapacity() {
    return D.BASE_CAPACITY + expansionBonuses().capacity;
  }

  function residentGoldRate() {
    const named = D.countHired(state);
    let generic = 0;
    state.genericResidents.forEach(function (r) { generic += guestIncome(r); });
    const menu = menuMultiplier() * (1 + menuAffinity("resident"));
    const shop = 1 + shopBonuses().residentBonus + expansionBonuses().residentBonus;
    const fed = state.lastMeal.fed !== false ? 1.1 : 0.7;
    return (named * 0.035 + generic) * menu * shop * fed * satisfactionMultiplier() * Math.max(0.55, 1 - missingFacilityCount() * 0.08) * missionaryPenalty();
  }

  function shopIncomeRate() {
    return shopBonuses().income;
  }

  function refreshShopUnlocks(s) {
    s = s || state;
    if (!s) return;
    D.SHOPS.forEach(function (shop) {
      const st = s.shops[shop.id];
      if (!st || st.status === "built") return;
      let unlocked = false;
      if (shop.unlock === "kitchen") unlocked = s.buildings.kitchen.status === "built";
      else if (shop.unlock === "barracks") unlocked = s.buildings.barracks.status === "built";
      else if (shop.unlock === "allrooms") unlocked = ["kitchen","study","barracks","storeroom","chapel"].every(function (id) {
        return s.buildings[id].status === "built";
      });
      else if (shop.unlock === "stage5") unlocked = D.countBuilt(s) >= 5;
      else if (shop.unlock === "floor2") unlocked = !!s.expansionUnlocked && (s.expansionFloorCount || 1) >= 2;
      st.status = unlocked ? "available" : "locked";
    });
  }

  function onNewDay() {
    state.day += 1;
    growLandCrops();
    state.trade = { day: state.day, bought: { wood: 0, stone: 0, food: 0 } };
    state.weather = pickWeather();
    const residents = countResidents();
    const reduction = kitchenFoodReduction();
    const shopUpkeep = D.SHOPS.filter(function (sh) { return state.shops[sh.id].status === "built"; }).length + landShopBuiltCount();
    const menuFood = menuUpkeep();
    const upkeep = Math.max(0, residents - reduction) + shopUpkeep + menuFood;
    let fed = true;
    if (ui.debugMode) {
      fed = true;
    } else if (state.resources.food >= upkeep) {
      state.resources.food -= upkeep;
    } else {
      fed = false;
      state.resources.food = 0;
    }
    state.lastMeal = { day: state.day, fed: fed, upkeep: upkeep, residents: residents };
    const weather = D.WEATHER[state.weather];
    addLog("第 " + state.day + " 天 · " + weather.name + "。" + (residents > 0
      ? "早餐消耗 " + upkeep + " 份食物，" + (fed ? "所有人都吃饱了。" : "食物不足，大家饿着肚子。")
      : (shopUpkeep > 0 ? "商铺消耗了 " + upkeep + " 份食物。" : "还没有居民需要吃早餐。")), fed ? "info" : "bad");
    if (residents > 0) {
      toast(fed
        ? "早餐时间：消耗 " + upkeep + " 份食物。居民干劲十足，生产效率 " + (efficiencyInfo().percent >= 0 ? "+" : "") + efficiencyInfo().percent + "%。"
        : "粮仓空了！今天的生产效率会大幅下降。去行商买点食物，或者让农夫加快生产。",
        fed ? "good" : "bad", fed ? "food" : "leaf");
    }
    const sat = satisfactionInfo();
    if (sat.score < 30 && state.genericResidents.length > 0) {
      const leaveCount = Math.min(sat.score < 16 ? 2 : 1, state.genericResidents.length);
      const left = state.genericResidents.splice(0, leaveCount);
      left.forEach(function (r) {
        const type = D.MASK_TYPES.filter(function (m) { return m.id === r.type; })[0];
        addLog("满意度太低，「" + r.name + "」收拾行李离开了城堡。", "bad");
        setTimeout(function () {
          toast((type ? type.name : "面具居民") + "「" + r.name + "」不满意，离开了城堡。改善食物、菜单和基础房间。", "bad", "people");
        }, 300);
      });
    } else if (sat.score < 30 && residents > 0) {
      addLog("居民们开始抱怨：食物、菜单或基础房间需要改善。", "bad");
    }
    // 防御与隔壁村偷窃
    if (!ui.debugMode && state.expansionUnlocked) {
      const need = requiredSoldiers();
      const soldiers = classCount("soldier");
      if (need > 0 && soldiers < need) {
        const risk = Math.min(0.82, 0.30 + (need - soldiers) * 0.14);
        if (Math.random() < risk) {
          const woodLoss = Math.min(Math.floor(state.resources.wood * (0.12 + Math.random() * 0.12)), 60);
          const stoneLoss = Math.min(Math.floor(state.resources.stone * (0.10 + Math.random() * 0.10)), 50);
          const foodLoss = Math.min(Math.floor(state.resources.food * (0.10 + Math.random() * 0.10)), 40);
          const goldLoss = Math.min(Math.floor(state.resources.gold * 0.08), 60);
          state.resources.wood = Math.max(0, state.resources.wood - woodLoss);
          state.resources.stone = Math.max(0, state.resources.stone - stoneLoss);
          state.resources.food = Math.max(0, state.resources.food - foodLoss);
          state.resources.gold = Math.max(0, state.resources.gold - goldLoss);
          addLog("隔壁村的人趁夜摸进仓库，偷走了 " + woodLoss + " 木材、" + stoneLoss + " 石料、" + foodLoss + " 食物和 " + goldLoss + " 金币。需要更多士兵。", "bad");
          setTimeout(function () {
            toast("防御不足！隔壁村偷走了物资。当前士兵 " + soldiers + "，建议至少 " + need + "。", "bad", "hammer");
          }, 420);
        } else {
          addLog("夜里有人在围墙外徘徊，但没敢进来。士兵不足，最好再招募一些。", "bad");
        }
      }
    }

    if (Math.random() < 0.62) {
      const ev = pickEvent();
      if (ev) {
        const extraLog = [];
        ev.effect({
          addRes: function (key, amount) {
            state.resources[key] = Math.max(0, (state.resources[key] || 0) + amount);
          },
          log: function (text) { extraLog.push(text); },
          hasGuard: function () { return state.workers.irondan.hired; }
        });
        addLog("【" + ev.title + "】" + ev.text, ev.tone === "bad" ? "bad" : ev.tone === "good" ? "good" : "info");
        extraLog.forEach(function (t) { addLog(t, "info"); });
        setTimeout(function () {
          toast(ev.title + "：" + ev.text, ev.tone === "bad" ? "bad" : ev.tone === "good" ? "good" : "neutral", ev.icon);
        }, 160);
      }
    }
    updateAudioEnvironment();
    saveState();
    renderAll(true);
  }

  function pickWeather() {
    const r = Math.random();
    if (r < 0.18) return "rain";
    if (r < 0.45) return "cloudy";
    return "clear";
  }

  function pickEvent() {
    const total = D.EVENTS.reduce(function (n, e) { return n + e.weight; }, 0);
    let r = Math.random() * total;
    for (let i = 0; i < D.EVENTS.length; i++) {
      r -= D.EVENTS[i].weight;
      if (r <= 0) return D.EVENTS[i];
    }
    return D.EVENTS[D.EVENTS.length - 1];
  }

  /* =========================================================
     雇人 / 建造
     ========================================================= */
  function hireWorker(id) {
    if (!started) return false;
    const w = WORKER_MAP[id];
    if (!w) return false;
    if (state.workers[id].hired) {
      ui.tab = "people";
      renderLedger(true);
      return false;
    }
    if (w.scene === "indoor") {
      toast("城堡内的居民要通过修复房间来结识。", "neutral", "lock");
      return false;
    }
    if (!ui.debugMode && state.resources.gold < w.hireCost) {
      toast("金币不够。还差 " + Math.ceil(w.hireCost - state.resources.gold) + " 金币，去行商卖点资源吧。", "bad", "coin");
      openTradeModal("还差 " + Math.ceil(w.hireCost - state.resources.gold) + " 金币才能雇佣" + w.name + "。");
      return false;
    }
    if (!ui.debugMode) state.resources.gold -= w.hireCost;
    state.workers[id].hired = true;
    state.stats.hired += 1;
    const area = BUILDING_MAP[w.area];
    if (area && state.buildings[area.id].status === "locked") state.buildings[area.id].status = "available";
    addLog(w.name + " 加入了风息堡。" + w.quirk, "good");
    toast(w.name + " 加入了！" + (area ? "「" + area.name + "」现在可以建造。" : ""), "gold", "people");
    A.sfx("hire");
    ui.guideSig = "";
    ui.highlightWorker = id;
    renderAll(true);
    checkGuide();
    saveState();
    return true;
  }

  function startBuild(id) {
    if (!started) return false;
    const b = BUILDING_MAP[id];
    if (!b) return false;
    const bs = state.buildings[id];
    if (bs.status === "built") return false;
    if (bs.status === "locked") {
      if (b.scene === "outdoor") {
        const w = b.worker && WORKER_MAP[b.worker];
        toast("先雇佣" + (w ? w.name : "对应工匠") + "，才能解锁这张蓝图。", "bad", "lock");
      } else if (!state.interiorUnlocked) {
        toast("进入城堡后才能修复这里。先建成两座庭院建筑。", "bad", "lock");
      } else {
        toast("这里还有前置条件未完成。", "bad", "lock");
      }
      return false;
    }
    if (bs.status === "building") return false;
    if (!canAfford(b.cost)) {
      toast("材料不够，还差：" + missingCostsText(b.cost), "bad", "hammer");
      if ((b.cost.gold || 0) > state.resources.gold &&
          (b.cost.wood || 0) <= state.resources.wood &&
          (b.cost.stone || 0) <= state.resources.stone) {
        openTradeModal("还差金币。把木材或石料卖给行商就能换钱。");
      }
      return false;
    }
    payCost(b.cost);
    if (ui.debugMode) {
      completeBuilding(b);
      if (ui.modalOpen) closeModal(true);
      return true;
    }
    bs.status = "building";
    bs.progress = 0;
    if (b.scene === "indoor") state.view = "indoor";
    addLog("「" + b.name + "」开始建造。", "info");
    toast("开工了：" + b.name + "，大约 " + b.time + " 秒完成。", "gold", "hammer");
    A.sfx("build");
    ui.guideSig = "";
    renderAll(true);
    saveState();
    if (ui.modalOpen) closeModal();
    return true;
  }

  function completeBuilding(b) {
    const bs = state.buildings[b.id];
    if (bs.status === "built") return;
    bs.status = "built";
    bs.progress = 1;
    state.stats.built += 1;
    if (b.completionGold) state.resources.gold += b.completionGold;
    let newWorker = null;
    if (b.scene === "indoor" && b.worker) {
      if (!state.workers[b.worker].hired) {
        state.workers[b.worker].hired = true;
        state.stats.hired += 1;
        newWorker = WORKER_MAP[b.worker];
      }
    }
    if (b.scene === "outdoor" && D.countOutdoorBuilt(state) >= 2 && !state.interiorUnlocked) {
      state.interiorUnlocked = true;
      ["kitchen", "study", "barracks", "storeroom"].forEach(function (id) {
        if (state.buildings[id].status === "locked") state.buildings[id].status = "available";
      });
      addLog("两座庭院建筑落成了。城堡大门打开，可以进入内部了。", "good");
      setTimeout(function () {
        toast("城堡大门打开了！现在可以进入城堡内部，修复房间并结识新居民。", "gold", "crest");
      }, 350);
    }
    if (b.scene === "indoor" && b.worker) {
      const fourRooms = ["kitchen", "study", "barracks", "storeroom"].every(function (id) {
        return state.buildings[id].status === "built";
      });
      if (fourRooms && state.buildings.chapel.status === "locked") {
        state.buildings.chapel.status = "available";
        addLog("四个房间都修复了。礼拜堂的门终于可以打开了。", "good");
        setTimeout(function () { toast("四个房间都恢复了！礼拜堂已开放。", "gold", "crest"); }, 450);
      }
    }
    if (b.id === "chapel") {
      state.flags.chapelBuilt = true;
      addLog("礼拜堂修复完成。彩窗重新亮了起来。", "good");
      toast("礼拜堂修复完成！风息堡重新完整了。", "gold", "crest");
    }
    if (b.id === "kitchen") {
      addLog("厨房菜单开放：可以购买菜品，提高居民金币收入。", "good");
      setTimeout(function () { toast("厨房菜单开放了：点厨房卡片里的「菜单」，让居民赚得更多。", "gold", "food"); }, 750);
    }
    const shopBefore = JSON.parse(JSON.stringify(state.shops));
    refreshShopUnlocks();
    announceShopUnlocks(shopBefore);
    const baseRoomsDone = ["kitchen","study","barracks","storeroom","chapel"].every(function (id) {
      return state.buildings[id].status === "built";
    });
    if (baseRoomsDone && !state.expansionUnlocked) {
      state.expansionUnlocked = true;
      addLog("城堡扩建层开放了。现在可以建造更多房间，邀请戴面具的新居民。", "good");
      setTimeout(function () {
        toast("城堡扩建层开放了！点击画面上方的「扩建层」，建造新房间、邀请新居民。", "gold", "crest");
      }, 650);
    }
    if (baseRoomsDone) refreshShopUnlocks();
    addLog("「" + b.name + "」建成了。", "good");
    toast("「" + b.name + "」完成！" + (b.completionGold ? " 金币 +" + b.completionGold : ""), "gold", "check");
    A.sfx("complete");
    const newStage = castleProgressStage();
    if (newStage > 0) {
      setTimeout(function () {
        toast("城堡阶段 " + newStage + "/8：" + CASTLE_STAGE_NAMES[newStage] + "。外观发生了变化。", "gold", "crest");
      }, 1500);
    }
    if (window.CastleScene) window.CastleScene.burstBuilding(b.id);
    ui.guideSig = "";
    renderAll(true);
    checkGuide();
    saveState();
    if (newWorker) {
      setTimeout(function () { showResidentIntro(newWorker); }, 380);
    }
  }

  /* =========================================================
     行商 / 交易
     ========================================================= */
  function hasMerchant() { return state.workers.goldbell.hired; }

  function sellPrice(res) {
    const info = D.SELL_INFO[res];
    const merchant = hasMerchant() ? 1.5 : 1;
    return Math.max(1, Math.floor(info.gold * (merchant + storeroomSellBonus())));
  }

  function sellResource(res, all) {
    if (!started) return;
    const info = D.SELL_INFO[res];
    if (!info) return;
    const have = Math.floor(state.resources[res] || 0);
    if (have < info.amount) {
      toast(D.RESOURCES[res].name + "不够。需要 " + info.amount + "，现在只有 " + have + "。", "bad", D.RESOURCES[res].icon);
      return;
    }
    const batches = all ? Math.floor(have / info.amount) : 1;
    const sold = batches * info.amount;
    const gain = batches * sellPrice(res);
    state.resources[res] = have - sold;
    state.resources.gold += gain;
    if (res === "wood") state.stats.soldWood += sold;
    if (res === "stone") state.stats.soldStone += sold;
    if (res === "food") state.stats.soldFood += sold;
    addLog("把 " + sold + " " + D.RESOURCES[res].name + "卖给了行商，得到 " + gain + " 金币。", "good");
    toast("卖出 " + sold + " " + D.RESOURCES[res].name + " → 金币 +" + gain + "。", "gold", "coin");
    A.sfx("coin");
    ui.guideSig = "";
    renderAll(true);
    checkGuide();
    saveState();
    if (ui.modalOpen && $("#tradeModal")) refreshTradeModal();
  }

  function buyFood() {
    if (!started) return;
    const cost = D.BUY_FOOD.gold;
    if (!ui.debugMode && state.resources.gold < cost) {
      toast("金币不够。卖点木材或石料再来吧。", "bad", "coin");
      return;
    }
    if (!ui.debugMode) state.resources.gold -= cost;
    state.resources.food += D.BUY_FOOD.food;
    addLog("向行商买了 " + D.BUY_FOOD.food + " 份食物。", "good");
    toast("食物 +" + D.BUY_FOOD.food + "，金币 -" + cost + "。", "good", "food");
    A.sfx("coin");
    renderAll(true);
    saveState();
    if ($("#tradeModal")) refreshTradeModal();
  }

  /* =========================================================
     厨房菜单
     ========================================================= */
  function hasMenu(id) { return state.menus.indexOf(id) >= 0; }

  function affinityText(m) {
    if (!m.affinity) return "无角色加成";
    return Object.keys(m.affinity).map(function (id) {
      const k = D.GUEST_CLASSES.filter(function (x) { return x.id === id; })[0];
      return (k ? k.name : id) + " +" + Math.round(m.affinity[id] * 100) + "%";
    }).join(" · ");
  }

  function openMenuModal(note) {
    if (state.buildings.kitchen.status !== "built") {
      toast("先修复厨房，布丁才能开始准备菜单。", "bad", "lock");
      return;
    }
    const mult = menuMultiplier();
    const rows = D.MENUS.map(function (m) {
      const owned = hasMenu(m.id);
      const cropOk = !m.requiresCrop || (state.land.cropsSeen && state.land.cropsSeen[m.requiresCrop]);
      const unlocked = countResidents() >= (m.minResidents || 0) && cropOk;
      const afford = canAfford(m.cost);
      return '<div class="menu-row' + (owned ? " owned" : "") + (unlocked ? "" : " locked") + '">' +
        '<div class="menu-icon"><img src="' + I.icon(m.icon) + '" alt=""></div>' +
        '<div class="menu-copy"><div class="menu-name">' + m.name + (owned ? '<span class="menu-owned">已上桌</span>' : "") + (owned || unlocked ? "" : '<span class="menu-lock">' + (!cropOk ? "需要收获" + (D.CROPS.filter(function (c) { return c.id === m.requiresCrop; })[0] || {}).name : "需要 " + m.minResidents + " 位居民") + "</span>") + "</div>" +
        '<div class="menu-desc">' + m.desc + "</div>" +
        '<div class="menu-meta">居民收入 +' + Math.round(m.bonus * 100) + "% · " + affinityText(m) + " · 每天 " + (m.dailyFood || 1) + " 食物 · " + costHTML(m.cost, true) + "</div></div>" +
        '<div class="menu-actions">' + (owned
          ? '<span class="menu-check">已解锁</span>'
          : '<button class="btn btn-gold btn-small" data-action="buy-menu" data-id="' + m.id + '"' + (afford && unlocked ? "" : " disabled") + '>' + (unlocked ? "购买" : "未解锁") + '</button>') +
        "</div></div>";
    }).join("");
    openModal(
      modalHead("food", "厨房 · 菜单", "今晚吃什么？", "菜单越丰富，居民越有干劲，也越会赚钱。") +
      '<div class="modal-body" id="menuModal">' +
      '<div class="menu-summary"><div><span>菜品数量</span><b>' + state.menus.length + " / " + D.MENUS.length + "</b></div>" +
      '<div><span>居民收入倍率</span><b>×' + mult.toFixed(2) + "</b></div>" +
      '<div><span>居民收入</span><b>+' + (residentGoldRate() * 60).toFixed(1) + " 金/分</b></div>" +
      '<div><span>菜品食物</span><b>' + menuUpkeep() + " /天</b></div></div>" +
      (note ? '<p class="modal-copy" style="margin-top:8px">' + escapeHTML(note) + "</p>" : '<p class="modal-copy" style="margin-top:8px">购买菜单会消耗金币和食物，永久提升所有居民（包括戴面具的新居民）的金币收入。</p>') +
      '<div class="menu-list">' + rows + "</div>" +
      '<div class="modal-actions"><span class="modal-note">菜单收入也受「吃饱」和商铺加成影响</span>' +
      '<button class="btn btn-primary" data-action="close-modal">回去吃饭</button></div></div>',
      { className: "modal-menu" }
    );
  }

  function buyMenu(id) {
    if (!started) return;
    const m = D.MENUS.filter(function (x) { return x.id === id; })[0];
    if (!m || hasMenu(id)) return;
    if (state.buildings.kitchen.status !== "built") { toast("先修复厨房。", "bad", "lock"); return; }
    if (countResidents() < (m.minResidents || 0)) {
      toast("「" + m.name + "」需要 " + m.minResidents + " 位居民才会出现在菜单上。", "bad", "lock");
      return;
    }
    if (m.requiresCrop && !(state.land.cropsSeen && state.land.cropsSeen[m.requiresCrop])) {
      const c = D.CROPS.filter(function (x) { return x.id === m.requiresCrop; })[0];
      toast("先收获一份" + (c ? c.name : "作物") + "，才能解锁「" + m.name + "」。", "bad", "lock");
      return;
    }
    if (!canAfford(m.cost)) {
      toast("买不起这道菜，还差：" + missingCostsText(m.cost), "bad", "food");
      return;
    }
    payCost(m.cost);
    state.menus.push(id);
    addLog("厨房添了一道新菜：" + m.name + "。居民收入提高 " + Math.round(m.bonus * 100) + "%。", "good");
    toast(m.name + "上桌了！居民收入 +" + Math.round(m.bonus * 100) + "%。", "gold", "food");
    A.sfx("complete");
    ui.guideSig = "";
    renderAll(true);
    saveState();
    openMenuModal("又把一道菜端上了长桌。");
  }

  /* =========================================================
     商铺
     ========================================================= */
  function buyShop(id) {
    if (!started) return;
    const shop = D.SHOPS.filter(function (s) { return s.id === id; })[0];
    if (!shop) return;
    const st = state.shops[id];
    if (!st) return;
    if (st.status === "built") return;
    refreshShopUnlocks();
    if (st.status !== "available") {
      toast(shop.unlockText + "。", "bad", "lock");
      return;
    }
    if (!canAfford(shop.cost)) {
      toast("开业资金不够，还差：" + missingCostsText(shop.cost), "bad", "coin");
      return;
    }
    payCost(shop.cost);
    st.status = "built";
    addLog("「" + shop.name + "」在庭院开业了。" + shop.flavor, "good");
    toast(shop.name + "开业！金币 +" + (shop.income * 60).toFixed(1) + "/分" +
      (shop.residentBonus ? " · 居民收入 +" + Math.round(shop.residentBonus * 100) + "%" : "") +
      (shop.productionBonus ? " · 生产 +" + Math.round(shop.productionBonus * 100) + "%" : ""), "gold", "coin");
    A.sfx("complete");
    ui.guideSig = "";
    renderAll(true);
    saveState();
  }

  function announceShopUnlocks(before) {
    D.SHOPS.forEach(function (shop) {
      const was = before[shop.id];
      const now = state.shops[shop.id];
      if (was && was.status !== "available" && now.status === "available") {
        addLog("庭院商铺解锁：「" + shop.name + "」。", "good");
        setTimeout(function () { toast("新商铺可开业：" + shop.name + "。切到庭院，在建设页底部开业。", "gold", "coin"); }, 500);
      }
    });
  }

  /* =========================================================
     引导
     ========================================================= */
  function currentGuide() {
    return D.GUIDE[state.guideIndex] || null;
  }

  function checkGuide() {
    if (!state || state.flags.festivalHeld) return;
    let changed = false;
    let guard = 0;
    while (guard++ < 5) {
      const step = currentGuide();
      if (!step) break;
      if (!step.check(state)) break;
      if (step.action && step.action.type === "festival" && !state.flags.festivalHeld) break;
      const reward = grantReward(step.reward);
      addLog("目标完成：「" + step.title + "」" + (reward ? " 获得 " + reward : ""), "good");
      toast("目标完成：" + step.title + (reward ? " · " + reward : ""), "gold", "check");
      A.sfx("complete");
      state.guideIndex += 1;
      changed = true;
    }
    if (changed) {
      ui.guideSig = "";
      renderAll(true);
      saveState();
    }
  }

  function grantReward(reward) {
    if (!reward) return "";
    const parts = [];
    Object.keys(reward).forEach(function (k) {
      state.resources[k] = (state.resources[k] || 0) + reward[k];
      parts.push("+" + reward[k] + " " + D.RESOURCES[k].name);
    });
    return parts.join("、");
  }

  function performGuideAction() {
    if (!started || ui.modalOpen) return;
    if (state.flags.festivalHeld) { showEndingModal(); return; }
    const step = currentGuide();
    if (!step) { toast("所有目标都完成了。继续经营城堡吧。", "good", "crown"); return; }
    const a = step.action;
    if (!a) return;
    if (a.type === "hire") {
      const w = WORKER_MAP[a.id];
      if (!w) return;
      if (state.workers[a.id].hired) { checkGuide(); return; }
      if (!ui.debugMode && state.resources.gold < w.hireCost) {
        openTradeModal("还差 " + Math.ceil(w.hireCost - state.resources.gold) + " 金币才能雇佣" + w.name + "。卖掉木材或石料就有了。");
        return;
      }
      hireWorker(a.id);
    } else if (a.type === "build") {
      const b = BUILDING_MAP[a.id];
      if (!b) return;
      if (state.buildings[a.id].status === "built") { checkGuide(); return; }
      if (b.scene === "indoor") {
        if (!state.interiorUnlocked) { toast("先建成两座庭院建筑，城堡内部才会开放。", "bad", "lock"); return; }
        if (state.view !== "indoor") {
          state.view = "indoor";
          renderAll(true);
        }
      }
      if (state.buildings[a.id].status === "available" && !canAfford(b.cost)) {
        const missingWood = Math.max(0, (b.cost.wood || 0) - state.resources.wood);
        const missingStone = Math.max(0, (b.cost.stone || 0) - state.resources.stone);
        if (missingWood > 0 || missingStone > 0) {
          toast("材料还在路上：还差 " + missingCostsText(b.cost) + "。伐木场和采石场会自动生产，稍等一会儿；着急的话可以先去行商卖点存货换金币。", "neutral", "hammer");
          ui.tab = "build";
          updateTabs();
          renderLedger(true);
          return;
        }
        openTradeModal("修复「" + b.name + "」还差 " + Math.ceil((b.cost.gold || 0) - state.resources.gold) + " 金币。把木材或石料卖给行商就有了。");
        return;
      }
      startBuild(a.id);
    } else if (a.type === "sell") {
      sellResource(a.res, false);
    } else if (a.type === "enterCastle") {
      enterCastle();
    } else if (a.type === "festival") {
      promptFestival();
    }
  }

  function enterCastle() {
    if (!state.interiorUnlocked) {
      toast("先建成两座庭院建筑，城堡内部才会开放。", "bad", "lock");
      return;
    }
    if (!state.flags.enteredCastle) {
      state.flags.enteredCastle = true;
      addLog("你第一次走进了风息堡内部。房间里落满灰尘，但壁炉还能用。", "good");
    }
    state.view = "indoor";
    if (window.CastleScene && window.CastleScene.hideTooltip) window.CastleScene.hideTooltip();
    ui.guideSig = "";
    renderAll(true);
    checkGuide();
    saveState();
    toast("这里是城堡内部。修复房间，让新居民住进来。", "gold", "crest");
  }

  /* =========================================================
     节日 / 结局
     ========================================================= */
  function promptFestival() {
    if (!started || ui.modalOpen) return;
    if (state.buildings.chapel.status !== "built") {
      toast("礼拜堂还没有修复完成。", "bad", "lock");
      return;
    }
    openModal(
      modalHead("crest", "终章", "举办丰收庆典", "风息堡重新完整了。") +
      '<div class="modal-body"><p class="modal-copy">所有庭院和房间都已经修复。点亮大厅的灯，邀请居民们坐下来吃一顿热饭吧。</p>' +
      '<div class="modal-flavor">“殿下，城堡不是石头堆起来的，是人一砖一瓦住出来的。”</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">再等等</button>' +
      '<button class="btn btn-gold" data-action="festival-confirm"><img src="' + I.icon("bunting") + '" alt="">点亮丰收庆典</button></div></div>'
    );
  }

  function startFestivalAnimation() {
    if (!started) return;
    const overlay = $("#festivalOverlay");
    if (!overlay) { finishFestival(); return; }
    closeModal(true);
    state.view = "outdoor";
    ui.festivalPrevSpeed = state.speed || 1;
    state.speed = 0;
    const named = D.WORKERS.filter(function (w) { return state.workers[w.id].hired; });
    const people = named.map(function (w) {
      return '<div class="festival-person"><div class="festival-portrait" style="background:#2b2119"><img src="' + I.portraitFor(w) + '" alt=""></div><span class="festival-name">' + w.name + "</span></div>";
    });
    state.genericResidents.forEach(function (r, i) {
      const type = D.MASK_TYPES.filter(function (m) { return m.id === r.type; })[0] || D.MASK_TYPES[0];
      people.push('<div class="festival-person" style="--bob:' + (i * -0.24) + 's"><div class="festival-portrait" style="background:#2b2119"><img src="' + guestPortraitFor(r) + '" alt=""></div><span class="festival-name">' + r.name + "</span></div>");
    });
    let confetti = "";
    const colors = ["#d3a646", "#c15c4f", "#6f8d5b", "#f0d28a", "#5b7b9d", "#e6c675"];
    for (let i = 0; i < 28; i++) {
      confetti += '<i style="left:' + (Math.random() * 96 + 2) + "%;background:" + colors[i % colors.length] +
        ";--dur:" + (2.4 + Math.random() * 2.6).toFixed(2) + "s;--delay:" + (Math.random() * 2.2).toFixed(2) + 's"></i>';
    }
    let lanterns = "";
    for (let i = 0; i < 9; i++) {
      lanterns += '<em class="festival-lantern" style="left:' + (Math.random() * 92 + 4) + "%;bottom:-12px;--dur:" +
        (5 + Math.random() * 3).toFixed(1) + "s;--delay:" + (Math.random() * 2).toFixed(1) + 's"></em>';
    }
    overlay.innerHTML =
      '<div class="festival-confetti">' + confetti + "</div>" +
      '<div class="festival-lanterns">' + lanterns + "</div>" +
      '<div class="festival-stage">' +
      '<div class="festival-kicker">WINDREST · HARVEST FESTIVAL</div>' +
      '<h2 class="festival-title">丰收庆典</h2>' +
      '<div class="festival-sub">第 ' + state.day + " 天 · 所有居民都来到了城堡门外</div>" +
      '<div class="festival-crowd">' + people.join("") + "</div>" +
      '<button class="festival-btn" data-action="festival-complete">点亮最后一盏灯</button>' +
      "</div>";
    overlay.hidden = false;
    overlay.classList.remove("lit");
    A.sfx("festival");
    if (window.CastleScene) window.CastleScene.bellPulse();
  }

  function finishFestival() {
    if (state.flags.festivalHeld) return;
    const overlay = $("#festivalOverlay");
    if (overlay) overlay.classList.add("lit");
    state.flags.festivalHeld = true;
    state.flags.festivalDay = state.day;
    state.guideIndex = D.GUIDE.length;
    state.speed = ui.festivalPrevSpeed || 1;
    addLog("丰收庆典在风息堡举行。所有居民聚在城堡门外，灯火和彩纸落满庭院。", "good");
    ui.guideSig = "";
    saveState();
    renderAll(true);
    setTimeout(function () {
      if (overlay) overlay.hidden = true;
      showEndingModal();
    }, 1200);
  }

  function holdFestival() {
    startFestivalAnimation();
  }

  function promptNewGame() {
    if (peekSave()) {
      openModal(
        modalHead("help", "重要决定", "开始新的故事？", "旧存档会被新的故事覆盖。") +
        '<div class="modal-body"><p class="modal-copy">当前的居民、建筑和手记都会留在上一段故事里。</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">再想想</button>' +
        '<button class="btn btn-danger" data-action="reset-confirm">重新开始</button></div></div>'
      );
    } else {
      beginNewGame();
    }
  }

  /* =========================================================
     实时 UI
     ========================================================= */
  function updateRealtimeUI(dt) {
    ui.uiAccum += dt;
    if (ui.uiAccum >= 0.2) { ui.uiAccum = 0; updateTopbar(); }
    ui.dailyAccum += dt;
    if (ui.dailyAccum >= 0.5) { ui.dailyAccum = 0; updateDailyStatus(); updateHint(); }
    ui.guideUiAccum += dt;
    if (ui.guideUiAccum >= 0.5) {
      ui.guideUiAccum = 0;
      updateGuideBarIfChanged();
    }
    ui.ledgerAccum += dt;
    if (ui.ledgerAccum >= 1.2) {
      ui.ledgerAccum = 0;
      if (!ui.modalOpen && !ui.dialogueOpen) renderLedger(false);
    }
    ui.audioAccum += dt;
    if (ui.audioAccum >= 1.5) { ui.audioAccum = 0; updateAudioEnvironment(); }
  }

  function updateMenuButton() {
    const btn = $("#menuBtn");
    if (!btn || !state) return;
    const ready = state.buildings.kitchen.status === "built";
    btn.classList.toggle("locked", !ready);
    btn.classList.toggle("ready", ready);
    btn.title = ready
      ? "厨房菜单：已解锁 " + state.menus.length + " 道菜，点击购买"
      : "先修复厨房，才能准备菜单";
    const count = $("#menuCount");
    if (count) count.textContent = String(state.menus.length);
  }

  function updateTopbar() {
    if (!state) return;
    const hour = getHour();
    $("#dayLabel").textContent = "第 " + state.day + " 天";
    $("#clockLabel").textContent = String(Math.floor(hour)).padStart(2, "0") + ":" + String(Math.floor((hour % 1) * 60)).padStart(2, "0");
    $("#dayFill").style.width = (state.dayProgress * 100).toFixed(1) + "%";
    const weather = D.WEATHER[state.weather];
    if (ui.lastWeather !== state.weather) {
      ui.lastWeather = state.weather;
      $("#weatherIcon").src = I.icon(weather.icon);
      $("#weatherLabel").textContent = weather.name;
      $("#weatherIcon").title = weather.desc;
    }
    const rates = productionRates();
    RES_ORDER.forEach(function (key) {
      const el = $("#resVal-" + key);
      if (!el) return;
      if (ui.debugMode) {
        if (el.textContent !== "无限") el.textContent = "无限";
        const rateEl = $("#resRate-" + key);
        if (rateEl) rateEl.textContent = "无限";
        return;
      }
      const val = Math.floor(state.resources[key]);
      if (el.textContent !== String(val)) {
        el.textContent = val;
        if (val > ui.lastRes[key]) {
          el.classList.remove("bump");
          void el.offsetWidth;
          el.classList.add("bump");
          setTimeout(function () { el.classList.remove("bump"); }, 320);
        }
        ui.lastRes[key] = val;
      }
      const rateEl = $("#resRate-" + key);
      if (rateEl) {
        if (key === "gold") {
          const goldRate = (residentGoldRate() + shopIncomeRate()) * 60;
          rateEl.textContent = goldRate > 0 ? "+" + goldRate.toFixed(1) + "/分" : "靠行商";
        } else rateEl.textContent = "+" + (rates[key] * 60).toFixed(1) + "/分";
      }
    });
    setSpeedButtons(state.speed);
    updateSoundButton();
    updateProgressWidget();
  }

  function productionRates() {
    const eff = efficiencyInfo();
    const rates = { wood: 0, stone: 0, food: 0 };
    D.BUILDINGS.forEach(function (b) {
      const bs = state.buildings[b.id];
      if (bs.status !== "built" || !b.worker || !state.workers[b.worker] || !state.workers[b.worker].hired) return;
      const mult = eff.multiplier * outputMultiplier(b) * (b.id === "farm" && state.weather === "rain" ? 1.25 : 1);
      Object.keys(b.output || {}).forEach(function (k) {
        if (rates[k] != null) rates[k] += b.output[k] * mult;
      });
    });
    return rates;
  }

  function updateProgressWidget() {
    const total = D.COMPLETION_TOTAL;
    const built = D.countBuilt(state);
    $("#progressValue").textContent = built + " / " + total;
    $("#progressFill").style.width = (built / total * 100).toFixed(1) + "%";
    const info = castleLevelInfo();
    const stage = castleProgressStage();
    state.castleLevel = info.level;
    state.castlePrestige = info.prestige;
    state.castleStage = stage;
    const pw = $("#progressWidget");
    if (pw) {
      pw.title = "城堡阶段 " + stage + "/8 · " + CASTLE_STAGE_NAMES[stage] + " · Lv." + info.level + " " + info.name + " · 威望 " + info.prestige;
      $("#progressSub").textContent = "阶段 " + stage + "/8 · " + CASTLE_STAGE_NAMES[stage] + " · Lv." + info.level;
    }
    const levelEl = $("#castleLevelText");
    if (levelEl) levelEl.textContent = "Lv." + info.level;
  }

  function updateDailyStatus() {
    const el = $("#dailyStatus");
    if (!el || !state) return;
    const eff = efficiencyInfo();
    const residents = countResidents();
    const shopUpkeep = D.SHOPS.filter(function (sh) { return state.shops[sh.id].status === "built"; }).length + landShopBuiltCount();
    const menuFood = menuUpkeep();
    const upkeep = Math.max(0, residents - kitchenFoodReduction()) + shopUpkeep + menuFood;
    const satTitle = escapeHTML(eff.satisfaction.reasons.map(function (r) {
      return r.label + " " + (r.value > 0 ? "+" : "") + r.value;
    }).join(" · "));
    const chips = [];
    chips.push('<span class="daily-chip"><img src="' + I.icon("people") + '" alt="">居民 <b>' + residents + '</b>/' + residentCapacity() + "</span>");
    chips.push('<span class="daily-chip" title="居民 ' + residents + '，厨房减免 ' + kitchenFoodReduction() + '，商铺 ' + shopUpkeep + '，菜品 ' + menuFood + '"><img src="' + I.icon("food") + '" alt="">口粮 <b>' + upkeep + "</b>/天</span>");
    chips.push('<span class="daily-chip"><img src="' + I.icon("sparkle") + '" alt="">效率 <b>' + (eff.percent >= 0 ? "+" : "") + eff.percent + "%</b></span>");
    chips.push('<span class="daily-chip ' + (eff.satisfaction.score >= 55 ? "good" : "bad") + '" title="' + satTitle + '">满意 <b>' + eff.satisfaction.score + "</b></span>");
    el.innerHTML = chips.join("");
  }

  function getHour() { return (6 + state.dayProgress * 24) % 24; }

  function setSpeedButtons(speed) {
    $$(".speed-btn").forEach(function (b) { b.classList.toggle("active", Number(b.dataset.speed) === speed); });
  }

  function updateSoundButton() {
    const btn = $("#soundBtn");
    if (!btn) return;
    if (ui.lastSoundMuted === muted && btn.firstElementChild) return;
    ui.lastSoundMuted = muted;
    btn.classList.toggle("muted", muted);
    btn.innerHTML = '<img src="' + I.icon(muted ? "soundOff" : "sound") + '" alt="">';
    btn.title = muted ? "开启声音" : "关闭声音";
  }

  function updateAudioEnvironment() {
    if (!started || !state) return;
    const hour = getHour();
    let night = 0;
    if (hour >= 20.5 || hour < 4.75) night = 1;
    else if (hour >= 18.3) night = clamp((hour - 18.3) / 2.2, 0, 1);
    else if (hour < 6.4) night = clamp((6.4 - hour) / 1.65, 0, 1);
    try {
      A.setNight(night);
      A.setRain(state.weather === "rain");
    } catch (e) { /* ignore */ }
  }

  function updateGuideBarIfChanged() {
    if (!state) return;
    const step = currentGuide();
    const eff = efficiencyInfo();
    let constructionSig = "";
    if (step && step.action && step.action.type === "build") {
      const bs = state.buildings[step.action.id];
      if (bs) constructionSig = bs.status + ":" + Math.floor((bs.progress || 0) * 100);
    }
    const sig = [
      state.guideIndex,
      constructionSig,
      state.view,
      state.flags.festivalHeld ? "f" : "",
      Math.floor(state.resources.gold),
      Math.floor(state.resources.wood),
      Math.floor(state.resources.stone),
      Math.floor(state.resources.food),
      eff.residents,
      state.interiorUnlocked ? "i" : "",
      state.buildings.chapel.status
    ].join("|");
    if (sig !== ui.guideSig) {
      ui.guideSig = sig;
      renderGuideBar();
    }
    updateDailyStatus();
    updateHint();
  }

  /* =========================================================
     顶栏目标
     ========================================================= */
  function guideActionInfo(step) {
    if (!step) return { label: "完成", cls: "btn-wood" };
    const a = step.action;
    if (!a) return { label: "继续", cls: "btn-wood" };
    if (a.type === "hire") {
      const w = WORKER_MAP[a.id];
      if (state.workers[a.id].hired) return { label: "已雇佣", cls: "btn-wood", disabled: true };
      if (!ui.debugMode && state.resources.gold < w.hireCost) {
        return { label: "去行商凑 " + Math.ceil(w.hireCost - state.resources.gold) + " 金", cls: "btn-gold", short: "还差金币" };
      }
      return { label: "雇佣 " + w.name + " · " + w.hireCost + " 金", cls: "btn-gold" };
    }
    if (a.type === "build") {
      const b = BUILDING_MAP[a.id];
      const bs = state.buildings[a.id];
      if (bs.status === "built") return { label: "已完成", cls: "btn-wood", disabled: true };
      if (bs.status === "building") return { label: "施工中 " + Math.floor(bs.progress * 100) + "%", cls: "btn-wood", disabled: true };
      if (bs.status === "locked") return { label: "查看条件", cls: "btn-wood" };
      if (!canAfford(b.cost)) return { label: "材料不足 · 查看", cls: "btn-gold", short: missingCostsText(b.cost) };
      return { label: "建造 " + b.name + " · " + b.time + "秒", cls: "btn-gold" };
    }
    if (a.type === "sell") {
      const s = D.SELL_INFO[a.res];
      const have = Math.floor(state.resources[a.res] || 0);
      return {
        label: have >= s.amount ? "卖出 " + s.amount + " " + D.RESOURCES[a.res].name + " · +" + sellPrice(a.res) + "金" : "等待" + D.RESOURCES[a.res].name,
        cls: "btn-gold",
        disabled: have < s.amount,
        short: have < s.amount ? "还差 " + (s.amount - have) + " " + D.RESOURCES[a.res].name : ""
      };
    }
    if (a.type === "enterCastle") return { label: "进入城堡", cls: "btn-gold" };
    if (a.type === "festival") return { label: "举办丰收庆典", cls: "btn-gold" };
    return { label: "继续", cls: "btn-gold" };
  }

  function renderGuideBar() {
    const bar = $("#topObjective");
    if (!bar || !state) return;
    if (state.flags.festivalHeld) {
      bar.innerHTML =
        '<span class="top-obj-badge">终</span>' +
        '<div class="top-obj-copy"><div class="top-obj-kicker">庆典之后 · 自由经营</div>' +
        '<div class="top-obj-title">灯火长明</div>' +
        '<div class="top-obj-meta">居民会自动生产金币 · 菜单和扩建层已开放</div></div>' +
        '<div class="top-obj-actions">' +
        (state.expansionUnlocked ? '<button class="btn btn-gold top-obj-trade" data-action="open-expansion">扩建层</button>' : "") +
        '</div>';
      return;
    }
    const step = currentGuide();
    if (!step) {
      bar.innerHTML =
        '<span class="top-obj-badge">完</span>' +
        '<div class="top-obj-copy"><div class="top-obj-kicker">自由经营</div>' +
        '<div class="top-obj-title">风息堡的日常</div>' +
        '<div class="top-obj-meta">查看菜单、扩建房间，或者去庭院添一间商铺。</div></div>' +
        '<div class="top-obj-actions">' +
        (state.expansionUnlocked ? '<button class="btn btn-gold top-obj-trade" data-action="open-expansion">扩建层</button>' : "") +
        '</div>';
      return;
    }
    const idx = state.guideIndex;
    const action = guideActionInfo(step);
    const progress = step.progress ? step.progress(state) : "";
    const rewardHTML = step.reward ? Object.keys(step.reward).map(function (k) {
      return '<span class="top-obj-reward"><img src="' + I.icon(D.RESOURCES[k].icon) + '" alt="">+' + step.reward[k] + '</span>';
    }).join("") : "";
    bar.innerHTML =
      '<span class="top-obj-badge">' + (idx + 1) + '</span>' +
      '<div class="top-obj-copy">' +
      '<div class="top-obj-kicker">下一步 · ' + (idx + 1) + " / " + D.GUIDE.length + '</div>' +
      '<div class="top-obj-title">' + step.title + '</div>' +
      '<div class="top-obj-meta">' +
      (progress ? '<span class="top-obj-progress">' + progress + '</span>' : "") +
      rewardHTML +
      '</div></div>' +
      '<div class="top-obj-actions">' +
      '<button class="btn ' + action.cls + ' top-obj-main" data-action="guide"' + (action.disabled ? " disabled" : "") + '>' +
      escapeHTML(action.label) + '</button></div>';
  }

  function updateHint() {
    const hint = $("#hintText");
    if (!hint || !state) return;
    let text = "";
    if (state.flags.festivalHeld) {
      text = state.expansionUnlocked
        ? "城堡扩建层已经开放：点击画面上方「扩建层」，建造新房间，邀请戴面具的居民。"
        : "庆典结束了，但炉火还在烧。可以继续经营，或回顾庆典。";
    } else {
      const step = currentGuide();
      if (step) text = step.desc;
      else if (state.expansionUnlocked) text = "扩建层已经开放，去建造新房间，邀请新的居民。";
      else text = "跟着金色按钮走，就能一步步修复城堡。";
    }
    if (hint.textContent !== text) hint.textContent = text;
  }

  /* =========================================================
     场景 / 视图
     ========================================================= */
  function switchView(view) {
    if (!started) return;
    if (view === "indoor" && !state.interiorUnlocked) {
      toast("先建成两座庭院建筑，城堡内部才会开放。", "bad", "lock");
      return;
    }
    if (view === "expansion" && !state.expansionUnlocked) {
      toast("修复所有房间后，扩建层才会开放。", "bad", "lock");
      return;
    }
    if (view === "land" && state.view === "land") return;
    state.view = view;
    state.currentFloor = Math.max(0, Math.min(state.expansionFloorCount - 1, state.currentFloor || 0));
    if (view === "indoor") state.flags.enteredCastle = true;
    if (window.CastleScene && window.CastleScene.hideTooltip) window.CastleScene.hideTooltip();
    ui.guideSig = "";
    renderAll(true);
    checkGuide();
    saveState();
    A.sfx("page");
  }

  function updateSceneChrome() {
    const indoor = state.view === "indoor";
    const expansion = state.view === "expansion";
    const land = state.view === "land";
    $("#sceneLocationTitle").textContent = expansion ? "风息堡扩建层 · 第 " + (state.currentFloor + 1) + " 层" : indoor ? "风息堡大厅" : land ? "风息堡领地" : "风息堡庭院";
    $("#sceneLocationSub").textContent = expansion ? "UPPER WING · FLOOR " + (state.currentFloor + 1) : indoor ? "GREAT HALL · 内部" : land ? "OUTER FIELDS · 农田" : "WINDREST COURTYARD";
    const vs = $("#viewSwitch");
    if (vs) {
      vs.hidden = !started;
      $$(".view-btn", vs).forEach(function (b) {
        b.classList.toggle("active", b.dataset.view === state.view);
        if (b.dataset.view === "indoor") b.disabled = !state.interiorUnlocked;
        if (b.dataset.view === "expansion") {
          b.hidden = !state.expansionUnlocked;
          b.disabled = !state.expansionUnlocked;
        }
      });
    }
    const decorBtn = $("#decorBtn");
    if (decorBtn) {
      decorBtn.hidden = !(indoor || expansion);
      decorBtn.textContent = expansion ? "第 " + (state.currentFloor + 1) + " 层装修" : "装修";
    }
    const frame = $("#sceneFrame");
    if (frame) {
      frame.classList.toggle("is-indoor", indoor || expansion);
      frame.classList.toggle("is-expansion", expansion);
    }
  }

  /* =========================================================
     弹窗
     ========================================================= */
  function modalHead(icon, kicker, title, subtitle) {
    const isBuildingIcon = D.BUILDINGS.some(function (b) { return b.icon === icon; });
    const iconSrc = isBuildingIcon ? I.buildingIcon(icon) : I.icon(icon);
    return '<div class="modal-page-head"><div class="modal-title-wrap">' +
      '<div class="modal-icon"><img src="' + iconSrc + '" alt=""></div>' +
      '<div><div class="modal-kicker">' + kicker + '</div><h3 class="modal-title">' + title + "</h3>" +
      '<div class="modal-subtitle">' + subtitle + "</div></div></div>" +
      '<button class="modal-close" data-action="close-modal" aria-label="关闭"><img src="' + I.icon("close") + '" alt=""></button></div>';
  }

  function openModal(innerHTML, options) {
    const opts = options || {};
    lastFocus = document.activeElement;
    const root = $("#modalRoot");
    root.innerHTML = '<div class="modal-backdrop"><div class="modal ' + (opts.className || "") + '">' + innerHTML + "</div></div>";
    ui.modalOpen = true;
    const backdrop = root.querySelector(".modal-backdrop");
    requestAnimationFrame(function () { backdrop.classList.add("show"); });
    if (opts.dismissible !== false) {
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeModal(); });
    }
    const closeBtn = root.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(instant) {
    const root = $("#modalRoot");
    if (!root || !root.firstElementChild) { ui.modalOpen = false; return; }
    ui.modalOpen = false;
    const backdrop = root.querySelector(".modal-backdrop");
    if (backdrop) backdrop.classList.remove("show");
    if (instant) root.innerHTML = "";
    else setTimeout(function () { if (!ui.modalOpen) root.innerHTML = ""; }, 170);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }

  function showDialogue(opts) {
    const npc = D.NPCS[opts.npc] || D.NPCS.samuel;
    const lines = opts.lines.slice();
    let idx = 0, chars = 0, typing = false, timer = null;
    lastFocus = document.activeElement;
    const root = $("#modalRoot");
    root.innerHTML =
      '<div class="modal-backdrop show"><div class="modal dialogue-modal">' +
      '<div class="dialogue-side"><div class="dialogue-portrait"><img src="' + I.npcPortrait(opts.npc) + '" alt=""></div></div>' +
      '<div class="dialogue-content"><div class="dialogue-name">' + npc.name + "<small>" + npc.title + "</small></div>" +
      '<div class="dialogue-text" id="dialogueText"></div>' +
      '<div class="dialogue-bottom"><span class="dialogue-page" id="dialoguePage">1 / ' + lines.length + "</span>" +
      '<span class="dialogue-hint">点击继续</span>' +
      '<div class="dialogue-actions"><button class="btn btn-ghost btn-small" data-action="dialogue-skip">跳过</button>' +
      '<button class="btn btn-primary" data-action="dialogue-next">继续 ▸</button></div></div></div></div></div>';
    ui.modalOpen = true;
    ui.dialogueOpen = true;
    const textEl = $("#dialogueText");
    const pageEl = $("#dialoguePage");
    const nextBtn = root.querySelector('[data-action="dialogue-next"]');
    function paintText() {
      textEl.innerHTML = escapeHTML((lines[idx] || "").slice(0, chars)) + (typing ? '<span class="caret"></span>' : "");
    }
    function startLine() {
      chars = 0; typing = true;
      pageEl.textContent = (idx + 1) + " / " + lines.length;
      nextBtn.textContent = "继续 ▸";
      paintText();
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        if (chars < lines[idx].length) { chars++; paintText(); }
        else {
          typing = false; clearInterval(timer); timer = null;
          paintText(); nextBtn.textContent = idx === lines.length - 1 ? "结束对话" : "继续 ▸";
        }
      }, 26);
    }
    function finishLine() {
      if (timer) { clearInterval(timer); timer = null; }
      typing = false; chars = lines[idx].length; paintText();
      nextBtn.textContent = idx === lines.length - 1 ? "结束对话" : "继续 ▸";
    }
    function advance() {
      if (typing) { finishLine(); return; }
      if (idx < lines.length - 1) { idx++; startLine(); A.sfx("page"); }
      else finish();
    }
    function finish() {
      if (!ui.dialogueOpen) return;
      if (timer) clearInterval(timer);
      ui.dialogueOpen = false;
      ui.modalOpen = false;
      root.innerHTML = "";
      if (opts.onDone) opts.onDone();
    }
    window.__dialogueAdvance = advance;
    window.__dialogueFinish = finish;
    startLine();
    const modalEl = root.querySelector(".dialogue-modal");
    modalEl.addEventListener("click", function (e) { if (!e.target.closest("button")) advance(); });
  }

  function openAreaModal(id) {
    if (!started || !state) return;
    const b = BUILDING_MAP[id];
    if (!b) return;
    const bs = state.buildings[id];
    const w = b.worker ? WORKER_MAP[b.worker] : null;
    const status = b.scene === "indoor" ? (state.interiorUnlocked ? D.statusText(bs) : "未进入") : D.statusText(bs);
    const workerActive = w && state.workers[w.id].hired;
    const output = outputRateText(b);
    let extra = "";
    let actions = '<button class="btn btn-ghost" data-action="close-modal">关闭</button>';
    if (bs.status === "built") {
      extra = '<div class="requirement"><img src="' + I.icon("sparkle") + '" alt="">' +
        (workerActive ? "现在由 " + w.name + " 自动运作 · " + output : "这个区域已经修复。" ) +
        "</div>" + '<div class="modal-flavor">“' + b.flavor + '”</div>';
    } else if (bs.status === "building") {
      extra = '<div class="progress-bar staffed"><i style="width:' + Math.floor(bs.progress * 100) + '%"></i></div>' +
        '<div class="progress-label"><span>施工进度</span><span>' + Math.floor(bs.progress * 100) + "%</span></div>";
    } else if (bs.status === "available") {
      const afford = canAfford(b.cost);
      extra = '<div class="requirement"><img src="' + I.icon("clock") + '" alt="">约 ' + b.time + ' 秒完成，建成后自动运作</div>' +
        '<div class="modal-flavor">“' + b.flavor + '”</div>';
      actions = '<button class="btn btn-ghost" data-action="close-modal">稍后</button>' +
        '<button class="btn btn-gold" data-action="build" data-id="' + b.id + '"><img src="' + I.icon("hammer") + '" alt="">' +
        (afford ? "开始建造" : "材料不足") + "</button>";
    } else {
      let req = "";
      if (b.scene === "outdoor" && w) req = "先雇佣 " + w.name + "（" + w.hireCost + " 金币）";
      else if (b.scene === "indoor" && !state.interiorUnlocked) req = "建成两座庭院建筑后开放";
      else if (b.id === "chapel") req = "先修复四个房间";
      extra = '<div class="requirement"><img src="' + I.icon("lock") + '" alt="">' + req + "</div>";
      if (b.scene === "outdoor" && w) {
        actions = '<button class="btn btn-ghost" data-action="close-modal">关闭</button>' +
          '<button class="btn btn-gold" data-action="tab" data-tab="people"><img src="' + I.icon("people") + '" alt="">去居民页</button>';
      }
    }
    openModal(
      modalHead(b.icon, b.scene === "indoor" ? "城堡内部 · 房间" : "庭院 · 生产建筑", b.name, "需要 " + b.time + " 秒") +
      '<div class="modal-body"><p class="modal-copy">' + b.desc + "</p>" +
      '<div class="modal-stats">' +
      '<div class="modal-stat"><img src="' + I.icon("hammer") + '" alt=""><span>状态<b>' + status + "</b></span></div>" +
      '<div class="modal-stat"><img src="' + I.icon("people") + '" alt=""><span>居民<b>' + (w ? w.name : "无") + "</b></span></div>" +
      '<div class="modal-stat"><img src="' + I.icon("sparkle") + '" alt=""><span>效果<b>' + (b.effect || "生产 " + output) + "</b></span></div>" +
      '<div class="modal-stat"><img src="' + I.icon("clock") + '" alt=""><span>工期<b>' + b.time + " 秒</b></span></div>" +
      "</div>" +
      (bs.status === "available" ? '<div class="cost-row" style="margin-top:9px"><span class="cost-label">所需材料</span>' + costHTML(b.cost, true) + "</div>" : "") +
      extra +
      '<div class="modal-actions">' + actions + "</div></div>"
    );
  }

  function openCastleModal() {
    const built = D.countBuilt(state);
    const out = D.countBuilt(state, "outdoor");
    const inside = D.countBuilt(state, "indoor");
    openModal(
      modalHead("crest", "城堡档案", state.view === "indoor" ? "风息堡大厅" : "风息堡庭院", "一座正在重新亮起灯的城堡") +
      '<div class="modal-body"><p class="modal-copy">' +
      (built >= 8 ? "所有区域都恢复了。风息堡重新完整，壁炉、厨房和每一扇窗都亮着。" : "还有房间在等一盏灯。继续修复，让更多居民住进来。") +
      "</p>" +
      '<div class="modal-stats">' +
      '<div class="modal-stat"><img src="' + I.icon("crown") + '" alt=""><span>复兴进度<b>' + built + " / " + D.COMPLETION_TOTAL + "</b></span></div>" +
      '<div class="modal-stat"><img src="' + I.icon("hammer") + '" alt=""><span>庭院<b>' + out + " / 3</b></span></div>" +
      '<div class="modal-stat"><img src="' + I.icon("book") + '" alt=""><span>城堡内<b>' + inside + " / 5</b></span></div>" +
      '<div class="modal-stat"><img src="' + I.icon("people") + '" alt=""><span>居民<b>' + D.countHired(state) + " / 7</b></span></div>" +
      "</div>" +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">继续经营</button></div></div>'
    );
  }

  function tradeBought(res) {
    if (!state.trade || state.trade.day !== state.day) state.trade = { day: state.day, bought: { wood: 0, stone: 0, food: 0 } };
    return state.trade.bought[res] || 0;
  }

  function tradeRemaining(res) {
    return Math.max(0, D.BUY_INFO[res].daily - tradeBought(res));
  }

  function openTradeModal(note, tab) {
    tradeNote = note || "";
    if (tab) ui.tradeTab = tab;
    else if (note) ui.tradeTab = "sell";
    const active = ui.tradeTab || "sell";
    const sellRows = ["wood", "stone", "food"].map(function (res) {
      const info = D.SELL_INFO[res];
      const price = sellPrice(res);
      const have = Math.floor(state.resources[res]);
      const can = have >= info.amount;
      const allBatches = Math.floor(have / info.amount);
      return '<div class="trade-row">' +
        '<div class="trade-icon"><img src="' + I.icon(D.RESOURCES[res].icon) + '" alt=""></div>' +
        '<div class="trade-copy"><div class="trade-name">' + D.RESOURCES[res].name + ' <span>现有 ' + have + '</span></div>' +
        '<div class="trade-rate">' + info.amount + ' ' + D.RESOURCES[res].name + ' → <b>' + price + ' 金币</b>' +
        (hasMerchant() ? ' <span class="merchant-tag">金铃 +' + Math.round((0.5 + storeroomSellBonus()) * 100) + '%</span>' : "") + "</div></div>" +
        '<div class="trade-actions">' +
        '<button class="btn btn-gold btn-small" data-action="sell" data-res="' + res + '"' + (can ? "" : " disabled") + '>卖 ' + info.amount + '</button>' +
        '<button class="btn btn-wood btn-small" data-action="sell-all" data-res="' + res + '"' + (allBatches > 1 ? "" : " disabled") + '>全部 ' + (allBatches > 1 ? "+" + (allBatches * price) + "金" : "") + "</button>" +
        "</div></div>";
    }).join("");
    const buyRows = ["wood", "stone", "food"].map(function (res) {
      const info = D.BUY_INFO[res];
      const remain = tradeRemaining(res);
      const can = remain >= info.amount && (ui.debugMode || state.resources.gold >= info.gold);
      const maxBatches = Math.min(Math.floor(remain / info.amount), ui.debugMode ? 999 : Math.floor(state.resources.gold / info.gold));
      return '<div class="trade-row">' +
        '<div class="trade-icon"><img src="' + I.icon(D.RESOURCES[res].icon) + '" alt=""></div>' +
        '<div class="trade-copy"><div class="trade-name">' + D.RESOURCES[res].name + ' <span>现有 ' + Math.floor(state.resources[res]) + '</span></div>' +
        '<div class="trade-rate">' + info.gold + ' 金币 → <b>' + info.amount + ' ' + D.RESOURCES[res].name + '</b> · 今日还可买 <b>' + remain + '</b></div>' +
        '<div class="trade-daily"><i style="width:' + (tradeBought(res) / info.daily * 100) + '%"></i><span>' + tradeBought(res) + " / " + info.daily + "</span></div></div>" +
        '<div class="trade-actions">' +
        '<button class="btn btn-gold btn-small" data-action="buy-resource" data-res="' + res + '"' + (can ? "" : " disabled") + '>买 ' + info.amount + '</button>' +
        '<button class="btn btn-wood btn-small" data-action="buy-resource-all" data-res="' + res + '"' + (maxBatches > 1 ? "" : " disabled") + '>全部 ' + (maxBatches > 1 ? "+" + maxBatches * info.gold + "金币" : "") + "</button>" +
        "</div></div>";
    }).join("");
    const content = active === "sell"
      ? '<p class="modal-copy">' + (tradeNote || "把多余的木材、石料和食物换成金币。金铃在账房时，出售价格会更高。") + '</p><div class="trade-list">' + sellRows + "</div>"
      : '<p class="modal-copy">用金币补缺口。每种物资每天能买的量有限，黎明时刷新。价格比卖出高，别指望靠倒卖发财。</p><div class="trade-list">' + buyRows + "</div>";
    openModal(
      modalHead("coin", "门口的行商", "行商的货车", "卖出手里的余粮，或者买进今天缺的材料。") +
      '<div class="modal-body" id="tradeModal">' +
      '<div class="trade-tabs">' +
      '<button class="trade-tab' + (active === "sell" ? " active" : "") + '" data-action="trade-tab" data-tab="sell">卖出 · 换金币</button>' +
      '<button class="trade-tab' + (active === "buy" ? " active" : "") + '" data-action="trade-tab" data-tab="buy">买入 · 每日限购</button>' +
      "</div>" + content +
      '<div class="modal-actions"><span class="modal-note">当前金币：<b>' + (ui.debugMode ? "无限" : Math.floor(state.resources.gold)) + "</b> · 第 " + state.day + " 天</span>" +
      '<button class="btn btn-primary" data-action="close-modal">继续经营</button></div></div>',
      { className: "modal-trade" }
    );
  }

  function refreshTradeModal() {
    const modal = $("#tradeModal");
    if (!modal) return;
    const sc = $(".modal").scrollTop;
    const note = tradeNote;
    openTradeModal(note);
    const m = $(".modal");
    if (m) m.scrollTop = sc;
  }

  function buyResource(res, all) {
    if (!started) return;
    const info = D.BUY_INFO[res];
    if (!info) return;
    if (state.trade.day !== state.day) state.trade = { day: state.day, bought: { wood: 0, stone: 0, food: 0 } };
    const remain = tradeRemaining(res);
    const maxBatches = Math.min(Math.floor(remain / info.amount), ui.debugMode ? 999 : Math.floor(state.resources.gold / info.gold));
    if (remain < info.amount) { toast("今天的" + D.RESOURCES[res].name + "已经买完了，黎明会补货。", "bad", "coin"); return; }
    if (!ui.debugMode && state.resources.gold < info.gold) { toast("金币不够。先卖点东西吧。", "bad", "coin"); return; }
    const batches = all ? Math.max(1, maxBatches) : 1;
    const bought = batches * info.amount;
    const cost = batches * info.gold;
    if (!ui.debugMode) state.resources.gold -= cost;
    state.resources[res] = (state.resources[res] || 0) + bought;
    state.trade.bought[res] = (state.trade.bought[res] || 0) + bought;
    addLog("向行商买入 " + bought + " " + D.RESOURCES[res].name + "，花费 " + cost + " 金币。", "info");
    toast("买入 " + bought + " " + D.RESOURCES[res].name + "，金币 -" + cost + "。今日剩余 " + tradeRemaining(res) + "。", "good", D.RESOURCES[res].icon);
    A.sfx("coin");
    renderAll(true);
    saveState();
    if ($("#tradeModal")) refreshTradeModal();
  }


  function openHelpModal() {
    openModal(
      modalHead("book", "经营手册", "风息堡经营手册", "从一条金色按钮开始，慢慢把城堡变成一座城。") +
      '<div class="modal-body"><div class="help-list">' +
      '<div class="help-item"><img src="' + I.icon("people") + '" alt=""><div><strong>① 雇人 → 解锁建筑</strong><p>先在居民页雇佣工匠。每个人都会解锁一座对应建筑，雇佣后建筑会自动出现在建设页。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("hammer") + '" alt=""><div><strong>② 建造 → 自动生产</strong><p>花材料建造。建成后对应居民会自动工作，不需要手动安排岗位，资源会持续积累。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("coin") + '" alt=""><div><strong>③ 木材/石料 → 金币</strong><p>点击右上角的行商按钮，把木材或石料卖给行商。金币用来雇佣新居民、修复城堡房间和购买食物。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("food") + '" alt=""><div><strong>④ 吃饭 → 效率</strong><p>每天黎明每位居民吃 1 份食物。吃饱时全员效率 +10%，饿肚子时效率 -30%。厨房会减少 1 份口粮需求。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("crest") + '" alt=""><div><strong>⑤ 两座建筑 → 城堡内部</strong><p>庭院建成两座建筑后，点击场景上方的「城堡内」，修复厨房、书房、兵营、账房和礼拜堂。每修好一个房间就会有一位新居民加入。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("food") + '" alt=""><div><strong>⑥ 厨房菜单 → 居民收入</strong><p>厨房修好后，点击顶栏金色「菜单」按钮购买菜肴。菜谱会随居民数量逐步解锁；每道菜提高居民金币收入，同时每天额外消耗 1–3 份食物。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("coin") + '" alt=""><div><strong>⑦ 庭院商铺 → 额外收入</strong><p>面包房、铁匠铺、杂货铺之外，还会解锁鱼摊（城堡阶段 5）和花摊（扩建第 2 层）。商铺持续产金币、提高居民收入，也各自增加 1 份/天食物消耗。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("sparkle") + '" alt=""><div><strong>⑧ 扩建层 → 房间、职业与配比</strong><p>修复所有房间后开放扩建层。每层 10 个不同尺寸的位置，房间可重复、位置自选。居民需要民居，士兵需要厕所+武器库+士兵营房，大臣需要会议室+书房+大臣办公室，传教士需要小礼拜堂+静修室。点击已建房间可以升级或拆除，升级会多出地毯、家具、床位和吊灯；地板/装修使用场景上方的「装修」按钮，与房间升级分开。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("bunting") + '" alt=""><div><strong>⑨ 全部修复 → 丰收庆典</strong><p>庭院 3 个区域 + 城堡内 5 个区域全部完成，就能举办庆典。庆典时所有居民会聚到城堡门外。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("cart") + '" alt=""><div><strong>⑩ 行商买入页</strong><p>行商现在有「卖出 / 买入」两页。木材、石料、食物都能买，但每种物资每天有购买上限，黎明刷新。卖出价格受金铃和账房等级影响。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("arrow") + '" alt=""><div><strong>⑪ 扩建与升级</strong><p>伐木场、农田、采石场可以扩建提高产速；城堡房间也可以升级，增强效果与满意度。顶栏进度会显示城堡等级与威望，外观会随等级变得更华丽。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("people") + '" alt=""><div><strong>⑫ 防御、满意度与离开</strong><p>士兵不足时隔壁村会偷物资；没有传教士时居民产能 -20%。食物、菜单、空间、基础设施和房间等级都会影响满意度，低于 30 时客人会离开。主线居民不会离开。每层建议至少 1 间厕所和 1 间餐厅。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("farm") + '" alt=""><div><strong>⑬ 领地农田</strong><p>顶部切换到「领地」，一页有 12 块田，用金币/木材逐块开垦。8 种作物按居民数解锁；作物成熟后收获并记录，用于解锁番茄意面、玉米面包、葡萄派、薰衣草茶。菜品会给不同职业加成；农夫/厨师是新增居民。领地底部还能建 2 个商铺。</p></div></div>' +
      '<div class="help-item"><img src="' + I.icon("hammer") + '" alt=""><div><strong>⑭ 调试模式</strong><p>按 `~` / `Ctrl+Shift+D` 打开。调试模式下建造立即完成，还可以一键加资源、解锁区域、满级和跳过一天。仅用于开发测试。</p></div></div>' +
      "</div>" +
      '<div class="modal-actions"><span class="modal-note">空格暂停 · 1/2/3 调速 · M 静音</span>' +
      '<button class="btn btn-primary" data-action="close-modal">开始经营</button></div></div>'
    );
  }

  function showResidentIntro(w) {
    if (!w) return;
    openModal(
      '<div class="resident-intro"><div class="resident-portrait"><img src="' + I.portraitFor(w) + '" alt=""></div>' +
      '<div class="resident-copy"><div class="modal-kicker">新居民加入</div><h3 class="modal-title">' + w.name + " · " + w.roleName + "</h3>" +
      '<p class="resident-quirk">“' + w.quirk + '”</p>' +
      '<div class="resident-perk"><img src="' + I.icon("sparkle") + '" alt=""><span><b>' + w.traitName + "</b> · " + w.traitDesc + "</span></div>" +
      '<p class="modal-copy" style="margin-top:10px">从今天起，' + w.name + " 每天会消耗 1 份食物，但也会让所有人都干得更快。</p>" +
      '<div class="modal-actions"><button class="btn btn-gold" data-action="close-modal">欢迎加入风息堡</button></div></div></div>',
      { className: "modal-resident" }
    );
    A.sfx("hire");
  }

  function showEndingModal() {
    const stats = state.stats;
    const minutes = Math.max(1, Math.round(stats.playSeconds / 60));
    closeModal(true);
    openModal(
      '<div class="ending-head"><img src="' + I.icon("crest") + '" alt="">' +
      '<div class="ending-kicker">风息堡 · 第 ' + state.day + " 天</div>" +
      '<h3 class="ending-title">灯火长明</h3>' +
      '<div class="ending-sub">A CASTLE ALIVE AGAIN</div></div>' +
      '<div class="ending-copy">你推开窗。大厅里有人唱歌，厨房里的汤还冒着热气，<br>' +
      '每个房间、每个人，把整座城堡都照亮了。<br><br>' +
      '二十年前的大火烧掉了屋顶，却没能烧掉人们回来的理由。<br>' +
      '今晚，风息堡重新成为了家。</div>' +
      '<div class="ending-stats">' +
      '<div class="ending-stat"><span>经营天数</span><b>' + state.day + "</b></div>" +
      '<div class="ending-stat"><span>修复区域</span><b>' + D.countBuilt(state) + " / " + D.COMPLETION_TOTAL + "</b></div>" +
      '<div class="ending-stat"><span>城堡居民</span><b>' + countResidents() + "</b></div>" +
      '<div class="ending-stat"><span>累计卖货</span><b>' + (stats.soldWood + stats.soldStone + stats.soldFood) + "</b></div>" +
      "</div>" +
      '<div class="modal-actions" style="justify-content:center"><span class="modal-note">经营了约 ' + minutes + " 分钟</span>" +
      '<button class="btn btn-ghost" data-action="ending-title">回到标题</button>' +
      '<button class="btn btn-gold" data-action="ending-continue">继续经营城堡</button></div>',
      { className: "modal-ending", dismissible: false }
    );
  }

  /* =========================================================
     账房 UI
     ========================================================= */
  function renderAll(force) {
    if (!state) return;
    updateTopbar();
    updateMenuButton();
    updateSceneChrome();
    ui.guideSig = "";
    renderGuideBar();
    updateTabs();
    renderLedger(true);
    renderSceneHotspots();
    renderFloorSwitch();
    updateDailyStatus();
    updateHint();
    updateSaveStatus();
  }

  function updateTabs() {
    $$(".tab-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === ui.tab); });
  }

  function renderLedger(force) {
    if (!state) return;
    const body = $("#ledgerBody");
    if (!body) return;
    if (!force && document.activeElement && body.contains(document.activeElement)) return;
    if (!force && ui.modalOpen) return;
    const scroll = body.scrollTop;
    let html = "";
    if (ui.tab === "build") html = renderBuildTab();
    else if (ui.tab === "people") html = renderPeopleTab();
    else html = renderJournalTab();
    body.innerHTML = html;
    body.scrollTop = scroll;
    setLedgerHint();
    if (ui.highlightWorker) {
      const el = body.querySelector('[data-worker-card="' + ui.highlightWorker + '"]');
      if (el && force) { try { el.scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ } }
      ui.highlightWorker = null;
    }
  }

  function setLedgerHint() {
    const hints = {
      build: state.view === "indoor" ? "修复房间会引入新居民，并提高生产效率" : "庭院建成两座建筑后，就能进入城堡内部",
      people: "居民会自动工作，不需要手动安排岗位",
      journal: "所有目标、记录和存档都在这里"
    };
    const el = $("#ledgerHint");
    if (el) el.textContent = hints[ui.tab] || "";
  }

  function sectionHead(left, right) {
    return '<div class="tab-section-head"><b>' + left + '</b><span class="count">' + right + "</span></div>";
  }

  function currentGuideTarget() {
    const step = currentGuide();
    if (!step || !step.action) return null;
    const a = step.action;
    if (a.type === "hire") return "worker:" + a.id;
    if (a.type === "build") return "area:" + a.id;
    return null;
  }

  function renderBuildTab() {
    const scene = state.view;
    if (scene === "expansion") return renderExpansionBuildTab();
    if (scene === "land") return renderLandBuildTab();
    const list = D.BUILDINGS.filter(function (b) { return b.scene === scene; });
    const built = list.filter(function (b) { return state.buildings[b.id].status === "built"; }).length;
    const target = currentGuideTarget();
    let html = sectionHead(scene === "indoor" ? "城堡内部" : "庭院建设", built + " / " + list.length + " 已完成");
    if (scene === "indoor" && !state.interiorUnlocked) {
      html += '<div class="empty-state"><img src="' + I.icon("lock") + '" alt="">城堡内部还没有开放。<br>先在庭院建成两座建筑。</div>';
      return html;
    }
    list.forEach(function (b) {
      const bs = state.buildings[b.id];
      const w = b.worker ? WORKER_MAP[b.worker] : null;
      const isTarget = target === "area:" + b.id;
      const status = bs.status;
      let cls = "card area-card";
      if (status === "locked") cls += " is-locked";
      if (status === "building") cls += " is-building";
      if (status === "built") cls += " is-built";
      if (isTarget) cls += " is-target";
      let tags = b.tags.map(function (t, i) { return '<span class="chip ' + (i === 0 ? "green" : "gold") + '">' + t + "</span>"; }).join("");
      let body = "";
      let action = "";
      if (status === "built") {
        const lv = buildingLevel(b.id);
        body = '<div class="area-status"><b>自动运作中</b> · ' + (w ? w.name : "无人值守") + ' · <span class="building-level">Lv.' + lv + "</span></div>";
        body += '<div class="area-output">' + outputRateText(b) + "</div>";
        action = (b.id === "kitchen" ? '<button class="btn btn-gold btn-small" data-action="menu"><img src="' + I.icon("food") + '" alt="">菜单</button>' : "") +
          (lv < D.MAX_BUILDING_LEVEL ? '<button class="btn btn-wood btn-small" data-action="upgrade-open" data-id="' + b.id + '"><img src="' + I.icon("arrow") + '" alt="">升级</button>' : '<span class="building-level max">Lv.MAX</span>') +
          '<button class="btn btn-ghost btn-small" data-action="show-area" data-id="' + b.id + '">详情</button>';
      } else if (status === "building") {
        body = '<div class="progress-bar"><i style="width:' + Math.floor(bs.progress * 100) + '%"></i></div>' +
          '<div class="progress-label"><span>施工进度</span><span>' + Math.floor(bs.progress * 100) + "%</span></div>";
        action = '<button class="btn btn-ghost btn-small" disabled>施工中</button>';
      } else if (status === "available") {
        body = '<div class="cost-row">' + costHTML(b.cost, true) + "</div>" +
          '<div class="area-hint">' + (b.effect || "建成后自动生产") + " · " + b.time + " 秒</div>";
        action = '<button class="btn btn-gold" data-action="build" data-id="' + b.id + '">' +
          '<img src="' + I.icon("hammer") + '" alt="">建造</button>';
      } else {
        const reason = b.scene === "outdoor" && w
          ? '<div class="lock-line"><img src="' + I.icon("lock") + '" alt="">先雇佣 ' + w.name + "（" + w.hireCost + " 金币）</div>"
          : '<div class="lock-line"><img src="' + I.icon("lock") + '" alt="">' + (b.id === "chapel" ? "修复四个房间后开放" : "进入城堡后开放") + "</div>";
        body = reason;
        action = b.scene === "outdoor" && w
          ? '<button class="btn btn-wood btn-small" data-action="tab" data-tab="people">去居民页</button>'
          : '<button class="btn btn-ghost btn-small" disabled>未开放</button>';
      }
      html += '<article class="' + cls + '" data-area-card="' + b.id + '">' +
        '<div class="card-icon"><img src="' + I.buildingIcon(b.icon) + '" alt=""></div>' +
        '<div class="card-main"><div class="card-title-row"><h3 class="card-title">' + b.name + "</h3>" + tags + "</div>" +
        '<div class="card-desc">' + b.desc + "</div>" +
        '<div class="area-room">' + b.room + "</div>" + body +
        '<div class="card-actions"><span class="card-status">' + (w ? (state.workers[w.id].hired ? "居民：" + w.name : "将入住：" + w.name) : "终章区域") + "</span>" + action + "</div>" +
        "</div></article>";
    });
    if (scene === "outdoor") html += renderShopsSection();
    if (scene === "indoor" && state.expansionUnlocked) {
      html += '<div class="expansion-entry"><div><b>城堡扩建层已开放</b><span>建造可重复的房间，增加床位和居民收入。</span></div>' +
        '<button class="btn btn-wood btn-small" data-action="open-expansion">去看看</button></div>';
    }
    return html;
  }

  function interiorSkinState() {
    if (!state.interiorSkin) state.interiorSkin = { owned: ["stone"], selected: "stone" };
    const st = state.interiorSkin;
    if (!Array.isArray(st.owned)) st.owned = ["stone"];
    if (st.owned.indexOf("stone") < 0) st.owned.push("stone");
    if (!st.selected || st.owned.indexOf(st.selected) < 0) st.selected = "stone";
    return st;
  }

  function currentInteriorSkin() {
    return interiorSkinState();
  }

  function applyInteriorSkin(id) {
    const skin = floorSkinById(id);
    const st = currentInteriorSkin();
    if (st.owned.indexOf(skin.id) < 0) return;
    st.selected = skin.id;
    toast("城堡内部地板换成「" + skin.name + "」。", "good", "sparkle");
    A.sfx("page");
    closeModal(true);
    renderAll(true);
    saveState();
  }

  function buyInteriorSkin(id) {
    const skin = floorSkinById(id);
    const st = currentInteriorSkin();
    if (st.owned.indexOf(skin.id) >= 0) { applyInteriorSkin(id); return; }
    if (!canAfford({ gold: skin.cost })) { toast("金币不够，装修需要 " + skin.cost + " 金币。", "bad", "coin"); return; }
    payCost({ gold: skin.cost });
    st.owned.push(skin.id);
    st.selected = skin.id;
    addLog("城堡内部购买了装修「" + skin.name + "」。", "good");
    toast("城堡内部已装修为「" + skin.name + "」。", "gold", "sparkle");
    A.sfx("complete");
    renderAll(true);
    saveState();
    openInteriorSkinModal();
  }

  function openInteriorSkinModal() {
    const st = currentInteriorSkin();
    const rows = D.FLOOR_SKINS.map(function (skin) {
      const owned = st.owned.indexOf(skin.id) >= 0;
      const selected = st.selected === skin.id;
      const can = skin.cost === 0 || canAfford({ gold: skin.cost });
      return '<div class="floor-skin-row' + (selected ? " selected" : "") + '">' +
        '<div class="floor-skin-swatch ' + skin.id + '"></div>' +
        '<div class="floor-skin-copy"><b>' + skin.name + '</b><span>' + skin.desc + "</span>" +
        '<em>' + (owned ? "城堡内部已拥有" : "城堡内部 · " + skin.cost + " 金币") + "</em></div>" +
        '<div class="floor-skin-action">' + (selected
          ? '<span class="menu-check">使用中</span>'
          : owned
            ? '<button class="btn btn-wood btn-small" data-action="apply-interior-skin" data-id="' + skin.id + '">使用</button>'
            : '<button class="btn btn-gold btn-small" data-action="buy-interior-skin" data-id="' + skin.id + '"' + (can ? "" : " disabled") + '>购买</button>') +
        "</div></div>";
    }).join("");
    openModal(
      modalHead("sparkle", "城堡内部 · 装修", "地板与样式", "一次购买应用于整个城堡内部，不影响扩建层各层皮肤。") +
      '<div class="modal-body"><div class="floor-skin-list">' + rows + "</div>" +
      '<div class="modal-actions"><span class="modal-note">当前金币：<b>' + (ui.debugMode ? "无限" : Math.floor(state.resources.gold)) + "</b></span>" +
      '<button class="btn btn-primary" data-action="close-modal">完成</button></div></div>',
      { className: "modal-floor-skin" }
    );
  }

  function floorSkinState(index) {
    if (!state.floorSkins) state.floorSkins = {};
    if (!state.floorSkins[index]) state.floorSkins[index] = { owned: ["stone"], selected: "stone" };
    const st = state.floorSkins[index];
    if (!Array.isArray(st.owned)) st.owned = ["stone"];
    if (st.owned.indexOf("stone") < 0) st.owned.push("stone");
    if (!st.selected || st.owned.indexOf(st.selected) < 0) st.selected = "stone";
    return st;
  }

  function floorSkinById(id) {
    return D.FLOOR_SKINS.filter(function (sk) { return sk.id === id; })[0] || D.FLOOR_SKINS[0];
  }

  function currentFloorSkin() {
    return floorSkinState(state.currentFloor || 0);
  }

  function applyFloorSkin(id) {
    const skin = floorSkinById(id);
    const st = currentFloorSkin();
    if (st.owned.indexOf(skin.id) < 0) return;
    st.selected = skin.id;
    toast("第 " + (state.currentFloor + 1) + " 层地板换成「" + skin.name + "」。", "good", "sparkle");
    A.sfx("page");
    closeModal(true);
    renderAll(true);
    saveState();
  }

  function buyFloorSkin(id) {
    const skin = floorSkinById(id);
    const st = currentFloorSkin();
    if (st.owned.indexOf(skin.id) >= 0) { applyFloorSkin(id); return; }
    if (!canAfford({ gold: skin.cost })) {
      toast("金币不够，购买「" + skin.name + "」需要 " + skin.cost + " 金币。", "bad", "coin");
      return;
    }
    payCost({ gold: skin.cost });
    st.owned.push(skin.id);
    st.selected = skin.id;
    addLog("第 " + (state.currentFloor + 1) + " 层购买了地板皮肤「" + skin.name + "」。", "good");
    toast("「" + skin.name + "」已应用到第 " + (state.currentFloor + 1) + " 层。", "gold", "sparkle");
    A.sfx("complete");
    renderAll(true);
    saveState();
    openFloorSkinModal();
  }

  function openFloorSkinModal() {
    const floor = state.currentFloor || 0;
    const st = currentFloorSkin();
    const rows = D.FLOOR_SKINS.map(function (skin) {
      const owned = st.owned.indexOf(skin.id) >= 0;
      const selected = st.selected === skin.id;
      const can = skin.cost === 0 || canAfford({ gold: skin.cost });
      return '<div class="floor-skin-row' + (selected ? " selected" : "") + '">' +
        '<div class="floor-skin-swatch ' + skin.id + '"></div>' +
        '<div class="floor-skin-copy"><b>' + skin.name + '</b><span>' + skin.desc + "</span>" +
        '<em>' + (owned ? "本层已拥有" : "仅限本层 · " + skin.cost + " 金币") + "</em></div>" +
        '<div class="floor-skin-action">' + (selected
          ? '<span class="menu-check">本层使用中</span>'
          : owned
            ? '<button class="btn btn-wood btn-small" data-action="apply-floor-skin" data-id="' + skin.id + '">使用</button>'
            : '<button class="btn btn-gold btn-small" data-action="buy-floor-skin" data-id="' + skin.id + '"' + (can ? "" : " disabled") + '>购买</button>') +
        "</div></div>";
    }).join("");
    openModal(
      modalHead("sparkle", "扩建层 · 地板皮肤", "第 " + (floor + 1) + " 层地板", "一次购买只解锁当前楼层；另一层需要单独购买。") +
      '<div class="modal-body"><div class="floor-skin-list">' + rows + "</div>" +
      '<div class="modal-actions"><span class="modal-note">当前金币：<b>' + (ui.debugMode ? "无限" : Math.floor(state.resources.gold)) + "</b></span>" +
      '<button class="btn btn-primary" data-action="close-modal">完成</button></div></div>',
      { className: "modal-floor-skin" }
    );
  }

  function expansionRoomBrief(type, room) {
    if (!type) return "";
    const parts = [];
    if (type.capacity) parts.push("床位 " + roomCapacity(type, room));
    if (type.defense) parts.push("防御 +" + (type.defense + (roomLevel(room) - 1) * 3));
    if (type.residentBonus) parts.push("收入 +" + Math.round(type.residentBonus * roomScale(room) * 100) + "%");
    if (type.productionBonus) parts.push("生产 +" + Math.round(type.productionBonus * roomScale(room) * 100) + "%");
    if (type.foodBonus) parts.push("食物 +" + Math.round(type.foodBonus * roomScale(room) * 100) + "%");
    if (type.satisfaction) parts.push("满意 +" + (type.satisfaction + (roomLevel(room) - 1) * 2));
    return parts.join(" · ") || "基础房";
  }

  function cropById(id) {
    return D.CROPS.filter(function (c) { return c.id === id; })[0] || D.CROPS[0];
  }

  function landShopById(id) {
    return D.LAND_SHOPS.filter(function (sh) { return sh.id === id; })[0] || null;
  }

  function landShopBuiltCount() {
    return (state.land.shops || []).filter(Boolean).length;
  }

  function buildLandShop(index) {
    if (!state.land || !state.land.plots) return;
    if (state.land.shops[index]) return;
    const shop = D.LAND_SHOPS[index];
    if (!shop) return;
    if (!canAfford(shop.cost)) { toast("建造" + shop.name + "还差：" + missingCostsText(shop.cost), "bad", "hammer"); return; }
    payCost(shop.cost);
    if (!state.land.shops) state.land.shops = [null, null];
    state.land.shops[index] = shop.id;
    addLog("领地里建起了「" + shop.name + "」。", "good");
    toast(shop.name + "开张，领地商铺开始营业。", "gold", "coin");
    A.sfx("build");
    renderAll(true);
    saveState();
  }

  function landUnlockedCount() {
    return state.land.plots.filter(function (p) { return p.unlocked; }).length;
  }

  function nextLandPlot() {
    for (let i = 0; i < state.land.plots.length; i++) if (!state.land.plots[i].unlocked) return i;
    return -1;
  }

  function landExpandCost(index) {
    const n = Math.max(0, index);
    return { gold: 80 + n * 50, wood: 20 + n * 10 };
  }

  function landPlotState(plot) {
    if (!plot.unlocked) return "未开垦";
    if (!plot.crop) return "空地 · 可播种";
    const crop = cropById(plot.crop);
    return plot.ready ? crop.name + " · 可收获" : crop.name + " · " + plot.growth + "/" + crop.days + " 天";
  }

  function expandLandPlot(index) {
    const plot = state.land.plots[index];
    if (!plot || plot.unlocked) return;
    const first = nextLandPlot();
    if (first !== index) {
      toast("按顺序扩建：先开垦第 " + (first + 1) + " 块田。", "bad", "lock");
      return;
    }
    const cost = landExpandCost(index);
    if (!canAfford(cost)) { toast("资源不够，扩建这块田需要 " + costTextOnly(cost) + "。", "bad", "hammer"); return; }
    payCost(cost);
    plot.unlocked = true;
    addLog("领地开垦了第 " + (index + 1) + " 块田。", "good");
    toast("第 " + (index + 1) + " 块田已开垦。", "gold", "farm");
    A.sfx("build");
    closeModal(true);
    renderAll(true);
    saveState();
  }

  function sowLandCrop(index, cropId) {
    const plot = state.land.plots[index];
    if (!plot || !plot.unlocked || plot.crop) return;
    const crop = cropById(cropId);
    if (countResidents() < (crop.minResidents || 0)) { toast("「" + crop.name + "」需要 " + crop.minResidents + " 位居民后解锁。", "bad", "lock"); return; }
    if (!canAfford({ gold: crop.cost })) { toast("金币不够，播种需要 " + crop.cost + " 金币。", "bad", "coin"); return; }
    payCost({ gold: crop.cost });
    plot.crop = crop.id;
    plot.growth = 0;
    plot.ready = false;
    plot.plantedDay = state.day;
    addLog("第 " + (index + 1) + " 块田播下" + crop.name + "。", "good");
    toast("播下" + crop.name + "，约 " + crop.days + " 天成熟。", "good", "farm");
    A.sfx("build");
    closeModal(true);
    renderAll(true);
    saveState();
  }

  function growLandCrops() {
    if (!state.land) return;
    state.land.plots.forEach(function (plot, i) {
      if (!plot.unlocked || !plot.crop || plot.ready) return;
      const crop = cropById(plot.crop);
      plot.growth = Math.min(crop.days, plot.growth + 1);
      if (plot.growth >= crop.days) {
        plot.ready = true;
        addLog("第 " + (i + 1) + " 块田的" + crop.name + "成熟了。", "good");
      }
    });
  }

  function harvestLandPlot(index) {
    const plot = state.land.plots[index];
    if (!plot || !plot.ready || !plot.crop) return;
    const crop = cropById(plot.crop);
    if (!state.land.cropsSeen) state.land.cropsSeen = {};
    state.land.cropsSeen[crop.id] = true;
    const yieldMult = 1 + classCount("farmer") * 0.08 + menuAffinity("farmer");
    Object.keys(crop.harvest).forEach(function (k) {
      state.resources[k] = (state.resources[k] || 0) + Math.round(crop.harvest[k] * yieldMult);
    });
    const gains = Object.keys(crop.harvest).map(function (k) { return D.RESOURCES[k].name + " +" + Math.round(crop.harvest[k] * yieldMult); }).join(" · ");
    addLog("收获第 " + (index + 1) + " 块田的" + crop.name + "：" + gains + "。", "good");
    toast("收获" + crop.name + "：" + gains, "gold", "food");
    plot.crop = null;
    plot.growth = 0;
    plot.ready = false;
    plot.plantedDay = null;
    A.sfx("complete");
    closeModal(true);
    renderAll(true);
    saveState();
  }

  function openLandPlotModal(index) {
    const plot = state.land.plots[index];
    if (!plot) return;
    if (!plot.unlocked) {
      const cost = landExpandCost(index);
      openModal(
        modalHead("farm", "领地 · 第 " + (index + 1) + " 块田", "开垦新田", "开垦后可以播种；田地按顺序扩建。") +
        '<div class="modal-body"><div class="land-modal-cost">开垦费用：' + costTextOnly(cost) + "</div>" +
        '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
        '<button class="btn btn-gold" data-action="expand-land" data-plot="' + index + '"' + (canAfford(cost) ? "" : " disabled") + ">开垦</button></div></div>"
      );
      return;
    }
    if (!plot.crop) {
      const rows = D.CROPS.map(function (crop) {
        const unlocked = countResidents() >= (crop.minResidents || 0);
        const can = unlocked && canAfford({ gold: crop.cost });
        const gains = Object.keys(crop.harvest).map(function (k) { return D.RESOURCES[k].name + " +" + crop.harvest[k]; }).join(" · ");
        return '<button class="crop-row' + (unlocked ? "" : " crop-locked") + '" data-action="sow-land" data-plot="' + index + '" data-crop="' + crop.id + '"' + (can ? "" : " disabled") + ">" +
          '<span class="crop-dot" style="background:' + crop.color + '"></span><span class="crop-copy"><b>' + crop.name + '</b><em>' + (unlocked ? crop.days + " 天 · " + crop.cost + " 金" : "需要 " + crop.minResidents + " 居民") + '</em></span>' +
          '<span class="crop-gain">' + (unlocked ? gains : "未解锁") + "</span></button>";
      }).join("");
      openModal(
        modalHead("farm", "领地 · 第 " + (index + 1) + " 块田", "播种", "选择一种作物；同一天只能种一次。") +
        '<div class="modal-body"><div class="crop-list">' + rows + "</div>" +
        '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">取消</button></div></div>'
      );
      return;
    }
    const crop = cropById(plot.crop);
    const gains = Object.keys(crop.harvest).map(function (k) { return D.RESOURCES[k].name + " +" + crop.harvest[k]; }).join(" · ");
    openModal(
      modalHead("farm", "领地 · 第 " + (index + 1) + " 块田", crop.name, plot.ready ? "已经成熟，可以收获" : "第 " + (crop.days - plot.growth) + " 天后成熟") +
      '<div class="modal-body"><div class="land-modal-cost">' + (plot.ready ? "已经成熟，可以收获。" : "生长中：" + plot.growth + " / " + crop.days + " 天") + "</div>" +
      '<div class="requirement">预计收成：' + gains + "</div>" +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">关闭</button>' +
      (plot.ready ? '<button class="btn btn-gold" data-action="harvest-land" data-plot="' + index + '">收获</button>' : "") + "</div></div>"
    );
  }

  function renderLandBuildTab() {
    const plots = state.land.plots;
    const open = landUnlockedCount();
    const ready = plots.filter(function (p) { return p.ready; }).length;
    const growing = plots.filter(function (p) { return p.crop && !p.ready; }).length;
    let html = sectionHead("领地农田", open + "/" + D.LAND_PLOT_RECTS.length + " 已开垦");
    html += '<div class="floor-compact-stats land-stats">' +
      '<div class="floor-stat"><span>成熟</span><b>' + ready + "</b></div>" +
      '<div class="floor-stat"><span>生长中</span><b>' + growing + "</b></div></div>";
    html += '<div class="land-grid">';
    plots.forEach(function (plot, i) {
      const locked = !plot.unlocked;
      html += '<button class="land-tile ' + (locked ? "locked" : plot.ready ? "ready" : plot.crop ? "growing" : "empty") + '" data-action="land-plot" data-plot="' + i + '">' +
        '<span class="land-tile-id">田 ' + (i + 1) + "</span><b>" + landPlotState(plot) + "</b></button>";
    });
    html += "</div>";
    const next = nextLandPlot();
    if (next >= 0) {
      const cost = landExpandCost(next);
      html += '<button class="btn btn-gold land-expand" data-action="expand-land" data-plot="' + next + '"' + (canAfford(cost) ? "" : " disabled") + ">开垦田 " + (next + 1) + " · " + costTextOnly(cost) + "</button>";
    } else {
      html += '<div class="floor-warning">土地已经全部开垦，没有更多田地了。</div>';
    }
    html += '<div class="tab-section-head" style="margin-top:10px"><b>领地商铺</b><span class="count">' + landShopBuiltCount() + "/2</span></div>";
    D.LAND_SHOPS.forEach(function (shop, i) {
      const built = state.land.shops && state.land.shops[i];
      html += '<button class="land-shop-tile ' + (built ? "built" : "") + '" data-action="land-shop" data-slot="' + i + '">' +
        '<b>' + (built ? "「" + shop.name + "」营业中" : "商铺位 " + (i + 1) + " · " + shop.name) + "</b>" +
        '<em>' + (built ? "金币 +" + (shop.income * 60).toFixed(1) + "/分" : costTextOnly(shop.cost)) + "</em></button>";
    });
    return html;
  }

  function ensureFloorProgression(notify) {
    if (!state || !state.expansionUnlocked) return;
    const floor = state.currentFloor || 0;
    if (floorRoomCount(floor) < D.EXPANSION_SLOTS.length) return;
    const nextCount = floor + 2;
    if (state.expansionFloorCount < nextCount) {
      state.expansionFloorCount = nextCount;
      addLog("第 " + (floor + 1) + " 层已建满，第 " + (floor + 2) + " 层自动解锁。", "good");
      if (notify !== false) {
        setTimeout(function () {
          toast("第 " + (floor + 1) + " 层已满，第 " + (floor + 2) + " 层已自动解锁。点击楼梯或楼层按钮上去。", "gold", "sparkle");
        }, 400);
      }
      saveState();
    }
  }

  function renderExpansionBuildTab() {
    ensureFloorProgression(false);
    const floor = state.currentFloor || 0;
    const rooms = currentFloorRooms();
    const built = floorRoomCount(floor);
    const fac = floorFacilities(floor);
    const defense = defenseValue();
    const need = requiredSoldiers();
    const soldiers = classCount("soldier");
    const guests = guestsOnFloor(floor);
    const missing = [];
    if (fac.rooms > 0 && !fac.toilet) missing.push("缺厕所");
    if (fac.rooms > 0 && !fac.dining) missing.push("缺餐厅");
    if (need > 0 && soldiers < need) missing.push("缺士兵 " + soldiers + "/" + need);
    if (countResidents() > 0 && missionaryCount() === 0) missing.push("缺传教士");
    let html = sectionHead("第 " + (floor + 1) + " 层", built + "/" + D.EXPANSION_SLOTS.length + " 房");
    html += '<div class="floor-compact-stats">' +
      '<div class="floor-stat"><span>床位</span><b>' + guests.length + " / " + floorBeds(floor) + "</b></div>" +
      '<div class="floor-stat"><span>传教</span><b>' + classCount("missionary") + "</b></div></div>";
    if (missing.length) html += '<div class="floor-warning">' + missing.join(" · ") + "</div>";
    html += '<div class="floor-actions"><button class="btn btn-gold btn-small" data-action="recruit-open"><img src="' + I.icon("people") + '" alt="">招募客人</button>' +
      '<span class="floor-guest-line">居民 ' + classCountOnFloor(floor, "resident") + " · 兵 " + classCountOnFloor(floor, "soldier") + " · 臣 " + classCountOnFloor(floor, "minister") + " · 传 " + classCountOnFloor(floor, "missionary") + " · 农 " + classCountOnFloor(floor, "farmer") + " · 厨 " + classCountOnFloor(floor, "cook") + "</span></div>";
    html += '<div class="room-grid">';
    D.EXPANSION_SLOTS.forEach(function (slot) {
      const room = rooms[slot.id];
      const type = room ? D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0] : null;
      html += '<button class="room-tile ' + (type ? "built" : "empty") + '" data-action="expansion-slot" data-slot="' + slot.id + '">' +
        '<span class="room-tile-id">' + slot.id.replace("s", "S") + " · " + slot.size + "</span>" +
        '<b>' + (type ? type.name + " Lv." + roomLevel(room) : "空位 · 建造") + "</b></button>";
    });
    html += "</div>";
    return html;
  }

  function openRecruitModal() {
    const floor = state.currentFloor || 0;
    const rows = D.GUEST_CLASSES.map(function (klass) {
      const met = requirementsMet(floor, klass);
      const unlocked = classUnlockMet(klass);
      const beds = floorFreeBeds(floor);
      const afford = canAfford(klass.cost);
      const enabled = met && unlocked && beds > 0 && afford;
      return '<div class="recruit-row ' + (enabled ? "ready" : "locked") + '">' +
        '<img class="recruit-portrait" src="' + I.guestPortrait(klass.id, 0) + '" alt="">' +
        '<div class="recruit-copy"><b>' + klass.name + '</b><span>' + klass.effectShort + (unlocked ? "" : " · " + classUnlockText(klass)) + "</span>" +
        '<div class="guest-req-row">' + guestRequirementHTML(klass, floor) + "</div></div>" +
        '<div class="recruit-action"><span class="guest-cost">' + costHTML(klass.cost, true) + "</span>" +
        '<button class="btn btn-gold btn-small" data-action="recruit-guest" data-class="' + klass.id + '"' + (enabled ? "" : " disabled") + ">招募</button></div></div>";
    }).join("");
    openModal(
      modalHead("people", "扩建层 · 第 " + (floor + 1) + " 层", "招募客人", "房间条件按本层计算；每位客人占 1 个床位。") +
      '<div class="modal-body"><div class="recruit-summary">床位 ' + guestsOnFloor(floor).length + " / " + floorBeds(floor) + " · 防御 " + defenseValue() + " · 士兵 " + classCount("soldier") + "/" + requiredSoldiers() + "</div>" +
      '<div class="recruit-list">' + rows + "</div>" +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div></div>'
    );
  }

  function goDownstairs() {
    if (!state.expansionUnlocked || state.view !== "expansion") return;
    const next = state.currentFloor + 1;
    if (next < state.expansionFloorCount) {
      state.currentFloor = next;
      renderAll(true);
      saveState();
      A.sfx("page");
      return;
    }
    if (floorRoomCount(state.currentFloor) >= D.EXPANSION_SLOTS.length) {
      ensureFloorProgression(false);
      if (state.expansionFloorCount > next) {
        state.currentFloor = next;
        toast("下一层已开放。", "gold", "sparkle");
        renderAll(true);
        saveState();
        A.sfx("page");
        return;
      }
    }
    toast("先把这一层建满 10 个房间，楼梯才会通往下一层。", "bad", "lock");
  }

  function renderFloorSwitch() {
    const el = $("#floorStrip");
    if (!el) return;
    const active = state && state.view === "expansion" && state.expansionUnlocked;
    if (active) ensureFloorProgression(false);
    el.hidden = !active;
    if (!active) { el.innerHTML = ""; return; }
    const floor = state.currentFloor || 0;
    let html = '<span class="floor-strip-label">楼层</span>';
    html += '<span class="floor-strip-stats">' +
      "<span>房间 <b>" + floorRoomCount(floor) + "/" + D.EXPANSION_SLOTS.length + "</b></span>" +
      "<span>床位 <b>" + guestsOnFloor(floor).length + "/" + floorBeds(floor) + "</b></span>" +
      "<span>防御 <b>" + defenseValue() + "</b> · 兵 <b>" + classCount("soldier") + "/" + requiredSoldiers() + "</b></span>" +
      "<span>传教 <b>" + classCount("missionary") + "</b></span></span>";
    html += '<span class="floor-btn-row">';
    for (let i = 0; i < state.expansionFloorCount; i++) {
      html += '<button class="floor-btn' + (i === state.currentFloor ? " active" : "") + '" data-action="floor" data-floor="' + i + '">F' + (i + 1) + "</button>";
    }
    html += "</span>";
    el.innerHTML = html;
    const activeFloorBtn = el.querySelector(".floor-btn.active");
    const row = el.querySelector(".floor-btn-row");
    if (activeFloorBtn && row) row.scrollLeft = Math.max(0, activeFloorBtn.offsetLeft - row.clientWidth / 2);
  }

  function setSidebarCollapsed(collapsed) {
    ui.sidebarCollapsed = !!collapsed;
    const game = $(".game");
    const collapse = $("#ledgerCollapse");
    const expand = $("#ledgerExpand");
    if (game) game.classList.toggle("sidebar-collapsed", ui.sidebarCollapsed);
    if (expand) expand.hidden = !ui.sidebarCollapsed;
    if (collapse) collapse.title = "收起账房";
    window.dispatchEvent(new Event("resize"));
  }

  function renderShopsSection() {
    refreshShopUnlocks();
    const anyUnlocked = D.SHOPS.some(function (s) { return state.shops[s.id].status !== "locked"; });
    if (!anyUnlocked) return "";
    const built = D.SHOPS.filter(function (s) { return state.shops[s.id].status === "built"; }).length;
    let html = '<div class="shop-section-head"><b>庭院商铺</b><span>' + built + " / " + D.SHOPS.length + " 营业中 · 增加金币收入</span></div>";
    D.SHOPS.forEach(function (shop) {
      const st = state.shops[shop.id];
      const affordable = canAfford(shop.cost);
      let action;
      let status;
      if (st.status === "built") {
        status = '<b>营业中</b> · 金币 +' + (shop.income * 60).toFixed(1) + '/分' +
          (shop.residentBonus ? " · 居民收入 +" + Math.round(shop.residentBonus * 100) + "%" : "") +
          (shop.productionBonus ? " · 生产 +" + Math.round(shop.productionBonus * 100) + "%" : "") +
          " · 每天消耗 1 食物";
        action = '<span class="shop-open">营业中</span>';
      } else if (st.status === "available") {
        status = "开业后金币 +" + (shop.income * 60).toFixed(1) + "/分" +
          (shop.residentBonus ? " · 居民收入 +" + Math.round(shop.residentBonus * 100) + "%" : "") +
          " · 每天消耗 1 食物";
        action = '<button class="btn btn-gold btn-small" data-action="shop-build" data-id="' + shop.id + '">开业</button>';
      } else {
        status = shop.unlockText;
        action = '<button class="btn btn-ghost btn-small" disabled>未开放</button>';
      }
      html += '<article class="shop-card ' + st.status + '">' +
        '<div class="shop-icon"><img src="' + I.buildingIcon(shop.icon) + '" alt=""></div>' +
        '<div class="shop-copy"><div class="shop-name">' + shop.name + '<span class="chip gold">商铺</span></div>' +
        '<div class="shop-desc">' + shop.desc + "</div>" +
        '<div class="shop-status">' + status + "</div>" +
        (st.status === "available" ? '<div class="cost-row">' + costHTML(shop.cost, true) + "</div>" : "") +
        '</div><div class="shop-action">' + action + "</div></article>";
    });
    return html;
  }

  function outputRateText(b) {
    if (!b.output || !Object.keys(b.output).length) return b.effect || "特殊效果";
    const eff = efficiencyInfo();
    const parts = Object.keys(b.output).map(function (k) {
      const mult = eff.multiplier * outputMultiplier(b) * (b.id === "farm" && state.weather === "rain" ? 1.25 : 1);
      return D.RESOURCES[k].name + " +" + (b.output[k] * mult * 60).toFixed(1) + "/分";
    });
    return parts.join(" · ") + " · Lv." + buildingLevel(b.id) + (b.effect ? " · " + b.effect : "");
  }

  function renderPeopleTab() {
    const eff = efficiencyInfo();
    const residents = countResidents();
    const capacity = residentCapacity();
    const kitchen = state.buildings.kitchen.status === "built";
    const shopUpkeep = D.SHOPS.filter(function (sh) { return state.shops[sh.id].status === "built"; }).length + landShopBuiltCount();
    const menuFood = menuUpkeep();
    const upkeep = Math.max(0, residents - kitchenFoodReduction()) + shopUpkeep + menuFood;
    const fed = state.lastMeal.fed !== false;
    const target = currentGuideTarget();
    const income = residentGoldRate() * 60;
    let html = sectionHead("居民与口粮", residents + " / " + capacity + " 空间");
    html += '<div class="people-summary">' +
      '<div class="summary-main"><img src="' + I.icon("people") + '" alt=""><div><b>' + residents + " 位居民</b><span>每天需要 " + upkeep + " 份食物 · 居民收入 +" + income.toFixed(1) + " 金/分</span></div></div>" +
      '<div class="summary-grid">' +
      '<div class="summary-box"><span>生产效率</span><b>' + (eff.percent >= 0 ? "+" : "") + eff.percent + "%</b></div>" +
      '<div class="summary-box"><span>早餐状态</span><b class="' + (fed ? "text-good" : "text-bad") + '">' + (fed ? "吃饱了" : "饿肚子") + "</b></div>" +
      '<div class="summary-box"><span>床位空间</span><b>' + residents + " / " + capacity + "</b></div>" +
      '<div class="summary-box"><span>菜单倍率</span><b>×' + menuMultiplier().toFixed(2) + "</b></div>" +
      '<div class="summary-box"><span>居民满意度</span><b class="' + (eff.satisfaction.score >= 55 ? "text-good" : "text-bad") + '">' + eff.satisfaction.score + " · " + eff.satisfaction.mood + "</b></div>" +
      "</div>" +
      '<div class="satisfaction-bar"><i style="width:' + eff.satisfaction.score + '%"></i></div>' +
      '<div class="satisfaction-reasons">' + eff.satisfaction.reasons.map(function (r) {
        return '<span class="' + (r.good ? "good" : "bad") + '">' + r.label + (r.value ? " " + (r.value > 0 ? "+" : "") + r.value : "") + (r.detail ? "：" + r.detail : "") + "</span>";
      }).join("") + "</div>" +
      '<div class="summary-note">' + (kitchen ? "厨房在运作：每日口粮 -" + kitchenFoodReduction() + "。" : "修复厨房后，每日口粮会减少 1 份。") +
      (shopUpkeep ? " 商铺每天额外消耗 " + shopUpkeep + " 份食物。" : "") +
      (menuFood ? " 已购菜品每天额外消耗 " + menuFood + " 份食物。" : "") +
      " 每名居民都会增加生产效率和金币收入。" + (state.expansionUnlocked ? " 扩建层可以建造客房，增加床位。" : " 修复所有房间后会开放扩建层。") +
      " 当前城堡 Lv." + castleLevelInfo().level + " · 威望 " + castleLevelInfo().prestige + "。" +
      '<div class="defense-line">防御 ' + defenseValue() + " · 士兵 " + classCount("soldier") + " / 需要 " + requiredSoldiers() +
      " · 传教士 " + classCount("missionary") + (classCount("missionary") === 0 && countResidents() > 0 ? "（居民产能 -20%）" : "") + "</div>" +
      "</div></div>";

    const hired = D.WORKERS.filter(function (w) { return state.workers[w.id].hired; });
    if (hired.length) {
      html += sectionHead("已在城堡里的人", "自动工作");
      hired.forEach(function (w) {
        const area = BUILDING_MAP[w.area];
        html += '<article class="resident-row" data-worker-card="' + w.id + '">' +
          '<div class="resident-row-portrait"><img src="' + I.portraitFor(w) + '" alt=""></div>' +
          '<div class="resident-row-main"><div class="resident-row-head"><b>' + w.name + "</b><span>" + w.roleName + "</span>" +
          '<em>' + Math.round(w.bonus * 100) + "% 加成</em></div>" +
          '<div class="resident-row-job">' + (area ? area.name : "城堡大厅") + " · 自动工作中</div>" +
          '<div class="resident-row-trait">' + w.traitName + " · " + w.traitDesc + "</div>" +
          "</div></article>";
      });
    }

    if (state.genericResidents.length) {
      html += sectionHead("城堡里的客人", state.genericResidents.length + " 人 · 在各自区域活动");
      state.genericResidents.forEach(function (r) {
        const klass = guestClass(r.klass || "resident");
        const perMin = (guestIncome(r) * menuMultiplier() * (1 + shopBonuses().residentBonus + expansionBonuses().residentBonus) * (fed ? 1.1 : 0.7) * missionaryPenalty() * 60).toFixed(1);
        const effect = klass.id === "soldier" ? "防御 +" + klass.defense
          : klass.id === "minister" ? "生产 +" + Math.round(klass.productionBonus * 100) + "%"
          : klass.id === "missionary" ? "维持居民产能 · 满意 +" + klass.satisfaction
          : "金币收入";
        html += '<article class="resident-row masked-row">' +
          '<div class="resident-row-portrait mask"><img src="' + guestPortraitFor(r) + '" alt=""></div>' +
          '<div class="resident-row-main"><div class="resident-row-head"><b>' + r.name + "</b><span>" + klass.name + ' · F' + ((r.floor || 0) + 1) + '</span><em class="mask-tag">' + effect + " · +" + perMin + '金/分</em></div>' +
          '<div class="resident-row-job">在第 ' + ((r.floor || 0) + 1) + ' 层活动 · 每天吃 1 份食物</div>' +
          '<div class="resident-row-trait">' + klass.trait + "</div>" +
          "</div></article>";
      });
    }

    if (state.expansionUnlocked) {
      html += sectionHead("招募客人", "按房间配比配置");
      html += '<div class="invite-card"><div class="invite-copy"><b>扩建层招募</b><span>居民 +收入、士兵 +防御、大臣 +生产、传教士维持产能。每位客人的招募条件按“所在楼层”的房间计算。</span>' +
        '<div class="invite-space">居民 ' + classCount("resident") + " · 士兵 " + classCount("soldier") + " · 大臣 " + classCount("minister") + " · 传教士 " + classCount("missionary") + "</div></div>" +
        '<button class="btn btn-gold" data-action="go-recruit"><img src="' + I.icon("people") + '" alt="">去扩建层</button></div>';
    } else {
      html += '<div class="invite-card locked-invite"><div class="invite-copy"><b>扩建层尚未开放</b><span>修复城堡全部房间后，解锁扩建层、房间配比与四类客人。</span></div></div>';
    }

    const outdoor = D.WORKERS.filter(function (w) { return w.scene === "outdoor" && !state.workers[w.id].hired; });
    if (outdoor.length) {
      html += sectionHead("还在城门口等待", "雇佣后解锁建筑");
      outdoor.forEach(function (w) {
        const area = BUILDING_MAP[w.area];
        const isTarget = target === "worker:" + w.id;
        html += '<article class="card worker-card' + (isTarget ? " is-target" : "") + '" data-worker-card="' + w.id + '">' +
          '<div class="card-icon portrait"><img src="' + I.portraitFor(w) + '" alt=""></div>' +
          '<div class="card-main"><div class="card-title-row"><h3 class="card-title">' + w.name + "</h3>" +
          '<span class="chip">' + w.roleName + '</span><span class="chip green">解锁 · ' + area.name + "</span></div>" +
          '<div class="card-quirk">' + w.quirk + "</div>" +
          '<div class="card-trait-line">' + w.traitName + " · " + w.traitDesc + "</div>" +
          '<div class="card-actions"><span class="card-status">每天吃 1 份食物</span>' +
          '<button class="btn btn-gold" data-action="hire" data-id="' + w.id + '"><img src="' + I.icon("coin") + '" alt="">' + w.hireCost + "</button></div>" +
          "</div></article>";
      });
    }

    const indoorLocked = D.WORKERS.filter(function (w) { return w.scene === "indoor" && !state.workers[w.id].hired; });
    if (indoorLocked.length) {
      html += sectionHead("城堡内的新面孔", "修复房间后加入");
      indoorLocked.forEach(function (w) {
        const area = BUILDING_MAP[w.area];
        html += '<article class="resident-row locked-row">' +
          '<div class="resident-row-portrait dim"><img src="' + I.portraitFor(w) + '" alt=""></div>' +
          '<div class="resident-row-main"><div class="resident-row-head"><b>???</b><span>' + w.roleName + '</span><em class="locked-tag">未结识</em></div>' +
          '<div class="resident-row-job">修复「' + area.name + "」后加入</div>" +
          '<div class="resident-row-trait">会为全城提供 +' + Math.round(w.bonus * 100) + "% 生产效率和金币收入</div>" +
          "</div></article>";
      });
    }
    return html;
  }

  function renderJournalTab() {
    let html = sectionHead("风息堡手记", "第 " + state.day + " 天");
    html += '<div class="journal-block"><div class="journal-title"><img src="' + I.icon("crest") + '" alt="">复兴进度</div>' +
      '<div class="journal-stats">' +
      '<div class="stat-box"><span>修复区域</span><b>' + D.countBuilt(state) + " / " + D.COMPLETION_TOTAL + "</b></div>" +
      '<div class="stat-box"><span>居民 / 空间</span><b>' + countResidents() + " / " + residentCapacity() + "</b></div>" +
      '<div class="stat-box"><span>菜单 / 商铺</span><b>' + state.menus.length + " / " + D.SHOPS.filter(function (x) { return state.shops[x.id].status === "built"; }).length + "</b></div>" +
      '<div class="stat-box"><span>城堡等级</span><b>Lv.' + castleLevelInfo().level + "</b></div>" +
      '<div class="stat-box"><span>累计卖货</span><b>' + (state.stats.soldWood + state.stats.soldStone + state.stats.soldFood) + "</b></div>" +
      "</div></div>";
    html += '<div class="journal-block"><div class="journal-title"><img src="' + I.icon("scroll") + '" alt="">目标清单</div><div class="guide-list">';
    D.GUIDE.forEach(function (step, i) {
      let cls = "guide-item";
      if (i < state.guideIndex) cls += " done";
      if (i === state.guideIndex) cls += " current";
      html += '<div class="' + cls + '"><span class="guide-index">' + (i < state.guideIndex ? "已" : (i + 1)) + "</span>" +
        "<div><b>" + step.title + "</b><span>" + (i < state.guideIndex ? "已完成" : i === state.guideIndex ? "下一步" : "等待解锁") + "</span></div></div>";
    });
    html += "</div></div>";
    html += '<div class="journal-block"><div class="journal-title"><img src="' + I.icon("book") + '" alt="">最近发生</div><div class="log-list">' +
      state.log.slice(-10).reverse().map(function (l) {
        return '<div class="log-entry ' + (l.kind || "") + '"><span class="log-day">D' + l.day + '</span><span>' + escapeHTML(l.text) + "</span></div>";
      }).join("") + "</div></div>";
    return html;
  }

  /* =========================================================
     室内热点
     ========================================================= */
  function renderSceneHotspots() {
    const layer = $("#interiorHotspots");
    if (!layer) return;
    if (state && state.view === "indoor") { renderInteriorHotspots(); return; }
    if (state && state.view === "expansion") { renderExpansionHotspots(); return; }
    if (state && state.view === "land") { renderLandHotspots(); return; }
    if (state && state.view === "outdoor") {
      layer.hidden = false;
      layer.innerHTML = '<button class="territory-arrow right" data-action="territory-to" data-view="land">领地 →</button>';
      return;
    }
    layer.hidden = true;
    layer.innerHTML = "";
  }

  function renderInteriorHotspots() {
    const layer = $("#interiorHotspots");
    if (!layer) return;
    const active = state && state.view === "indoor" && state.interiorUnlocked;
    layer.hidden = !active;
    if (!active) { layer.innerHTML = ""; return; }
    const rooms = D.BUILDINGS.filter(function (b) { return b.scene === "indoor"; });
    const target = currentGuideTarget();
    layer.innerHTML = rooms.map(function (b) {
      const bs = state.buildings[b.id];
      const r = b.rect;
      const style = "left:" + (r.x / 720 * 100) + "%;top:" + (r.y / 405 * 100) + "%;width:" + (r.w / 720 * 100) + "%;height:" + (r.h / 405 * 100) + "%;";
      let plaque = "";
      if (bs.status === "built") {
        const w = b.worker ? WORKER_MAP[b.worker] : null;
        plaque = '<span class="room-plaque built"><img src="' + (w ? I.portraitFor(w) : I.icon("crest")) + '" alt="">' +
          '<span><b>' + b.name + '</b><em>' + (w ? w.name + " · 已入住" : "已修复") + " · Lv." + buildingLevel(b.id) + "</em></span></span>";
      } else if (bs.status === "building") {
        plaque = '<span class="room-plaque building"><b>' + b.name + '</b><em>修复中 ' + Math.floor(bs.progress * 100) + "%</em></span>";
      } else if (bs.status === "available") {
        plaque = '<span class="room-plaque available"><b>' + b.name + '</b><em>点击查看 · 可修复</em></span>';
      } else {
        plaque = '<span class="room-plaque locked"><img src="' + I.icon("lock") + '" alt=""><b>' + b.name + "</b><em>" + (b.id === "chapel" ? "修复四个房间后开放" : "未开放") + "</em></span>";
      }
      return '<button class="room-hotspot ' + bs.status + (target === "area:" + b.id ? " is-target" : "") + '" style="' + style + '" data-action="room" data-id="' + b.id + '" aria-label="' + b.name + '">' + plaque + "</button>";
    }).join("");
  }

  function renderLandHotspots() {
    const layer = $("#interiorHotspots");
    if (!layer) return;
    if (!state || state.view !== "land") { layer.hidden = true; layer.innerHTML = ""; return; }
    layer.hidden = false;
    layer.innerHTML = state.land.plots.map(function (plot, i) {
      const r = D.LAND_PLOT_RECTS[i];
      const style = "left:" + (r.x / 720 * 100) + "%;top:" + (r.y / 405 * 100) + "%;width:" + (r.w / 720 * 100) + "%;height:" + (r.h / 405 * 100) + "%;";
      const label = !plot.unlocked ? "开垦" : !plot.crop ? "播种" : plot.ready ? "收获" : "田 " + (i + 1);
      return '<button class="land-hotspot ' + (!plot.unlocked ? "locked" : plot.ready ? "ready" : "") + '" style="' + style + '" data-action="land-plot" data-plot="' + i + '" title="田 ' + (i + 1) + '"><span>' + label + "</span></button>";
    }).join("") + D.LAND_SHOP_RECTS.map(function (r, i) {
      const built = state.land.shops && state.land.shops[i];
      return '<button class="land-hotspot shop" style="left:' + (r.x / 720 * 100) + '%;top:' + (r.y / 405 * 100) + '%;width:' + (r.w / 720 * 100) + '%;height:' + (r.h / 405 * 100) + '%;" data-action="land-shop" data-slot="' + i + '" title="领地商铺"><span>' + (built ? "营业中" : "建商铺") + "</span></button>";
    }).join("") + '<button class="territory-arrow left" data-action="territory-to" data-view="outdoor">← 庭院</button>';
  }

  /* =========================================================
     扩建层与面具居民
     ========================================================= */
  function expansionRoomInfo(slotId) {
    const room = currentFloorRooms()[slotId];
    if (!room) return null;
    return D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0] || null;
  }

  function expansionIcon(type) {
    if (!type) return I.icon("sparkle");
    if (["tavern","market","library","tower","chapel","lumber","farm","quarry"].indexOf(type.icon) >= 0) {
      return I.buildingIcon(type.icon);
    }
    return I.icon(type.icon);
  }

  function expansionRoomRefund(type) {
    return {
      wood: Math.floor((type.cost.wood || 0) * 0.5),
      stone: Math.floor((type.cost.stone || 0) * 0.5),
      gold: Math.floor((type.cost.gold || 0) * 0.5)
    };
  }

  function openDemolishConfirm(slotId) {
    const room = currentFloorRooms()[slotId];
    if (!room) return;
    const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0];
    if (!type) return;
    const floor = state.currentFloor;
    const remainingTypes = {};
    D.EXPANSION_SLOTS.forEach(function (slot) {
      const r = currentFloorRooms()[slot.id];
      if (r && slot.id !== slotId) remainingTypes[r.type] = true;
    });
    const willLeave = guestsOnFloor(floor).filter(function (g) {
      const klass = guestClass(g.klass || "resident");
      return !klass.requirements.every(function (req) { return !!remainingTypes[req]; });
    });
    const bedsAfter = floorRoomsDetailed(floor).reduce(function (n, e) {
      return n + (e.slot.id === slotId ? 0 : roomCapacity(e.type, e.room));
    }, 0);
    const excess = Math.max(0, guestsOnFloor(floor).length - willLeave.length - bedsAfter);
    const refund = expansionRoomRefund(type);
    openModal(
      modalHead("hammer", "扩建层 · 拆除", "拆除「" + type.name + "」？", "会退还一半建造材料，但房间等级和装饰会消失。") +
      '<div class="modal-body"><div class="demolish-warning">' +
      (willLeave.length ? "<b>" + willLeave.length + " 位客人会因失去职业房间而离开。</b>" : "") +
      (excess > 0 ? "<b>还有 " + excess + " 位客人会因床位不足离开。</b>" : "") +
      (!willLeave.length && excess <= 0 ? "当前没有客人会因此离开。" : "") +
      "</div>" +
      '<div class="requirement"><img src="' + I.icon("coin") + '" alt="">拆除返还：' + costTextOnly(refund) + "</div>" +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">保留房间</button>' +
      '<button class="btn btn-danger" data-action="demolish-confirm" data-slot="' + slotId + '">确认拆除</button></div></div>'
    );
  }

  function costTextOnly(cost) {
    return RES_ORDER.filter(function (k) { return cost[k]; }).map(function (k) {
      return D.RESOURCES[k].name + " +" + cost[k];
    }).join(" · ") || "无";
  }

  function demolishExpansionRoom(slotId) {
    const rooms = currentFloorRooms();
    const room = rooms[slotId];
    if (!room) return;
    const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0];
    if (!type) return;
    const refund = expansionRoomRefund(type);
    rooms[slotId] = null;
    Object.keys(refund).forEach(function (k) {
      if (refund[k]) state.resources[k] = (state.resources[k] || 0) + refund[k];
    });
    const floor = state.currentFloor;
    // 先移除因职业房间缺失而不满足条件的客人
    const keep = [];
    const leaving = [];
    guestsOnFloor(floor).forEach(function (g) {
      const klass = guestClass(g.klass || "resident");
      const met = klass.requirements.every(function (req) { return floorHasType(floor, req); });
      if (met) keep.push(g); else leaving.push(g);
    });
    // 再按剩余床位移除多余客人
    let remaining = keep;
    const beds = floorBeds(floor);
    if (remaining.length > beds) {
      leaving = leaving.concat(remaining.slice(beds));
      remaining = remaining.slice(0, beds);
    }
    const keepIds = {};
    remaining.forEach(function (g) { keepIds[g.id] = true; });
    const leavingIds = {};
    leaving.forEach(function (g) { leavingIds[g.id] = true; });
    state.genericResidents = state.genericResidents.filter(function (g) {
      return !leavingIds[g.id] || (g.floor || 0) !== floor;
    });
    leaving.forEach(function (g) {
      addLog("拆除「" + type.name + "」后，「" + g.name + "」离开了城堡。", "bad");
    });
    addLog("第 " + (floor + 1) + " 层拆除了「" + type.name + "」，返还 " + costTextOnly(refund) + "。", "info");
    toast("已拆除「" + type.name + "」。" + (leaving.length ? " " + leaving.length + " 位客人离开。" : ""), "neutral", "hammer");
    closeModal(true);
    ui.guideSig = "";
    renderAll(true);
    saveState();
  }

  function openExpansionSlotModal(slotId) {
    if (!state.expansionUnlocked) { toast("修复所有房间后，扩建层才会开放。", "bad", "lock"); return; }
    const slot = D.EXPANSION_SLOTS.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    const type = expansionRoomInfo(slotId);
    if (type) {
      const room = currentFloorRooms()[slotId];
      const lv = roomLevel(room);
      const cost = roomUpgradeCost(type, room);
      const afford = canAfford(cost);
      openModal(
        modalHead(type.icon, "扩建层 · 第 " + (state.currentFloor + 1) + " 层", type.name + " · Lv." + lv, "S" + slotId.replace("s", "") + " 号房间") +
        '<div class="modal-body"><div class="upgrade-preview"><div><span>当前等级</span><b>Lv.' + lv + "</b></div><div><span>房间尺寸</span><b>" + type.size + "</b></div></div>" +
        '<div class="requirement"><img src="' + I.icon("sparkle") + '" alt="">' +
        "当前加成：床位 " + roomCapacity(type, room) +
        (type.residentBonus ? " · 居民收入 +" + Math.round(type.residentBonus * roomScale(room) * 100) + "%" : "") +
        (type.productionBonus ? " · 生产 +" + Math.round(type.productionBonus * roomScale(room) * 100) + "%" : "") +
        (type.foodBonus ? " · 食物 +" + Math.round(type.foodBonus * roomScale(room) * 100) + "%" : "") +
        (type.defense ? " · 防御 +" + (type.defense + (lv - 1) * 3) : "") +
        " · 满意度 +" + ((type.satisfaction || 0) + (lv - 1) * 2) + "</div>" +
        (lv < 3 ? '<div class="upgrade-next"><b>升级到 Lv.' + (lv + 1) + "</b><span>" + roomUpgradeEffect(type, room) + "</span>" +
          '<div class="cost-row">' + costHTML(cost, true) + "</div></div>" : '<div class="floor-full-note">这间房已达到 Lv.3 上限。</div>') +
        '<div class="modal-actions"><span class="modal-note">' + (lv < 3 && !afford ? "升级材料不足：" + missingCostsText(cost) : "") + "</span>" +
        '<button class="btn btn-ghost" data-action="close-modal">关闭</button>' +
        '<button class="btn btn-danger" data-action="demolish-open" data-slot="' + slotId + '">拆除</button>' +
        (lv < 3 ? '<button class="btn btn-gold" data-action="upgrade-expansion" data-slot="' + slotId + '"' + (afford ? "" : " disabled") + '><img src="' + I.icon("arrow") + '" alt="">升级房间</button>' : "") +
        "</div></div>"
      );
      return;
    }
    const slotRank = D.ROOM_SIZE_RANK[slot.size] || 1;
    const fitTypes = D.EXPANSION_ROOMS.filter(function (r) { return (D.ROOM_SIZE_RANK[r.size] || 1) <= slotRank; });
    const rows = fitTypes.map(function (r) {
      const afford = canAfford(r.cost);
      return '<div class="menu-row">' +
        '<div class="menu-icon"><img src="' + expansionIcon(r) + '" alt=""></div>' +
        '<div class="menu-copy"><div class="menu-name">' + r.name + ' <span class="room-size-tag ' + r.size + '">' + r.size + "</span></div>" +
        '<div class="menu-desc">' + r.desc + "</div>" +
        '<div class="menu-meta">' + costHTML(r.cost, true) + "</div></div>" +
        '<div class="menu-actions"><button class="btn btn-gold btn-small" data-action="build-expansion" data-slot="' + slotId + '" data-type="' + r.id + '"' + (afford ? "" : " disabled") + '>建造</button></div></div>';
    }).join("");
    openModal(
      modalHead("sparkle", "扩建层 · 空房间", "选择这间房的用途", "房间类型可以重复；位置由你选择。") +
      '<div class="modal-body"><p class="modal-copy">第 ' + (state.currentFloor + 1) + ' 层的这个位置是 <b>' + slot.size + '</b> 号。只能放置不超过该尺寸的房间；每层建议至少配置 1 间厕所和 1 间餐厅，并按客人需求准备武器库、会议室或小礼拜堂。</p>' +
      '<div class="menu-list">' + rows + "</div>" +
      '<div class="modal-actions"><span class="modal-note">当前空间：' + countResidents() + " / " + residentCapacity() + "</span>" +
      '<button class="btn btn-ghost" data-action="close-modal">再想想</button></div></div>',
      { className: "modal-menu" }
    );
  }

  function buildExpansionRoom(slotId, typeId) {
    if (!started) return;
    if (!state.expansionUnlocked) { toast("扩建层尚未开放。", "bad", "lock"); return; }
    const floor = state.currentFloor || 0;
    const rooms = floorRooms(floor);
    if (rooms[slotId]) { toast("这间房已经建好了。", "bad", "lock"); return; }
    const type = D.EXPANSION_ROOMS.filter(function (r) { return r.id === typeId; })[0];
    if (!type) return;
    const slot = D.EXPANSION_SLOTS.filter(function (s) { return s.id === slotId; })[0];
    if (!slot) return;
    if ((D.ROOM_SIZE_RANK[type.size] || 1) > (D.ROOM_SIZE_RANK[slot.size] || 1)) {
      toast("这个位置太小，放不下「" + type.name + "」。", "bad", "lock");
      return;
    }
    if (!canAfford(type.cost)) { toast("材料不够，还差：" + missingCostsText(type.cost), "bad", "hammer"); return; }
    payCost(type.cost);
    rooms[slotId] = { type: typeId, level: 1 };
    addLog("扩建层第 " + (floor + 1) + " 层新房间完成：" + type.name + "。", "good");
    toast("「" + type.name + "」建成了！" + type.desc, "gold", "sparkle");
    const fac = floorFacilities(floor);
    if (fac.rooms > 0 && !fac.toilet && type.id !== "toilet") {
      setTimeout(function () { toast("第 " + (floor + 1) + " 层还没有厕所，居民会不满意。", "bad", "toilet"); }, 500);
    }
    if (fac.rooms > 0 && !fac.dining && type.id !== "dining") {
      setTimeout(function () { toast("第 " + (floor + 1) + " 层还没有餐厅，居民会不满意。", "bad", "food"); }, 850);
    }
    ensureFloorProgression(true);
    A.sfx("complete");
    ui.guideSig = "";
    renderAll(true);
    saveState();
    closeModal();
  }

  const MASK_NAMES = ["阿灰", "铜扣", "小满", "青弦", "白羽", "栗子", "石南", "蜜糖", "夜莺", "七弦"];
  const GUEST_NAMES = {
    farmer: ["阿土", "麦穗", "青禾", "老犁"],
    cook: ["汤勺", "布丁", "胡椒", "奶油"],
    resident: ["阿灰", "铜扣", "小满", "青弦", "白羽", "栗子", "石南", "蜜糖", "夜莺", "七弦"],
    soldier: ["铁牛", "石盾", "长枪", "灰狼", "铜盔", "黑岩", "短刃", "守夜"],
    minister: ["金策", "青简", "白算", "墨衡", "文石", "长史"],
    missionary: ["灯烛", "福音", "白衣", "安息", "晨钟", "盐光"]
  };

  function guestPortraitFor(r) {
    const klass = guestClass(r.klass || "resident");
    if (klass.id === "resident") {
      const type = D.MASK_TYPES.filter(function (m) { return m.id === r.type; })[0] || D.MASK_TYPES[0];
      return I.maskedPortrait(type);
    }
    return I.guestPortrait(klass.id, r.variant || 0);
  }

  function inviteGuest(klassId) {
    if (!started) return;
    if (!state.expansionUnlocked) { toast("修复所有房间后，扩建层才会开放。", "bad", "lock"); return; }
    const klass = D.GUEST_CLASSES.filter(function (c) { return c.id === klassId; })[0];
    if (!klass) return;
    if (!classUnlockMet(klass)) { toast("招募" + klass.name + "需要：" + classUnlockText(klass) + "。", "bad", "lock"); return; }
    const floor = state.currentFloor || 0;
    const missing = klass.requirements.filter(function (typeId) { return !floorHasType(floor, typeId); });
    if (missing.length) {
      const names = missing.map(function (id) {
        const room = D.EXPANSION_ROOMS.filter(function (r) { return r.id === id; })[0];
        return room ? room.name : id;
      }).join("、");
      toast("招募" + klass.name + "需要本层具备：" + names + "。", "bad", "lock");
      return;
    }
    if (floorFreeBeds(floor) <= 0) {
      toast("第 " + (floor + 1) + " 层没有空床位。先建民居、士兵营房、大臣办公室、静修室或其他卧室房。", "bad", "lock");
      return;
    }
    if (!canAfford(klass.cost)) {
      toast("招募" + klass.name + "还差：" + missingCostsText(klass.cost), "bad", klass.icon);
      return;
    }
    payCost(klass.cost);
    const names = GUEST_NAMES[klass.id] || MASK_NAMES;
    const name = names[Math.floor(Math.random() * names.length)] + "·" + klass.name;
    const mask = D.MASK_TYPES[Math.floor(Math.random() * D.MASK_TYPES.length)];
    const resident = {
      id: state.nextGenericId++,
      type: mask.id,
      klass: klass.id,
      floor: floor,
      variant: Math.floor(Math.random() * 4),
      name: name
    };
    state.genericResidents.push(resident);
    addLog("一位" + klass.name + "「" + name + "」住进了第 " + (floor + 1) + " 层。", "good");
    toast(klass.name + "「" + name + "」加入第 " + (floor + 1) + " 层。" +
      (klass.id === "soldier" ? " 防御 +" + klass.defense : "") +
      (klass.id === "minister" ? " 生产 +" + Math.round(klass.productionBonus * 100) + "%" : "") +
      (klass.id === "missionary" ? " 恢复居民产能" : ""), "gold", klass.icon);
    A.sfx("hire");
    if (ui.modalOpen) closeModal(true);
    renderAll(true);
    saveState();
  }

  function inviteResident() { inviteGuest("resident"); }

  function guestRequirementHTML(klass, floor) {
    return klass.requirements.map(function (typeId) {
      const room = D.EXPANSION_ROOMS.filter(function (r) { return r.id === typeId; })[0];
      const ok = floorHasType(floor, typeId);
      return '<span class="req-chip ' + (ok ? "ok" : "miss") + '">' + (ok ? "已" : "缺") + " " + (room ? room.name : typeId) + "</span>";
    }).join("");
  }

  function renderGuestRecruitSection(floor) {
    let html = '<div class="guest-recruit-head"><b>本层客人</b><span>防御 ' + defenseValue() + " · 需要士兵 " + requiredSoldiers() + "</span></div>";
    html += '<div class="guest-counts">' +
      '<span class="guest-count resident">居民 ' + classCountOnFloor(floor, "resident") + '</span>' +
      '<span class="guest-count soldier">士兵 ' + classCountOnFloor(floor, "soldier") + '</span>' +
      '<span class="guest-count minister">大臣 ' + classCountOnFloor(floor, "minister") + '</span>' +
      '<span class="guest-count missionary">传教士 ' + classCountOnFloor(floor, "missionary") + "</span></div>";
    if (classCount("missionary") === 0 && countResidents() > 0) {
      html += '<div class="facility-warning">没有传教士：居民产能 -20%。在小礼拜堂和静修室齐备的楼层招募一位传教士。</div>';
    }
    if (classCount("soldier") < requiredSoldiers() && countResidents() > 0) {
      html += '<div class="facility-warning">防御不足：需要至少 ' + requiredSoldiers() + " 名士兵。隔壁村可能偷走物资。</div>";
    }
    const floorGuests = guestsOnFloor(floor);
    if (floorGuests.length) {
      html += '<div class="floor-guest-list">' + floorGuests.map(function (r) {
        const klass = guestClass(r.klass || "resident");
        return '<div class="floor-guest"><img src="' + guestPortraitFor(r) + '" alt=""><span><b>' + r.name + '</b><em>' + klass.name + "</em></span></div>";
      }).join("") + "</div>";
    }
    html += '<div class="guest-recruit-grid">';
    D.GUEST_CLASSES.forEach(function (klass) {
      const met = requirementsMet(floor, klass);
      const beds = floorFreeBeds(floor);
      const afford = canAfford(klass.cost);
      const enabled = met && beds > 0 && afford;
      html += '<article class="guest-recruit-card ' + (enabled ? "ready" : "locked") + '">' +
        '<div class="guest-recruit-top"><img src="' + I.guestPortrait(klass.id, 0) + '" alt=""><div><b>' + klass.name + '</b><span>' + klass.effectShort + "</span></div></div>" +
        '<div class="guest-req-row">' + guestRequirementHTML(klass, floor) + "</div>" +
        '<div class="guest-recruit-foot"><span class="guest-cost">' + costHTML(klass.cost, true) + " · 床位 " + beds + "</span>" +
        '<button class="btn btn-gold btn-small" data-action="recruit-guest" data-class="' + klass.id + '"' + (enabled ? "" : " disabled") + ">招募</button></div></article>";
    });
    html += "</div>";
    return html;
  }


  function renderExpansionHotspots() {
    const layer = $("#interiorHotspots");
    if (!layer) return;
    if (!state || state.view !== "expansion" || !state.expansionUnlocked) { layer.hidden = true; layer.innerHTML = ""; return; }
    layer.hidden = false;
    layer.innerHTML = D.EXPANSION_SLOTS.map(function (slot) {
      const room = currentFloorRooms()[slot.id];
      const type = room ? D.EXPANSION_ROOMS.filter(function (r) { return r.id === room.type; })[0] : null;
      const style = "left:" + (slot.x / 720 * 100) + "%;top:" + (slot.y / 405 * 100) + "%;width:" + (slot.w / 720 * 100) + "%;height:" + (slot.h / 405 * 100) + "%;";
      let plaque;
      if (type) {
        plaque = '<span class="room-plaque built expansion-plaque"><img src="' + expansionIcon(type) + '" alt="">' +
          '<span><b>' + type.name + '</b></span></span>';
      } else {
        plaque = '<span class="room-plaque available"><b>空位置 · ' + slot.size + '</b><em>S' + slot.id.replace("s", "") + ' · 点击建造</em></span>';
      }
      return '<button class="room-hotspot ' + (type ? "built" : "available") + ' expansion-slot slot-' + slot.size + '" style="' + style + '" data-action="expansion-slot" data-slot="' + slot.id + '" data-size="' + slot.size + '">' + plaque + "</button>";
    }).join("") +
      '<button class="stair-hotspot" data-action="floor-stairs" title="点击楼梯前往下一层"><span>' +
      (state.currentFloor + 1 < state.expansionFloorCount ? "下一层" : (floorRoomCount(state.currentFloor) >= D.EXPANSION_SLOTS.length ? "解锁下一层" : "建满本层")) +
      '</span></button>';
  }

  /* =========================================================
     事件
     ========================================================= */
  function setDebugMode(on) {
    ui.debugMode = !!on;
    const panel = $("#debugPanel");
    if (panel) panel.hidden = !ui.debugMode;
    document.body.classList.toggle("debug-on", ui.debugMode);
    const btn = $(".debug-toggle");
    if (btn) btn.textContent = ui.debugMode ? "调试中" : "调试";
    toast(ui.debugMode ? "调试模式开启：建造会立即完成。" : "调试模式关闭。", ui.debugMode ? "gold" : "neutral", "hammer");
  }

  function debugAction(action) {
    if (!ui.debugMode) setDebugMode(true);
    if (action === "debug-res") {
      toast("调试：金币与物资已经视为无限。", "gold", "coin");
    } else if (action === "debug-finish") {
      D.BUILDINGS.forEach(function (b) {
        if (state.buildings[b.id].status === "building") completeBuilding(b);
      });
      toast("调试：所有施工已完成。", "gold", "hammer");
    } else if (action === "debug-max") {
      D.BUILDINGS.forEach(function (b) {
        if (state.buildings[b.id].status === "built") state.buildings[b.id].level = D.MAX_BUILDING_LEVEL;
      });
      toast("调试：所有区域已升到 Lv.MAX。", "gold", "star");
    } else if (action === "debug-unlock") {
      D.WORKERS.forEach(function (w) { state.workers[w.id].hired = true; });
      D.BUILDINGS.forEach(function (b) {
        state.buildings[b.id].status = "built";
        state.buildings[b.id].progress = 1;
        if (!state.buildings[b.id].level) state.buildings[b.id].level = 1;
      });
      state.interiorUnlocked = true;
      state.expansionUnlocked = true;
      state.flags.enteredCastle = true;
      state.flags.chapelBuilt = true;
      if (!state.expansionFloors.length) state.expansionFloors = [{}];
      state.expansionFloorCount = Math.max(1, state.expansionFloorCount);
      refreshShopUnlocks();
      toast("调试：所有区域已解锁。", "gold", "crest");
    } else if (action === "debug-bed") {
      state.expansionUnlocked = true;
      let floor = 0, placed = false;
      for (; floor < state.expansionFloorCount && !placed; floor++) {
        const rooms = state.expansionFloors[floor];
        for (let i = 0; i < D.EXPANSION_SLOTS.length; i++) {
          const id = D.EXPANSION_SLOTS[i].id;
          if (!rooms[id]) { rooms[id] = { type: "guest" }; placed = true; state.currentFloor = floor; break; }
        }
      }
      if (!placed) toast("调试：本层没有空位，先切换楼层或用扩建功能。", "bad", "sparkle");
      else { inviteResident(); toast("调试：已加一间客房并邀请居民。", "gold", "people"); }
    } else if (action === "debug-feed") {
      state.resources.food = Math.max(state.resources.food, 100);
      state.lastMeal.fed = true;
      toast("调试：食物补满。", "good", "food");
    } else if (action === "debug-day") {
      onNewDay();
      toast("调试：跳过一天。", "gold", "clock");
    } else if (action === "debug-close") {
      setDebugMode(false);
      return;
    }
    ui.guideSig = "";
    checkGuide();
    renderAll(true);
    saveState();
  }

  function bindEvents() {
    $("#newGameBtn").addEventListener("click", function () { if (peekSave()) promptNewGame(); else beginNewGame(); });
    $("#continueBtn").addEventListener("click", continueGame);
    $("#tradeBtn").addEventListener("click", function () { if (started) openTradeModal(""); });
    $("#menuBtn").addEventListener("click", function () { if (started) openMenuModal(""); });
    const collapseBtn = $("#ledgerCollapse");
    if (collapseBtn) collapseBtn.addEventListener("click", function () { setSidebarCollapsed(true); });
    const expandBtn = $("#ledgerExpand");
    if (expandBtn) expandBtn.addEventListener("click", function () { setSidebarCollapsed(false); });
    $("#viewSwitch").addEventListener("click", function (e) {
      const b = e.target.closest("[data-view]");
      if (b) switchView(b.dataset.view);
    });

    document.addEventListener("click", function (e) {
      const el = e.target.closest("[data-action]");
      if (!el || el.disabled) return;
      const action = el.dataset.action;
      if (action === "speed") {
        if (!started) return;
        state.speed = Number(el.dataset.speed);
        setSpeedButtons(state.speed);
        A.sfx("click");
        saveState(true);
      } else if (action === "sound") toggleMute();
      else if (action === "help") { if (started) openHelpModal(); }
      else if (action === "trade") { if (started) openTradeModal(""); }
      else if (action === "guide") { performGuideAction(); }
      else if (action === "tab") {
        if (!started) return;
        closeModal();
        ui.tab = el.dataset.tab;
        updateTabs();
        renderLedger(true);
        A.sfx("page");
      } else if (action === "hire") hireWorker(el.dataset.id);
      else if (action === "build") startBuild(el.dataset.id);
      else if (action === "show-area" || action === "room") openAreaModal(el.dataset.id);
      else if (action === "sell") sellResource(el.dataset.res, false);
      else if (action === "sell-all") sellResource(el.dataset.res, true);
      else if (action === "buy-food") buyFood();
      else if (action === "debug-toggle") setDebugMode(!ui.debugMode);
      else if (action.indexOf("debug-") === 0) debugAction(action);
      else if (action === "trade-tab") { ui.tradeTab = el.dataset.tab; openTradeModal(tradeNote); }
      else if (action === "buy-resource") buyResource(el.dataset.res, false);
      else if (action === "buy-resource-all") buyResource(el.dataset.res, true);
      else if (action === "upgrade-open") openUpgradeModal(el.dataset.id);
      else if (action === "upgrade-confirm") upgradeBuilding(el.dataset.id);
      else if (action === "menu") openMenuModal("");
      else if (action === "buy-menu") buyMenu(el.dataset.id);
      else if (action === "shop-build") buyShop(el.dataset.id);
      else if (action === "expansion-slot") openExpansionSlotModal(el.dataset.slot);
      else if (action === "build-expansion") buildExpansionRoom(el.dataset.slot, el.dataset.type);
      else if (action === "upgrade-expansion") upgradeExpansionRoom(el.dataset.slot);
      else if (action === "recruit-open") openRecruitModal();
      else if (action === "land-plot") openLandPlotModal(Number(el.dataset.plot));
      else if (action === "expand-land") expandLandPlot(Number(el.dataset.plot));
      else if (action === "sow-land") sowLandCrop(Number(el.dataset.plot), el.dataset.crop);
      else if (action === "harvest-land") harvestLandPlot(Number(el.dataset.plot));
      else if (action === "land-shop") buildLandShop(Number(el.dataset.slot));
      else if (action === "territory-to") switchView(el.dataset.view);
      else if (action === "decor-open") { if (state.view === "indoor") openInteriorSkinModal(); else if (state.view === "expansion") openFloorSkinModal(); }
      else if (action === "floor-skin-open") openFloorSkinModal();
      else if (action === "buy-floor-skin") buyFloorSkin(el.dataset.id);
      else if (action === "apply-floor-skin") applyFloorSkin(el.dataset.id);
      else if (action === "apply-interior-skin") applyInteriorSkin(el.dataset.id);
      else if (action === "buy-interior-skin") buyInteriorSkin(el.dataset.id);
      else if (action === "demolish-open") openDemolishConfirm(el.dataset.slot);
      else if (action === "demolish-confirm") demolishExpansionRoom(el.dataset.slot);
      else if (action === "invite") inviteResident();
      else if (action === "go-recruit") { ui.tab = "build"; switchView("expansion"); }
      else if (action === "recruit-guest") inviteGuest(el.dataset.class);
      else if (action === "open-expansion") switchView("expansion");
      else if (action === "floor") {
        state.currentFloor = Math.max(0, Math.min(state.expansionFloorCount - 1, Number(el.dataset.floor) || 0));
        renderAll(true);
        saveState();
        A.sfx("page");
      }
      else if (action === "floor-stairs") goDownstairs();
      else if (action === "festival-confirm") holdFestival();
      else if (action === "festival-complete") finishFestival();
      else if (action === "festival") promptFestival();
      else if (action === "show-ending") { if (state.flags.festivalHeld) showEndingModal(); }
      else if (action === "ending-continue") {
        closeModal();
        state.speed = ui.festivalPrevSpeed || 1;
        setSpeedButtons(state.speed);
        toast("庆典结束了，但城堡的日常还在继续。", "good", "bunting");
        saveState();
      } else if (action === "ending-title") { saveState(true); location.reload(); }
      else if (action === "reset-game") promptNewGame();
      else if (action === "reset-confirm") {
        closeModal(true);
        const screen = $("#startScreen");
        if (screen) screen.style.display = "none";
        ui.startHidden = true;
        beginAfterReset();
      } else if (action === "close-modal") closeModal();
      else if (action === "dialogue-next") { if (window.__dialogueAdvance) window.__dialogueAdvance(); }
      else if (action === "dialogue-skip") { if (window.__dialogueFinish) window.__dialogueFinish(); }
      else if (action === "view") switchView(el.dataset.view);
    });

    document.addEventListener("keydown", function (e) {
      if (ui.dialogueOpen) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (window.__dialogueAdvance) window.__dialogueAdvance(); }
        else if (e.key === "Escape") { e.preventDefault(); if (window.__dialogueFinish) window.__dialogueFinish(); }
        return;
      }
      if (e.key === "Escape") { if (ui.modalOpen) { e.preventDefault(); closeModal(); } return; }
      if (!started) return;
      if (e.target && ["INPUT", "SELECT", "TEXTAREA"].indexOf(e.target.tagName) >= 0) return;
      if (e.key === "`" || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d")) { e.preventDefault(); setDebugMode(!ui.debugMode); return; }
      if (e.code === "Space") { e.preventDefault(); state.speed = state.speed === 0 ? 1 : 0; setSpeedButtons(state.speed); }
      else if (["1", "2", "3"].indexOf(e.key) >= 0) { state.speed = Number(e.key); setSpeedButtons(state.speed); }
      else if (e.key === "m" || e.key === "M") toggleMute();
    });

    document.addEventListener("visibilitychange", function () {
      lastFrame = performance.now();
      if (document.hidden && started) saveState(true);
    });
    window.addEventListener("beforeunload", function () { if (started) saveState(true); });
  }

  function beginAfterReset() {
    closeModal(true);
    hideStart();
    ensureAudio();
    state = createInitialState();
    started = true;
    state.speed = 1;
    ui.tab = "build";
    ui.guideSig = "";
    ui.lastSavedAt = 0;
    ui.highlightWorker = null;
    setSpeedButtons(1);
    renderAll(true);
    saveState(true);
    showIntroDialogue();
  }

  function toggleMute() {
    muted = !muted;
    safeStorageSet(D.MUTE_KEY, muted ? "1" : "0");
    A.setMuted(muted);
    updateSoundButton();
    if (started) toast(muted ? "声音已关闭。" : "声音已开启。", "neutral", muted ? "soundOff" : "sound");
  }

  /* =========================================================
     工具
     ========================================================= */
  function canAfford(cost) {
    if (!cost || ui.debugMode) return true;
    return Object.keys(cost).every(function (k) { return (state.resources[k] || 0) >= cost[k]; });
  }
  function payCost(cost) {
    if (ui.debugMode) return;
    Object.keys(cost).forEach(function (k) { state.resources[k] = Math.max(0, (state.resources[k] || 0) - cost[k]); });
  }
  function costHTML(cost, check) {
    if (!cost) return "";
    const parts = [];
    RES_ORDER.forEach(function (k) {
      const amount = cost[k];
      if (!amount) return;
      const lack = check && !ui.debugMode && (state.resources[k] || 0) < amount;
      parts.push('<span class="cost' + (lack ? " lack" : "") + '"><img src="' + I.icon(D.RESOURCES[k].icon) + '" alt="">' + amount + "</span>");
    });
    return parts.length ? parts.join("") : '<span class="cost">无需材料</span>';
  }
  function missingCostsText(cost) {
    const parts = [];
    Object.keys(cost).forEach(function (k) {
      const missing = cost[k] - (state.resources[k] || 0);
      if (missing > 0) parts.push(Math.ceil(missing) + " " + D.RESOURCES[k].name);
    });
    return parts.join("、") || "无";
  }
  function addLog(text, kind) {
    state.log.push({ day: state.day, text: text, kind: kind || "info" });
    if (state.log.length > 70) state.log = state.log.slice(-70);
  }
  function toast(text, kind, icon) {
    const stack = $("#toastStack");
    if (!stack) return;
    while (stack.children.length >= 3) stack.removeChild(stack.firstElementChild);
    const el = document.createElement("div");
    el.className = "toast " + (kind || "neutral");
    el.dataset.toastId = String(++toastSeq);
    el.innerHTML = '<img src="' + I.icon(icon || "sparkle") + '" alt=""><span>' + escapeHTML(text) + "</span>";
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3600);
  }
  function escapeHTML(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function clamp(v, min, max) { v = Number(v); return isFinite(v) ? Math.max(min, Math.min(max, v)) : min; }

  function fitScene() {
    const holder = $("#sceneHolder");
    const frame = $("#sceneFrame");
    if (!holder || !frame) return;
    const maxW = holder.clientWidth;
    const maxH = holder.clientHeight;
    if (maxW <= 0 || maxH <= 0) return;
    let w = maxW;
    let h = w * 9 / 16;
    if (h > maxH) { h = maxH; w = h * 16 / 9; }
    frame.style.width = Math.floor(w) + "px";
    frame.style.height = Math.floor(h) + "px";
  }

  /* =========================================================
     开发辅助
     ========================================================= */
  window.CastleGame = {
    getState: function () { return state; },
    addRes: function (obj) {
      Object.keys(obj).forEach(function (k) { state.resources[k] = (state.resources[k] || 0) + obj[k]; });
      renderAll(true);
    },
    hire: function (id) { hireWorker(id); },
    build: function (id) { startBuild(id); },
    sell: function (res, all) { sellResource(res, all); },
    enter: function () { enterCastle(); },
    menu: function (id) { buyMenu(id); },
    shop: function (id) { buyShop(id); },
    expand: function (slot, type) { buildExpansionRoom(slot, type); },
    upgrade: function (id) { upgradeBuilding(id); },
    invite: function () { inviteResident(); },
    fastForward: function (seconds) {
      const wasModal = ui.modalOpen, wasDialogue = ui.dialogueOpen;
      ui.modalOpen = false; ui.dialogueOpen = false;
      const steps = Math.max(1, Math.ceil((seconds || 1) / 0.1));
      for (let i = 0; i < steps; i++) updateGame(0.1);
      ui.modalOpen = wasModal; ui.dialogueOpen = wasDialogue;
      renderAll(true);
    },
    completeAll: function () {
      D.WORKERS.forEach(function (w) {
        state.workers[w.id].hired = true;
        const area = BUILDING_MAP[w.area];
        if (area) { state.buildings[area.id].status = "built"; state.buildings[area.id].progress = 1; }
      });
      state.buildings.chapel.status = "built";
      state.buildings.chapel.progress = 1;
      state.interiorUnlocked = true;
      state.flags.enteredCastle = true;
      state.flags.chapelBuilt = true;
      state.guideIndex = D.GUIDE.length - 1;
      state.resources = { gold: 240, wood: 120, stone: 90, food: 60 };
      renderAll(true);
    }
  };

  init();
})();
