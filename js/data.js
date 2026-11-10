/* =========================================================
   城堡物语 v2 · 游戏数据
   核心循环：雇人 → 建造 → 生产 → 卖资源 → 解锁 → 进入城堡
   ========================================================= */
window.GameData = (function () {
  "use strict";

  const VERSION = 4;
  const DAY_LENGTH = 90;
  const START_HOUR = 8;
  const SAVE_KEY = "castle-story-save-v4";
  const MUTE_KEY = "castle-story-muted";

  const RESOURCES = {
    gold:  { name: "金币", icon: "coin",  color: "#e5b34c", hint: "建造、雇佣和买食物都要用。把木材/石料卖给行商就能换钱。" },
    wood:  { name: "木材", icon: "wood",  color: "#b07c4a", hint: "伐木场产出。可以卖钱，也是建筑的主要材料。" },
    stone: { name: "石料", icon: "stone", color: "#a9afa4", hint: "采石场产出。卖价更高，也是城堡内部修复的主要材料。" },
    food:  { name: "食物", icon: "food",  color: "#d9b35c", hint: "每天黎明所有居民都要吃饭。食物不足会降低生产效率。" }
  };

  const SELL_INFO = {
    wood:  { amount: 10, gold: 6 },
    stone: { amount: 10, gold: 9 },
    food:  { amount: 10, gold: 5 }
  };
  const BUY_FOOD = { gold: 6, food: 10 };

  const WORKERS = [
    {
      id: "bart", name: "巴特", role: "wood", roleName: "木匠",
      area: "lumber", scene: "outdoor", hireCost: 10, bonus: 0.05,
      quirk: "手稳话少，能用一把小刀削出一整座谷仓。",
      traitName: "巧手", traitDesc: "在伐木场工作，并为全城提供 +5% 生产效率。",
      look: {
        skin: "#d9a173", skinShade: "#b77e56", hair: "#5c3a24", hairShade: "#3d2516",
        hat: "cap", hatColor: "#4d6b4a", hatShade: "#324a31",
        clothes: "#728b58", clothesShade: "#506740", accent: "#c98c42",
        beard: "brown", glasses: false, blush: false
      }
    },
    {
      id: "maya", name: "麦芽", role: "food", roleName: "农夫",
      area: "farm", scene: "outdoor", hireCost: 25, bonus: 0.05,
      quirk: "她声称能听见麦子拔节的声音，而且从不失手。",
      traitName: "绿拇指", traitDesc: "在农田工作，并为全城提供 +5% 生产效率。",
      look: {
        skin: "#e6b285", skinShade: "#c58c62", hair: "#a85b3b", hairShade: "#7b3d27",
        hat: "straw", hatColor: "#c9a45a", hatShade: "#8f7138",
        clothes: "#8d9d58", clothesShade: "#667542", accent: "#d76d5b",
        beard: false, glasses: false, blush: true
      }
    },
    {
      id: "granite", name: "花岗", role: "stone", roleName: "石匠",
      area: "quarry", scene: "outdoor", hireCost: 35, bonus: 0.05,
      quirk: "在石场长大的人，肩膀比城墙还宽，鼾声比钟声还响。",
      traitName: "铁背", traitDesc: "在采石场工作，并为全城提供 +5% 生产效率。",
      look: {
        skin: "#c99167", skinShade: "#a46f4b", hair: "#77736a", hairShade: "#504d47",
        hat: "bandana", hatColor: "#9a4d3c", hatShade: "#6e352b",
        clothes: "#7d7f72", clothesShade: "#5a5c52", accent: "#b8b3a4",
        beard: "grey", glasses: false, blush: false
      }
    },
    {
      id: "pudding", name: "布丁", role: "cook", roleName: "厨师",
      area: "kitchen", scene: "indoor", hireCost: 0, bonus: 0.10,
      quirk: "一锅汤能温暖三层楼，尤其是他笑起来的时候。",
      traitName: "热汤", traitDesc: "每天少消耗 1 份食物，并为全城提供 +10% 生产效率。",
      look: {
        skin: "#e8b58a", skinShade: "#c78c64", hair: "#7b4a2b", hairShade: "#553019",
        hat: "toque", hatColor: "#efe5cc", hatShade: "#c9bda1",
        clothes: "#c9c0a8", clothesShade: "#9d937d", accent: "#b9563f",
        beard: "brown", glasses: false, blush: true
      }
    },
    {
      id: "ink", name: "墨墨", role: "scholar", roleName: "学者",
      area: "study", scene: "indoor", hireCost: 0, bonus: 0.10,
      quirk: "她正在写一本关于城堡猫的书，已经写到第七卷。",
      traitName: "博览", traitDesc: "为全城提供 +10% 生产效率，并让手记记录更多细节。",
      look: {
        skin: "#e7bc95", skinShade: "#c1936e", hair: "#3c3040", hairShade: "#28202b",
        hat: "hood", hatColor: "#3e5b79", hatShade: "#2b4056",
        clothes: "#4f6d8b", clothesShade: "#3a5169", accent: "#d4b25e",
        beard: false, glasses: true, blush: true
      }
    },
    {
      id: "irondan", name: "铁蛋", role: "guard", roleName: "守卫",
      area: "barracks", scene: "indoor", hireCost: 0, bonus: 0.10,
      quirk: "他给城里的每只鸽子都取了名字，包括那只偷面包的。",
      traitName: "守夜", traitDesc: "为全城提供 +10% 生产效率，并让坏事件减半。",
      look: {
        skin: "#c98e63", skinShade: "#a16b47", hair: "#4a392d", hairShade: "#30251d",
        hat: "helmet", hatColor: "#8d9495", hatShade: "#5f6868",
        clothes: "#5f6d79", clothesShade: "#435058", accent: "#a94b3c",
        beard: "brown", glasses: false, blush: false
      }
    },
    {
      id: "goldbell", name: "金铃", role: "merchant", roleName: "商人",
      area: "storeroom", scene: "indoor", hireCost: 0, bonus: 0.10,
      quirk: "她能从一块石头的影子里看出三笔生意，还能顺手赚第四笔。",
      traitName: "精明", traitDesc: "为全城提供 +10% 生产效率，出售资源价格 +50%。",
      look: {
        skin: "#dfa77d", skinShade: "#b97d55", hair: "#7b3f2e", hairShade: "#54271b",
        hat: "beret", hatColor: "#7b567e", hatShade: "#55375a",
        clothes: "#8a5d72", clothesShade: "#644053", accent: "#e0b94e",
        beard: false, glasses: false, blush: true
      }
    }
  ];

  const BUILDINGS = [
    {
      id: "lumber", name: "伐木场", icon: "lumber", scene: "outdoor",
      worker: "bart", tags: ["生产", "木材"], room: "庭院 · 左侧",
      cost: { wood: 10, gold: 0 }, time: 5,
      output: { wood: 0.28 },
      desc: "把倒下的老橡树变成整齐的木板。",
      flavor: "锯末让城堡闻起来像新的一天。",
      completionGold: 10,
      plot: { x: 38, y: 246, w: 132, h: 82, baseY: 300, labelY: 246 }
    },
    {
      id: "farm", name: "农田", icon: "farm", scene: "outdoor",
      worker: "maya", tags: ["生产", "食物"], room: "庭院 · 左下",
      cost: { wood: 18, gold: 5 }, time: 6,
      output: { food: 0.22 },
      desc: "翻土、撒种，然后耐心等风来。",
      flavor: "第一批麦子磨成面粉时，全城堡都闻到了面包香。",
      completionGold: 10,
      plot: { x: 22, y: 314, w: 190, h: 78, baseY: 382, labelY: 314 }
    },
    {
      id: "quarry", name: "采石场", icon: "quarry", scene: "outdoor",
      worker: "granite", tags: ["生产", "石料"], room: "庭院 · 右侧",
      cost: { wood: 15, gold: 0 }, time: 6,
      output: { stone: 0.18 },
      desc: "从沉睡的山岩里凿出下一座城堡。",
      flavor: "花岗说，石头只是睡得很沉的云。",
      completionGold: 15,
      plot: { x: 536, y: 244, w: 118, h: 88, baseY: 326, labelY: 244 }
    },
    {
      id: "kitchen", name: "厨房", icon: "tavern", scene: "indoor",
      worker: "pudding", tags: ["城堡内", "食物"], room: "城堡 · 左下",
      cost: { wood: 20, stone: 12, gold: 20 }, time: 7,
      output: { food: 0.04 },
      effect: "每日少消耗 1 份食物，全体效率 +10%",
      desc: "炉火、热汤和一张能坐下所有人的长桌。",
      flavor: "布丁说，饿着肚子的人修不好城堡。",
      completionGold: 15,
      rect: { x: 26, y: 268, w: 180, h: 112 }
    },
    {
      id: "study", name: "书房", icon: "library", scene: "indoor",
      worker: "ink", tags: ["城堡内", "效率"], room: "城堡 · 左上",
      cost: { wood: 28, stone: 22, gold: 35 }, time: 8,
      effect: "全体生产效率 +10%",
      desc: "旧书里有旧王国的地图，也有明天的办法。",
      flavor: "最里面那排书架，总是比昨天多出一本。",
      completionGold: 20,
      rect: { x: 26, y: 24, w: 180, h: 124 }
    },
    {
      id: "barracks", name: "兵营", icon: "tower", scene: "indoor",
      worker: "irondan", tags: ["城堡内", "安全"], room: "城堡 · 右上",
      cost: { wood: 35, stone: 30, gold: 45 }, time: 9,
      effect: "全体生产效率 +10%，坏事件减半",
      desc: "武器靠墙，炉火不灭，守夜的人有一张自己的床。",
      flavor: "铁蛋坚持在门口放一块擦鞋垫。",
      completionGold: 25,
      rect: { x: 514, y: 24, w: 180, h: 124 }
    },
    {
      id: "storeroom", name: "账房", icon: "market", scene: "indoor",
      worker: "goldbell", tags: ["城堡内", "买卖"], room: "城堡 · 左中",
      cost: { wood: 40, stone: 35, gold: 60 }, time: 10,
      effect: "出售资源价格 +50%，全体效率 +10%",
      desc: "账本、货架、秘银秤，还有一把只用来数钱的椅子。",
      flavor: "金铃说，最好的买卖是让双方都笑着回家。",
      completionGold: 30,
      rect: { x: 26, y: 154, w: 180, h: 108 }
    },
    {
      id: "chapel", name: "礼拜堂", icon: "chapel", scene: "indoor",
      worker: null, tags: ["城堡内", "终章"], room: "城堡 · 上方",
      cost: { wood: 60, stone: 50, gold: 100 }, time: 12,
      effect: "风息堡重新完整，可以举办丰收庆典",
      desc: "修补彩窗，重新点亮烛台，让钟声再次有地方回响。",
      flavor: "钟声不是用来告别的，是用来叫大家回家的。",
      completionGold: 0,
      rect: { x: 216, y: 24, w: 288, h: 124 }
    }
  ];

  // 每个区域总览：3 个庭院 + 4 个房间 + 礼拜堂
  const COMPLETION_TOTAL = 8;

  const GUIDE = [
    {
      id: "hire_bart", title: "先请一位木匠",
      desc: "城门口的木匠巴特只要 10 金币。请他进门，他就会帮你修伐木场。",
      hint: "点击右侧金色按钮，直接雇佣巴特。",
      action: { type: "hire", id: "bart" },
      reward: { gold: 10 },
      check: function (s) { return !!s.workers.bart.hired; },
      progress: function (s) { return s.workers.bart.hired ? "1 / 1" : "0 / 1"; }
    },
    {
      id: "build_lumber", title: "修好伐木场",
      desc: "花 10 木材把锯木棚立起来。巴特会自动开始生产木材，不用手动安排。",
      hint: "木材是之后卖钱和修城堡的基础。",
      action: { type: "build", id: "lumber" },
      reward: { wood: 10 },
      check: function (s) { return s.buildings.lumber.status === "built"; },
      progress: function (s) { return statusText(s.buildings.lumber); }
    },
    {
      id: "sell_wood", title: "把木材卖给行商",
      desc: "10 木材可以换 6 金币。卖一次，让金币重新流动起来。",
      hint: "点击「卖出 10 木材」就能完成。",
      action: { type: "sell", res: "wood" },
      reward: { gold: 5 },
      check: function (s) { return (s.stats.soldWood || 0) >= 10; },
      progress: function (s) { return Math.min(s.stats.soldWood || 0, 10) + " / 10 木材"; }
    },
    {
      id: "hire_granite", title: "请石匠花岗",
      desc: "花岗的锤子能凿开山岩。请他留下，就能解锁采石场蓝图。",
      hint: "如果金币不够，先去行商那里卖木材或石料。",
      action: { type: "hire", id: "granite" },
      reward: { stone: 8 },
      check: function (s) { return !!s.workers.granite.hired; },
      progress: function (s) { return s.workers.granite.hired ? "1 / 1" : "0 / 1"; }
    },
    {
      id: "build_quarry", title: "开采石料",
      desc: "用木材搭起采石场。花岗会自动开始凿石，石料能卖更多钱。",
      hint: "采石场建好后，石料也可以卖给行商。",
      action: { type: "build", id: "quarry" },
      reward: { gold: 10 },
      check: function (s) { return s.buildings.quarry.status === "built"; },
      progress: function (s) { return statusText(s.buildings.quarry); }
    },
    {
      id: "hire_maya", title: "让餐桌有面包",
      desc: "农夫麦芽会照料农田。人越多，每天要吃的食物也越多。",
      hint: "卖一点石料或木材，凑够雇佣麦芽的金币。",
      action: { type: "hire", id: "maya" },
      reward: { food: 8 },
      check: function (s) { return !!s.workers.maya.hired; },
      progress: function (s) { return s.workers.maya.hired ? "1 / 1" : "0 / 1"; }
    },
    {
      id: "build_farm", title: "修好农田",
      desc: "农田每天产出食物。居民们吃饱了，干活效率会更高。",
      hint: "食物每天黎明消耗，别忘了先囤一点。",
      action: { type: "build", id: "farm" },
      reward: { wood: 15 },
      check: function (s) { return s.buildings.farm.status === "built"; },
      progress: function (s) { return statusText(s.buildings.farm); }
    },
    {
      id: "enter_castle", title: "推开城堡大门",
      desc: "庭院已经有两座建筑落成。城堡内部开放了：修复房间，才能请新居民住进来。",
      hint: "进入城堡后，点击房间上的标签查看修复条件。",
      action: { type: "enterCastle" },
      reward: { stone: 15 },
      check: function (s) { return !!s.flags.enteredCastle; },
      progress: function (s) { return s.flags.enteredCastle ? "已进入" : "待进入"; }
    },
    {
      id: "restore_kitchen", title: "修复厨房，请布丁进来",
      desc: "厨房能让大家少吃一点、干活更暖。修复后，布丁会成为新居民。",
      hint: "新居民也要吃饭，但他们会提高全体生产效率。",
      action: { type: "build", id: "kitchen" },
      reward: { food: 12 },
      check: function (s) { return s.buildings.kitchen.status === "built"; },
      progress: function (s) { return statusText(s.buildings.kitchen); }
    },
    {
      id: "restore_study", title: "修复书房，请墨墨进来",
      desc: "墨墨会把旧王国的知识整理成册，让每项生产都更有效率。",
      hint: "书房的修复材料可以在行商那里通过出售木材/石料换取。",
      action: { type: "build", id: "study" },
      reward: { gold: 20 },
      check: function (s) { return s.buildings.study.status === "built"; },
      progress: function (s) { return statusText(s.buildings.study); }
    },
    {
      id: "restore_barracks", title: "修复兵营，请铁蛋进来",
      desc: "铁蛋会守夜、赶野猪，也会让居民们更安心地工作。",
      hint: "兵营完成后，坏事件会减半。",
      action: { type: "build", id: "barracks" },
      reward: { stone: 20 },
      check: function (s) { return s.buildings.barracks.status === "built"; },
      progress: function (s) { return statusText(s.buildings.barracks); }
    },
    {
      id: "restore_storeroom", title: "修复账房，请金铃进来",
      desc: "金铃会把行商的价格谈高 50%。木材、石料、食物都能卖得更值钱。",
      hint: "账房是最后的赚钱房间，先修它再修礼拜堂。",
      action: { type: "build", id: "storeroom" },
      reward: { gold: 35 },
      check: function (s) { return s.buildings.storeroom.status === "built"; },
      progress: function (s) { return statusText(s.buildings.storeroom); }
    },
    {
      id: "restore_chapel", title: "修复礼拜堂",
      desc: "彩窗、烛台、钟声。把最后一块石头放回去，风息堡就完整了。",
      hint: "四个房间都修复后，礼拜堂才会开放。",
      action: { type: "build", id: "chapel" },
      reward: null,
      check: function (s) { return s.buildings.chapel.status === "built"; },
      progress: function (s) { return statusText(s.buildings.chapel); }
    },
    {
      id: "celebrate", title: "举办丰收庆典",
      desc: "所有区域都已经修复。点亮大厅的灯，邀请所有人坐下来吃一顿饭。",
      hint: "点击按钮，完成风息堡的故事。",
      action: { type: "festival" },
      reward: null,
      check: function (s) { return !!s.flags.festivalHeld; },
      progress: function (s) { return s.flags.festivalHeld ? "已完成" : "准备就绪"; }
    }
  ];

  const BUY_INFO = {
    wood: { amount: 10, gold: 12, daily: 40 },
    stone: { amount: 10, gold: 18, daily: 30 },
    food: { amount: 10, gold: 6, daily: 60 }
  };

  const MAX_BUILDING_LEVEL = 5;
  const MAX_FLOORS = 6;
  const BASE_CAPACITY = 7;
  const CASTLE_LEVELS = [
    { level: 1, min: 0, name: "断墙重生" },
    { level: 2, min: 70, name: "炉火初旺" },
    { level: 3, min: 150, name: "旗帜飞扬" },
    { level: 4, min: 260, name: "石墙生辉" },
    { level: 5, min: 400, name: "风息盛景" },
    { level: 6, min: 560, name: "王冠之城" }
  ];

  const MENUS = [
    {
      id: "soup", name: "蘑菇浓汤", icon: "mushroomSoup", cost: { gold: 35, food: 8 }, bonus: 0.10, minResidents: 2, dailyFood: 1,
      desc: "雨后的林地蘑菇，熬成一小锅暖汤。"
    },
    {
      id: "bread", name: "蜂蜜面包", icon: "honeyBread", cost: { gold: 70, food: 14 }, bonus: 0.15, minResidents: 4, dailyFood: 1,
      desc: "蜂巢里最后一勺蜜，抹在刚出炉的面包上。"
    },
    {
      id: "roast", name: "香草烤肉", icon: "herbRoast", cost: { gold: 120, food: 22 }, bonus: 0.20, minResidents: 6, dailyFood: 2,
      desc: "厨房的看家菜，连守卫都会多巡两圈。"
    },
    {
      id: "pie", name: "苹果派", icon: "applePie", cost: { gold: 180, food: 30 }, bonus: 0.25, minResidents: 8, dailyFood: 2,
      desc: "酥皮、肉桂和一点坏心思：多放一勺糖。"
    },
    {
      id: "skewer", name: "烤蘑菇串", icon: "mushroomSkewer", cost: { gold: 90, food: 12 }, bonus: 0.12, minResidents: 10, dailyFood: 1,
      desc: "林地里刚采的蘑菇，撒一点盐就很好。"
    },
    {
      id: "pumpkin", name: "奶油南瓜汤", icon: "pumpkinSoup", cost: { gold: 140, food: 18 }, bonus: 0.18, minResidents: 12, dailyFood: 2,
      desc: "金黄色的汤，和秋天的壁炉最配。"
    },
    {
      id: "fish", name: "蜂蜜烤鱼", icon: "honeyFish", cost: { gold: 220, food: 28 }, bonus: 0.28, minResidents: 14, dailyFood: 2,
      desc: "河鱼刷上蜂蜜，烤到边缘微焦。"
    },
    {
      id: "feast", name: "皇家炖锅", icon: "royalStew", cost: { gold: 260, food: 45 }, bonus: 0.30, minResidents: 16, dailyFood: 3,
      desc: "风息堡的招牌菜，适合在长桌中央冒着热气。"
    }
  ];

  const SHOPS = [
    {
      id: "bakery", name: "面包房", icon: "tavern", plot: { x: 162, y: 214, w: 110, h: 96, baseY: 300 },
      cost: { wood: 30, stone: 20, gold: 60 }, income: 0.20, residentBonus: 0.05,
      unlock: "kitchen", unlockText: "修复厨房后开放",
      desc: "面包香会顺着风飘进每一个房间。",
      flavor: "每天清晨，第一炉面包会被放在窗台上。"
    },
    {
      id: "smithy", name: "铁匠铺", icon: "tower", plot: { x: 568, y: 178, w: 106, h: 102, baseY: 274 },
      cost: { wood: 35, stone: 40, gold: 80 }, income: 0.26, productionBonus: 0.05,
      unlock: "barracks", unlockText: "修复兵营后开放",
      desc: "钉马蹄、修刀剑、顺便听守卫抱怨。",
      flavor: "铁锤落下的节奏，听久了像一首歌。"
    },
    {
      id: "general", name: "杂货铺", icon: "market", plot: { x: 470, y: 314, w: 154, h: 74, baseY: 386 },
      cost: { wood: 50, stone: 35, gold: 100 }, income: 0.35, residentBonus: 0.10,
      unlock: "allrooms", unlockText: "修复所有房间后开放",
      desc: "货架上什么都有，包括你昨天卖掉的那把勺子。",
      flavor: "金铃说，一家好的杂货铺应该让客人空手进来，满载出去。"
    }
  ];

  const EXPANSION_ROOMS = [
    {
      id: "toilet", name: "厕所", icon: "toilet", size: "S", cost: { wood: 10, stone: 8, gold: 15 },
      capacity: 0, satisfaction: 6, basic: "toilet",
      desc: "小型基础房。缺少厕所时，该层效率与满意度都会下降。"
    },
    {
      id: "dining", name: "餐厅", icon: "market", size: "S", cost: { wood: 25, stone: 15, gold: 80 },
      capacity: 0, residentBonus: 0.10, satisfaction: 2, basic: "dining",
      desc: "中型基础房。提供餐厅后，这一层才算适合居住。"
    },
    {
      id: "guest", name: "卧室", icon: "tavern", size: "M", cost: { wood: 30, stone: 20, gold: 60 },
      capacity: 2, residentBonus: 0.05, satisfaction: 1,
      desc: "中型卧室，增加 2 个床位。士兵/大臣/传教士的招募条件之一。"
    },
    {
      id: "dorm", name: "宿舍", icon: "dorm", size: "M", cost: { wood: 40, stone: 18, gold: 45 },
      capacity: 4, residentBonus: 0.02,
      desc: "中型房。增加 4 个床位，空间紧凑，收入加成较低。"
    },
    {
      id: "workshop", name: "工坊", icon: "hammer", size: "S", cost: { wood: 35, stone: 30, gold: 70 },
      capacity: 0, productionBonus: 0.08,
      desc: "中型房。全城生产 +8%。"
    },
    {
      id: "garden", name: "花园房", icon: "leaf", size: "S", cost: { wood: 20, stone: 25, gold: 50 },
      capacity: 1, foodBonus: 0.10, satisfaction: 3,
      desc: "小型房。增加 1 个床位，食物产出 +10%。"
    },
    {
      id: "library", name: "图书室", icon: "book", size: "S", cost: { wood: 28, stone: 26, gold: 75 },
      capacity: 0, productionBonus: 0.03, residentBonus: 0.08, satisfaction: 2,
      desc: "中型房。生产 +3%，居民收入 +8%。"
    },
    {
      id: "bath", name: "浴场", icon: "bath", size: "S", cost: { wood: 22, stone: 30, gold: 65 },
      capacity: 0, residentBonus: 0.05, satisfaction: 10,
      desc: "中型房。居民收入 +5%，满意度大幅提高。"
    },
    {
      id: "armory", name: "武器库", icon: "hammer", size: "M", cost: { wood: 30, stone: 35, gold: 90 },
      capacity: 0, satisfaction: 1, defense: 6,
      desc: "中型军事房。提供防御，是招募士兵的必要房间。"
    },
    {
      id: "study", name: "书房", icon: "book", size: "M", cost: { wood: 32, stone: 28, gold: 95 },
      capacity: 0, productionBonus: 0.05, residentBonus: 0.05,
      desc: "中型房。生产 +5%，居民收入 +5%。招募大臣的必要房间。"
    },
    {
      id: "meeting", name: "会议室", icon: "scroll", size: "L", cost: { wood: 55, stone: 45, gold: 160 },
      capacity: 0, productionBonus: 0.10, residentBonus: 0.08,
      desc: "大型房，造价较高。生产 +10%，居民收入 +8%。招募大臣的必要房间。"
    },
    {
      id: "chapel", name: "小礼拜堂", icon: "crest", size: "L", cost: { wood: 48, stone: 50, gold: 140 },
      capacity: 0, satisfaction: 8, productionBonus: 0.03,
      desc: "大型房。满意度 +8%，生产 +3%。招募传教士的必要房间。"
    },
    {
      id: "residence", name: "民居", icon: "tavern", size: "S", cost: { wood: 24, stone: 16, gold: 55 },
      capacity: 2, residentBonus: 0.06, satisfaction: 2,
      desc: "中型居民住宅，增加 2 个床位。招募居民的必要房间。"
    },
    {
      id: "soldier_quarters", name: "士兵营房", icon: "dorm", size: "M", cost: { wood: 34, stone: 30, gold: 85 },
      capacity: 2, defense: 3, satisfaction: 1,
      desc: "中型营房，增加 2 个床位并提高防御。招募士兵的必要房间。"
    },
    {
      id: "minister_office", name: "大臣办公室", icon: "scroll", size: "M", cost: { wood: 42, stone: 34, gold: 130 },
      capacity: 1, productionBonus: 0.06, residentBonus: 0.04,
      desc: "中型办公室，增加 1 个床位并提高生产。招募大臣的必要房间。"
    },
    {
      id: "missionary_cell", name: "静修室", icon: "crest", size: "S", cost: { wood: 18, stone: 22, gold: 60 },
      capacity: 1, satisfaction: 5, productionBonus: 0.02,
      desc: "小型静修室，增加 1 个床位。招募传教士的必要房间。"
    }
  ];

  const GUEST_CLASSES = [
    {
      id: "resident", name: "居民", icon: "people", color: "#c9a24e",
      requirements: ["residence"], cost: { gold: 25, food: 4 },
      income: 0.06, defense: 0, productionBonus: 0, satisfaction: 1,
      trait: "居民提高金币收入；需要一张卧室床位。",
      needText: "民居"
    },
    {
      id: "soldier", name: "士兵", icon: "hammer", color: "#6e7f8d",
      requirements: ["toilet", "armory", "soldier_quarters"], cost: { gold: 50, stone: 10, food: 6 },
      income: 0.02, defense: 15, productionBonus: 0, satisfaction: 1,
      trait: "士兵提高防御，降低隔壁村偷窃的概率。",
      needText: "厕所 + 武器库 + 士兵营房"
    },
    {
      id: "minister", name: "大臣", icon: "scroll", color: "#8d668c",
      requirements: ["meeting", "study", "minister_office"], cost: { gold: 180, wood: 20, food: 10 },
      income: 0.03, defense: 0, productionBonus: 0.06, satisfaction: 2,
      trait: "大臣数量少、房间贵，但每个提供 +6% 生产。",
      needText: "会议室 + 书房 + 大臣办公室"
    },
    {
      id: "missionary", name: "传教士", icon: "crest", color: "#8b7a4a",
      requirements: ["chapel", "missionary_cell"], cost: { gold: 80, food: 8 },
      income: 0.03, defense: 0, productionBonus: 0, satisfaction: 4,
      trait: "没有传教士时，居民产能下降；有传教士后恢复正常。",
      needText: "小礼拜堂 + 静修室"
    }
  ];

  const ROOM_SIZE_RANK = { S: 1, M: 2, L: 3 };

  const EXPANSION_SLOTS = [
    { id: "s1", x: 18, y: 46, w: 78, h: 108, size: "S" },
    { id: "s2", x: 104, y: 46, w: 210, h: 108, size: "L" },
    { id: "s3", x: 322, y: 46, w: 136, h: 108, size: "M" },
    { id: "s4", x: 466, y: 46, w: 120, h: 108, size: "M" },
    { id: "s5", x: 594, y: 46, w: 92, h: 108, size: "S" },
    { id: "s6", x: 18, y: 226, w: 78, h: 108, size: "S" },
    { id: "s7", x: 104, y: 226, w: 136, h: 108, size: "M" },
    { id: "s8", x: 248, y: 226, w: 210, h: 108, size: "L" },
    { id: "s9", x: 466, y: 226, w: 120, h: 108, size: "M" },
    { id: "s10", x: 594, y: 226, w: 92, h: 108, size: "S" }
  ];

  const MASK_TYPES = [
    { id: "merchant", name: "面具商人", mask: "#d6a44e", income: 0.06, quirk: "口袋里总有一枚不属于自己的硬币。" },
    { id: "bard", name: "面具乐师", mask: "#5b7b9d", income: 0.05, quirk: "没人见过面具下的脸，但大家都记得那首歌。" },
    { id: "gardener", name: "面具园丁", mask: "#748f5b", income: 0.04, quirk: "他种的花只在夜里开。" },
    { id: "envoy", name: "面具使节", mask: "#8d668c", income: 0.07, quirk: "来自很远的地方，每天写一封没有收件人的信。" },
    { id: "apprentice", name: "面具学徒", mask: "#a35f4e", income: 0.05, quirk: "正在学一门很厉害、但暂时没什么用的手艺。" }
  ];

  const EVENTS = [
    {
      id: "caravan", title: "路过的商队", icon: "coin", tone: "good", weight: 3,
      text: "一支商队借井水歇脚，买走了几筐边角木料。",
      effect: function (api) { api.addRes("gold", 10); }
    },
    {
      id: "rain_gift", title: "一场好雨", icon: "food", tone: "good", weight: 2,
      text: "夜里的雨把田地灌得饱饱的，厨房还发现了一篮蘑菇。",
      effect: function (api) { api.addRes("food", 7); }
    },
    {
      id: "wood_gift", title: "河上漂来的木头", icon: "wood", tone: "good", weight: 2,
      text: "上游的旧木筏散架了，几根好梁木搁浅在城堡后的小河边。",
      effect: function (api) { api.addRes("wood", 9); }
    },
    {
      id: "bard", title: "吟游诗人", icon: "coin", tone: "good", weight: 2,
      text: "一位戴羽毛帽的诗人坐在城墙上弹琴，临走前往帽子里放了几枚银币。",
      effect: function (api) { api.addRes("gold", 5); }
    },
    {
      id: "quiet_day", title: "安静的一天", icon: "sun", tone: "neutral", weight: 3,
      text: "没有大事发生。炉火很旺，面包很香，猫在窗台上睡了一整天。",
      effect: function (api) { api.log("风息堡度过了一个安静的清晨。"); }
    },
    {
      id: "lost_cat", title: "迷路的小猫", icon: "heart", tone: "good", weight: 2,
      text: "一只三花猫跟着送奶车来到门口。厨房给了它一小碟鱼汤。",
      effect: function (api) { api.addRes("food", 2); }
    },
    {
      id: "boar", title: "野猪闯进农田", icon: "leaf", tone: "bad", weight: 3,
      text: "一头野猪在田里拱出了几个坑，还顺走了一筐萝卜。",
      effect: function (api) {
        if (api.hasGuard()) {
          api.addRes("food", -2);
          api.log("铁蛋在田边赶走了野猪，只损失了两根萝卜。");
        } else {
          api.addRes("food", -5);
        }
      }
    },
    {
      id: "rats", title: "谷仓里的老鼠", icon: "leaf", tone: "bad", weight: 3,
      text: "谷仓传来窸窸窣窣的声音，面粉袋被咬破了一个角。",
      effect: function (api) {
        if (api.hasGuard()) {
          api.addRes("food", -1);
          api.log("铁蛋带着猫巡逻了一圈，老鼠们连夜搬了家。");
        } else {
          api.addRes("food", -4);
        }
      }
    }
  ];

  const WEATHER = {
    clear: { name: "晴", icon: "sun", desc: "阳光正好，适合干活。" },
    cloudy: { name: "多云", icon: "cloud", desc: "云层低低的，风里有木头和泥土的味道。" },
    rain: { name: "小雨", icon: "rain", desc: "细雨落在瓦片上，农田产量 +25%。" }
  };

  const NPCS = {
    samuel: {
      name: "塞缪尔", title: "老管家",
      look: {
        skin: "#d2a077", skinShade: "#ac7a56", hair: "#b7b1a4", hairShade: "#8a8479",
        hat: "none", hatColor: "#6b5140", hatShade: "#49372b",
        clothes: "#5a4a3b", clothesShade: "#403328", accent: "#b08c4e",
        beard: "grey", glasses: true, blush: false, monocle: true
      }
    },
    player: {
      name: "你", title: "风息堡主人",
      look: {
        skin: "#e3ae82", skinShade: "#bd8659", hair: "#4a3022", hairShade: "#312014",
        hat: "circlet", hatColor: "#e0b94e", hatShade: "#a87c2d",
        clothes: "#9a3f38", clothesShade: "#702b28", accent: "#f0d179",
        beard: false, glasses: false, blush: false
      }
    }
  };

  function statusText(bs) {
    if (!bs) return "—";
    if (bs.status === "built") return "已完成";
    if (bs.status === "building") return Math.floor((bs.progress || 0) * 100) + "%";
    if (bs.status === "available") return "可开工";
    return "未解锁";
  }

  function countHired(s) {
    return WORKERS.reduce(function (n, w) { return n + (s.workers[w.id] && s.workers[w.id].hired ? 1 : 0); }, 0);
  }
  function countBuilt(s, scene) {
    return BUILDINGS.reduce(function (n, b) {
      if (scene && b.scene !== scene) return n;
      const bs = s.buildings[b.id];
      return n + (bs && bs.status === "built" ? 1 : 0);
    }, 0);
  }
  function countOutdoorBuilt(s) { return countBuilt(s, "outdoor"); }
  function getWorker(id) { return WORKERS.filter(function (w) { return w.id === id; })[0] || null; }
  function getBuilding(id) { return BUILDINGS.filter(function (b) { return b.id === id; })[0] || null; }

  return {
    VERSION: VERSION,
    DAY_LENGTH: DAY_LENGTH,
    START_HOUR: START_HOUR,
    SAVE_KEY: SAVE_KEY,
    MUTE_KEY: MUTE_KEY,
    RESOURCES: RESOURCES,
    SELL_INFO: SELL_INFO,
    BUY_FOOD: BUY_FOOD,
    WORKERS: WORKERS,
    BUILDINGS: BUILDINGS,
    GUIDE: GUIDE,
    EVENTS: EVENTS,
    MENUS: MENUS,
    SHOPS: SHOPS,
    EXPANSION_ROOMS: EXPANSION_ROOMS,
    GUEST_CLASSES: GUEST_CLASSES,
    ROOM_SIZE_RANK: ROOM_SIZE_RANK,
    MASK_TYPES: MASK_TYPES,
    BASE_CAPACITY: BASE_CAPACITY,
    EXPANSION_SLOTS: EXPANSION_SLOTS,
    BUY_INFO: BUY_INFO,
    MAX_BUILDING_LEVEL: MAX_BUILDING_LEVEL,
    MAX_FLOORS: MAX_FLOORS,
    CASTLE_LEVELS: CASTLE_LEVELS,
    WEATHER: WEATHER,
    NPCS: NPCS,
    COMPLETION_TOTAL: COMPLETION_TOTAL,
    countHired: countHired,
    countBuilt: countBuilt,
    countOutdoorBuilt: countOutdoorBuilt,
    getWorker: getWorker,
    getBuilding: getBuilding,
    statusText: statusText
  };
})();
