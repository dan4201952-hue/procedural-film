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

  // A fading copy of 12's foam "9", matched exactly (screen space and stroke styling) to 12's own
  // redraw: not 12's stroke-by-stroke build, which 12 owns, just its final shape and look, fading out.
  //   Loop: closed ellipse cx=620 cy=380 rx=145 ry=170, traced CCW from the top (620, 220).
  //   Tail: cubic bezier P0=(765,380) C1=(770,530) C2=(700,750) P1=(595,830).
  //   Strokes, widest (bottom) to narrowest (top): dark outline (P.outline, +12, low alpha), a thin
  //   goldDeep edge (+6), the uniform 70 px foam body, a lighter gloss core (x0.36).
  function foamNine(ctx, P, alpha) {
    if (alpha <= 0.003) return;
    const sw = 70;
    const cx = 620, cy = 380, rx = 145, ry = 170;
    const p0 = [765, 380], c1 = [770, 530], c2 = [700, 750], p1 = [595, 830];
    const loop = new Path2D();
    loop.ellipse(cx, cy, rx, ry, 0, 0, TAU, true); // CCW
    const tail = new Path2D();
    tail.moveTo(p0[0], p0[1]);
    tail.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pass = (color, width, a) => {
      ctx.globalAlpha = alpha * a;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke(loop);
      ctx.stroke(tail);
    };
    pass(P.outline, sw + 12, 0.35);
    pass(P.goldDeep, sw + 6, 1);
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(cx - rx, cy - ry, cx * 0.9, p1[1]);
    grad.addColorStop(0, P.foam);
    grad.addColorStop(1, P.foamShade);
    ctx.strokeStyle = grad;
    ctx.lineWidth = sw;
    ctx.stroke(loop);
    ctx.stroke(tail);
    pass(P.gloss, sw * 0.36, 0.5);
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
      foamNine(ctx, P, 1 - smoothstep(0, HOLD, t));

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
