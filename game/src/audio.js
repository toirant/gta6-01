// audio.js — synthesised WebAudio effects and a small original music loop for Solmar City.
// Every sound is generated with oscillators and filtered noise: no audio files.
window.G = window.G || {};
(function () {
  var G = window.G;
  var ctx = null, master = null, musicTimer = null, musicStep = 0, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensureCtx()) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  function noiseBurst(dur, vol, filterFreq) {
    if (!ensureCtx()) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFreq || 1200;
    var g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }
  // A lazy, sun-baked bassline: Am – F – C – G, one bar each, with a soft pluck on top.
  var BASS = [55, 43.65, 65.41, 49];
  var PLUCK = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 196];
  G.audio = {
    unlock: function () { ensureCtx(); },
    startMusic: function () {
      if (!ensureCtx() || musicTimer) return;
      musicStep = 0;
      musicTimer = setInterval(function () {
        var bar = Math.floor(musicStep / 8) % 4;
        if (musicStep % 8 === 0) tone(BASS[bar], 1.9, "triangle", 0.16);
        if (musicStep % 2 === 0) tone(PLUCK[musicStep % 8] * (bar === 1 ? 0.89 : 1), 0.32, "sine", 0.05);
        if (musicStep % 8 === 4) noiseBurst(0.06, 0.05, 4000);
        musicStep++;
      }, 240);
    },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setEngine: function (on, speed01) {
      if (!ensureCtx()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth"; engineOsc.frequency.value = 60;
        engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
        var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(on ? 0.045 + speed01 * 0.03 : 0.0, ctx.currentTime, 0.1);
      }
    },
    setSiren: function (on) {
      if (!ensureCtx()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = "sine"; sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.0;
        var lfo = ctx.createOscillator(); lfo.frequency.value = 0.6;
        var lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
        lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); lfo.start();
        sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.2);
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch (e) { /* already stopped */ }
        sirenOsc = null; sirenGain = null;
      }
    },
    gunshot: function () { noiseBurst(0.14, 0.5, 900); tone(160, 0.1, "square", 0.18, 60); },
    punch: function () { noiseBurst(0.09, 0.35, 500); tone(90, 0.09, "sine", 0.3, 50); },
    pickup: function () { tone(660, 0.12, "sine", 0.2); setTimeout(function () { tone(880, 0.18, "sine", 0.2); }, 110); },
    cash: function () { tone(523, 0.1, "triangle", 0.2); setTimeout(function () { tone(784, 0.22, "triangle", 0.2); }, 100); },
    crash: function () { noiseBurst(0.25, 0.4, 700); },
    horn: function () { tone(370, 0.25, "square", 0.08); tone(466, 0.25, "square", 0.08); },
    busted: function () { tone(392, 0.4, "sawtooth", 0.15, 196); setTimeout(function () { tone(311, 0.6, "sawtooth", 0.15, 155); }, 350); },
    click: function () { tone(800, 0.05, "sine", 0.1); }
  };
})();
