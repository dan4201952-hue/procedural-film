// music.js : the score and sound design of the film.
// Owner: music. Contract: docs/CONTRACT.md, section Audio.
//
// FILM.audio.render(ctx, { start = 0, dest = ctx.destination }) schedules the whole piece,
// music and effects, from global time `start` into any BaseAudioContext.
// Every sound is synthesised here: oscillators, periodic waves, seeded noise, filters, envelopes,
// a ping-pong delay, convolver reverbs on generated impulse responses, a glue compressor and a
// soft limiter. Randomness comes only from FILM.lib.rng, seeded per event, so any start time
// schedules the same notes at the same global times.
//
// The engine, instruments, effects and master chain below are film-agnostic. Per film the music
// agent replaces three things: the CH chord table, the MIX.ride section automation, and the whole
// score() function — composing against FILM.TIMELINE.bpm and FILM.TIMELINE.cues so hits land on
// the cuts. What ships here is a demo score that gives the stub pass a pulse; see the skill's
// reference/music.md before composing.
(function () {
  'use strict';
  const FILM = window.FILM;
  const lib = FILM.lib;
  const TAU = Math.PI * 2;
  const FLOOR = 1e-5;

  // DynamicsCompressorNode delays its output by a fixed 6 ms look-ahead (measured: 288 samples at
  // 48 kHz). Every event before the compressor is scheduled that much early, so it leaves the master
  // exactly on its cue. Only an event inside the first 6 ms of a render window can land late.
  const LAT = 0.006;

  // Mix constants, tuned by measurement (tools/audio): loudness, peaks, per-bar profile.
  const MIX = {
    trim: 1.05,
    ceiling: 0.66, // soft limiter output ceiling (about -3.6 dBFS)
    knee: 0.5,
    bus: { drums: 0.6, perc: 0.8, bass: 0.3, pad: 0.26, keys: 0.6, bells: 0.45, lead: 0.5, sfx: 0.62, amb: 0.5 },
    // Master tilt EQ in dB: a low shelf under the subs, presence and air for phone speakers.
    eq: { low: -4, presence: 5, air: 3 },
    comp: { threshold: -18, knee: 10, ratio: 2, attack: 0.006, release: 0.2 },
    // Section fader rides in dB at global times, pre-compressor: hushed 2 s intro, the groove
    // building underneath, full tutti at the T 6.0 cut, a small lift into the salsa and the second
    // tutti, peaks at the big brass hits, then a ramp back down under the final chord's ring-out so
    // the loop seam (loud ending vs. hushed intro) restarts cleanly.
    ride: [
      [0, -14.5],
      [2.0, -12],
      [5.5, -9.5],
      [6.0, -7.5],
      [15.4, -6.9],
      [16.0, -7.2],
      [24.0, -6.7],
      [27.4, -6.5],
      [28.0, -7.5],
      [30.5, -6.6],
      [33.0, -6.4],
      [35.0, -7.2],
      [36.0, -14.5],
    ],
  };

  // ---------------------------------------------------------------- pitch
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) {
    if (typeof n === 'number') return n;
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------------------------------------------------------------- envelopes
  // pts: [[dt, value, shape]] with dt from the note start; shape is the ramp INTO that point:
  // 'lin' (default), 'exp' or 'set'. The first point must sit at dt 0.
  // When the voice started before the render window (skip > 0) the value at `skip` is computed
  // and automation resumes from there, so a seek hears the same envelope.
  function setEnv(param, pts, c0, skip) {
    let i;
    let prev;
    if (skip > 0) {
      let v = pts[0][1];
      for (i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (skip < b[0]) {
          const f = (skip - a[0]) / Math.max(1e-9, b[0] - a[0]);
          const sh = b[2] || 'lin';
          if (sh === 'set') v = a[1];
          else if (sh === 'exp' && a[1] > 0) v = a[1] * Math.pow(Math.max(b[1], FLOOR) / a[1], f);
          else v = a[1] + (b[1] - a[1]) * f;
          break;
        }
        v = b[1];
      }
      param.setValueAtTime(v, c0 + skip);
      prev = v;
    } else {
      param.setValueAtTime(pts[0][1], c0);
      prev = pts[0][1];
      i = 1;
    }
    for (; i < pts.length; i++) {
      const v = pts[i][1];
      const sh = pts[i][2] || 'lin';
      const w = c0 + pts[i][0];
      if (sh === 'set') {
        param.setValueAtTime(v, w);
        prev = v;
      } else if (sh === 'exp' && prev > 0) {
        param.exponentialRampToValueAtTime(Math.max(v, FLOOR), w);
        prev = Math.max(v, FLOOR);
      } else {
        param.linearRampToValueAtTime(v, w);
        prev = v;
      }
    }
  }

  // Percussive amplitude envelope: attack then exponential decay to silence.
  const perc = (vel, att, dec) => [[0, 0], [att, vel], [att + dec, FLOOR, 'exp']];

  // ---------------------------------------------------------------- generated buffers
  function noiseBuffer(ctx, secs, channels, seed) {
    const n = Math.floor(secs * ctx.sampleRate);
    const buf = ctx.createBuffer(channels, n, ctx.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const r = lib.rng(lib.hash('film-noise', seed, ch));
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    }
    return buf;
  }

  // Impulse response: seeded stereo noise, exponential decay to -60 dB at `secs`, a two-pole
  // lowpass that darkens over the tail, a pre-delay and a few early reflections.
  function impulse(ctx, secs, seed, o) {
    const sr = ctx.sampleRate;
    const n = Math.floor(secs * sr);
    const buf = ctx.createBuffer(2, n, sr);
    const pre = Math.floor(o.pre * sr);
    const tail = secs - o.pre;
    for (let ch = 0; ch < 2; ch++) {
      const r = lib.rng(lib.hash('film-ir', seed, ch));
      const d = buf.getChannelData(ch);
      let l1 = 0;
      let l2 = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        const u = t / tail;
        const env = Math.exp(-6.9 * u) * (t < 0.005 ? t / 0.005 : 1);
        const a = o.bright + (o.dark - o.bright) * Math.sqrt(u);
        l1 += a * (r() * 2 - 1 - l1);
        l2 += a * (l1 - l2);
        d[i] = l2 * env;
      }
      for (let k = 0; k < o.early; k++) {
        const i = pre + Math.floor((0.003 + r() * o.spread) * sr);
        if (i < n) d[i] += (r() * 2 - 1) * 0.35 * (1 - k / o.early);
      }
    }
    return buf;
  }

  // Grains rendered straight into a stereo buffer: band-passed noise flaps and clicks, or short sines.
  // g: { t, dur, amp, pan (-1..1), f, q, att, dec, sine }
  function grainBuffer(ctx, key, secs, grains) {
    const sr = ctx.sampleRate;
    const n = Math.max(1, Math.ceil(secs * sr));
    const buf = ctx.createBuffer(2, n, sr);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const r = lib.rng(lib.hash('film-grain', key));
    for (const g of grains) {
      const i0 = Math.floor(g.t * sr);
      const m = Math.floor(g.dur * sr);
      const gl = Math.cos(((g.pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((g.pan + 1) * Math.PI) / 4);
      const att = g.att || 0.002;
      const dec = g.dec || g.dur * 0.3;
      const w = (TAU * g.f) / sr;
      const al = Math.sin(w) / (2 * (g.q || 1));
      const cw = Math.cos(w);
      const a0 = 1 + al;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      const ph = r() * TAU;
      for (let k = 0; k < m; k++) {
        const j = i0 + k;
        if (j >= n) break;
        const tt = k / sr;
        let s;
        if (g.sine) s = Math.sin(ph + w * k);
        else {
          const x = r() * 2 - 1;
          s = (al * x - al * x2 + 2 * cw * y1 - (1 - al) * y2) / a0;
          x2 = x1;
          x1 = x;
          y2 = y1;
          y1 = s;
        }
        const env = tt < att ? tt / att : Math.exp(-(tt - att) / dec);
        const tailFade = k > m - 64 ? (m - k) / 64 : 1;
        const v = s * env * tailFade * g.amp;
        if (j >= 0) {
          L[j] += v * gl;
          R[j] += v * gr;
        }
      }
    }
    return buf;
  }

  // Stick-slip creak: irregular pulses, each ringing three damped wooden resonances.
  function creakBuffer(ctx, key, secs, rate0, rate1, formants) {
    const sr = ctx.sampleRate;
    const n = Math.ceil(secs * sr);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const r = lib.rng(lib.hash('film-creak', key));
    let t = 0.004;
    while (t < secs - 0.01) {
      const u = t / secs;
      const swell = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.55 + 0.45 * r());
      const i0 = Math.floor(t * sr);
      for (const [f, tau, a] of formants) {
        const m = Math.min(n - i0, Math.floor(tau * 5 * sr));
        const fj = f * (0.94 + 0.12 * r());
        for (let k = 0; k < m; k++) d[i0 + k] += swell * a * Math.exp(-k / sr / tau) * Math.sin((TAU * fj * k) / sr);
      }
      const rate = rate0 + (rate1 - rate0) * u;
      t += (1 / rate) * (0.7 + 0.6 * r());
    }
    for (let k = 0; k < 96 && k < n; k++) d[n - 1 - k] *= k / 96;
    return buf;
  }

  // Soft limiter transfer curve. The shaper is fed at half level, so the curve covers inputs up to
  // +6 dBFS: linear to the knee, then a tanh shoulder that never passes the ceiling.
  function limiterCurve(ceiling, knee) {
    const n = 16385;
    const c = new Float32Array(n);
    const room = ceiling - knee;
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * 2;
      const a = Math.abs(x);
      const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  function periodic(ctx, n, amp) {
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) imag[k] = amp(k);
    return ctx.createPeriodicWave(real, imag);
  }

  // ---------------------------------------------------------------- engine
  function makeEngine(ctx, start, dest, DUR, MIX) {
    const base = ctx.currentTime;
    const E = { ctx, sr: ctx.sampleRate, start, base, DUR, duckTargets: [] };

    // A voice is a note or effect that starts at global time t0 and lasts len seconds (release included).
    // A sustained voice whose compensated start falls before the window resumes mid-envelope on time.
    // A short voice that starts inside the first 6 ms plays whole, up to 6 ms late; one that began
    // earlier is skipped.
    E.w0 = -Infinity;
    E.w1 = Infinity;
    E.voice = function (t0, len, sustain) {
      if (t0 < E.w0 || t0 >= E.w1) return null; // belongs to another scheduling window
      if (t0 >= DUR || t0 + len <= start) return null;
      const c = base + (t0 - start) - LAT;
      let c0 = c;
      let skip = 0;
      if (c < base) {
        if (sustain) skip = base - c;
        else if (t0 >= start) c0 = base;
        else return null;
      }
      return {
        c0,
        skip,
        len,
        env: (param, pts) => setEnv(param, pts, c0, skip),
        osc(node, stopDt) {
          node.start(c0 + skip);
          node.stop(c0 + Math.max(stopDt === undefined ? len : stopDt, skip + 0.002));
          return node;
        },
        buf(node, offset, stopDt) {
          const d = node.buffer.duration;
          let off = (offset || 0) + skip;
          if (node.loop) off %= d;
          else if (off >= d) return node;
          node.start(c0 + skip, off);
          node.stop(c0 + Math.max(stopDt === undefined ? len : stopDt, skip + 0.002));
          return node;
        },
      };
    };

    E.gain = (v) => {
      const g = ctx.createGain();
      g.gain.value = v === undefined ? 1 : v;
      return g;
    };
    E.osc = (type, f) => {
      const o = ctx.createOscillator();
      if (typeof type === 'string') o.type = type;
      else o.setPeriodicWave(type);
      o.frequency.value = f;
      return o;
    };
    E.filt = (type, f, q) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q === undefined ? 0.707 : q;
      return b;
    };
    E.panner = (p) => {
      const s = ctx.createStereoPanner();
      s.pan.value = p;
      return s;
    };
    E.rng = (...k) => lib.rng(lib.hash('film-score', ...k));

    // ---- master: highpass, glue compressor, trim, soft limiter, output fades
    const master = E.gain(1);
    const hp = E.filt('highpass', 26, 0.6);
    const lowShelf = E.filt('lowshelf', 140, 0.7);
    lowShelf.gain.value = MIX.eq.low;
    const presence = E.filt('peaking', 3000, 0.7);
    presence.gain.value = MIX.eq.presence;
    const air = E.filt('highshelf', 8000, 0.7);
    air.gain.value = MIX.eq.air;
    const comp = ctx.createDynamicsCompressor();
    for (const k in MIX.comp) comp[k].value = MIX.comp[k];
    const trim = E.gain(MIX.trim * 0.5);
    const lim = ctx.createWaveShaper();
    lim.curve = limiterCurve(MIX.ceiling, MIX.knee);
    lim.oversample = 'none';
    const out = E.gain(1);
    master.connect(hp);
    hp.connect(lowShelf);
    lowShelf.connect(presence);
    presence.connect(air);
    air.connect(comp);
    comp.connect(trim);
    trim.connect(lim);
    lim.connect(out);
    out.connect(dest);
    E.master = master;
    // Output fades sit after the compressor, so they use uncompensated times. The compressor's
    // first 6 ms are silent; the output then opens over 3 ms, and the last 10 ms taper to zero, so the
    // loop seam and every seek start without a click.
    out.gain.setValueAtTime(0, base);
    out.gain.setValueAtTime(0, base + LAT);
    out.gain.linearRampToValueAtTime(1, base + LAT + 0.003);
    const cEnd = base + (DUR - start);
    if (DUR - start > 0.05) {
      out.gain.setValueAtTime(1, cEnd - 0.01);
      out.gain.linearRampToValueAtTime(0, cEnd);
    }
    // Section rides on the master input, compensated like every other pre-compressor event.
    setEnv(master.gain, MIX.ride.map(([t, d], i) => [t, Math.pow(10, d / 20), i ? 'lin' : undefined]), base - start - LAT, start + LAT);

    // ---- shared buffers
    E.white = noiseBuffer(ctx, 2.5, 1, 'white');
    E.wide = noiseBuffer(ctx, 5, 2, 'wide');
    E.warmSaw = periodic(ctx, 48, (k) => Math.pow(k, -1.35) * (k > 24 ? Math.exp(-(k - 24) / 10) : 1));
    E.softSquare = periodic(ctx, 31, (k) => (k % 2 ? Math.pow(k, -1.5) : 0.04 / k));
    E.brassSaw = periodic(ctx, 40, (k) => Math.pow(k, -1.05));

    // ---- effects returns
    E.fx = {};
    const verb = (name, secs, o, ret) => {
      const c = ctx.createConvolver();
      c.buffer = impulse(ctx, secs, name, o);
      const g = E.gain(ret);
      c.connect(g);
      g.connect(master);
      E.fx[name] = c;
    };
    verb('room', 0.9, { pre: 0.006, bright: 0.55, dark: 0.18, early: 10, spread: 0.035 }, 0.9);
    verb('hall', 2.8, { pre: 0.018, bright: 0.45, dark: 0.09, early: 14, spread: 0.07 }, 0.9);
    verb('cave', 6.0, { pre: 0.03, bright: 0.35, dark: 0.05, early: 18, spread: 0.12 }, 0.85);

    // Ping-pong delay, a dotted 8th (0.375 s) each side.
    const dIn = E.gain(1);
    dIn.channelCount = 1;
    dIn.channelCountMode = 'explicit';
    const dL = ctx.createDelay(1);
    const dR = ctx.createDelay(1);
    dL.delayTime.value = 0.375;
    dR.delayTime.value = 0.375;
    const fL = E.filt('lowpass', 4200, 0.5);
    const fR = E.filt('lowpass', 3400, 0.5);
    const gL = E.gain(0.4);
    const gR = E.gain(0.4);
    dIn.connect(dL);
    dL.connect(fL);
    fL.connect(gL);
    gL.connect(dR);
    dR.connect(fR);
    fR.connect(gR);
    gR.connect(dL);
    const mrg = ctx.createChannelMerger(2);
    fL.connect(mrg, 0, 0);
    fR.connect(mrg, 0, 1);
    const dRet = E.gain(0.75);
    mrg.connect(dRet);
    dRet.connect(master);
    const dVerb = E.gain(0.25);
    dRet.connect(dVerb);
    dVerb.connect(E.fx.hall);
    E.fx.delay = dIn;

    // ---- buses
    E.bus = {};
    // Per-voice sends pass through a tap scaled by the bus gain, so a bus fader moves its reverb too.
    E.tap = {};
    const taps = (name) => {
      E.tap[name] = {};
      for (const k of ['room', 'hall', 'cave', 'delay']) {
        const g = E.gain(MIX.bus[name]);
        g.connect(E.fx[k]);
        E.tap[name][k] = g;
      }
    };
    const bus = (name, sends, duck, hpf) => {
      taps(name);
      const b = E.gain(MIX.bus[name]);
      let tail = b;
      if (hpf) {
        const h = E.filt('highpass', hpf, 0.6);
        tail.connect(h);
        tail = h;
      }
      if (duck) {
        const d = E.gain(1);
        b.connect(d);
        tail = d;
        E.duckTargets.push(d.gain);
      }
      tail.connect(master);
      for (const k in sends) {
        const s = E.gain(sends[k]);
        tail.connect(s);
        s.connect(E.fx[k]);
      }
      E.bus[name] = b;
    };
    // Drum bus: a gentle saturator adds harmonics so the kick reads on phone speakers.
    {
      const b = E.gain(MIX.bus.drums);
      const drive = E.gain(1.6);
      const sat = ctx.createWaveShaper();
      const curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
      }
      sat.curve = curve;
      const back = E.gain(0.72);
      b.connect(drive);
      drive.connect(sat);
      sat.connect(back);
      back.connect(master);
      const rs = E.gain(0.1);
      back.connect(rs);
      rs.connect(E.fx.room);
      E.bus.drums = b;
      taps('drums');
    }
    bus('perc', { room: 0.1 });
    bus('bass', {}, true);
    bus('pad', { hall: 0.22 }, true, 180);
    bus('keys', { room: 0.12, hall: 0.14, delay: 0.06 });
    bus('bells', { hall: 0.3, cave: 0.06, delay: 0.14 });
    bus('lead', { hall: 0.22, delay: 0.18 });
    bus('sfx', { room: 0.14 });
    bus('amb', { hall: 0.12 });

    // Route a voice's last node to a bus, with an optional pan and extra sends.
    E.out = (node, busName, o) => {
      o = o || {};
      let n = node;
      if (o.pan) {
        const p = E.panner(o.pan);
        n.connect(p);
        n = p;
      }
      n.connect(E.bus[busName]);
      for (const k of ['room', 'hall', 'cave', 'delay']) {
        if (o[k]) {
          const s = E.gain(o[k]);
          n.connect(s);
          s.connect(E.tap[busName][k]);
        }
      }
      return n;
    };

    // Looping noise source with a per-event deterministic read offset.
    E.noise = (V, key, stereo) => {
      const s = ctx.createBufferSource();
      s.buffer = stereo ? E.wide : E.white;
      s.loop = true;
      const off = ((lib.hash('film-nz', key) % 100003) / 100003) * s.buffer.duration;
      return V.buf(s, off);
    };

    // Sidechain-style pump: a decaying negative curve added to the pad and bass bus gains on a kick.
    const duckLen = 0.32;
    E.duckBuf = ctx.createBuffer(1, Math.floor(duckLen * E.sr), E.sr);
    {
      const d = E.duckBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / E.sr;
        d[i] = -(t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) / 0.085)) * (i > d.length - 48 ? (d.length - i) / 48 : 1);
      }
    }
    E.duck = (t, depth) => {
      const V = E.voice(t, duckLen, false);
      if (!V) return;
      const s = ctx.createBufferSource();
      s.buffer = E.duckBuf;
      for (const p of E.duckTargets) {
        const g = E.gain(depth);
        s.connect(g);
        g.connect(p);
      }
      V.buf(s, 0);
    };
    return E;
  }

  // ---------------------------------------------------------------- instruments
  function instruments(E) {
    const ctx = E.ctx;
    const I = {};

    // Felt, full, heartbeat or thud kick: a pitch-dropping sine with a short filtered click.
    I.kick = (t, vel, kind) => {
      const P = {
        felt: { f0: 125, f1: 50, fd: 0.055, dec: 0.36, click: 0.18, cf: 1600 },
        full: { f0: 165, f1: 47, fd: 0.065, dec: 0.5, click: 0.3, cf: 4200 },
        heart: { f0: 96, f1: 46, fd: 0.05, dec: 0.3, click: 0.16, cf: 1500 },
        thud: { f0: 95, f1: 52, fd: 0.04, dec: 0.2, click: 0.12, cf: 1200 },
      }[kind || 'felt'];
      const V = E.voice(t, P.dec + 0.03, false);
      if (!V) return;
      const o = E.osc('sine', P.f0);
      V.env(o.frequency, [[0, P.f0], [P.fd, P.f1, 'exp'], [P.dec, P.f1 * 0.92, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.06, vel * 0.75, 'exp'], [P.dec, FLOOR, 'exp']]);
      o.connect(g);
      E.out(g, 'drums');
      V.osc(o);
      const n = E.noise(V, ['kick', t]);
      const f = E.filt('lowpass', P.cf, 0.7);
      const cg = E.gain(0);
      V.env(cg.gain, perc(vel * P.click, 0.0008, 0.012));
      n.connect(f);
      f.connect(cg);
      E.out(cg, 'drums');
    };

    I.brush = (t, vel, pan) => {
      const V = E.voice(t, 0.26, false);
      if (!V) return;
      const n = E.noise(V, ['brush', t]);
      const f = E.filt('bandpass', 3000, 0.55);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [0.05, vel * 0.45, 'exp'], [0.24, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', { pan: pan || 0.12 });
      const o = E.osc('sine', 185);
      const og = E.gain(0);
      V.env(og.gain, perc(vel * 0.35, 0.002, 0.06));
      o.connect(og);
      E.out(og, 'drums');
      V.osc(o, 0.1);
    };

    I.hat = (t, vel, open) => {
      const len = open ? 0.22 : 0.055;
      const V = E.voice(t, len + 0.01, false);
      if (!V) return;
      const n = E.noise(V, ['hat', t]);
      const f = E.filt('highpass', 7200, 0.8);
      const f2 = E.filt('peaking', 10500, 1.2);
      f2.gain.value = 5;
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, len));
      n.connect(f);
      f.connect(f2);
      f2.connect(g);
      E.out(g, 'perc', { pan: -0.25 });
    };

    I.shaker = (t, vel, pan) => {
      const V = E.voice(t, 0.09, false);
      if (!V) return;
      const n = E.noise(V, ['shaker', t]);
      const f = E.filt('bandpass', 6500, 1.1);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.01, vel], [0.075, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', { pan: pan || 0.3 });
    };

    I.crash = (t, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.55;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const n = E.noise(V, ['crash', t], true);
      const f = E.filt('highpass', 4800, 0.6);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.12, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', o);
    };

    // Woodblock tock or small wooden click.
    I.tock = (t, vel, f, o) => {
      o = o || {};
      const V = E.voice(t, 0.1, false);
      if (!V) return;
      const s = E.osc('sine', f * 1.5);
      V.env(s.frequency, [[0, f * 1.5], [0.006, f, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, o.dec || 0.06));
      s.connect(g);
      E.out(g, o.bus || 'perc', o);
      V.osc(s);
      const tri = E.osc('triangle', f * 2.71);
      const tg = E.gain(0);
      V.env(tg.gain, perc(vel * 0.25, 0.001, 0.025));
      tri.connect(tg);
      E.out(tg, o.bus || 'perc', o);
      V.osc(tri, 0.05);
      const n = E.noise(V, ['tock', t, f]);
      const nf = E.filt('bandpass', Math.min(9000, f * 2.4), 2.5);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.5, 0.0005, 0.01));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'perc', o);
    };

    // FM marimba: soft-mallet FM attack on the fundamental, the tuned 4th partial, a mallet thump.
    I.marimba = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || Math.min(2.2, Math.max(0.35, 1.5 * Math.sqrt(220 / f)));
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 1.4], [0.04, f * 0.04, 'exp'], [dec, FLOOR, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [dec, FLOOR, 'exp']]);
      c.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(c);
      V.osc(m);
      if (f * 4 < 16000) {
        const p = E.osc('sine', f * 4);
        const pg = E.gain(0);
        V.env(pg.gain, perc(vel * 0.22, 0.002, 0.12));
        p.connect(pg);
        E.out(pg, o.bus || 'keys', o);
        V.osc(p, 0.2);
      }
      const n = E.noise(V, ['mar', t, f]);
      const nf = E.filt('lowpass', 1400, 0.7);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.12, 0.001, 0.012));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'keys', o);
    };

    // Kalimba: sine tine with a small pitch settle, an inharmonic overtone and a thumb click.
    I.kalimba = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.5;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const s = E.osc('sine', f);
      V.env(s.frequency, [[0, f * 1.007], [0.03, f, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.09, vel * 0.55, 'exp'], [dec, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(s);
      if (f * 5.93 < 17000) {
        const p = E.osc('sine', f * 5.93);
        const pg = E.gain(0);
        V.env(pg.gain, perc(vel * 0.28, 0.001, 0.07));
        p.connect(pg);
        E.out(pg, o.bus || 'keys', o);
        V.osc(p, 0.12);
      }
      const h = E.osc('sine', f * 2);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.1, 0.002, 0.35));
      h.connect(hg);
      E.out(hg, o.bus || 'keys', o);
      V.osc(h, 0.5);
      const n = E.noise(V, ['kal', t, f]);
      const nf = E.filt('bandpass', 3300, 1.8);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.3, 0.0005, 0.008));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'keys', o);
    };

    // Glockenspiel: free-bar partial ratios, higher partials die first.
    I.glock = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.8;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const parts = [
        [1, 1, 1],
        [2.756, 0.3, 0.35],
        [5.404, 0.11, 0.14],
        [8.933, 0.05, 0.06],
      ];
      for (const [ratio, a, d] of parts) {
        if (f * ratio > 18000) continue;
        const s = E.osc('sine', f * ratio);
        const g = E.gain(0);
        V.env(g.gain, perc(vel * a, 0.001, dec * d));
        s.connect(g);
        E.out(g, o.bus || 'bells', o);
        V.osc(s, dec * d + 0.02);
      }
    };

    // Glassy sine ping.
    I.glass = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.6;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const parts = [
        [1, 1, 1],
        [2, 0.12, 0.35],
        [3.01, 0.05, 0.18],
      ];
      for (const [ratio, a, d] of parts) {
        const s = E.osc('sine', f * ratio);
        const g = E.gain(0);
        V.env(g.gain, perc(vel * a, o.att || 0.003, dec * d));
        s.connect(g);
        E.out(g, o.bus || 'bells', o);
        V.osc(s, dec * d + 0.02);
      }
    };

    // FM bell: modulator at an inharmonic or harmonic ratio, index decaying with the note.
    I.fmBell = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.6;
      const ratio = o.ratio || 1.4;
      const idx = o.index || 3;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f * ratio);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * idx], [dec * 0.5, f * idx * 0.08, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, o.att || 0.002, dec));
      c.connect(g);
      E.out(g, o.bus || 'bells', o);
      V.osc(c);
      V.osc(m);
    };

    // Soft FM gong.
    I.gong = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 2.2;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f * 1.41);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 0.3], [0.09, f * 2.2], [dec, f * 0.15, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const lp = E.filt('lowpass', 1900, 0.5);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.012, vel], [dec, FLOOR, 'exp']]);
      c.connect(lp);
      lp.connect(g);
      E.out(g, o.bus || 'bells', o);
      V.osc(c);
      V.osc(m);
    };

    // Metallic FM ting for the gold dots.
    I.ting = (t, f, vel, o) => I.fmBell(t, f, vel, Object.assign({ ratio: 3.51, index: 1.6, dec: 0.45 }, o || {}));

    // Warm detuned pad: two warm-saw voices per note, spread left and right, one shared lowpass.
    // o: att, rel, cut0, cut1 (cutoff at the start and at t1), q, sine (hushed sine pad), bus, sends
    I.pad = (t0, t1, notes, vel, o) => {
      o = o || {};
      const att = Math.min(o.att === undefined ? 0.25 : o.att, t1 - t0);
      const rel = o.rel === undefined ? 0.35 : o.rel;
      const hold = t1 - t0;
      const len = hold + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const lp = E.filt('lowpass', o.cut0 || 1200, o.q || 0.6);
      V.env(lp.frequency, [[0, o.cut0 || 1200], [hold, o.cut1 || o.cut0 || 1200, 'exp'], [len, (o.cut1 || o.cut0 || 1200) * 0.7, 'exp']]);
      const g = E.gain(0);
      const pts = [[0, 0], [att, vel, o.attShape || 'lin']];
      if (hold > att) pts.push([hold, vel * (o.sus === undefined ? 1 : o.sus), 'lin']);
      pts.push([len, 0, 'lin']);
      V.env(g.gain, pts);
      lp.connect(g);
      E.out(g, o.bus || 'pad', o);
      const per = 1 / Math.sqrt(notes.length * 2);
      notes.forEach((nm, i) => {
        const f = hz(nm);
        const sides = o.sine ? [0] : [-1, 1];
        for (const side of sides) {
          const s = E.osc(o.sine ? 'sine' : E.warmSaw, f);
          s.detune.value = side * (o.detune || 8) + (i % 2 ? 1.5 : -1.5);
          const sg = E.gain(per * (o.sine ? 1.4 : 1));
          const p = E.panner(side * (o.width === undefined ? 0.55 : o.width) * (i % 2 ? 0.8 : 1));
          s.connect(sg);
          sg.connect(p);
          p.connect(lp);
          V.osc(s);
        }
      });
    };

    // Sub bass: sine with a little 2nd and 3rd harmonic so it survives small speakers.
    I.sub = (t0, t1, note, vel, o) => {
      o = o || {};
      const att = Math.min(o.att === undefined ? 0.008 : o.att, t1 - t0);
      const rel = o.rel === undefined ? 0.06 : o.rel;
      const hold = t1 - t0;
      const len = hold + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const f = hz(note);
      const g = E.gain(0);
      const pts = [[0, 0], [att, vel, o.attShape || 'lin']];
      if (hold > att) pts.push([hold, vel * (o.sus === undefined ? 0.85 : o.sus), 'lin']);
      pts.push([len, 0, 'lin']);
      V.env(g.gain, pts);
      const lp = E.filt('lowpass', 420, 0.5);
      for (const [k, a] of [
        [1, 1],
        [2, 0.3],
        [3, 0.1],
      ]) {
        const s = E.osc('sine', f * k);
        const sg = E.gain(a);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'bass');
    };

    // Sub drop: a sine sweeping down under a hit.
    I.subDrop = (t, f0, f1, len, vel) => {
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [len * 0.5, vel * 0.7, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'bass');
      V.osc(s);
    };

    // Warm pluck: warm saw plus soft square an octave up, a fast lowpass sweep.
    I.pluck = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      const dec = o.dec || 0.8;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', 2000, o.q || 1.2);
      const top = Math.min(11000, f * (o.bright || 9));
      V.env(lp.frequency, [[0, top], [0.16, Math.max(180, f * 1.8), 'exp'], [dec, Math.max(150, f * 1.2), 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.14, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      const a = E.osc(E.warmSaw, f);
      a.detune.value = -5;
      const b = E.osc(E.softSquare, f * 2);
      b.detune.value = 6;
      const bg = E.gain(0.35);
      a.connect(lp);
      b.connect(bg);
      bg.connect(lp);
      lp.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(a);
      V.osc(b);
    };

    // FM boop with an upward bend (the molts).
    I.boop = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      const V = E.voice(t, 0.32, false);
      if (!V) return;
      const c = E.osc('sine', f * 0.8);
      V.env(c.frequency, [[0, f * 0.8], [0.06, f, 'exp']]);
      const m = E.osc('sine', f * 1.6);
      V.env(m.frequency, [[0, f * 1.6], [0.06, f * 2, 'exp']]);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 2.2], [0.14, f * 0.2, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [0.08, vel * 0.6, 'exp'], [0.3, FLOOR, 'exp']]);
      c.connect(g);
      E.out(g, 'keys', Object.assign({ room: 0.2 }, o));
      V.osc(c);
      V.osc(m);
    };

    // Detuned, band-passed saw stab.
    I.stab = (t, notes, vel, o) => {
      o = o || {};
      const len = o.len || 0.22;
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const bp = E.filt('bandpass', o.f || 1500, 1.4);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [len, FLOOR, 'exp']]);
      bp.connect(g);
      E.out(g, 'keys', o);
      for (const nm of notes) {
        for (const d of [-14, 14]) {
          const s = E.osc('sawtooth', hz(nm));
          s.detune.value = d;
          const sg = E.gain(0.5 / notes.length);
          s.connect(sg);
          sg.connect(bp);
          V.osc(s);
        }
      }
    };

    // Continuous FM lead with glides and delayed vibrato. phrase: [[t, note, glide]]
    I.lead = (phrase, tEnd, vel, o) => {
      o = o || {};
      const t0 = phrase[0][0];
      const rel = o.rel || 0.3;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const pitch = ctx.createConstantSource();
      const pp = [[0, hz(phrase[0][1])]];
      const vib = [[0, 0]];
      for (let i = 1; i < phrase.length; i++) {
        const dt = phrase[i][0] - t0;
        const gl = Math.max(0.005, phrase[i][2] || 0);
        pp.push([dt, hz(phrase[i - 1][1]), 'set']);
        pp.push([dt + gl, hz(phrase[i][1]), 'exp']);
      }
      for (let i = 0; i < phrase.length; i++) {
        const a = phrase[i][0] - t0;
        const b = (i + 1 < phrase.length ? phrase[i + 1][0] : tEnd + rel) - t0;
        const f = hz(phrase[i][1]);
        vib.push([a, 0, 'set']);
        if (b - a > 0.35) {
          vib.push([a + 0.18, 0, 'set']);
          vib.push([Math.min(b, a + 0.45), f * 0.008, 'lin']);
          vib.push([b, f * 0.008, 'lin']);
        }
      }
      V.env(pitch.offset, pp);
      const c = E.osc('sine', 0);
      const m = E.osc('sine', 0);
      const sub = E.osc('triangle', 0);
      pitch.connect(c.frequency);
      const mr = E.gain(1);
      pitch.connect(mr);
      mr.connect(m.frequency);
      const sr = E.gain(0.5);
      pitch.connect(sr);
      sr.connect(sub.frequency);
      const mg = E.gain(hz(phrase[0][1]) * 0.9);
      m.connect(mg);
      mg.connect(c.frequency);
      const lfo = E.osc('sine', 5.3);
      const vg = E.gain(0);
      V.env(vg.gain, vib);
      lfo.connect(vg);
      vg.connect(c.frequency);
      const lp = E.filt('lowpass', 3200, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.012, vel], [tEnd - t0, vel * 0.9, 'lin'], [len, 0, 'lin']]);
      const sg = E.gain(0.35);
      c.connect(lp);
      sub.connect(sg);
      sg.connect(lp);
      lp.connect(g);
      E.out(g, 'lead', o);
      V.osc(pitch);
      V.osc(c);
      V.osc(m);
      V.osc(sub);
      V.osc(lfo);
    };

    // Synth horn: two brass saws with a filter swell per note and a scoop into pitch.
    I.horn = (phrase, tEnd, vel, o) => {
      o = o || {};
      const t0 = phrase[0][0];
      const rel = 0.25;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const pitch = ctx.createConstantSource();
      const pp = [];
      const cut = [];
      phrase.forEach(([t, nm], i) => {
        const dt = t - t0;
        const f = hz(nm);
        if (i === 0) pp.push([0, f * 0.97]);
        else pp.push([dt, f * 0.97, 'set']);
        pp.push([dt + 0.07, f, 'exp']);
        cut.push([dt, 300, i === 0 ? 'lin' : 'set']);
        cut.push([dt + 0.16, 2400, 'exp']);
        cut.push([dt + 0.45, 1500, 'exp']);
      });
      cut[0] = [0, 300];
      V.env(pitch.offset, pp);
      const lp = E.filt('lowpass', 300, 1.1);
      V.env(lp.frequency, cut);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.06, vel], [tEnd - t0, vel, 'lin'], [len, 0, 'lin']]);
      for (const d of [-7, 7]) {
        const s = E.osc(E.brassSaw, 0);
        s.detune.value = d;
        pitch.connect(s.frequency);
        const sg = E.gain(0.5);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'lead', o);
      V.osc(pitch);
    };

    // Generic filtered noise: whooshes, sweeps, cracks, risers.
    // o: { type, f: env pts, q, amp: env pts, pan, panEnv, bus, sustain, stereo, sends }
    I.nz = (t, len, o) => {
      const V = E.voice(t, len, !!o.sustain);
      if (!V) return;
      const n = E.noise(V, ['nz', t, len, o.key || ''], !!o.stereo);
      const f = E.filt(o.type || 'bandpass', o.f[0][1], o.q || 0.8);
      V.env(f.frequency, o.f);
      const g = E.gain(0);
      V.env(g.gain, o.amp);
      n.connect(f);
      let last = f;
      if (o.type2) {
        const f2 = E.filt(o.type2, o.f2, o.q2 || 0.7);
        f.connect(f2);
        last = f2;
      }
      last.connect(g);
      let node = g;
      if (o.panEnv) {
        const p = E.panner(0);
        V.env(p.pan, o.panEnv);
        g.connect(p);
        node = p;
      }
      E.out(node, o.bus || 'sfx', o);
    };

    // A generated buffer played through an optional filter. make() builds the buffer only when the
    // voice is actually scheduled; secs must match its length.
    I.play = (t, secs, make, vel, o) => {
      o = o || {};
      const V = E.voice(t, secs + 0.01, o.sustain !== false);
      if (!V) return;
      const s = ctx.createBufferSource();
      s.buffer = make();
      let last = s;
      if (o.filt) {
        const f = E.filt(o.filt[0], o.filt[1], o.filt[2]);
        s.connect(f);
        last = f;
      }
      const g = E.gain(vel);
      last.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.buf(s, 0);
    };

    // Wing flutter: band-passed noise sweeping f0 to f1 with a flap on each listed offset.
    I.flutter = (t, len, flaps, o) => {
      const amp = [[0, 0]];
      const fl = o.floor || 0.08;
      flaps.forEach((dt, i) => {
        const pk = o.vel * (o.grow ? 0.6 + (0.4 * i) / Math.max(1, flaps.length - 1) : 1);
        amp.push([dt, amp.length > 1 ? o.vel * fl : 0, 'lin']);
        amp.push([dt + 0.008, pk, 'lin']);
        amp.push([dt + 0.06, o.vel * fl, 'exp']);
      });
      amp.push([len, FLOOR, 'exp']);
      I.nz(t, len, {
        type: 'bandpass',
        q: 1.1,
        f: [[0, o.f0], [len, o.f1, 'exp']],
        amp,
        panEnv: o.pan ? [[0, -o.pan], [len, o.pan, 'lin']] : null,
        bus: 'sfx',
        room: 0.25,
        key: 'flutter',
      });
    };

    I.chew = (t, vel, pan) =>
      I.nz(t, 0.02, { type: 'highpass', q: 0.7, f: [[0, 4200]], amp: perc(vel, 0.0008, 0.012), pan, key: 'chew' });

    I.plip = (t, f0, f1, vel, o) => {
      o = o || {};
      const V = E.voice(t, 0.14, false);
      if (!V) return;
      for (const [k, a] of [
        [1, 1],
        [2, 0.25],
      ]) {
        const s = E.osc('sine', f0 * k);
        V.env(s.frequency, [[0, f0 * k], [0.05, f1 * k, 'exp']]);
        const g = E.gain(0);
        V.env(g.gain, [[0, 0], [0.002, vel * a], [0.02, vel * a * 0.6, 'exp'], [0.12, FLOOR, 'exp']]);
        s.connect(g);
        E.out(g, 'sfx', Object.assign({ room: 0.2 }, o));
        V.osc(s);
      }
    };

    I.glide = (t, f0, f1, len, vel, o) => {
      o = o || {};
      const V = E.voice(t, len + 0.3, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [len, vel * 0.5, 'exp'], [len + 0.28, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.osc(s);
    };

    // Low whump for the wing pumps: a rising sine body plus a soft rising noise sweep.
    I.whump = (t, vel) => {
      const V = E.voice(t, 0.42, false);
      if (!V) return;
      const s = E.osc('sine', 55);
      V.env(s.frequency, [[0, 55], [0.14, 88, 'exp'], [0.4, 80, 'lin']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.006, vel], [0.12, vel * 0.7, 'exp'], [0.4, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'bass');
      V.osc(s);
      const h = E.osc('triangle', 110);
      V.env(h.frequency, [[0, 110], [0.14, 176, 'exp']]);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.25, 0.005, 0.18));
      h.connect(hg);
      E.out(hg, 'sfx');
      V.osc(h, 0.25);
      I.nz(t, 0.3, {
        type: 'bandpass',
        q: 1.5,
        f: [[0, 220], [0.26, 1500, 'exp']],
        amp: [[0, 0], [0.02, vel * 0.08], [0.2, vel * 0.18, 'lin'], [0.3, FLOOR, 'exp']],
        key: 'whump',
      });
    };

    I.whistle = (t, len, f0, f1, vel) => {
      const V = E.voice(t, len + 0.05, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.015, vel], [len, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'sfx', { hall: 0.15 });
      V.osc(s);
    };

    I.bleep = (t, f, vel) => {
      const V = E.voice(t, 0.07, false);
      if (!V) return;
      const s = E.osc('sine', f);
      const lp = E.filt('lowpass', 6500, 0.7);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.062, FLOOR, 'exp']]);
      s.connect(lp);
      lp.connect(g);
      E.out(g, 'sfx', { room: 0.15 });
      V.osc(s);
    };

    // Striated buzz: a rising saw, chopped at 30 Hz, through a feedback comb.
    I.buzz = (t, len, vel) => {
      const V = E.voice(t, len + 0.05, false);
      if (!V) return;
      const s = E.osc('sawtooth', 98);
      V.env(s.frequency, [[0, 98], [len, 196, 'exp']]);
      const chop = E.gain(0.5);
      const lfo = E.osc('square', 30);
      const lg = E.gain(0.45);
      lfo.connect(lg);
      lg.connect(chop.gain);
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.0034;
      const fb = E.gain(0.55);
      const bp = E.filt('bandpass', 1300, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.04, vel * 0.5], [len * 0.85, vel, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(chop);
      chop.connect(bp);
      chop.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(bp);
      bp.connect(g);
      E.out(g, 'sfx', { hall: 0.25 });
      V.osc(s);
      V.osc(lfo);
    };

    // Reverse swell: noise rising exponentially into a hard stop at t + len.
    I.revSwell = (t, len, vel, o) => {
      o = o || {};
      const hi = o.hi || false;
      I.nz(t, len, {
        type: hi ? 'highpass' : 'lowpass',
        q: 0.7,
        f: hi ? [[0, 9000], [len, 3500, 'exp']] : [[0, 400], [len, o.fTop || 3500, 'exp']],
        type2: hi ? 'peaking' : null,
        f2: 9500,
        amp: [[0, vel * 0.004], [len - 0.012, vel, 'exp'], [len, FLOOR, 'lin']],
        stereo: true,
        sustain: true,
        bus: o.bus || 'sfx',
        hall: o.hall || 0.2,
        key: 'rev',
      });
    };

    // Stereo wind bed: wide noise through a slowly wandering band-pass. amp: env pts.
    I.wind = (t0, t1, amp, o) => {
      o = o || {};
      const len = t1 - t0;
      const f = [[0, 700]];
      for (let k = 1; k * 0.25 < len; k++) f.push([k * 0.25, 650 + 380 * lib.noise1(k * 0.23 + t0, 'film-wind'), 'lin']);
      I.nz(t0, len, { type: 'bandpass', q: 0.45, f, type2: 'lowpass', f2: o.lp || 2600, amp, stereo: true, sustain: true, bus: 'amb', key: 'wind' });
    };

    return I;
  }

  // ---------------------------------------------------------------- grain textures
  function flapGrains(r, t0, len, rate, o) {
    const out = [];
    const n = Math.floor(len * rate);
    for (let i = 0; i < n; i++) {
      const t = t0 + r() * len;
      out.push({
        t,
        dur: 0.05 + r() * 0.05,
        amp: (o.amp || 0.3) * (0.4 + 0.6 * r()),
        pan: (r() * 2 - 1) * (o.width || 0.9),
        f: (o.f0 || 380) + r() * (o.f1 || 1200),
        q: 0.9,
        att: 0.008 + r() * 0.008,
        dec: 0.02 + r() * 0.02,
      });
    }
    return out;
  }
  function clickGrains(r, t0, len, count, o) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const u = o.shape ? Math.pow(r(), o.shape) : r();
      out.push({
        t: t0 + u * len,
        dur: 0.008,
        amp: (o.amp || 0.3) * (0.3 + 0.7 * r()),
        pan: (r() * 2 - 1) * (o.width || 0.9),
        f: (o.f0 || 3000) + r() * (o.f1 || 5000),
        q: o.q || 1.2,
        att: 0.0004,
        dec: o.dec || 0.0015,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- the score
  // OktoberFESB 2026: a Bb-major oom-pah polka (bars 1-8), a salsa vamp in G minor — Bb's relative
  // minor, same key signature, so the return feels natural — (bars 9-14), then the polka reprise
  // back in Bb (bars 15-18). Chord tones for the comping instruments (tuba root/fifth is derived
  // from the chord's own outer notes).
  const CH = {
    I: ['Bb2', 'D3', 'F3'],
    IV: ['Eb3', 'G3', 'Bb3'],
    V: ['F3', 'A3', 'C4', 'Eb4'],
    gi: ['G3', 'Bb3', 'D4'],
    gVII: ['F3', 'A3', 'C4'],
    gVI: ['Eb3', 'G3', 'Bb3'],
    gV: ['D3', 'F#3', 'A3', 'C4'],
  };
  const ROOT = { I: 'Bb1', IV: 'Eb2', V: 'F1', gi: 'G1', gVII: 'F1', gVI: 'Eb1', gV: 'D1' };
  const FIFTH = { I: 'F2', IV: 'Bb2', V: 'C2', gi: 'D2', gVII: 'C2', gVI: 'Bb1', gV: 'A1' };

  function score(E, I) {
    const { kick, hat, crash, shaker, glass, fmBell, glock, tock, nz, sub, pluck, revSwell, glide } = I;
    const bpm = (FILM.TIMELINE && FILM.TIMELINE.bpm) || 120;
    const BEAT = 60 / bpm; // 0.5 s
    const EIGHTH = BEAT / 2; // 0.25 s
    const SIXTEENTH = BEAT / 4; // 0.125 s

    // ---- bespoke voices for this film (built from the shared engine primitives) ----

    // Tuba: sine fundamental plus a filtered, slightly detuned saw for grit, through a low-passed
    // "oom-pah" envelope; a soft valve click gives short notes a clean attack for onset detection.
    function tuba(t, note, dur, vel) {
      const f = hz(note);
      const V = E.voice(t, dur + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', 480, 0.7);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.01, vel], [dur * 0.55, vel * 0.6, 'exp'], [dur, FLOOR, 'exp']]);
      const s = E.osc('sine', f);
      const sg = E.gain(0.75);
      s.connect(sg);
      sg.connect(lp);
      const w = E.osc('sawtooth', f);
      w.detune.value = -6;
      const wg = E.gain(0.4);
      w.connect(wg);
      wg.connect(lp);
      lp.connect(g);
      E.out(g, 'bass');
      V.osc(s);
      V.osc(w);
      const n = E.noise(V, ['tuba', t]);
      const nf = E.filt('bandpass', 900, 1.4);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.15, 0.001, 0.02));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, 'bass');
    }

    // Accordion: two detuned soft-square voices and two detuned warm-saw voices per chord tone,
    // through a band-pass, with a slow vibrato (an LFO added into each oscillator's detune) that
    // swells in after the attack.
    function accordion(t, notes, dur, vel, o) {
      o = o || {};
      const V = E.voice(t, dur + 0.08, false);
      if (!V) return;
      const bp = E.filt('bandpass', o.f || 1000, 0.85);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.015, vel], [dur * 0.65, vel * 0.6, 'exp'], [dur, FLOOR, 'exp']]);
      const lfo = E.osc('sine', 5.4);
      const vg = E.gain(0);
      V.env(vg.gain, [[0, 0], [0.12, 0], [Math.max(0.22, dur * 0.6), 5.5], [dur, 5.5]]);
      lfo.connect(vg);
      V.osc(lfo);
      const per = 0.5 / notes.length;
      notes.forEach((nm) => {
        const f = hz(nm);
        [[E.softSquare, -8], [E.softSquare, 8], [E.warmSaw, -3], [E.warmSaw, 3]].forEach(([wave, d]) => {
          const s = E.osc(wave, f);
          s.detune.value = d;
          vg.connect(s.detune);
          const sg = E.gain(per);
          s.connect(sg);
          sg.connect(bp);
          V.osc(s);
        });
      });
      bp.connect(g);
      E.out(g, 'keys', Object.assign({ room: 0.12 }, o));
    }

    // Clarinet: a filtered-square lead voice, one oscillator per note (legato phrase built from
    // discrete notes), with a light vibrato that grows in on held notes.
    function clarinet(t, note, dur, vel, o) {
      o = o || {};
      const f = hz(note);
      const rel = Math.min(0.08, dur * 0.3);
      const V = E.voice(t, dur + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', o.cut || 2100, 2.1);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.018, vel], [Math.max(0.02, dur - rel), vel * 0.92, 'lin'], [dur, FLOOR, 'exp']]);
      const s = E.osc(E.softSquare, f);
      const lfo = E.osc('sine', 5.6);
      const vg = E.gain(0);
      V.env(vg.gain, dur > 0.3 ? [[0, 0], [0.22, 0], [dur, f * 0.006]] : [[0, 0], [dur, 0]]);
      lfo.connect(vg);
      vg.connect(s.frequency);
      s.connect(lp);
      lp.connect(g);
      E.out(g, 'lead', Object.assign({ hall: 0.18 }, o));
      V.osc(s);
      V.osc(lfo);
    }

    // Brass stab: detuned brass-saw pairs per note through a low-pass whose cutoff snaps open on
    // the attack and settles — the filter envelope that gives it its "stab" character.
    function brass(t, notes, dur, vel, o) {
      o = o || {};
      const bright = o.bright || 3200;
      const V = E.voice(t, dur + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', 260, 1.1);
      V.env(lp.frequency, [[0, 260], [Math.min(0.05, dur * 0.3), bright, 'exp'], [dur, Math.max(500, bright * 0.35), 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.006, vel], [dur * 0.7, vel * 0.75, 'exp'], [dur, FLOOR, 'exp']]);
      notes.forEach((nm) => {
        const f = hz(nm);
        [-8, 8].forEach((d) => {
          const s = E.osc(E.brassSaw, f);
          s.detune.value = d;
          const sg = E.gain(0.5 / notes.length);
          s.connect(sg);
          sg.connect(lp);
          V.osc(s);
        });
      });
      lp.connect(g);
      E.out(g, 'lead', Object.assign({ hall: 0.2 }, o));
    }

    // Snare: a band-passed noise body, a high-passed snap, and a small tonal thump.
    function snare(t, vel) {
      const V = E.voice(t, 0.16, false);
      if (!V) return;
      const n = E.noise(V, ['snare', t]);
      const bp = E.filt('bandpass', 1800, 0.9);
      const hpf = E.filt('highpass', 3200, 0.7);
      const g1 = E.gain(0);
      V.env(g1.gain, perc(vel, 0.001, 0.09));
      const g2 = E.gain(0);
      V.env(g2.gain, perc(vel * 0.7, 0.0008, 0.055));
      n.connect(bp);
      bp.connect(g1);
      n.connect(hpf);
      hpf.connect(g2);
      E.out(g1, 'drums');
      E.out(g2, 'drums');
      const s = E.osc('sine', 195);
      V.env(s.frequency, [[0, 195], [0.05, 140, 'exp']]);
      const gs = E.gain(0);
      V.env(gs.gain, perc(vel * 0.35, 0.001, 0.045));
      s.connect(gs);
      E.out(gs, 'drums');
      V.osc(s, 0.06);
    }

    // Shared "sine with a pitch drop, plus a bandpassed slap" body for congas and toms.
    function tonedHit(t, vel, f0, f1, dec, bus, pan) {
      const V = E.voice(t, dec + 0.04, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [dec * 0.4, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.002, dec));
      s.connect(g);
      E.out(g, bus, { pan });
      V.osc(s);
      const n = E.noise(V, ['tonedhit', t, f0]);
      const f = E.filt('bandpass', Math.min(9000, f0 * 6), 1.3);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.3, 0.0006, 0.015));
      n.connect(f);
      f.connect(ng);
      E.out(ng, bus, { pan });
    }
    const CONGA = { open: [220, 150, 0.16], muff: [260, 190, 0.07] };
    const conga = (t, vel, tone) => tonedHit(t, vel, CONGA[tone][0], CONGA[tone][1], CONGA[tone][2], 'perc', 0.1);
    const tom = (t, vel, hi) => tonedHit(t, vel, hi ? 190 : 140, hi ? 110 : 85, 0.14, 'drums', 0);

    // Cowbell: two square partials (540 / 800 Hz) through a band-pass tuned between them.
    function cowbell(t, vel) {
      const V = E.voice(t, 0.2, false);
      if (!V) return;
      const bp = E.filt('bandpass', 660, 3.2);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, 0.13));
      [540, 800].forEach((f) => {
        const s = E.osc('square', f);
        const sg = E.gain(0.5);
        s.connect(sg);
        sg.connect(bp);
        V.osc(s, 0.15);
      });
      bp.connect(g);
      E.out(g, 'perc', { pan: -0.15 });
    }

    // Montuno piano: a triangle fundamental plus a fast-decaying sine octave.
    function piano(t, note, vel, dur) {
      const f = hz(note);
      const V = E.voice(t, dur + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', 3500, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [dur * 0.5, vel * 0.35, 'exp'], [dur, FLOOR, 'exp']]);
      const s = E.osc('triangle', f);
      const sg = E.gain(0.8);
      s.connect(sg);
      sg.connect(lp);
      const h = E.osc('sine', f * 2);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.25, 0.001, dur * 0.3));
      h.connect(hg);
      lp.connect(g);
      E.out(g, 'keys', { room: 0.08 });
      E.out(hg, 'keys', { room: 0.08 });
      V.osc(s);
      V.osc(h);
    }

    // Clave: a short high sine plus a click (the engine's woodblock voice, retuned).
    const clave = (t, vel) => tock(t, vel, 2500, { dec: 0.04, bus: 'perc', pan: 0.15 });
    const up = (n) => n.replace(/(-?\d)$/, (d) => String(Number(d) + 1));

    // One bar of oom-pah: tuba on 1 and 3 (root, then the chord's fifth), accordion chord stabs
    // and snare on the off-beats 2 and 4; a soft closed-hat 8th pulse fills the tutti bars.
    function polkaBar(t0, chord, o) {
      o = o || {};
      const vel = o.vel || 0.5;
      const tutti = !!o.tutti;
      tuba(t0, ROOT[chord], 0.85, vel);
      tuba(t0 + BEAT, FIFTH[chord], 0.85, vel * 0.92);
      accordion(t0 + BEAT * 0.5, CH[chord], 0.42, vel * (tutti ? 0.62 : 0.4));
      accordion(t0 + BEAT * 1.5, CH[chord], 0.42, vel * (tutti ? 0.62 : 0.4));
      snare(t0 + BEAT * 0.5, vel * (tutti ? 0.55 : 0.28));
      snare(t0 + BEAT * 1.5, vel * (tutti ? 0.55 : 0.28));
      if (tutti) for (let i = 0; i < 8; i++) hat(t0 + i * EIGHTH, i % 2 ? 0.07 : 0.05);
    }

    // ================================================================ Act 1: polka (bars 1-8, 0-16 s)

    // T 0.0-1.75: eight rising test-tick blips on 8ths, plus a soft tuba pickup and two pizzicato ticks.
    ['C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6', 'C7'].forEach((n, i) => I.bleep(i * EIGHTH, hz(n), 0.32));
    tuba(0.0, 'Bb1', 1.8, 0.12);
    pluck(0.5, 'F2', 0.16, { dec: 0.3, bus: 'bass', bright: 5 });
    pluck(1.25, 'Bb2', 0.16, { dec: 0.3, bus: 'bass', bright: 5 });

    // T 2.0: the groove starts underneath (quiet); T 6.0: full tutti. I-V-I-IV-I-V-I.
    const POLKA_BARS = [
      { t: 2, ch: 'I', tutti: false },
      { t: 4, ch: 'V', tutti: false },
      { t: 6, ch: 'I', tutti: true },
      { t: 8, ch: 'IV', tutti: true },
      { t: 10, ch: 'I', tutti: true },
      { t: 12, ch: 'V', tutti: true },
      { t: 14, ch: 'I', tutti: true },
    ];
    POLKA_BARS.forEach((b) => polkaBar(b.t, b.ch, { vel: b.tutti ? 0.62 : 0.32, tutti: b.tutti }));

    // T 2.5: Deploy — thunk, crash, brass stab; confetti ticks on 16ths to T 3.0. T 3.0: caption bell.
    kick(2.5, 0.95, 'full');
    crash(2.5, 0.85, { dec: 1.3 });
    brass(2.5, CH.V, 0.35, 0.75);
    for (let i = 0; i < 4; i++) shaker(2.5 + i * SIXTEENTH, 0.28 - i * 0.03);
    fmBell(3.0, hz('C6'), 0.55, { ratio: 2, index: 2.2, dec: 0.7, bus: 'bells' });

    // T 4.0-5.0: pour (rising band-pass sweep) with a ratchet tick every 0.1 s. T 5.0: cork pop.
    nz(4.0, 1.0, { type: 'bandpass', q: 1.0, f: [[0, 300], [1.0, 3000, 'exp']], amp: [[0, 0.001], [0.05, 0.32], [1.0, 0.5, 'exp']], bus: 'sfx', key: 'pour' });
    for (let i = 0; i < 10; i++) tock(4.0 + i * 0.1, 0.22, 1100 + i * 90, { dec: 0.02, bus: 'sfx' });
    I.chew(5.0, 0.55, 0);
    tonedHit(5.0, 0.45, 900, 320, 0.05, 'sfx', 0);

    // T 5.5-6.0: foam fizz swelling into a whoosh to the cut (a shaker seeds the onset at 5.5).
    shaker(5.5, 0.32);
    revSwell(5.5, 0.5, 0.75, { hi: false, fTop: 3200, bus: 'sfx', hall: 0.25 });

    // T 6.0: full polka tutti, clarinet melody. The catchy hook (T 6.0-14.5).
    crash(6.0, 0.85, { dec: 1.6 });
    const HOOK = [
      [6.0, 'D5', 0.45, 0.55], [6.5, 'F5', 0.45, 0.6], [7.0, 'Bb5', 0.45, 0.68], [7.5, 'A5', 0.22, 0.55], [7.75, 'G5', 0.22, 0.5],
      [8.0, 'F5', 0.45, 0.55], [8.5, 'Eb5', 0.45, 0.55], [9.0, 'D5', 0.45, 0.5], [9.5, 'C5', 0.22, 0.5], [9.75, 'D5', 0.22, 0.55],
      [10.0, 'D5', 0.22, 0.5], [10.25, 'F5', 0.22, 0.55], [10.5, 'A5', 0.22, 0.6], [10.75, 'Bb5', 0.22, 0.65],
      [11.0, 'A5', 0.22, 0.58], [11.25, 'G5', 0.22, 0.52], [11.5, 'F5', 0.22, 0.5], [11.75, 'D5', 0.22, 0.48],
      [12.0, 'D5', 0.45, 0.55], [12.5, 'F5', 0.45, 0.6], [13.0, 'Bb5', 0.45, 0.68], [13.5, 'C5', 0.22, 0.55], [13.75, 'A4', 0.22, 0.5],
      [14.0, 'D5', 0.5, 0.6],
    ];
    HOOK.forEach(([t, n, d, v]) => clarinet(t, n, d, v));

    // T 7.0: caption bell. T 8.0: glass ping (3.2 kHz).
    fmBell(7.0, hz('C6'), 0.5, { ratio: 2, index: 2.2, dec: 0.7, bus: 'bells' });
    glass(8.0, 3200, 0.5, { dec: 0.4, bus: 'bells' });

    // T 8.5-10: blueprint 1 — FM-bell sparkle arpeggio plus label blips on 8ths; T 9.5: queue slide blip.
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => fmBell(8.5 + i * SIXTEENTH, hz(n), 0.4, { ratio: 2.4, index: 2, dec: 0.5, bus: 'bells' }));
    [['C6', 8.5], ['D6', 8.75], ['E6', 9.0], ['F6', 9.25], ['G6', 9.75]].forEach(([n, t]) => I.bleep(t, hz(n), 0.24));
    I.plip(9.5, 1800, 2600, 0.4, { bus: 'sfx' });

    // T 10.0-12.5: footsteps on the beats (wooden thumps), glass clinks on the 8ths between.
    [10.0, 10.5, 11.0, 11.5, 12.0].forEach((t) => tock(t, 0.42, 110, { dec: 0.09, bus: 'perc' }));
    [10.25, 10.75, 11.25, 11.75, 12.25].forEach((t) => glass(t, 2800, 0.3, { dec: 0.3, bus: 'bells' }));

    // T 12.5-14: blueprint 2 sparkle; T 12.75-13.5: ten rising blips; T 13.75: success chime.
    ['D6', 'F6', 'A6', 'D7'].forEach((n, i) => fmBell(12.5 + i * SIXTEENTH, hz(n), 0.4, { ratio: 2.4, index: 2, dec: 0.5, bus: 'bells' }));
    for (let i = 0; i < 10; i++) I.bleep(12.75 + i * (0.75 / 9), hz('C6') * Math.pow(2, i / 12), 0.26 + i * 0.02);
    glock(13.75, hz('Bb5'), 0.5, { dec: 1.0, bus: 'bells' });
    glock(13.85, hz('D6'), 0.45, { dec: 0.9, bus: 'bells' });
    glock(13.95, hz('F6'), 0.45, { dec: 0.9, bus: 'bells' });

    // T 14.25: pork knuckle thud. T 14.5: glass set down.
    kick(14.25, 0.9, 'thud');
    glass(14.5, 1600, 0.42, { dec: 0.35, bus: 'bells' });

    // T 15.0: Prost clink — detuned glass pings, brass "hey" stab, cymbal.
    [2400, 2430, 2460, 2500].forEach((f, i) => glass(15.0, f, 0.42, { dec: 0.9, bus: 'bells', pan: -0.3 + i * 0.2 }));
    brass(15.0, CH.I, 0.5, 0.85);
    accordion(15.0, CH.I, 0.5, 0.5);
    crash(15.0, 0.8, { dec: 1.4 });

    // T 15.5-16.0: drum fill into the change.
    [15.5, 15.625, 15.75, 15.875].forEach((t, i) => snare(t, 0.4 + i * 0.12));

    // T 16.0: record scratch into the salsa downbeat. T 16.25: head-gleam shimmer.
    nz(16.0, 0.15, { type: 'bandpass', q: 3, f: [[0, 1200], [0.05, 420, 'exp'], [0.1, 1500, 'exp'], [0.15, 320, 'exp']], amp: [[0, 0], [0.006, 0.5], [0.08, 0.28], [0.15, FLOOR]], bus: 'sfx' });
    fmBell(16.25, hz('A5'), 0.4, { ratio: 2.1, index: 2.5, dec: 0.8, bus: 'bells' });
    I.bleep(16.3, hz('E6'), 0.24);

    // ================================================================ Act 2: salsa (bars 9-14, 16-28 s)
    // G minor — Bb major's relative minor — i-bVII-bVI-V7 vamp: clave 3-2, conga tumbao, cowbell on
    // the beat, an anticipated ("anticipada") tumbao bass, a syncopated piano montuno, brass punches.
    const SALSA_CHORDS = ['gi', 'gVII', 'gVI', 'gV', 'gi', 'gV'];
    const MONTUNO_POS = [1, 3, 4, 6, 8, 9, 11, 13];
    const MONTUNO_DEG = [1, 2, 0, 1, 2, 0, 1, 2];
    SALSA_CHORDS.forEach((chord, idx) => {
      const t0 = 16 + idx * 2;
      const nextChord = SALSA_CHORDS[(idx + 1) % SALSA_CHORDS.length];
      const claveHits = idx % 2 === 0 ? [0, 0.75, 1.5] : [0.5, 1.25]; // 3-side then 2-side
      claveHits.forEach((o) => clave(t0 + o, 0.55));
      conga(t0 + 0.25, 0.26, 'muff');
      conga(t0 + 0.75, 0.55, 'open');
      conga(t0 + 1.5, 0.55, 'open');
      conga(t0 + 1.75, 0.26, 'muff');
      [0, 0.5, 1.0, 1.5].forEach((o) => cowbell(t0 + o, 0.4));
      sub(t0 + 0.5, t0 + 0.5 + 0.45, ROOT[chord], 0.55, { att: 0.006, rel: 0.05 });
      sub(t0 + 1.75, t0 + 1.75 + 0.65, ROOT[nextChord], 0.5, { att: 0.006, rel: 0.05 }); // anticipated bass
      MONTUNO_POS.forEach((p, i) => piano(t0 + p * SIXTEENTH, up(CH[chord][MONTUNO_DEG[i]]), 0.16, 0.3));
      brass(t0, CH[chord], 0.16, 0.5);
      if (idx % 2 === 1) brass(t0 + 1.0, CH[chord], 0.14, 0.45);
    });

    // T 18.5-22.0: fifteen throw whooshes on 8ths; T 19.0-22.5: fifteen catch flaps on 8ths.
    for (let i = 0; i < 15; i++) {
      nz(18.5 + i * EIGHTH, 0.16, { type: 'bandpass', q: 0.9, f: [[0, 2600], [0.15, 700, 'exp']], amp: perc(0.34, 0.006, 0.11), bus: 'sfx', pan: i % 2 ? 0.3 : -0.3 });
    }
    for (let i = 0; i < 15; i++) {
      nz(19.0 + i * EIGHTH, 0.09, { type: 'highpass', f: [[0, 1800]], amp: perc(0.3, 0.004, 0.05), bus: 'sfx', pan: i % 2 ? -0.2 : 0.2 });
    }

    // T 23.0-23.875: eight rising brass stabs on 16ths. T 24.0: the full brass hit.
    const TURN_BASE = CH.gVII.map(hz);
    for (let i = 0; i < 8; i++) brass(23.0 + i * SIXTEENTH, TURN_BASE.map((f) => f * Math.pow(2, i / 12)), 0.13, 0.4 + i * 0.06);
    brass(24.0, CH.gi, 0.5, 0.9);
    tuba(24.0, 'G1', 0.5, 0.75);
    crash(24.0, 0.9, { dec: 1.6 });

    // T 25.5-27.0: rising whoosh glissando while the foam draws the 9 (ends just shy of 27.0 so the
    // sparkle hit reads as a clean new onset rather than a continuation of the glissando's tail).
    shaker(25.5, 0.3);
    glide(25.5, 300, 3400, 1.42, 0.55, { bus: 'sfx' });
    revSwell(25.5, 1.42, 0.45, { hi: true, bus: 'sfx' });

    // T 27.0: sparkle hit and brass fall on the finished 9.
    glass(27.0, 2600, 0.55, { dec: 0.5, bus: 'bells' });
    fmBell(27.0, hz('C6'), 0.6, { ratio: 2, index: 2.2, dec: 0.8, bus: 'bells' });
    I.horn([[27.0, 'Bb4'], [27.35, 'F4']], 27.55, 0.6, {});

    // T 27.5-28.0: snare roll into the polka reprise.
    for (let i = 0; i < 8; i++) snare(27.5 + i * 0.0625, 0.32 + i * 0.06);

    // ================================================================ Act 3: polka reprise (bars 15-18, 28-36 s)
    crash(28.0, 0.85, { dec: 1.5 });
    polkaBar(28.0, 'I', { vel: 0.62, tutti: true });
    polkaBar(30.0, 'V', { vel: 0.62, tutti: true });
    [[28.0, 'D5', 0.45, 0.6], [28.5, 'F5', 0.45, 0.62], [29.0, 'Bb5', 0.45, 0.7], [29.5, 'A5', 0.22, 0.55], [29.75, 'G5', 0.22, 0.5]].forEach(
      ([t, n, d, v]) => clarinet(t, n, d, v)
    );

    // T 30.0-30.5: whoosh rising into the cut. T 30.5: crash and brass tutti on the logo.
    shaker(30.0, 0.32);
    revSwell(30.0, 0.5, 0.7, { hi: true, bus: 'sfx' });
    crash(30.5, 0.9, { dec: 1.8 });
    brass(30.5, CH.V, 0.6, 0.85);
    tuba(30.5, 'F1', 0.6, 0.7);

    // T 32.0-32.5: letter-slam tom hits on 16ths.
    [32.0, 32.125, 32.25, 32.375].forEach((t, i) => tom(t, 0.5 + i * 0.1, i >= 2));

    // T 33.0: the big "Prost!" brass chord.
    brass(33.0, ['Bb3', 'D4', 'F4', 'Bb4'], 1.3, 0.95);
    tuba(33.0, 'Bb1', 1.3, 0.8);
    accordion(33.0, CH.I, 1.3, 0.55);
    crash(33.0, 0.9, { dec: 1.8 });
    glock(33.05, hz('Bb5'), 0.4, { dec: 1.4, bus: 'bells' });

    // T 34.0: a short passing dominant on the way to the final chord.
    brass(34.0, CH.V, 0.4, 0.5);
    tuba(34.0, 'F1', 0.4, 0.45);

    // T 35.0: the final chord, ringing out to T 36.0 (the master ride and the engine's output
    // fade take it to silence exactly at the end).
    brass(35.0, ['Bb3', 'D4', 'F4', 'Bb4'], 1.0, 1.0);
    tuba(35.0, 'Bb1', 1.0, 0.85);
    accordion(35.0, CH.I, 1.0, 0.55);
    crash(35.0, 0.85, { dec: 1.5 });
    glock(35.05, hz('Bb5'), 0.45, { dec: 1.6, bus: 'bells' });
    glock(35.1, hz('D6'), 0.4, { dec: 1.5, bus: 'bells' });
  }

  FILM.audio = {
    render(ctx, opts) {
      const o = opts || {};
      const start = Math.max(0, Number(o.start) || 0);
      const dest = o.dest || ctx.destination;
      const DUR = (FILM.TIMELINE && FILM.TIMELINE.duration) || FILM.DURATION || 32;
      // opts.mix overrides the mix constants (bus gains, trim); the analysis tools use it for solo renders.
      const om = o.mix || {};
      const mix = Object.assign({}, MIX, om, {
        bus: Object.assign({}, MIX.bus, om.bus || {}),
        eq: Object.assign({}, MIX.eq, om.eq || {}),
        comp: Object.assign({}, MIX.comp, om.comp || {}),
      });
      const E = makeEngine(ctx, start, dest, DUR, mix);
      const I = instruments(E);
      // The score is scheduled one bar at a time, so the audio graph only ever holds the voices of
      // the next few seconds. Each voice belongs to exactly one bar by its start time, so the output
      // is the same as scheduling everything at once. The first bar also takes every earlier voice
      // still sounding at `start`.
      const BAR = 240 / ((FILM.TIMELINE && FILM.TIMELINE.bpm) || 120);
      const first = Math.floor(start / BAR);
      const last = Math.ceil(DUR / BAR) - 1;
      const run = (k) => {
        E.w0 = k === first ? -Infinity : k * BAR;
        E.w1 = k === last ? Infinity : (k + 1) * BAR;
        score(E, I);
      };
      const due = (k) => E.base + (k * BAR - start) - LAT; // context time of bar k's first event
      run(first);
      let k = first + 1;
      const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
      if (isOffline && typeof ctx.suspend !== 'function') {
        // An offline context that cannot pause mid-render gets every bar up front.
        for (; k <= last; k++) run(k);
      } else if (isOffline) {
        // Offline: pause the render 0.25 s before each bar, schedule it, resume.
        const q = 128 / ctx.sampleRate;
        const end = ctx.length / ctx.sampleRate;
        for (; k <= last; k++) {
          const j = k;
          const when = Math.floor((due(j) - 0.25) / q) * q;
          if (when >= end - q) break; // this bar starts after the render window ends
          let paused = null;
          if (when > ctx.currentTime + q) {
            try {
              paused = ctx.suspend(when);
            } catch (e) {
              paused = null;
            }
          }
          if (!paused) run(j);
          else
            paused.then(
              () => {
                run(j);
                ctx.resume();
              },
              () => run(j)
            );
        }
      } else {
        // Live: a look-ahead timer schedules each bar 1.5 s before it sounds.
        const AHEAD = 1.5;
        const pump = () => {
          while (k <= last && due(k) - ctx.currentTime < AHEAD) run(k++);
          return k <= last;
        };
        if (pump()) {
          const timer = setInterval(() => {
            if (ctx.state === 'closed' || !pump()) clearInterval(timer);
          }, 100);
        }
      }
    },
  };
})();
