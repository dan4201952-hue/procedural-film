// Shot 13 'mug-camera', T 28.0-30.5 (illustrated).
// The mug comes to the camera: starts exactly on G3 (the chef's raised mug, the foam 9 fading on
// the left), then the mug approaches and grows until it exactly fills the frame at G4, handing off
// to 14's lockup pull-back. Layers back to front:
//   1. hall background + bunting + garland + the chef, all zoomed 1.0 -> 1.3 and falling out of frame
//   2. bubbles behind the mug
//   3. the fading foam "9" (G3's handoff from 12), screen-fixed
//   4. the hero mug, screen-fixed, growing from G3 to G4
//   5. a few large bubbles streaming past close to the camera
(function () {
  'use strict';
  const FILM = window.FILM;
  const ID = 'mug-camera';
  const LIB = FILM.lib;
  const TAU = LIB.TAU;

  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;

  // ---------------------------------------------------------------------------
  // Shared geometry (docs/storyboard.md): G3 (12 end / 13 start), G4 (13 end / 14 start).
  // G3 is the chef's raised mug: centred (1300, 330), height 200 -> base (1300, 430).
  // G4 is read off the mug's own logo anchor so it always lands the FESB logo exactly on
  // (960, 560) at size 400, per the storyboard, instead of a hand-copied number.
  // ---------------------------------------------------------------------------
  const G3 = { x: 1300, y: 430, h: 200 };
  const G4 = (() => {
    const probe = FILM.props.mug(null, 0, 0, 1000, { alpha: 0 }); // pure geometry, draws nothing
    const yFrac = probe.logo[1] / 1000, sFrac = probe.logo[2] / 1000;
    const h = 400 / sFrac;
    return { x: 960, y: 560 - yFrac * h, h };
  })();

  const clamp = LIB.clamp, lerp = LIB.lerp, smoothstep = LIB.smoothstep, E = LIB.ease;

  // A fading copy of 12's foam "9" (art bible: stroke 70 px of foam with gold bubbles), just enough
  // to hold the shape through the cut while it fades: not 12's stroke-by-stroke build, which 12 owns.
  function foamNine(ctx, P, cx, cy, h, alpha) {
    if (alpha <= 0.003) return;
    const w = h * 0.66;
    const sw = 70;
    const bowlR = h * 0.235;
    const bowlCx = cx + w * 0.03;
    const bowlCy = cy - h * 0.235;
    const a0 = -0.35, a1 = TAU - 0.95;
    const tailStart = [bowlCx + bowlR * Math.cos(a1), bowlCy + bowlR * Math.sin(a1)];
    const c1 = [tailStart[0] + h * 0.03, tailStart[1] + h * 0.22];
    const tailEnd = [cx - w * 0.07, cy + h * 0.46];
    const c2 = [tailEnd[0] + h * 0.16, tailEnd[1] - h * 0.2];
    const path = new Path2D();
    path.arc(bowlCx, bowlCy, bowlR, a0, a1, false);
    path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], tailEnd[0], tailEnd[1]);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = P.outline;
    ctx.lineWidth = sw + 8;
    ctx.stroke(path);
    const grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    grad.addColorStop(0, P.foam);
    grad.addColorStop(1, P.foamShade);
    ctx.strokeStyle = grad;
    ctx.lineWidth = sw;
    ctx.stroke(path);
    ctx.strokeStyle = LIB.rgba(P.gloss, 0.45);
    ctx.lineWidth = sw * 0.3;
    ctx.stroke(path);
    // a few gold bubbles along the stroke for texture (art bible 4)
    const bez = (t) => {
      const mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, cc = 3 * mt * t * t, d = t * t * t;
      return [a * tailStart[0] + b * c1[0] + cc * c2[0] + d * tailEnd[0], a * tailStart[1] + b * c1[1] + cc * c2[1] + d * tailEnd[1]];
    };
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = a0 + (a1 - a0) * (0.15 + 0.7 * (i / 3));
      pts.push([bowlCx + Math.cos(a) * bowlR, bowlCy + Math.sin(a) * bowlR]);
    }
    for (let i = 1; i <= 3; i++) pts.push(bez(i / 4));
    for (let i = 0; i < pts.length; i++) {
      const r = LIB.rng(sd('nineBub', i));
      const rad = h * (0.014 + 0.012 * r());
      const [px, py] = pts[i];
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, TAU);
      ctx.fillStyle = LIB.rgba(P.gold, 0.92);
      ctx.fill();
      ctx.strokeStyle = P.goldDeep;
      ctx.lineWidth = Math.max(1, rad * 0.18);
      ctx.stroke();
      ctx.fillStyle = P.gloss;
      ctx.beginPath();
      ctx.arc(px - rad * 0.3, py - rad * 0.3, Math.max(0.6, rad * 0.28), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = clamp(tIn, 0, info.dur);
      const T = info.T;
      const W = info.W, H = info.H;

      const HOLD = 0.5; // T 28.0-28.5: hold G3 exactly, the foam 9 fades
      const e = E.outCubic(clamp((t - HOLD) / (info.dur - HOLD), 0, 1)); // T 28.5-30.5 approach

      const mugX = lerp(G3.x, G4.x, e);
      const mugY = lerp(G3.y, G4.y, e);
      const mugH = lerp(G3.h, G4.h, e);
      const zoom = lerp(1, 1.3, e);
      const chefAlpha = 1 - clamp((t - 0.6) / 0.9); // gone by t=1.5, before he'd peek past the handle

      // 1. hall, bunting, garland and the chef, zoomed and falling out of frame together
      L.camera(ctx, { x: 960, y: 540, zoom }, () => {
        FILM.props.hallBack(ctx, { variant: 'hall', t: T, dim: 0 });
        FILM.props.bunting(ctx, -80, 128, 2000, 128, 46, { t: T, seed: sd('bunt') });
        FILM.props.garland(ctx, -80, 196, 2000, 196, 60, { t: T, seed: sd('gar') });
        if (chefAlpha > 0.003) {
          FILM.cast.chef(ctx, 1180, 1010, 860, { name: 'raiseMug', k: 1, t: T }, {
            mug: { h: G3.h, alpha: 0 }, // invisible: only shapes a correct gripping hand
            bandana: true, gleam: 0, line: 'hero', alpha: chefAlpha,
          });
        }
      });

      // 2. bubbles behind the mug, picking up speed and size as the approach builds
      FILM.props.bubbles(ctx, sd('bubBack'), T, { x: 0, y: 0, w: W, h: H },
        { count: 22, speed: lerp(55, 130, e), size: [6, lerp(16, 34, e)], alpha: 1 });

      // 3. the fading foam 9 handed off from 12 (G3), screen-fixed
      foamNine(ctx, P, 620, 520, 620, 1 - smoothstep(0, HOLD, t));

      // 4. the hero mug, screen-fixed: grows from G3 to G4 exactly on the last frame
      FILM.props.mug(ctx, mugX, mugY, mugH, {
        fill: 0.86,
        foam: clamp(1.0 + 0.14 * Math.sin(t * 9), 0, 1.4),
        slosh: clamp(0.55 * Math.sin(t * 6.2), -1, 1),
        logo: true,
        bubbles: true,
        t,
        line: 'hero',
        seed: sd('mug'),
      });

      // 5. a few big bubbles streaming close past the camera in the final approach
      if (e > 0.01) {
        FILM.props.bubbles(ctx, sd('bubFront'), T, { x: 0, y: 0, w: W, h: H },
          { count: 8, speed: lerp(90, 210, e), size: [lerp(18, 70, e), lerp(50, 190, e)], alpha: 0.85 * e });
      }
    },
  });
})();
