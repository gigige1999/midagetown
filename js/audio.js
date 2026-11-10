/* =========================================================
   城堡物语 · 程序化音频
   鲁特琴式拨弦 + 环境音，全部由 WebAudio 合成
   ========================================================= */
window.GameAudio = (function () {
  "use strict";

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let musicFilter = null;
  let rainGain = null;
  let rainSource = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let stepIndex = 0;
  let running = false;
  let nightFactor = 0;
  let targetFilter = 3200;
  let noiseBuffer = null;

  const BPM = 68;
  const EIGHTH = 60 / BPM / 2;

  // 四小节，每小节 8 个八分音符（C 大调五声/七和弦色彩）
  const MELODY = [
    [261.63, 329.63, 392.00, 493.88, 329.63, 392.00, 493.88, 659.25],
    [220.00, 261.63, 329.63, 392.00, 261.63, 329.63, 392.00, 523.25],
    [174.61, 220.00, 261.63, 329.63, 220.00, 261.63, 329.63, 440.00],
    [196.00, 246.94, 293.66, 329.63, 246.94, 293.66, 329.63, 392.00]
  ];
  const BASS = [130.81, 110.00, 87.31, 98.00];
  const PAD = [
    [261.63, 329.63, 392.00],
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
    [196.00, 246.94, 293.66]
  ];

  function init() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) { /* ignore */ }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);

    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 3200;
    musicFilter.Q.value = 0.4;

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(musicFilter);
    musicFilter.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);

    // 雨声总线
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGain.connect(master);
    buildNoise();
    startRainLoop();
    return true;
  }

  function buildNoise() {
    const len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }

  function startRainLoop() {
    if (!ctx || rainSource) return;
    rainSource = ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.3;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 400;
    rainSource.connect(hp);
    hp.connect(filter);
    filter.connect(rainGain);
    rainSource.start();
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
    }
  }

  function isMuted() { return muted; }

  function note(freq, start, dur, type, gain, bus, filterFreq) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain || 0.08, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(env);
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filterFreq;
      env.connect(f);
      f.connect(bus || musicBus);
    } else {
      env.connect(bus || musicBus);
    }
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function scheduleMusic() {
    if (!ctx || !running) return;
    while (nextNoteTime < ctx.currentTime + 0.32) {
      const bar = Math.floor(stepIndex / 8) % 4;
      const step = stepIndex % 8;
      const f = MELODY[bar][step];
      note(f, nextNoteTime, 0.65, "triangle", 0.085, musicBus, nightFactor > 0.5 ? 1800 : 4200);
      if (step === 0) {
        note(BASS[bar], nextNoteTime, 1.8, "sine", 0.055, musicBus, 900);
        // 柔和铺底
        PAD[bar].forEach(function (pf, i) {
          note(pf / 2, nextNoteTime, 2.2, "sine", 0.012, musicBus, 1200);
        });
      }
      if (step === 4) {
        note(MELODY[bar][step] * 2, nextNoteTime + 0.02, 0.38, "triangle", 0.028, musicBus, 3200);
      }
      nextNoteTime += EIGHTH;
      stepIndex++;
    }
  }

  function startMusic() {
    if (!init() || running) return;
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) { /* ignore */ }
    running = true;
    stepIndex = 0;
    nextNoteTime = ctx.currentTime + 0.1;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(scheduleMusic, 120);
    scheduleMusic();
  }

  function stopMusic() {
    running = false;
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setNight(v) {
    nightFactor = Math.max(0, Math.min(1, v || 0));
    targetFilter = 4200 - nightFactor * 2200;
    if (musicFilter && ctx) {
      musicFilter.frequency.setTargetAtTime(targetFilter, ctx.currentTime, 1.5);
    }
    if (musicBus && ctx) {
      musicBus.gain.setTargetAtTime(0.16 - nightFactor * 0.035, ctx.currentTime, 1.5);
    }
  }

  function setRain(on, amount) {
    if (!rainGain || !ctx) return;
    const target = on ? (amount == null ? 0.055 : amount) : 0;
    rainGain.gain.setTargetAtTime(target, ctx.currentTime, 1.2);
  }

  function envPing(freq, t, dur, gain, type, bus) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus || sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseHit(t, dur, gain, filterFreq) {
    if (!ctx || !noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function sfx(name) {
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    switch (name) {
      case "click":
        envPing(660, t, 0.06, 0.035, "square");
        break;
      case "page":
        noiseHit(t, 0.1, 0.02, 2200);
        break;
      case "error":
        envPing(180, t, 0.12, 0.06, "sawtooth");
        envPing(140, t + 0.09, 0.16, 0.05, "sawtooth");
        break;
      case "build":
        noiseHit(t, 0.12, 0.11, 700);
        envPing(120, t, 0.14, 0.07, "sine");
        break;
      case "complete":
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          envPing(f, t + i * 0.075, 0.5, 0.06, "triangle");
        });
        break;
      case "hire":
        [659.25, 880, 1174.66].forEach(function (f, i) {
          envPing(f, t + i * 0.06, 0.5, 0.055, "triangle");
        });
        noiseHit(t, 0.08, 0.02, 3000);
        break;
      case "coin":
        envPing(1318.5, t, 0.14, 0.035, "square");
        envPing(1760, t + 0.05, 0.18, 0.025, "triangle");
        break;
      case "bell":
        [196, 392, 523.25, 587.33, 784].forEach(function (f, i) {
          envPing(f, t + i * 0.012, 2.8 - i * 0.25, 0.07 / (i * 0.55 + 1), "sine");
        });
        noiseHit(t, 0.5, 0.02, 900);
        break;
      case "cat":
        envPing(820, t, 0.1, 0.03, "sine");
        envPing(1120, t + 0.12, 0.16, 0.025, "sine");
        break;
      case "assign":
        envPing(440, t, 0.12, 0.04, "triangle");
        envPing(554, t + 0.08, 0.22, 0.035, "triangle");
        break;
      case "festival":
        [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
          envPing(f, t + i * 0.11, 0.9, 0.055, "triangle");
        });
        break;
      default:
        envPing(520, t, 0.06, 0.03, "triangle");
    }
  }

  window.addEventListener("pointerdown", function () {
    if (ctx && ctx.state === "suspended") {
      try { ctx.resume(); } catch (e) { /* ignore */ }
    }
  });

  return {
    init: init,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setMuted: setMuted,
    isMuted: isMuted,
    setNight: setNight,
    setRain: setRain,
    sfx: sfx
  };
})();
