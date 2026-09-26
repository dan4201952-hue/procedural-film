/*
 * 08-prost.js : "Pork knuckle and Prost!" — T 14.0 to 16.0 (t 0 to 2.0), illustrated, hard cuts on
 * both sides (no shared geometry to match).
 *
 * Layers back to front, all inside a 5% kick-zoom on the clink (the caption is screen-fixed):
 *   1. Warm close-table backdrop (a glimpse of bunting at the very top) and two static side dishes.
 *   2. The pork knuckle: mid-air at t 0, lands at (960,700) on T 14.25 with a squash and a gravy
 *      splash, carried by Resi's serveArm entering top-left, which withdraws (fades) after landing.
 *   3. The hero mug slides in and lands at x 1320 on T 14.5, sloshing as it settles.
 *   4. Six teammates (FILM.cast.person, upper body, pose 'reach') swing their mugs up from the
 *      table's near edge toward the centre above the knuckle, T 14.5 -> 15.0.
 *   5. The clink on T 15.0: a sparkle flash, a starburst of foam droplets and rising gold bubbles.
 * Caption "Prost!" (FILM.props.caption) pops on T 15.0, screen-fixed outside the kick-zoom so its
 * ink never drifts toward the safe-area edge.
 */
(function () {
  'use strict';
  const ID = 'prost';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const PR = FILM.props;
  const CAST = FILM.cast;
  const TAU2 = Math.PI * 2;
  const FRAME = 1 / 24;

  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;

  const T_KNUCKLE = 0.25; // T 14.25
  const T_MUG = 0.5; // T 14.5
  const T_CLINK = 1.0; // T 15.0
  const CLINK_X = 960, CLINK_Y = 470; // above the knuckle, where the six mugs meet

  let GEO = null;
  function geo() {
    if (GEO) return GEO;
    const REACH_X = [170, 490, 780, 1130, 1420, 1750];
    const rSeed = sd('reach');
    const reachers = REACH_X.map((x, i) => ({
      x,
      spec: CAST.TEAM[(i * 2 + 1) % CAST.TEAM.length],
      flip: i % 2 === 1,
      tilt: (LIB.h3(rSeed, i, 5) - 0.5) * 0.5,
      ph: LIB.h3(rSeed, i, 6) * 0.6,
    }));
    const gravySeed = sd('gravy');
    const gravy = [];
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * 0.62 + LIB.h3(gravySeed, i, 1) * Math.PI * 1.24;
      const v = 90 + LIB.h3(gravySeed, i, 2) * 220;
      gravy.push({ a, v, r: 3 + LIB.h3(gravySeed, i, 3) * 5, kraut: LIB.h3(gravySeed, i, 4) > 0.72 });
    }
    const burstSeed = sd('burst');
    const burst = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU2 + (LIB.h3(burstSeed, i, 1) - 0.5) * 0.5;
      const v = 160 + LIB.h3(burstSeed, i, 2) * 260;
      burst.push({ a, v, r: 3 + LIB.h3(burstSeed, i, 3) * 6, gold: LIB.h3(burstSeed, i, 4) > 0.45 });
    }
    GEO = { reachers, gravy, burst };
    return GEO;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, E = L.ease;
      const t = L.clamp(tIn, 0, info.dur);
      const clamp = L.clamp, lerp = L.lerp;
      const T = info.T;
      const G = geo();

      // decay(land, frames): 1 right at `land`, linearly down to 0 over `frames` frames — the shared
      // shape for a landing squash / a jump bump.
      const decay = (land, frames) => (t < land ? 0 : clamp(1 - (t - land) / (frames * FRAME)));
      const knuckleSquash = decay(T_KNUCKLE, 2);
      const jump = t < T_KNUCKLE ? 0 : Math.max(0, Math.sin(Math.PI * clamp((t - T_KNUCKLE) / (6 * FRAME))));

      // knuckle: mid-air at t 0, gravity-eases down, lands and stays at (960, 700)
      const knuckleY = t < T_KNUCKLE ? lerp(480, 700, E.inQuad(clamp(t / T_KNUCKLE))) : 700;
      const knuckleH = 440;

      // hero mug: slides in from the right, lands at (1320, 760) on T 14.5
      const mugP = E.outCubic(clamp((t - 0.3) / (T_MUG - 0.3)));
      const mugX = t < 0.3 ? 2050 : lerp(2050, 1320, mugP);
      const mugY = t < 0.3 ? 660 : lerp(660, 760, mugP);
      const mugSquash = decay(T_MUG, 2);
      const sloshEnv = t < T_MUG ? 0 : Math.exp(-7 * (t - T_MUG));
      const slosh = clamp(sloshEnv * Math.sin((t - T_MUG) * 42) * 0.85, -1, 1);

      // kick-zoom: 5% right on the clink beat, settling over 6 frames
      const zoomK = t < T_CLINK ? 0 : clamp(1 - (t - T_CLINK) / (6 * FRAME));
      const zoom = 1 + 0.05 * zoomK;

      L.camera(ctx, { x: 960, y: 540, zoom }, () => {
        // =====================================================================
        // 1. backdrop: warm close-table gradient, a glimpse of bunting, side dishes
        // =====================================================================
        const bg = ctx.createLinearGradient(0, 0, 0, 1080);
        bg.addColorStop(0, L.mix(P.hallDim, P.woodDeep, 0.35));
        bg.addColorStop(0.16, L.mix(P.woodMid, P.hallWarm, 0.25));
        bg.addColorStop(1, P.woodLight);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1920, 1080);
        // faint wood grain streaks
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = P.woodDeep;
        ctx.lineWidth = 3;
        const r = L.rng(sd('grain'));
        for (let i = 0; i < 10; i++) {
          const gy = 140 + i * 92 + r.range(-14, 14);
          ctx.beginPath();
          ctx.moveTo(-40, gy);
          ctx.bezierCurveTo(500, gy + r.range(-18, 18), 1400, gy + r.range(-18, 18), 1960, gy);
          ctx.stroke();
        }
        ctx.restore();
        PR.bunting(ctx, -80, 46, 2000, 46, 30, { t: T, seed: sd('bunt'), line: 'background' });

        ctx.save();
        ctx.translate(0, -10 * jump);
        PR.pretzel(ctx, 1660, 300, 210, { rot: 0.18, line: 'secondary', seed: sd('pretz') });
        ctx.restore();
        ctx.save();
        ctx.translate(0, -8 * jump);
        PR.sausages(ctx, 300, 940, 190, { rot: -0.08, line: 'secondary', seed: sd('saus') });
        ctx.restore();

        // =====================================================================
        // 2. the knuckle, carried in and set down by Resi's arm
        // =====================================================================
        const armFadeStart = 0.3, armFadeEnd = 0.56;
        const armAlpha = t < armFadeStart ? 1 : clamp(1 - (t - armFadeStart) / (armFadeEnd - armFadeStart));
        if (armAlpha > 0.01) {
          CAST.serveArm(ctx, 960, knuckleY, 2.9, { plate: 'knuckle', from: -2.4, alpha: armAlpha, line: 'secondary' });
        }
        PR.knuckle(ctx, 960, knuckleY, knuckleH, { squash: knuckleSquash, line: 'hero', seed: sd('knuckle') });

        // gravy splash at the landing instant
        if (t >= T_KNUCKLE) {
          const dt = t - T_KNUCKLE, life = 0.5;
          if (dt < life) {
            const fade = 1 - dt / life;
            ctx.save();
            ctx.globalAlpha = fade;
            for (const g of G.gravy) {
              const px = 960 + Math.cos(g.a) * g.v * dt;
              const py = 700 - 30 + Math.sin(g.a) * g.v * dt * 0.6 + 520 * dt * dt;
              ctx.fillStyle = g.kraut ? P.kraut : P.crust;
              ctx.beginPath();
              ctx.arc(px, py, Math.max(0.5, g.r * (1 - dt / life)), 0, TAU2);
              ctx.fill();
            }
            ctx.restore();
          }
        }

        // =====================================================================
        // 3. the hero mug, set down at the right
        // =====================================================================
        ctx.save();
        ctx.translate(mugX, mugY);
        ctx.scale(1 + 0.07 * mugSquash, 1 - 0.09 * mugSquash);
        ctx.translate(-mugX, -mugY);
        PR.mug(ctx, mugX, mugY, 460, {
          fill: 0.86, foam: 1.1, logo: true, bubbles: true, t: T, slosh, line: 'hero', seed: sd('heromug'),
        });
        ctx.restore();

        // =====================================================================
        // 4. six teammates swing their mugs up toward the centre
        // =====================================================================
        const reachK = clamp((t - T_MUG) / (T_CLINK - T_MUG));
        const swing = E.outBack(reachK);
        for (const rc of G.reachers) {
          const wobble = t >= T_CLINK ? 0.05 * Math.sin((t - T_CLINK) * 5 + rc.ph * 10) : 0;
          CAST.person(ctx, rc.spec, rc.x, 1000, 420, { name: 'reach', k: swing }, {
            upper: true, outfit: 'casual', flip: rc.flip, line: 'secondary',
            mug: { fill: 0.85, foam: 1.05, bubbles: true, t: T, tilt: rc.tilt + wobble },
          });
        }

        // =====================================================================
        // 5. the clink: sparkle flash, foam-and-gold starburst, rising bubbles
        // =====================================================================
        if (t >= T_CLINK) {
          const dt = t - T_CLINK;
          PR.sparkle(ctx, CLINK_X, CLINK_Y, 150, clamp(dt / 0.5 + 1 / 12)); // +lead: visible on the beat frame
          const life = 1.0;
          if (dt < life) {
            const fade = 1 - dt / life;
            ctx.save();
            ctx.globalAlpha = fade;
            for (const b of G.burst) {
              const px = CLINK_X + Math.cos(b.a) * b.v * dt;
              const py = CLINK_Y + Math.sin(b.a) * b.v * dt + 420 * dt * dt;
              if (b.gold) {
                ctx.fillStyle = P.gold;
                ctx.strokeStyle = P.goldDeep;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(px, py, Math.max(0.6, b.r * (1 - dt / life * 0.5)), 0, TAU2);
                ctx.fill();
                ctx.stroke();
              } else {
                ctx.fillStyle = P.foam;
                ctx.beginPath();
                ctx.arc(px, py, Math.max(0.6, b.r * (1 - dt / life * 0.5)), 0, TAU2);
                ctx.fill();
              }
            }
            ctx.restore();
          }
          PR.bubbles(ctx, sd('clinkbubbles'), dt, { x: CLINK_X - 160, y: CLINK_Y - 260, w: 320, h: 300 }, {
            count: 14, speed: 0.8, size: [5, 14],
          });
        }
      });

      // =========================================================================
      // caption "Prost!", screen-fixed outside the kick-zoom
      // =========================================================================
      if (t >= T_CLINK) {
        PR.caption(ctx, 'Prost!', 960, 260, 160, {
          align: 'center', style: 'gold', pop: clamp((t - T_CLINK) / (4 * FRAME) + 1 / 4), // +lead: visible on the beat frame
        });
      }
    },
  });
})();
