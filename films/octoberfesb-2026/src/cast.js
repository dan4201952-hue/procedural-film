/*
 * cast.js : FILM.cast, the characters of OktoberFESB 2026 (docs/cast-api.md; art bible 10.1 to 10.3
 * and 10.8). Loaded after props.js, before the timeline and the scenes.
 *
 *   TEAM                                  the 15 teammate specs (art bible 10.3)
 *   person(ctx, spec, x, y, h, pose, o)   a teammate                      -> { hand, head }
 *   chef(ctx, x, y, h, pose, o)           the chef (10.1)                 -> { handR, handL, head }
 *   chefHand(ctx, x, y, s, o)             his hand in the hoodie sleeve (shot 02)
 *   chefBeardEdge(ctx, x, y, w, o)        his chin and short beard from the top of the frame (shot 02)
 *   waitress(ctx, x, y, h, pose, o)       the waitress with ten Maß       -> { fanL, fanR }
 *   tshirt(ctx, x, y, s, o)               a flying or held t-shirt (10.8)
 *   jerseyBack(ctx, x, y, w, o)           the FESB 9 back print alone
 *
 * One rig for every figure. A body (proportions in units of 1 % of the figure height) and a pose
 * (pelvis offset and tilt, spine lean, head tilt and turn, shoulder / elbow / wrist angles, foot
 * targets solved to hip / knee / ankle by two-bone IK) go through solve() to joints, and
 * drawFigure() dresses the joints. Named poses are keyframes mixed by k, so every pose of a
 * character runs through the same bones and the proportions never drift. Scenes pass
 * lib.onTwos(t) as pose.t and quantise k so characters move on twos; the chef's salsa holds one
 * pose per 8th (counts 1-3 and 5-7 step, 4 and 8 hold, hips sway away from the moving foot).
 *
 * Conventions
 *   - L and R are SCREEN left and right of an unflipped figure (the chef's mug hand 'R' is his
 *     screen-right hand, as storyboard G3 needs). o.flip mirrors the figure about x; prints and
 *     the mug logo never mirror.
 *   - Line weight: o.line 'hero' | 'secondary' (default) | 'background' = 7 / 5 / 3 px for an
 *     800 px figure, scaled with h (min 1.5 px); detail lines 2.5 px likewise; props.LINE settings.
 *   - Teammates are drawn at h * spec.tall (0.97 to 1.04) so a row of them is not a row of clones.
 *   - Figure parts go through shapeFig(), the figures' twin of FILM.props.shape (same options and
 *     look, an ink resample step that grows with the outline length); mugs, logos, the lockup,
 *     sparkles and the t-shirts use FILM.props itself.
 *   - Cached (t-independent, keyed by size bucket and render scale in one lib.cached store): faces
 *     per expression and turn, the jersey print, chest logos; the OktoberFESB tee lockup per boil
 *     drawing (props.lockup boils with lib.T and costs ~20 ms, so it is drawn at most once per
 *     boil drawing and scaled to every tee).
 *
 * Options beyond docs/cast-api.md (all optional)
 *   person: pose 'crouch' (front row of a team photo, hands on knees); pose.crouch or o.crouch
 *     crouches any pose ('turn', 'back', 'pullOn', 'cheer'...); o.upper draws only the upper body
 *     (a teammate behind a table); o.shirt 'jersey' | 'octo' for the shirt hugged in 'catch';
 *     o.gleam 0..1 sweeps a gold gleam over the jersey back print; o.hands [L, R] hand shapes.
 *   chef: expressions 'half' (calm half-smile at rest) and 'grin'; o.mug.h overrides the mug
 *     height (default h * 200 / 860, storyboard G3); the mug grip comes from props.mug's handle.
 *   TEAM specs also carry top, legs (the casual outfit) and tall.
 */
(function () {
  'use strict';

  const FILM = window.FILM;
  const L = FILM.lib;
  const P = Object.assign({}, L.pal); // hoisted copy: the read-only palette proxy is slow in loops
  const PI = Math.PI, TAU = Math.PI * 2;
  const sin = Math.sin, cos = Math.cos, atan2 = Math.atan2, hypot = Math.hypot;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const wrapPi = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const l2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const FONT = '"Montserrat", "DejaVu Sans", sans-serif';
  const EIGHTH = 0.25; // s at 120 bpm

  // ===========================================================================
  // Line, colours, shapes
  // ===========================================================================

  const LINE0 = { wobble: 0.8, tremble: 0.25, rough: 0.35, boilAmp: 0.5, widthJitter: 0.12, taper: 6, taperOpen: [6, 10], W: { hero: 7, secondary: 5, background: 3, detail: 2.5 } };
  const PR = () => FILM.props || {};
  function lineSet() {
    const l = PR().LINE;
    return l && typeof l.wobble === 'number' && l.W ? l : LINE0;
  }

  const SHADE_SKIN = L.rgba('#000000', 0.15);
  const SHADE = L.rgba('#000000', 0.18);
  const SHADE_DEEP = L.rgba('#000000', 0.24);
  const COL = {
    mouth: L.mix(P.dirndlSkirt, P.outline, 0.5),
    tongue: L.mix(P.confettiD, P.dirndlSkirt, 0.35),
    blush: L.rgba(P.confettiD, 0.3),
    lens: L.rgba(P.glass, 0.3),
    grey: L.mix(P.outlineSoft, P.bavWhite, 0.52),
    olive: L.mix(P.leafDeep, P.wheatDeep, 0.5),
    mustard: L.mix(P.wheatDeep, P.wheat, 0.35),
    maroon: L.mix(P.dirndlSkirt, P.outlineSoft, 0.3),
    denim: L.mix(P.bavBlue, P.outlineSoft, 0.52),
    jeans: L.mix(P.fesbDeep, P.outline, 0.55),
    chinos: L.mix(P.wheatDeep, P.foamShade, 0.45),
    dark: L.mix(P.outlineSoft, P.hallDim, 0.35),
    shoe: P.hallDim,
    shoeBrown: P.woodDeep,
    sock: P.foam,
    sockBand: L.mix(P.foam, P.leafDeep, 0.6),
    hoodie: P.officeDesk,
    hoodieDeep: L.mix(P.officeDesk, P.outline, 0.5),
    lederDeep: L.mix(P.lederhosen, P.outline, 0.35),
    lederLight: L.mix(P.lederhosen, P.woodLight, 0.55),
    lace: P.bavWhite,
    white: P.gloss,
  };
  const SHIRTS = { grey: COL.grey, olive: COL.olive, mustard: COL.mustard, maroon: COL.maroon, denim: COL.denim };
  const LEGS = { jeans: COL.jeans, chinos: COL.chinos, dark: COL.dark };
  const skinOf = (k) => P[k] || P.skinA;
  const HAIR_X = { grey: L.mix(P.beardGrey, P.bavWhite, 0.25), greying: L.mix(P.hairBrown, P.beardGrey, 0.6) };
  const hairOf = (k) => HAIR_X[k] || P[k] || P.hairBrown;
  const browOf = (k) => (k === 'hairBlonde' ? L.mix(P.wheatDeep, P.hairBrown, 0.55) : k === 'grey' || k === 'greying' ? L.mix(P.beardGrey, P.outline, 0.35) : L.mix(hairOf(k), P.outline, 0.25));

  /** uniform Catmull-Rom through the points as cubic Beziers (matches the ink line closely) */
  function crTrace(ctx, pts, closed) {
    const n = pts.length;
    if (n < 3) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      return;
    }
    const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    ctx.moveTo(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  }
  function bboxOf(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * bandShade(ctx, pts, dx, dy, color): the cel crescent of a convex-ish outline without a clip:
   * the stretch of outline facing away from the light plus the same stretch moved toward the light.
   * Equal to "the shape minus itself shifted by (dx, dy)" for the tubes it is used on.
   */
  function bandShade(ctx, pts, dx, dy, color) {
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sg = area > 0 ? 1 : -1;
    const ld = hypot(dx, dy) || 1, sx = -dx / ld, sy = -dy / ld;
    const on = new Array(n);
    let start = -1;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      const tx = b[0] - a[0], ty = b[1] - a[1];
      on[i] = sg * (ty * sx - tx * sy) > 0;
      if (!on[i] && start < 0) start = i;
    }
    if (start < 0) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        ctx.moveTo(run[0][0], run[0][1]);
        for (let k = 1; k < run.length; k++) ctx.lineTo(run[k][0], run[k][1]);
        for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k][0] + dx, run[k][1] + dy);
        ctx.closePath();
      }
      run = [];
    };
    for (let j = 1; j <= n; j++) {
      const i = (start + j) % n;
      if (on[i]) run.push(pts[i]);
      else flush();
    }
    flush();
    ctx.fill();
  }

  /**
   * shapeFig(ctx, pts, o): the figures' twin of FILM.props.shape, with the same options and look
   * (smooth fill, cel tone { color, side, frac } or { color, pts }, gloss [x, y, len, angle, w],
   * outline through lib.inkPath with FILM.props.LINE). Two differences keep a hall of people fast:
   * the ink resample step grows with the outline length (2.5 to 5 px), and the cel-tone pass fills
   * only the shape's own box.
   */
  function shapeFig(ctx, pts, o) {
    const draw = o.draw == null ? 1 : o.draw;
    if (draw <= 0 || !pts || pts.length < 3) return;
    const LN = lineSet();
    const smooth = o.smooth !== false;
    if (draw >= 1 && o.fill) {
      ctx.beginPath();
      if (smooth) crTrace(ctx, pts, true);
      else L.tracePath(ctx, pts, true);
      ctx.fillStyle = o.fill;
      ctx.fill();
      let sh = o.shade;
      if (sh && !sh.pts) {
        const b0 = bboxOf(pts);
        if (Math.min(b0.w, b0.h) < 14) sh = null;
        else if (sh.band) {
          const f = sh.frac != null ? sh.frac : 0.25;
          bandShade(ctx, pts, -f * b0.w, -f * b0.h * 0.3, sh.color || SHADE_SKIN);
          sh = null;
        }
      }
      if (sh) {
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        if (sh.pts) {
          crTrace(ctx, sh.pts, true);
          ctx.fillStyle = sh.color || SHADE_SKIN;
          ctx.fill();
        } else {
          const b = bboxOf(pts), f = sh.frac != null ? sh.frac : 0.25, side = sh.side || 'right';
          let dx = -f * b.w, dy = -f * b.h * 0.3;
          if (side === 'left') dx = f * b.w;
          else if (side === 'bottom') (dx = -f * b.w * 0.15), (dy = -f * b.h);
          else if (side === 'top') (dx = 0), (dy = f * b.h);
          ctx.rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
          const moved = new Array(pts.length);
          for (let i = 0; i < pts.length; i++) moved[i] = [pts[i][0] + dx, pts[i][1] + dy];
          if (smooth) crTrace(ctx, moved, true);
          else L.tracePath(ctx, moved, true);
          ctx.fillStyle = sh.color || SHADE_SKIN;
          ctx.fill('evenodd');
        }
        ctx.restore();
      }
      if (o.gloss) for (const g of o.gloss) glossLine(ctx, [g[0], g[1]], [g[0] + cos(g[3] || 0) * (g[2] || 0), g[1] + sin(g[3] || 0) * (g[2] || 0)], g[4] || Math.max(2, (g[2] || 0) * 0.22), 0.95);
    }
    if (o.outline !== false) {
      let per = 0;
      for (let i = 0, n = pts.length; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        per += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      }
      L.inkPath(ctx, pts, {
        closed: true, width: o.width || 5, color: o.color || P.outline, alpha: o.lineAlpha, seed: o.seed || 1, draw, boil: o.boil, smooth,
        wobble: LN.wobble, tremble: LN.tremble, rough: LN.rough, boilAmp: LN.boilAmp, widthJitter: LN.widthJitter, taper: LN.taper,
        step: clamp(per / 40, 4, 6), swell: 0.08, minWidth: 0.3,
      });
    }
  }
  const SH = shapeFig;
  /** props-owned objects use the house primitive itself */
  function SHP(ctx, pts, o) {
    const f = PR().shape;
    if (typeof f === 'function') f(ctx, pts, o);
    else shapeFig(ctx, pts, o);
  }
  /** an open detail stroke with the film's line settings */
  function inkLine(ctx, pts, o) {
    if (!pts || pts.length < 2) return;
    const LN = lineSet();
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const tp = LN.taperOpen || [LN.taper, 10];
    L.inkPath(ctx, pts, {
      width: o.width, color: o.color || P.outlineSoft, seed: o.seed || 1, draw: o.draw == null ? 1 : o.draw, alpha: o.alpha,
      boil: o.boil, wobble: LN.wobble, tremble: LN.tremble, rough: LN.rough, boilAmp: LN.boilAmp, widthJitter: LN.widthJitter,
      taper: [Math.min(tp[0], len * 0.3), Math.min(tp[1], len * 0.35)], swell: 0.1, minWidth: 0.3, closed: !!o.closed, fill: o.fill,
    });
  }
  function glossLine(ctx, a, b, w, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 0.95 : alpha;
    ctx.strokeStyle = P.gloss;
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }
  function dotPx(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.3, r), 0, TAU);
    ctx.fill();
  }

  // ---------------------------------------------------------------------------
  // small caches (one lib.cached slot per render scale, holding our own capped map)
  // ---------------------------------------------------------------------------
  function store() {
    return L.cached('cast|store|' + (FILM.S || 1), () => new Map());
  }
  function cacheGet(key, make) {
    const m = store();
    let v = m.get(key);
    if (v === undefined) {
      v = make();
      m.set(key, v);
      if (m.size > 700) m.delete(m.keys().next().value);
    }
    return v;
  }
  function newCanvas(w, h) {
    return FILM.makeCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  }
  const bucket = (px) => Math.pow(2, Math.round(Math.log2(Math.max(4, px)) * 10) / 10);

  // ===========================================================================
  // Geometry (figure units: 1 % of the figure height, origin at the feet, y down)
  // ===========================================================================

  function ell(cx, cy, rx, ry, n, rot) {
    n = n || 18;
    const out = [], cr = cos(rot || 0), sr = sin(rot || 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = cos(a) * rx, y = sin(a) * ry;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return out;
  }
  /** a tapered capsule from a (radius ra) to b (radius rb) */
  function cap(a, b, ra, rb, n) {
    n = n || 6;
    const ang = atan2(b[1] - a[1], b[0] - a[0]);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = ang + PI / 2 - (i / n) * PI;
      pts.push([b[0] + cos(t) * rb, b[1] + sin(t) * rb]);
    }
    for (let i = 0; i <= n; i++) {
      const t = ang - PI / 2 - (i / n) * PI;
      pts.push([a[0] + cos(t) * ra, a[1] + sin(t) * ra]);
    }
    return pts;
  }
  /** a bent tube a -> b -> c (radii ra, rb, rc): one outline for a whole limb, round joint outside */
  function chain(a, b, c, ra, rb, rc) {
    let d1 = [b[0] - a[0], b[1] - a[1]], d2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = hypot(d1[0], d1[1]) || 1e-6, l2 = hypot(d2[0], d2[1]) || 1e-6;
    d1 = [d1[0] / l1, d1[1] / l1];
    d2 = [d2[0] / l2, d2[1] / l2];
    const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
    let nm = [n1[0] + n2[0], n1[1] + n2[1]];
    const lm = hypot(nm[0], nm[1]) || 1e-6;
    nm = [nm[0] / lm, nm[1] / lm];
    const ch = Math.max(0.55, nm[0] * n1[0] + nm[1] * n1[1]);
    const bend = n1[0] * d2[0] + n1[1] * d2[1];
    const side = (sg) => {
      const pts = [[a[0] + sg * n1[0] * ra, a[1] + sg * n1[1] * ra]];
      const inner = Math.abs(bend) < 0.08 || (bend > 0) === (sg > 0);
      if (inner) pts.push([b[0] + sg * nm[0] * (rb / ch), b[1] + sg * nm[1] * (rb / ch)]);
      else {
        let a1 = atan2(sg * n1[1], sg * n1[0]), a2 = atan2(sg * n2[1], sg * n2[0]);
        a2 = a1 + wrapPi(a2 - a1);
        for (let k = 0; k <= 2; k++) {
          const t = lerp(a1, a2, k / 2);
          pts.push([b[0] + cos(t) * rb, b[1] + sin(t) * rb]);
        }
      }
      pts.push([c[0] + sg * n2[0] * rc, c[1] + sg * n2[1] * rc]);
      return pts;
    };
    const L1 = side(1), R1 = side(-1).reverse();
    const out = L1;
    const ac = atan2(d2[1], d2[0]);
    for (let i = 1; i < 5; i++) {
      const t = ac + PI / 2 - (i / 5) * PI;
      out.push([c[0] + cos(t) * rc, c[1] + sin(t) * rc]);
    }
    for (const q of R1) out.push(q);
    const aa = atan2(d1[1], d1[0]);
    for (let i = 1; i < 5; i++) {
      const t = aa - PI / 2 - (i / 5) * PI;
      out.push([a[0] + cos(t) * ra, a[1] + sin(t) * ra]);
    }
    return out;
  }
  const bendOf = (a, b, c) => Math.abs(wrapPi(atan2(c[1] - b[1], c[0] - b[0]) - atan2(b[1] - a[1], b[0] - a[0])));
  /** two-bone IK: from a toward t with bone lengths la, lb; the middle joint bends toward pref */
  function ik2(a, t, la, lb, pref) {
    const dx = t[0] - a[0], dy = t[1] - a[1];
    const d = hypot(dx, dy) || 1e-6;
    const dc = clamp(d, Math.abs(la - lb) + 1e-3, (la + lb) * 0.9995);
    const ux = dx / d, uy = dy / d;
    const end = [a[0] + ux * dc, a[1] + uy * dc];
    const ca = clamp((la * la + dc * dc - lb * lb) / (2 * la * dc), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const m1 = [a[0] + la * (ux * ca - uy * sa), a[1] + la * (uy * ca + ux * sa)];
    const m2 = [a[0] + la * (ux * ca + uy * sa), a[1] + la * (uy * ca - ux * sa)];
    const s1 = (m1[0] - a[0]) * pref[0] + (m1[1] - a[1]) * pref[1];
    const s2 = (m2[0] - a[0]) * pref[0] + (m2[1] - a[1]) * pref[1];
    return { mid: s1 >= s2 ? m1 : m2, end };
  }

  // ===========================================================================
  // Rig: unit-space drawing onto the canvas
  // ===========================================================================

  function makeRig(ctx, x, y, h, o, key, lineRefH) {
    const LN = lineSet();
    const W = LN.W;
    const kind = o.line && W[o.line] != null ? o.line : 'secondary';
    const U = h / 100;
    const f = o.flip ? -1 : 1;
    const ref = lineRefH || 800;
    const R = {
      ctx, x, y, h, U, f,
      ow: Math.max(1.5, (W[kind] * h) / ref),
      dw: Math.max(1.2, (W.detail * h) / ref),
      seed: (L.hash('cast', key) % 90000) * 13,
      draw: o.draw == null ? 1 : clamp(o.draw),
    };
    R.m = (p) => [x + f * p[0] * U, y + p[1] * U];
    R.M = (pts) => {
      const out = new Array(pts.length);
      for (let i = 0; i < pts.length; i++) out[i] = [x + f * pts[i][0] * U, y + pts[i][1] * U];
      return out;
    };
    R.shape = (pts, fill, k, extra) => {
      const q = R.M(pts);
      SH(ctx, q, Object.assign({ fill, width: R.ow, seed: R.seed + k, draw: R.draw }, extra));
      return q;
    };
    R.shaded = (pts, fill, k, color, frac, extra) =>
      R.shape(pts, fill, k, Object.assign({ shade: { color: color || SHADE, side: 'right', frac: frac == null ? 0.2 : frac } }, extra));
    /** a limb capsule with a cel tone sized to its thickness */
    R.limb = (a, b, ra, rb, fill, k, color, extra) => {
      const q = R.M(cap(a, b, ra, rb, 6));
      const bb = bboxOf(q);
      const frac = clamp(((ra + rb) * 0.34 * U) / Math.max(1, bb.w), 0.05, 0.42);
      const o2 = { fill, width: R.ow, seed: R.seed + k, draw: R.draw };
      if (color !== false) o2.shade = { color: color || SHADE, side: 'right', frac, band: true };
      SH(ctx, q, Object.assign(o2, extra));
    };
    /** a whole two-bone limb as one outline (two capsules when it folds tight) */
    R.limb2 = (a, b, c, ra, rb, rc, fill, k, color) => {
      if (bendOf(a, b, c) > 2.1) {
        R.limb(b, c, rb, rc, fill, k, color);
        R.limb(a, b, ra, rb, fill, k + 1, color);
        return;
      }
      const q = R.M(chain(a, b, c, ra, rb, rc));
      const bb = bboxOf(q);
      const frac = clamp(((ra + rc) * 0.34 * U) / Math.max(1, bb.w), 0.05, 0.42);
      SH(ctx, q, { fill, width: R.ow, seed: R.seed + k, draw: R.draw, shade: color === false ? null : { color: color || SHADE, side: 'right', frac, band: true } });
    };
    R.line = (pts, k, extra) => {
      const q = R.M(pts);
      const a = q[0], b = q[q.length - 1];
      if (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) < 5) return;
      inkLine(ctx, q, Object.assign({ width: R.dw, color: P.outlineSoft, seed: R.seed + k, draw: R.draw }, extra));
    };
    R.fill = (pts, color) => {
      if (R.draw < 1) return;
      ctx.beginPath();
      crTrace(ctx, R.M(pts), true);
      ctx.fillStyle = color;
      ctx.fill();
    };
    R.dot = (p, r, color) => {
      if (R.draw < 1) return;
      const q = R.m(p);
      dotPx(ctx, q[0], q[1], r * U, color);
    };
    R.gloss = (a, b, w, alpha) => {
      if (R.draw < 1) return;
      glossLine(ctx, R.m(a), R.m(b), Math.max(1, w * U), alpha);
    };
    return R;
  }

  // ===========================================================================
  // Bodies (units of 1 % of the figure height)
  // ===========================================================================

  function chefBody() {
    return { head: 15.4, headW: 12.9, neck: 2.0, neckR: 4.6, torso: 33.6, thigh: 22, shin: 22, ankleH: 3, hipJ: 6.2, shW: 12.8, chest: 14.6, waist: 14.4, hip: 13, upper: 15, fore: 13.6, hand: 6.8, armR: 4.3, foreR: 3.5, thighR: 6.3, shinR: 4.3, zStep: 2.2, headK: 'chef' };
  }
  function waitressBody() {
    return { head: 15.4, headW: 14.6, neck: 2.4, neckR: 3.3, torso: 30.4, thigh: 22, shin: 22.2, ankleH: 2.8, hipJ: 6, shW: 11, chest: 12.2, waist: 10.8, hip: 14.6, upper: 14.6, fore: 13, hand: 6.2, armR: 3.9, foreR: 3.2, thighR: 5.6, shinR: 3.7, zStep: 2, headK: 'waitress' };
  }
  function teamBody(spec) {
    const B = { head: 17, headW: 13.5, neck: 2.8, neckR: 3.2, torso: 29.6, thigh: 22.6, shin: 22.6, ankleH: 2.8, hipJ: 5, shW: 10.4, chest: 10.9, waist: 9.6, hip: 9.9, upper: 15, fore: 13.4, hand: 6.4, armR: 3.2, foreR: 2.7, thighR: 4.7, shinR: 3.5, zStep: 2, headK: 'team' };
    const m = { slim: 0.9, average: 1, stocky: 1.12 }[spec.build] || 1;
    for (const k of ['shW', 'chest', 'waist', 'hip', 'armR', 'foreR', 'thighR', 'shinR', 'neckR']) B[k] *= m;
    if (spec.build === 'stocky') (B.waist *= 1.1), (B.headW *= 1.03);
    if (spec.build === 'slim') B.headW *= 0.97;
    return B;
  }
  const pelvisY = (B) => -(B.thigh + B.shin) * 0.985 - B.ankleH;

  // ===========================================================================
  // Poses
  // ===========================================================================

  const BASE = {
    px: 0, py: 0, tilt: 0, lean: 0, head: 0, look: 0, nod: 0, turn: 0, shL: 0, shR: 0, torsoK: 1,
    aL: [0.16, 0.12, 0, 1], aR: [0.16, 0.12, 0, 1],
    fL: [-5.5, 0, 0], fR: [5.5, 0, 0], foreL: 1, foreR: 1, kneeL: 1, kneeR: 1,
    hands: ['open', 'open'], expr: 'smile', tails: 0,
  };
  function full(p) {
    const q = Object.assign({}, BASE, p);
    q.aL = q.aL.slice(); q.aR = q.aR.slice(); q.fL = q.fL.slice(); q.fR = q.fR.slice();
    while (q.aL.length < 4) q.aL.push(q.aL.length === 3 ? 1 : 0);
    while (q.aR.length < 4) q.aR.push(q.aR.length === 3 ? 1 : 0);
    return q;
  }
  function mixPose(a, b, k) {
    if (k <= 0) return a;
    if (k >= 1) return b;
    const out = {};
    for (const key in a) {
      const va = a[key], vb = b[key];
      if (vb === undefined) out[key] = va;
      else if (typeof va === 'number') out[key] = va + (vb - va) * k;
      else if (Array.isArray(va)) out[key] = va.map((x, i) => (typeof x === 'number' ? x + (vb[i] - x) * k : k < 0.5 ? x : vb[i]));
      else out[key] = k < 0.5 ? va : vb;
    }
    for (const key in b) if (out[key] === undefined) out[key] = b[key];
    return out;
  }
  /** keyframes [[k, pose], ...] sampled at k */
  function track(keys, k) {
    k = clamp(k);
    if (k <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (k <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        return mixPose(a[1], b[1], (k - a[0]) / (b[0] - a[0]));
      }
    }
    return keys[keys.length - 1][1];
  }
  function armDir(s, a, cl, sl) {
    const x = s * sin(a), y = cos(a);
    return [x * cl - y * sl, x * sl + y * cl];
  }
  function armAngle(s, vx, vy, cl, sl) {
    const x = vx * cl + vy * sl, y = -vx * sl + vy * cl;
    return atan2(s * x, y);
  }
  function chestOf(B, p) {
    const cl = cos(p.lean), sl = sin(p.lean), T = B.torso * p.torsoK;
    return [p.px + sl * T, pelvisY(B) + p.py - cl * T];
  }
  /** turn ikL / ikR hand targets [x, y, outward, down, wrist] into arm angles for this body */
  function resolve(B, p) {
    p = full(p);
    if (!p.ikL && !p.ikR) return p;
    const cl = cos(p.lean), sl = sin(p.lean);
    const chest = chestOf(B, p);
    for (const s of [-1, 1]) {
      const T = s < 0 ? p.ikL : p.ikR;
      if (!T) continue;
      const sh = [chest[0] + s * cl * B.shW, chest[1] + s * sl * B.shW + (s < 0 ? p.shL : p.shR)];
      const r = ik2(sh, T, B.upper, B.fore + B.hand * 0.45, [s * num(T[2], 1), num(T[3], 0.4)]);
      const a = armAngle(s, r.mid[0] - sh[0], r.mid[1] - sh[1], cl, sl);
      const af = armAngle(s, r.end[0] - r.mid[0], r.end[1] - r.mid[1], cl, sl);
      p[s < 0 ? 'aL' : 'aR'] = [a, wrapPi(af - a), num(T[4], 0), 1];
    }
    delete p.ikL;
    delete p.ikR;
    return p;
  }

  function solve(B, p) {
    const J = {};
    const pel = [p.px, pelvisY(B) + p.py];
    const ct = cos(p.tilt), st = sin(p.tilt);
    J.pel = pel;
    J.hipL = [pel[0] - B.hipJ * ct, pel[1] - B.hipJ * st];
    J.hipR = [pel[0] + B.hipJ * ct, pel[1] + B.hipJ * st];
    for (const s of [-1, 1]) {
      const f = s < 0 ? p.fL : p.fR;
      const hip = s < 0 ? J.hipL : J.hipR;
      const ank = [f[0], -B.ankleH - f[1] + f[2] * B.zStep];
      const r = ik2(hip, ank, B.thigh * (s < 0 ? p.foreL : p.foreR), B.shin, p.kneeP || [s * (s < 0 ? p.kneeL : p.kneeR), 0.3]);
      if (s < 0) (J.kneeL = r.mid), (J.ankL = r.end), (J.zL = f[2]);
      else (J.kneeR = r.mid), (J.ankR = r.end), (J.zR = f[2]);
    }
    const cl = cos(p.lean), sl = sin(p.lean);
    const T = B.torso * p.torsoK;
    const chest = [pel[0] + sl * T, pel[1] - cl * T];
    J.chest = chest;
    J.shL = [chest[0] - cl * B.shW, chest[1] - sl * B.shW + p.shL];
    J.shR = [chest[0] + cl * B.shW, chest[1] + sl * B.shW + p.shR];
    const ha = p.lean + p.head;
    J.headAng = ha;
    J.neck = [chest[0] + sl * 0.6, chest[1] - cl * 0.6];
    const hd = B.neck + B.head * 0.5;
    J.head = [J.neck[0] + sin(ha) * hd, J.neck[1] - cos(ha) * hd + p.nod * 1.1];
    for (const s of [-1, 1]) {
      const A = s < 0 ? p.aL : p.aR;
      const sh = s < 0 ? J.shL : J.shR;
      const d1 = armDir(s, A[0], cl, sl), d2 = armDir(s, A[0] + A[1], cl, sl), d3 = armDir(s, A[0] + A[1] + A[2], cl, sl);
      const el = [sh[0] + d1[0] * B.upper, sh[1] + d1[1] * B.upper];
      const fk = num(A[3], 1);
      const wr = [el[0] + d2[0] * B.fore * fk, el[1] + d2[1] * B.fore * fk];
      const hc = [wr[0] + d3[0] * B.hand * 0.45, wr[1] + d3[1] * B.hand * 0.45];
      const S = s < 0 ? 'L' : 'R';
      J['el' + S] = el;
      J['wr' + S] = wr;
      J['hc' + S] = hc;
      J['ha' + S] = atan2(d3[1], d3[0]);
    }
    return J;
  }
  const POINTS = ['pel', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankL', 'ankR', 'chest', 'shL', 'shR', 'neck', 'head', 'elL', 'elR', 'wrL', 'wrR', 'hcL', 'hcR'];
  /** narrow the figure about its pelvis (turns); 1 = full width */
  function squashJ(J, wf) {
    J.wf = wf;
    if (wf === 1) return;
    const cx = J.pel[0];
    for (const k of POINTS) J[k][0] = cx + (J[k][0] - cx) * wf;
  }
  function shiftJ(J, dx, dy) {
    for (const k of POINTS) (J[k][0] += dx), (J[k][1] += dy);
  }

  // ===========================================================================
  // Drawing the parts
  // ===========================================================================

  /** a point in the torso frame: x across (squashed by wf), v up from the pelvis; the frame
   *  turns from the pelvis tilt at the hips to the spine lean at the chest */
  function torsoFrame(B, J, p) {
    const T = B.torso * p.torsoK, pel = J.pel, wf = J.wf;
    return (x, v) => {
      const a = lerp(p.tilt, p.lean, clamp(v / (T * 0.6)));
      const xx = x * wf;
      return [pel[0] + xx * cos(a) + v * sin(a), pel[1] + xx * sin(a) - v * cos(a)];
    };
  }
  function mirrorPts(half, mid) {
    const out = half.slice();
    if (mid) out.push(mid);
    for (let i = half.length - 1; i >= 0; i--) out.push([-half[i][0], half[i][1]]);
    return out;
  }
  function torsoOutline(B, T, hem, neckW, neckDip, shoulderPad) {
    const sh = B.shW, ar = B.armR * (shoulderPad || 1);
    const half = [
      [-neckW, T + 1.1],
      [-sh * 0.62, T + 1.05],
      [-(sh + ar * 0.5), T - 1.0],
      [-B.chest, T - 6.8],
      [-B.waist, T * 0.45],
      [-B.hip, 1.5],
      [-B.hip * 0.99, hem + 1.1],
      [-B.hip * 0.55, hem],
    ];
    const pts = mirrorPts(half, [0, hem - 0.3]);
    pts.reverse();
    pts.push([0, T + neckDip]);
    return pts;
  }

  function drawShoe(R, B, ank, s, z, color, k, side) {
    const zs = 1 + z * 0.05;
    const hw = B.shinR * 1.36 * zs, hh = B.ankleH * 1.1 * zs;
    const cx = ank[0] + s * 0.5 + (side ? side * hw * 0.6 : 0), cy = ank[1] + B.ankleH * 0.45;
    const ex = side ? 1.6 : 1;
    const pts = [[-1, 0.62], [-1.08, 0.05], [-0.86, -0.55], [-0.35, -0.86], [0.35, -0.86], [0.86, -0.55], [1.08, 0.05], [1, 0.62], [0, 0.72]].map(([u, v]) => [cx + u * hw * ex, cy + v * hh]);
    R.shape(pts, color, k, { shade: { color: SHADE, side: 'right', frac: 0.16 } });
    R.gloss([cx - hw * 0.45, cy - hh * 0.5], [cx - hw * 0.1, cy - hh * 0.66], hh * 0.22, 0.75);
  }

  /** hand at wrist wr pointing along ang (unit-space radians); thumb toward the body (front view) */
  function drawHand(R, B, wr, ang, s, kind, skin, k, back, scale) {
    if (kind === 'none') return;
    const hs = B.hand * (scale || 1);
    const dx = cos(ang), dy = sin(ang);
    const ts = s * (back ? -1 : 1);
    const nx = -dy * ts, ny = dx * ts;
    const H = (u, v) => [wr[0] + dx * u * hs + nx * v * hs, wr[1] + dy * u * hs + ny * v * hs];
    const HS = (list) => list.map((q) => H(q[0], q[1]));
    const fine = hs * R.U >= 22;
    if (kind === 'fist' || kind === 'grip' || kind === 'thumb' || kind === 'point') {
      R.shape(HS([[-0.05, -0.3], [0.3, -0.42], [0.64, -0.38], [0.84, -0.18], [0.86, 0.1], [0.72, 0.34], [0.42, 0.42], [0.1, 0.36], [-0.05, 0.3]]), skin, k, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.16 } });
      if (fine) R.line(HS([[0.62, -0.26], [0.7, 0], [0.62, 0.24]]), k + 1, { alpha: 0.8 });
      if (kind === 'thumb') R.shape(cap(H(0.35, 0.3), H(0.1, 0.95), hs * 0.16, hs * 0.14, 5), skin, k + 2);
      else if (kind === 'point') R.shape(cap(H(0.6, -0.08), H(1.3, -0.08), hs * 0.15, hs * 0.13, 5), skin, k + 2);
      else if (fine) R.line(HS([[0.22, 0.36], [0.46, 0.22], [0.6, 0.06]]), k + 2, { alpha: 0.85 });
    } else {
      R.shape(HS([[-0.05, -0.3], [0.42, -0.36], [0.82, -0.32], [1.0, -0.16], [1.03, 0.05], [0.9, 0.24], [0.62, 0.3], [0.54, 0.38], [0.66, 0.58], [0.52, 0.68], [0.32, 0.52], [0.1, 0.36], [-0.05, 0.3]]), skin, k, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.14 } });
      if (fine) R.line(HS([[0.7, -0.12], [0.96, -0.1]]), k + 1, { alpha: 0.75 });
      if (fine) R.line(HS([[0.7, 0.08], [0.95, 0.1]]), k + 2, { alpha: 0.75 });
    }
    return H(0.45, 0);
  }

  // ---------------------------------------------------------------------------
  // Heads
  // ---------------------------------------------------------------------------

  /** turn a head-surface x (in head widths, -0.5..0.5) by phi on the sphere */
  function warpX(x, phi) {
    if (!phi) return x;
    const c = clamp(x * 2, -1, 1);
    const extra = x - c * 0.5;
    const th = Math.asin(c) + phi;
    return 0.5 * sin(clamp(th, -PI / 2, PI / 2)) + extra * cos(phi);
  }
  function headMap(B, J, wfh) {
    const hc = J.head, a = J.headAng, ca = cos(a), sa = sin(a);
    const hw = B.headW * wfh, hh = B.head;
    return (x, y) => {
      const X = x * hw, Y = y * hh;
      return [hc[0] + X * ca - Y * sa, hc[1] + X * sa + Y * ca];
    };
  }
  function headShape(jaw, chin) {
    const pts = [];
    const n = 30;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      let x = cos(t) * 0.5, y = sin(t) * 0.5;
      if (y > 0) {
        const q = sin(t);
        x *= 1 - jaw * q * q;
        y *= 1 + (chin || 0) * q * q;
      }
      pts.push([x, y]);
    }
    return pts;
  }

  // Hair, in head units (x in head widths, y in head heights, origin the head centre)
  const HAIR_FRONT = {
    short: [[-0.5, 0.02], [-0.56, -0.2], [-0.5, -0.43], [-0.3, -0.59], [0, -0.64], [0.3, -0.59], [0.5, -0.43], [0.56, -0.2], [0.5, 0.02], [0.45, -0.12], [0.38, -0.24], [0.16, -0.3], [-0.04, -0.26], [-0.16, -0.31], [-0.37, -0.25], [-0.45, -0.12]],
    crop: [[-0.5, -0.02], [-0.54, -0.22], [-0.47, -0.45], [-0.26, -0.58], [0, -0.61], [0.26, -0.58], [0.47, -0.45], [0.54, -0.22], [0.5, -0.02], [0.45, -0.18], [0.3, -0.29], [0, -0.3], [-0.3, -0.29], [-0.45, -0.18]],
    side: [[-0.5, 0.0], [-0.57, -0.25], [-0.46, -0.52], [-0.2, -0.67], [0.16, -0.67], [0.46, -0.53], [0.57, -0.28], [0.51, 0.0], [0.46, -0.1], [0.42, -0.2], [0.2, -0.2], [-0.12, -0.25], [-0.38, -0.27], [-0.46, -0.14]],
    long: [[-0.52, 0.5], [-0.59, 0.1], [-0.57, -0.26], [-0.45, -0.5], [-0.2, -0.64], [0.2, -0.64], [0.45, -0.5], [0.57, -0.26], [0.59, 0.1], [0.52, 0.5], [0.42, 0.46], [0.41, 0.05], [0.35, -0.2], [0.14, -0.32], [0.02, -0.33], [-0.14, -0.32], [-0.35, -0.2], [-0.41, 0.05], [-0.42, 0.46]],
    bob: [[-0.56, 0.36], [-0.61, 0.0], [-0.56, -0.35], [-0.35, -0.58], [0, -0.64], [0.35, -0.58], [0.56, -0.35], [0.61, 0.0], [0.56, 0.36], [0.44, 0.34], [0.43, 0.0], [0.41, -0.13], [0.2, -0.11], [-0.2, -0.11], [-0.41, -0.13], [-0.43, 0.0], [-0.44, 0.34]],
    buzz: [[-0.5, -0.02], [-0.53, -0.24], [-0.46, -0.46], [-0.26, -0.58], [0, -0.6], [0.26, -0.58], [0.46, -0.46], [0.53, -0.24], [0.5, -0.02], [0.45, -0.2], [0.3, -0.3], [0, -0.32], [-0.3, -0.3], [-0.45, -0.2]],
    quiff: [[-0.5, 0.02], [-0.56, -0.22], [-0.5, -0.46], [-0.32, -0.62], [-0.08, -0.74], [0.18, -0.82], [0.4, -0.74], [0.54, -0.5], [0.56, -0.22], [0.5, 0.02], [0.45, -0.14], [0.4, -0.28], [0.22, -0.36], [0.02, -0.34], [-0.2, -0.32], [-0.38, -0.26], [-0.45, -0.12]],
    tied: [[-0.5, 0.0], [-0.55, -0.24], [-0.47, -0.47], [-0.26, -0.6], [0, -0.63], [0.26, -0.6], [0.47, -0.47], [0.55, -0.24], [0.5, 0.0], [0.44, -0.16], [0.34, -0.3], [0.16, -0.36], [0, -0.35], [-0.16, -0.36], [-0.34, -0.3], [-0.44, -0.16]],
    receding: [[-0.5, 0.05], [-0.55, -0.2], [-0.49, -0.42], [-0.3, -0.57], [0, -0.6], [0.3, -0.57], [0.49, -0.42], [0.55, -0.2], [0.5, 0.05], [0.44, -0.04], [0.42, -0.27], [0.26, -0.43], [0.08, -0.44], [0, -0.48], [-0.08, -0.44], [-0.26, -0.43], [-0.42, -0.27], [-0.44, -0.04]],
    tight: [[-0.5, -0.02], [-0.55, -0.24], [-0.47, -0.47], [-0.26, -0.6], [0, -0.63], [0.26, -0.6], [0.47, -0.47], [0.55, -0.24], [0.5, -0.02], [0.44, -0.18], [0.3, -0.27], [0.1, -0.3], [-0.06, -0.24], [-0.1, -0.3], [-0.3, -0.28], [-0.44, -0.18]],
  };
  function bumpy(cx, cy, rx, ry, a0, a1, n, amp, freq) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      const r = 1 + amp * Math.abs(sin(a * freq));
      out.push([cx + cos(a) * rx * r, cy + sin(a) * ry * r]);
    }
    return out;
  }
  function hairFrontPts(style) {
    if (style === 'curls' || style === 'curly' || style === 'afro') {
      const top = bumpy(0, -0.08, 0.56, 0.56, PI + 0.05, TAU - 0.05, 18, 0.07, 5.5);
      const line = bumpy(0, 0.02, 0.44, 0.3, -0.25, -PI + 0.25, 8, 0.12, 6).map((q) => [q[0], q[1] - 0.02]);
      return [[0.5, 0.0], ...line, [-0.5, 0.0], ...top];
    }
    if (style === 'bun' || style === 'ponytail') return HAIR_FRONT.tight;
    return HAIR_FRONT[style] || HAIR_FRONT.short;
  }
  function hairBackPts(style) {
    switch (style) {
      case 'long': return [[-0.6, -0.25], [-0.66, 0.4], [-0.64, 1.12], [-0.38, 1.26], [0.38, 1.26], [0.64, 1.12], [0.66, 0.4], [0.6, -0.25], [0.42, -0.58], [0, -0.66], [-0.42, -0.58]];
      case 'bob': return [[-0.6, -0.2], [-0.64, 0.42], [-0.3, 0.52], [0.3, 0.52], [0.64, 0.42], [0.6, -0.2], [0.4, -0.58], [0, -0.66], [-0.4, -0.58]];
      case 'afro': return bumpy(0, -0.14, 0.76, 0.66, 0, TAU - 0.01, 30, 0.06, 6.5);
      case 'ponytail': return [[0.3, -0.5], [0.56, -0.36], [0.68, -0.08], [0.7, 0.32], [0.62, 0.7], [0.5, 0.86], [0.46, 0.6], [0.5, 0.28], [0.46, -0.04], [0.36, -0.26]];
      case 'bun': return ell(0, -0.63, 0.2, 0.17, 16);
      case 'tied': return ell(0.16, -0.6, 0.15, 0.13, 14);
      default: return null;
    }
  }
  /** back of the head: hair cover per style */
  function hairCoverPts(style) {
    switch (style) {
      case 'long': return [[-0.56, -0.3], [-0.62, 0.3], [-0.6, 1.14], [-0.3, 1.24], [0.3, 1.24], [0.6, 1.14], [0.62, 0.3], [0.56, -0.3], [0.38, -0.56], [0, -0.64], [-0.38, -0.56]];
      case 'bob': return [[-0.58, -0.3], [-0.62, 0.42], [-0.3, 0.5], [0.3, 0.5], [0.62, 0.42], [0.58, -0.3], [0.38, -0.57], [0, -0.64], [-0.38, -0.57]];
      case 'afro': return bumpy(0, -0.14, 0.76, 0.66, 0, TAU - 0.01, 30, 0.06, 6.5);
      case 'curly':
      case 'curls': return [...bumpy(0, -0.05, 0.56, 0.58, PI - 0.4, TAU + 0.4, 20, 0.07, 5.5), [0.44, 0.34], [0.2, 0.4], [0, 0.36], [-0.2, 0.4], [-0.44, 0.34]];
      default: return [[-0.53, -0.1], [-0.52, 0.2], [-0.4, 0.32], [-0.2, 0.36], [0, 0.33], [0.2, 0.36], [0.4, 0.32], [0.52, 0.2], [0.53, -0.1], [0.46, -0.44], [0.26, -0.6], [0, -0.64], [-0.26, -0.6], [-0.46, -0.44]];
    }
  }

  // ---------------------------------------------------------------------------
  // Faces (cached per character, expression, look, size bucket and render scale)
  // ---------------------------------------------------------------------------

  function faceBlit(R, J, B, wfh, key, F) {
    const S = FILM.S || 1;
    const hwPx = B.headW * wfh * R.U, hhPx = B.head * R.U;
    const q = bucket(hwPx);
    const sc = hwPx / q;
    const qh = (q * hhPx) / hwPx;
    const cw = q * 1.5, ch = qh * 1.3;
    const c = cacheGet('face|' + key + '|' + q.toFixed(2) + '|' + S, () => {
      const cv = newCanvas(cw * S, ch * S);
      const g = cv.getContext('2d');
      g.scale(S, S);
      g.translate(cw / 2, ch / 2);
      paintFace(g, q, qh, F);
      return cv;
    });
    const ctx = R.ctx;
    const p = R.m(J.head);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(R.f * J.headAng);
    ctx.scale(R.f * sc, sc);
    ctx.drawImage(c, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }

  function fInk(g, pts, w, color, seed, closed, fill) {
    const LN = lineSet();
    L.inkPath(g, pts, { width: w, color: color || P.outline, seed, closed: !!closed, fill, boil: false, wobble: LN.wobble * 0.5, tremble: LN.tremble * 0.5, rough: LN.rough * 0.6, widthJitter: LN.widthJitter, taper: closed ? 2 : [Math.max(1, w), Math.max(1.5, w * 1.2)], minWidth: 0.35, swell: 0.12 });
  }
  function fEll(cx, cy, rx, ry, n) {
    return ell(cx, cy, rx, ry, n || 16);
  }

  /**
   * paintFace(g, hw, hh, F): eyes, brows, nose, mouth, cheeks, glasses and moustache in px around
   * the head centre. F: { eyeY, eyeX, eyeRx, eyeRy, pupil, lashes, brow, browW, browLift, mouthY,
   * mouthW, expr, look, nod, skin, glasses, moustache, lines, chef }
   */
  function paintFace(g, hw, hh, F) {
    const lw = Math.max(1.1, hw * 0.042);
    const phi = Math.asin(clamp(F.look || 0, -0.95, 0.95)) * 0.9;
    const nod = F.nod || 0;
    const X = (xn) => warpX(xn, phi) * hw;
    const ey = (F.eyeY + nod * 0.05) * hh;
    const expr = F.expr || 'smile';
    const happy = expr === 'grin' || F.chef;
    const seed = 1000 + (F.seed || 0);
    // cheeks
    if (F.blush) {
      g.fillStyle = F.blush;
      for (const e of [-1, 1]) {
        const th = Math.asin(e * 0.62) + phi;
        if (cos(th) < 0.25) continue;
        g.beginPath();
        g.ellipse(0.5 * sin(th) * hw, ey + 0.17 * hh, hw * 0.085 * (0.5 + 0.5 * cos(th)), hw * 0.055, 0, 0, TAU);
        g.fill();
      }
    }
    if (F.forehead) {
      for (const k of [0, 1]) {
        const y = (F.eyeY - F.eyeRy - F.browLift - 0.1 - k * 0.055) * hh;
        fInk(g, [[X(-0.15 + k * 0.03), y + hh * 0.01], [X(0), y - hh * 0.008], [X(0.15 - k * 0.03), y + hh * 0.01]], lw * 0.55, F.chef ? L.rgba(P.outlineSoft, 0.5) : P.outlineSoft, seed + 3 + k);
      }
    }
    // eyes
    const eyes = [];
    for (const e of [-1, 1]) {
      const th = Math.asin(e * F.eyeX * 2) + phi;
      const vis = cos(th);
      if (vis < 0.22) continue;
      const ex = 0.5 * sin(th) * hw;
      const rx = F.eyeRx * hw * (0.45 + 0.55 * vis), ry = F.eyeRy * hh;
      eyes.push({ e, ex, rx, ry, vis });
      const pts = fEll(ex, ey, rx, ry, 18);
      fInk(g, pts, lw * 0.9, P.outline, seed + e * 3, true, P.gloss);
      // pupil
      const pr = F.pupil * hw * (0.6 + 0.4 * vis);
      const px = ex + (F.look || 0) * rx * 0.35, py = ey + ry * 0.12 + nod * ry * 0.35;
      g.save();
      g.beginPath();
      g.ellipse(ex, ey, rx * 0.97, ry * 0.97, 0, 0, TAU);
      g.clip();
      if (F.iris) {
        dotPx(g, px, py, pr, P.outline);
        dotPx(g, px, py, pr * 0.8, F.iris);
        dotPx(g, px, py, pr * 0.45, P.outline);
      } else dotPx(g, px, py, pr, P.outline);
      dotPx(g, px - pr * 0.36, py - pr * 0.4, pr * 0.34, P.gloss);
      dotPx(g, px + pr * 0.38, py + pr * 0.34, pr * 0.15, P.gloss);
      if (happy) {
        // cheeks push the lower lid up: a smiling eye (higher when he laughs)
        const up = F.chef ? (expr === 'grin' ? 0.32 : 0.16) : 0;
        g.fillStyle = F.skin;
        g.beginPath();
        g.ellipse(ex, ey + ry * (1.28 - up), rx * 1.4, ry * 0.62, 0, 0, TAU);
        g.fill();
      }
      g.restore();
      if (happy) {
        const up = F.chef ? (expr === 'grin' ? 0.32 : 0.16) : 0;
        fInk(g, [[ex - rx * 0.95, ey + ry * (0.55 - up)], [ex, ey + ry * (0.7 - up)], [ex + rx * 0.95, ey + ry * (0.55 - up)]], lw * 0.7, P.outline, seed + 7 + e);
      }
      // upper lid
      fInk(g, [[ex - rx * 1.08, ey + ry * 0.05], [ex - rx * 0.7, ey - ry * 0.78], [ex, ey - ry * 1.02], [ex + rx * 0.7, ey - ry * 0.78], [ex + rx * 1.08, ey + ry * 0.05]], lw * 1.35, P.outline, seed + 11 + e);
      if (F.lashes) {
        const ox = ex + e * rx * 0.98, oy = ey - ry * 0.35;
        fInk(g, [[ox, oy], [ox + e * rx * 0.42, oy - ry * 0.34]], lw * 0.9, P.outline, seed + 13 + e);
      }
      if (F.lines) {
        // crow's feet: warmth, age (the chef shows them when he smiles)
        const ox = ex + e * rx * 1.28;
        fInk(g, [[ox, ey - ry * 0.1], [ox + e * rx * 0.36, ey - ry * 0.3]], lw * 0.55, P.outlineSoft, seed + 17 + e);
        fInk(g, [[ox, ey + ry * 0.2], [ox + e * rx * 0.38, ey + ry * 0.34]], lw * 0.55, P.outlineSoft, seed + 19 + e);
      }
      // brow
      const by = ey - ry - F.browLift * hh;
      const bl = rx * 1.15;
      if (F.chef) {
        const th = F.browW * hw;
        const ox = ex + e * bl * 1.12, oy = by + ry * 0.42, ix = ex - e * bl * 0.95, iy = by + ry * 0.05;
        const bp = [[ox, oy - th * 0.3], [ex, by - th * 0.62], [ix, iy - th * 0.55], [ix - e * th * 0.15, iy + th * 0.45], [ex, by + th * 0.38], [ox + e * th * 0.1, oy + th * 0.3]];
        fInk(g, bp, lw * 0.7, P.outline, seed + 23 + e, true, F.brow);
        if (F.browGrey) fInk(g, [[ex + e * bl * 0.35, by - th * 0.2], [ex + e * bl * 0.62, by - th * 0.05]], lw * 0.4, F.browGrey, seed + 25 + e);
      } else {
        fInk(g, [[ex - bl, by + ry * 0.2], [ex - bl * 0.2, by - ry * 0.22], [ex + bl, by - ry * 0.05]].map((q) => (e < 0 ? q : [2 * ex - q[0], q[1]])), F.browW * hw, F.brow, seed + 23 + e);
      }
    }
    // nose
    const nx = X(0), ny = ey + 0.2 * hh;
    const lookN = (F.look || 0) * hw * 0.05;
    if (F.chef) {
      // a strong straight nose: the shade side of the bridge, a rounded tip, nostril wings
      const q = (x, y) => [nx + lookN + x * hw, ny + y * hh];
      g.fillStyle = SHADE_SKIN;
      g.beginPath();
      crTrace(g, [q(0.015, -0.17), q(0.06, -0.02), q(0.085, 0.05), q(0.04, 0.075), q(0.03, -0.02)], true);
      g.fill();
      fInk(g, [q(0.015, -0.2), q(0.05, -0.04), q(0.085, 0.04), q(0.055, 0.078), q(0.0, 0.085)], lw * 1.15, P.outline, seed + 31);
      fInk(g, [q(-0.045, 0.035), q(-0.08, 0.055), q(-0.055, 0.08), q(-0.02, 0.078)], lw * 0.85, P.outline, seed + 32);
      dotPx(g, q(-0.01, 0.01)[0], q(-0.01, 0.01)[1], hw * 0.016, P.gloss);
    } else {
      g.save();
      g.fillStyle = SHADE_SKIN;
      g.beginPath();
      g.ellipse(nx + lookN + hw * 0.02, ny + hh * 0.01, hw * 0.05, hh * 0.035, 0, 0, TAU);
      g.fill();
      g.restore();
      fInk(g, [[nx + lookN + hw * 0.035, ny - hh * 0.06], [nx + lookN + hw * 0.055, ny + hh * 0.015], [nx + lookN + hw * 0.005, ny + hh * 0.04]], lw * 0.75, P.outline, seed + 31);
    }
    // mouth
    const mx = X(0) * 0.96, my = F.mouthY * hh;
    const mw = F.mouthW * hw * (0.55 + 0.45 * cos(phi));
    if (expr === 'half') {
      // a calm, confident half-smile: closed, the corner on the lit side lifts
      fInk(g, [[mx - mw * 0.9, my + hh * 0.012], [mx - mw * 0.25, my + hh * 0.035], [mx + mw * 0.45, my + hh * 0.022], [mx + mw * 1.0, my - hh * 0.028]], lw * 1.1, P.outline, seed + 41);
      fInk(g, [[mx + mw * 1.06, my - hh * 0.065], [mx + mw * 1.16, my - hh * 0.02]], lw * 0.6, P.outlineSoft, seed + 42);
      fInk(g, [[mx - mw * 0.35, my + hh * 0.075], [mx + mw * 0.3, my + hh * 0.07]], lw * 0.55, P.outlineSoft, seed + 44);
    } else if (expr === 'calm') {
      fInk(g, [[mx - mw, my - hh * 0.015], [mx, my + hh * 0.045], [mx + mw, my - hh * 0.015]], lw * 1.1, P.outline, seed + 41);
    } else if (expr === 'o') {
      const pts = fEll(mx, my + hh * 0.02, mw * 0.5, hh * 0.075, 16);
      fInk(g, pts, lw, P.outline, seed + 41, true, COL.mouth);
      g.save();
      g.beginPath();
      g.ellipse(mx, my + hh * 0.02, mw * 0.48, hh * 0.072, 0, 0, TAU);
      g.clip();
      g.fillStyle = COL.tongue;
      g.beginPath();
      g.ellipse(mx, my + hh * 0.085, mw * 0.4, hh * 0.04, 0, 0, TAU);
      g.fill();
      g.restore();
    } else {
      const wide = expr === 'grin' ? (F.chef ? 1.3 : 1.18) : 1;
      const w2 = mw * wide, d = hh * (expr === 'grin' ? (F.chef ? 0.15 : 0.12) : 0.1);
      const pts = [[mx - w2, my - hh * 0.03], [mx - w2 * 0.5, my - hh * 0.005], [mx, my], [mx + w2 * 0.5, my - hh * 0.005], [mx + w2, my - hh * 0.03], [mx + w2 * 0.62, my + d * 0.72], [mx, my + d], [mx - w2 * 0.62, my + d * 0.72]];
      g.save();
      g.beginPath();
      crTrace(g, pts, true);
      g.fillStyle = COL.mouth;
      g.fill();
      g.clip();
      g.fillStyle = COL.tongue;
      g.beginPath();
      g.ellipse(mx, my + d * 1.02, w2 * 0.5, d * 0.42, 0, 0, TAU);
      g.fill();
      g.fillStyle = P.gloss;
      g.fillRect(mx - w2, my - hh * 0.05, w2 * 2, d * 0.4 + hh * 0.05);
      g.restore();
      fInk(g, pts, lw, P.outline, seed + 41, true);
      if (F.lines || expr === 'grin') {
        for (const e of [-1, 1]) fInk(g, [[mx + e * w2 * 1.08, my - hh * 0.07], [mx + e * w2 * 1.18, my - hh * 0.02], [mx + e * w2 * 1.1, my + hh * 0.03]], lw * 0.6, P.outlineSoft, seed + 43 + e);
      }
    }
    // moustache over the mouth
    if (F.moustache) {
      const c = F.moustache;
      const s = c.big ? 1 : c.thin ? 0.62 : c.trim ? 0.74 : 0.8;
      const mt = ny + hh * 0.05;
      const pts = [[mx, mt], [mx + hw * 0.1 * s, mt - hh * 0.012], [mx + hw * 0.24 * s, mt + hh * 0.03], [mx + hw * 0.3 * s, mt + hh * 0.1 * s], [mx + hw * 0.2 * s, mt + hh * 0.075], [mx + hw * 0.08 * s, mt + hh * 0.07], [mx, mt + hh * 0.05], [mx - hw * 0.08 * s, mt + hh * 0.07], [mx - hw * 0.2 * s, mt + hh * 0.075], [mx - hw * 0.3 * s, mt + hh * 0.1 * s], [mx - hw * 0.24 * s, mt + hh * 0.03], [mx - hw * 0.1 * s, mt - hh * 0.012]];
      fInk(g, pts, lw * 0.9, P.outline, seed + 51, true, c.color);
      if (c.grey) fInk(g, [[mx + hw * 0.06, mt + hh * 0.02], [mx + hw * 0.16, mt + hh * 0.045]], lw * 0.5, c.grey, seed + 53);
    }
    // glasses
    if (F.glasses && eyes.length) {
      const gw = lw * 0.95;
      for (const E of eyes) {
        const rr = [];
        const gx = E.rx * 1.55, gy = E.ry * 1.25;
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          const c = cos(a), s2 = sin(a);
          const kx = Math.sign(c) * Math.pow(Math.abs(c), 0.7), ky = Math.sign(s2) * Math.pow(Math.abs(s2), 0.7);
          rr.push([E.ex + kx * gx, ey + ky * gy]);
        }
        g.fillStyle = COL.lens;
        g.beginPath();
        crTrace(g, rr, true);
        g.fill();
        fInk(g, rr, gw, P.outline, seed + 61 + E.e, true);
        glossLine(g, [E.ex - gx * 0.55, ey - gy * 0.1], [E.ex - gx * 0.15, ey - gy * 0.6], Math.max(1, gw * 0.9), 0.7);
      }
      if (eyes.length === 2) {
        const a = eyes[0], b = eyes[1];
        fInk(g, [[a.ex + a.rx * 1.5, ey - a.ry * 0.3], [(a.ex + b.ex) / 2, ey - a.ry * 0.6], [b.ex - b.rx * 1.5, ey - b.ry * 0.3]], gw, P.outline, seed + 65);
      }
    }
  }

  // ===========================================================================
  // The figure
  // ===========================================================================

  /**
   * drawFigure(R, B, J, p, st): dress the joints. st: kind 'team'|'chef'|'waitress', skin,
   * top ('tee'|'sweater'|'shirt'|'hoodie'|'jersey'|'octo'|'chef'|'blouse'), topColor, sleeve,
   * legColor, shoe, hair, hairColor, back, side, look (-1..1), faceKey, face (paintFace spec),
   * spec, hands, bandana, gleam, tails, armBehind ('L'|'R'|null), hemV (pullOn clip)
   */
  function drawFigure(R, B, J, p, st) {
    const back = st.back;
    const T = B.torso * p.torsoK;
    const tf = torsoFrame(B, J, p);
    const phi = back ? 0 : Math.asin(clamp(st.look, -0.95, 0.95)) * 0.9;
    const wfh = 0.88 + 0.12 * J.wf;
    const H = headMap(B, J, wfh);
    const HM = (list, warp) => list.map((q) => H(warp ? warpX(q[0], phi) : q[0], q[1]));

    // 1. behind the body: long hair, ponytail, bun, the bandana tails
    if (!back) {
      if (st.kind === 'chef' && st.bandana === 'on') drawBandanaTails(R, B, H, st, false);
      const hb = st.hair ? hairBackPts(st.hair) : null;
      if (hb) R.shaded(HM(hb, st.hair !== 'afro'), hairOf(st.hairColor), 2, SHADE, 0.16);
    }
    // 2. legs, far leg first
    const order = J.zL > J.zR ? [1, -1] : [-1, 1];
    if (!st.sitBack && !st.upper) for (const s of order) drawLeg(R, B, J, s, st);
    // 3. trousers top / skirt
    if (st.kind === 'team' && !st.sitBack && !st.upper) {
      const pts = [[-B.hip * 0.97, 6], [-B.hip, 0], [-B.hip * 0.98, -5.2], [-B.hipJ * 0.45, -7.4], [0, -6.2], [B.hipJ * 0.45, -7.4], [B.hip * 0.98, -5.2], [B.hip, 0], [B.hip * 0.97, 6]];
      R.shaded(pts.map((q) => tf(q[0], q[1])), st.legColor, 30, SHADE, 0.16);
    }
    if (st.kind === 'waitress') drawSkirt(R, B, J, p, st, tf);
    // arm behind the torso (side views)
    if (st.armBehind) drawArm(R, B, J, st.armBehind === 'L' ? -1 : 1, st);
    // 4. neck
    R.limb(l2(J.chest, J.head, -0.12), l2(J.chest, J.head, 0.55), B.neckR, B.neckR * 0.95, st.skin, 20, SHADE_SKIN);
    // 5. torso
    drawTorso(R, B, J, p, st, tf, T);
    // 6. arms
    if (!st.skipArms) for (const s of [-1, 1]) if (st.armBehind !== (s < 0 ? 'L' : 'R')) drawArm(R, B, J, s, st);
    // 7. head
    drawHead(R, B, J, p, st, H, HM, phi, wfh);
  }

  function drawLeg(R, B, J, s, st) {
    const S = s < 0 ? 'L' : 'R';
    const hip = J['hip' + S], knee = J['knee' + S], ank = J['ank' + S], z = J['z' + S];
    const k = s < 0 ? 100 : 120;
    if (st.sit && st.side) {
      // side view seated: the far leg hides behind the near one
    }
    drawShoe(R, B, ank, s, z, st.shoe, k, st.side || 0);
    if (st.kind === 'chef') {
      R.limb(l2(hip, knee, 0.75), ank, B.shinR * 1.12, B.shinR * 0.8, st.skin, k + 3, SHADE_SKIN);
      const top = l2(knee, ank, 0.3);
      R.limb(top, l2(knee, ank, 1.02), B.shinR * 1.1, B.shinR * 0.86, COL.sock, k + 4, SHADE);
      for (const f of [0.37]) {
        const c = l2(knee, ank, f), an = atan2(ank[1] - knee[1], ank[0] - knee[0]);
        const nx = -sin(an) * B.shinR * 1.02, ny = cos(an) * B.shinR * 1.02;
        R.line([[c[0] - nx, c[1] - ny], [c[0] + nx, c[1] + ny]], k + 5 + f * 10, { color: COL.sockBand, width: R.dw * 1.3 });
      }
      R.limb(hip, l2(hip, knee, 0.64), B.thighR, B.thighR * 0.96, P.lederhosen, k + 7, SHADE);
      const e = l2(hip, knee, 0.64), d = l2(hip, knee, 0.5);
      const a = atan2(e[1] - hip[1], e[0] - hip[0]);
      const n = [-sin(a) * B.thighR * 0.95, cos(a) * B.thighR * 0.95];
      R.line([[d[0] - n[0], d[1] - n[1]], [d[0] + n[0], d[1] + n[1]]], k + 8, { color: COL.lederDeep, alpha: 0.9 });
    } else if (st.kind === 'waitress') {
      R.limb(knee, ank, B.shinR * 1.05, B.shinR * 0.78, st.skin, k + 3, SHADE_SKIN);
      R.limb(l2(knee, ank, 0.62), l2(knee, ank, 1.02), B.shinR * 0.94, B.shinR * 0.82, COL.sock, k + 4, SHADE);
    } else {
      R.limb2(hip, knee, ank, B.thighR, B.shinR * 1.12, B.shinR * 1.0, st.legColor, k + 3, SHADE);
    }
  }

  function drawSkirt(R, B, J, p, st, tf) {
    const T = B.torso * p.torsoK;
    const sway = st.skirtSway || 0;
    const top = T * 0.36;
    const hy = pelvisY(B) + B.ankleH + B.shin * 0.48, hw = B.hip * 1.45;
    const pts = [
      [-B.waist * 1.02, top], [-B.hip * 1.08, top * 0.45], [-hw * 0.95 + sway, hy + 8], [-hw + sway * 1.4, hy + 0.6],
      [-hw * 0.6 + sway * 1.4, hy - 0.9], [-hw * 0.2 + sway * 1.4, hy - 0.2], [hw * 0.2 + sway * 1.4, hy - 0.9], [hw * 0.6 + sway * 1.4, hy - 0.2],
      [hw + sway * 1.4, hy + 0.6], [hw * 0.95 + sway, hy + 8], [B.hip * 1.08, top * 0.45], [B.waist * 1.02, top],
    ].map((q) => tf(q[0], q[1]));
    R.shaded(pts, P.dirndlSkirt, 31, SHADE, 0.2);
    for (const fx of [-0.55, -0.1, 0.4]) R.line([tf(B.waist * fx * 1.4, top * 0.5), tf(hw * fx * 1.15 + sway * 1.2, hy + 1.5)], 32 + fx * 10, { color: P.outline, alpha: 0.35 });
    st.skirtHem = hy;
  }

  function drawTorso(R, B, J, p, st, tf, T) {
    const back = st.back;
    const top = st.top;
    const F = (list) => list.map((q) => tf(q[0], q[1]));
    let hem = -3.4, neckW = B.neckR * 1.15, dip = back ? 0.5 : -0.6;
    if (top === 'jersey' && !back) dip = -3.2;
    if (top === 'chef' && !back) dip = -4.2;
    if (top === 'blouse') (hem = T * 0.36), (dip = back ? 0.5 : -1.5);
    const color = st.topColor;
    const outline = torsoOutline(B, T, hem, neckW, dip, st.kind === 'chef' ? 1.1 : 1);
    // hood behind the neck
    if (top === 'hoodie') {
      const hood = back
        ? [[-B.shW * 0.75, T - 1], [-B.shW * 0.7, T + 2.2], [0, T + 3], [B.shW * 0.7, T + 2.2], [B.shW * 0.75, T - 1], [B.shW * 0.4, T - 9], [0, T - 11], [-B.shW * 0.4, T - 9]]
        : [[-B.shW * 0.72, T - 0.5], [-B.shW * 0.66, T + 2.8], [0, T + 3.4], [B.shW * 0.66, T + 2.8], [B.shW * 0.72, T - 0.5]];
      if (!back) R.shaded(F(hood), L.mix(color, P.outline, 0.12), 35, SHADE, 0.2);
      R.shaded(F(outline), color, 36, SHADE, 0.2);
      if (back) R.shaded(F(hood), L.mix(color, P.outline, 0.1), 37, SHADE, 0.2);
    } else {
      R.shaded(F(outline), color, 36, SHADE, top === 'chef' ? 0.14 : 0.2);
    }
    // pullOn: the jersey slides down over the casual top
    if (st.overJersey != null) return drawJerseyOver(R, B, J, p, st, tf, T);
    if (st.kind === 'chef') return drawChefTorsoDetails(R, B, J, p, st, tf, T, F);
    if (st.kind === 'waitress') return drawBodice(R, B, J, p, st, tf, T, F);
    const detail = { color: P.outline, alpha: 0.55 };
    if (!back) {
      if (top === 'tee' || top === 'sweater' || top === 'hoodie' || top === 'octo') {
        const band = [[-neckW * 1.28, T + 1.2], [0, T - 1.6], [neckW * 1.28, T + 1.2], [neckW * 0.95, T + 1.2], [0, T - 0.5], [-neckW * 0.95, T + 1.2]];
        R.shape(F(band), top === 'octo' ? P.fesbBlue : L.mix(color, P.outline, 0.2), 38, { width: R.ow * 0.6 });
      }
      if (top === 'sweater') R.line(F([[-B.hip * 0.95, hem + 2.2], [0, hem + 1.9], [B.hip * 0.95, hem + 2.2]]), 39, detail);
      if (top === 'hoodie') {
        R.line(F([[-B.hip * 0.5, T * 0.12], [-B.hip * 0.62, T * 0.4], [B.hip * 0.62, T * 0.4], [B.hip * 0.5, T * 0.12]]), 39, detail);
        R.line(F([[-1.3, T - 1.2], [-1.5, T - 6.5]]), 40, { color: COL.white });
        R.line(F([[1.3, T - 1.2], [1.5, T - 6.5]]), 41, { color: COL.white });
      }
      if (top === 'shirt') {
        R.shape(F([[-neckW * 1.6, T + 1.3], [-0.2, T - 2.6], [-neckW * 0.6, T - 3.2], [-neckW * 1.8, T - 0.8]]), L.mix(color, P.gloss, 0.25), 38, { width: R.ow * 0.6 });
        R.shape(F([[neckW * 1.6, T + 1.3], [0.2, T - 2.6], [neckW * 0.6, T - 3.2], [neckW * 1.8, T - 0.8]]), L.mix(color, P.gloss, 0.25), 39, { width: R.ow * 0.6 });
        R.line(F([[0.4, T - 2.8], [0.5, hem + 0.8]]), 40, detail);
        for (let i = 0; i < 3; i++) R.dot(tf(1.3, T - 7 - i * 6.5), 0.45, L.mix(color, P.gloss, 0.6));
      }
      if (top === 'jersey') {
        const v = [[-neckW * 1.3, T + 1.2], [0, T - 4.4], [neckW * 1.3, T + 1.2], [neckW * 0.95, T + 1.2], [0, T - 3.0], [-neckW * 0.95, T + 1.2]];
        R.shape(F(v), COL.white, 38, { width: R.ow * 0.6 });
        chestLogo(R, tf(B.chest * 0.44, T - 8.2), B.chest * 0.36 * J.wf, B.chest * 0.36);
      }
      if (top === 'octo') octoChest(R, tf(0, T * 0.52), B.chest * 1.05);
    } else {
      R.line(F([[-neckW * 1.2, T + 1.1], [0, T + 0.2], [neckW * 1.2, T + 1.1]]), 38, { color: P.outline, alpha: 0.5 });
      if (top === 'jersey') {
        // "FESB" over a huge "9": the number is 45 % of the back's height
        const wq = (0.45 * (T + 3.4)) / 1.12;
        const c = R.m(tf(0, T * 0.47));
        if (R.draw >= 1) jerseyPrint(R.ctx, c[0], c[1], wq * J.wf * R.U, wq * R.U, st.gleam || 0);
      }
      if (top === 'octo') chestLogo(R, tf(0, T - 6), B.chest * 0.3 * J.wf, B.chest * 0.3);
      if (top === 'shirt') R.line(F([[-B.chest * 0.95, T - 5], [0, T - 6.5], [B.chest * 0.95, T - 5]]), 39, { color: P.outline, alpha: 0.4 });
    }
  }

  function drawJerseyOver(R, B, J, p, st, tf, T) {
    const hemV = st.overJersey;
    const neckW = B.neckR * 1.15;
    const outline = torsoOutline(B, T, -3.4, neckW, -3.2, 1).map((q) => [q[0] * 1.04, Math.max(q[1], hemV)]);
    const F = (list) => list.map((q) => tf(q[0], q[1]));
    R.shaded(F(outline), P.fesbBlue, 44, SHADE, 0.2);
    R.shape(F([[-neckW * 1.3, T + 1.2], [0, T - 4.4], [neckW * 1.3, T + 1.2], [neckW * 0.95, T + 1.2], [0, T - 3.0], [-neckW * 0.95, T + 1.2]]), COL.white, 45, { width: R.ow * 0.6 });
    R.line(F([[-B.hip, hemV + 0.6], [0, hemV + 1.4], [B.hip, hemV + 0.6]]), 46, { color: P.outline, alpha: 0.7 });
  }

  function drawChefTorsoDetails(R, B, J, p, st, tf, T, F) {
    const back = st.back;
    const neckW = B.neckR * 1.15;
    if (!back) {
      // open collar
      R.shape(F([[-neckW * 1.25, T + 1.3], [-0.4, T - 4.6], [-neckW * 1.5, T - 3.6], [-neckW * 2.1, T - 0.2]]), P.shirtWhite, 38, { width: R.ow * 0.7, shade: { color: SHADE, side: 'right', frac: 0.2 } });
      R.shape(F([[neckW * 1.25, T + 1.3], [0.4, T - 4.6], [neckW * 1.5, T - 3.6], [neckW * 2.1, T - 0.2]]), P.shirtWhite, 39, { width: R.ow * 0.7, shade: { color: SHADE, side: 'right', frac: 0.2 } });
      R.line(F([[B.chest * 0.2, T - 9], [B.chest * 0.55, T - 14]]), 40, { alpha: 0.6 });
      R.line(F([[-B.chest * 0.7, T - 13], [-B.chest * 0.35, T - 16]]), 41, { alpha: 0.6 });
    }
    // lederhosen seat (over the tucked shirt)
    const wb = T * 0.33;
    const ph = [[-B.waist * 1.0, wb], [-B.hip * 1.02, wb * 0.4], [-B.hip * 1.04, -2], [-B.hip * 0.98, -6], [-B.hipJ * 0.45, -8.2], [0, -7], [B.hipJ * 0.45, -8.2], [B.hip * 0.98, -6], [B.hip * 1.04, -2], [B.hip * 1.02, wb * 0.4], [B.waist * 1.0, wb]];
    R.shaded(F(ph), P.lederhosen, 50, SHADE, 0.16);
    R.line(F([[-B.waist * 0.98, wb - 2.4], [0, wb - 2.6], [B.waist * 0.98, wb - 2.4]]), 51, { color: COL.lederDeep });
    if (!back) {
      // front flap with two horn buttons
      R.line(F([[-B.hipJ * 0.95, wb - 2.6], [-B.hipJ * 0.95, -3], [0, -5.4], [B.hipJ * 0.95, -3], [B.hipJ * 0.95, wb - 2.6]]), 52, { color: COL.lederDeep });
      R.dot(tf(-B.hipJ * 0.95, wb - 4.2), 0.75, P.woodLight);
      R.dot(tf(B.hipJ * 0.95, wb - 4.2), 0.75, P.woodLight);
    }
    // suspenders
    const sw = 1.35;
    const strap = (x0, x1) => [[x0 - sw, wb - 0.6], [x1 - sw, T + 0.8], [x1 + sw, T + 0.8], [x0 + sw, wb - 0.6]];
    if (!back) {
      R.shape(F(strap(-B.waist * 0.5, -B.shW * 0.56)), P.lederhosen, 53, { width: R.ow * 0.7, smooth: false });
      R.shape(F(strap(B.waist * 0.5, B.shW * 0.56)), P.lederhosen, 54, { width: R.ow * 0.7, smooth: false });
      const cy = T * 0.74;
      const cx0 = -B.waist * 0.5 + (-B.shW * 0.56 + B.waist * 0.5) * ((cy - wb) / (T - wb)) - sw;
      const bar = [[cx0, cy + 2.3], [-cx0, cy + 2.3], [-cx0, cy - 2.3], [cx0, cy - 2.3]];
      R.shape(F(bar), P.lederhosen, 55, { width: R.ow * 0.7, smooth: false, shade: { color: SHADE, side: 'bottom', frac: 0.3 } });
      // the embroidered emblem on the cross strap
      const c = tf(0, cy);
      R.dot(c, 1.25, COL.lederLight);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - PI / 2;
        R.dot(tf(cos(a) * 1.55 * 0.9, cy - sin(a) * 1.4), 0.6, P.bavWhite);
      }
      R.dot(c, 0.5, P.gold);
    } else {
      R.shape(F([[-B.waist * 0.45 - sw, wb - 0.6], [B.shW * 0.5 - sw, T + 0.8], [B.shW * 0.5 + sw, T + 0.8], [-B.waist * 0.45 + sw, wb - 0.6]]), P.lederhosen, 53, { width: R.ow * 0.7, smooth: false });
      R.shape(F([[B.waist * 0.45 - sw, wb - 0.6], [-B.shW * 0.5 - sw, T + 0.8], [-B.shW * 0.5 + sw, T + 0.8], [B.waist * 0.45 + sw, wb - 0.6]]), P.lederhosen, 54, { width: R.ow * 0.7, smooth: false });
    }
  }

  function drawBodice(R, B, J, p, st, tf, T, F) {
    const back = st.back;
    const wb = T * 0.36;
    // bodice: from the waist to the chest, straps over the shoulders, a modest scooped neckline
    const bod = [
      [-B.shW * 0.7, T + 0.5], [-B.shW * 0.42, T + 0.6], [-B.shW * 0.38, T - 4.5], [-B.chest * 0.5, T - 8.2], [0, T - 9.2], [B.chest * 0.5, T - 8.2], [B.shW * 0.38, T - 4.5], [B.shW * 0.42, T + 0.6], [B.shW * 0.7, T + 0.5],
      [B.shW + B.armR * 0.2, T - 2.5], [B.chest * 1.0, T - 7], [B.waist * 1.02, wb + 2], [B.waist * 0.6, wb - 1.2], [0, wb - 2.6], [-B.waist * 0.6, wb - 1.2], [-B.waist * 1.02, wb + 2], [-B.chest * 1.0, T - 7], [-(B.shW + B.armR * 0.2), T - 2.5],
    ];
    const bodBack = [[-B.shW * 0.8, T + 0.7], [B.shW * 0.8, T + 0.7], [B.shW + B.armR * 0.2, T - 2.5], [B.chest, T - 7], [B.waist * 1.02, wb + 2], [0, wb - 1], [-B.waist * 1.02, wb + 2], [-B.chest, T - 7], [-(B.shW + B.armR * 0.2), T - 2.5]];
    R.shaded(F(back ? bodBack : bod), P.dirndlBodice, 60, SHADE, 0.18);
    if (!back) {
      // blouse frill at the neck (modest, high)
      R.line(F([[-B.neckR * 1.5, T + 0.3], [-B.neckR * 0.8, T - 0.8], [0, T - 1.2], [B.neckR * 0.8, T - 0.8], [B.neckR * 1.5, T + 0.3]]), 61, { alpha: 0.6 });
      // lacing
      const y0 = T - 10, y1 = wb + 0.5, n = 4;
      for (let i = 0; i < n; i++) {
        const a = lerp(y0, y1, i / n), b = lerp(y0, y1, (i + 1) / n);
        R.line(F([[-1.6, a], [1.6, b]]), 62 + i, { color: COL.lace, width: R.dw * 1.1 });
        R.line(F([[1.6, a], [-1.6, b]]), 66 + i, { color: COL.lace, width: R.dw * 1.1 });
      }
      for (let i = 0; i <= n; i++) {
        const a = lerp(y0, y1, i / n);
        R.dot(tf(-1.9, a), 0.42, P.gloss);
        R.dot(tf(1.9, a), 0.42, P.gloss);
      }
      // apron with its waistband and the bow on her left (the viewer's right)
      const hy = st.skirtHem != null ? st.skirtHem : -12;
      const sway = (st.skirtSway || 0) * 1.3;
      const ap = [[-B.waist * 0.78, wb - 0.4], [-B.hip * 0.95 + sway * 0.6, hy + 12], [-B.hip * 0.98 + sway, hy + 3.4], [0 + sway, hy + 2.8], [B.hip * 0.98 + sway, hy + 3.4], [B.hip * 0.95 + sway * 0.6, hy + 12], [B.waist * 0.78, wb - 0.4]];
      R.shaded(F(ap), P.dirndlApron, 70, SHADE, 0.16);
      for (const fx of [-0.4, 0.15, 0.55]) R.line(F([[B.waist * fx, wb - 3], [B.hip * fx * 1.1 + sway, hy + 5]]), 71 + fx * 10, { color: P.outline, alpha: 0.28 });
      R.shape(F([[-B.waist * 1.03, wb + 0.4], [B.waist * 1.03, wb + 0.4], [B.waist * 1.03, wb - 1.5], [-B.waist * 1.03, wb - 1.5]]), P.dirndlApron, 73, { width: R.ow * 0.7, smooth: false });
      const bx = B.waist * 0.72, by = wb - 0.5;
      R.shape(F([[bx, by], [bx + 3.8, by + 2.4], [bx + 4.4, by - 0.4], [bx + 3.4, by - 2.2]]), P.dirndlApron, 74, { width: R.ow * 0.7 });
      R.shape(F([[bx, by], [bx - 3.2, by + 2.2], [bx - 3.9, by - 0.6], [bx - 2.6, by - 2.2]]), P.dirndlApron, 75, { width: R.ow * 0.7 });
      R.shape(F([[bx + 0.2, by - 0.6], [bx + 1.8, by - 7.5], [bx + 3.2, by - 7], [bx + 1.3, by - 0.2]]), P.dirndlApron, 76, { width: R.ow * 0.65 });
      R.shape(F([[bx - 0.2, by - 0.6], [bx - 0.6, by - 8.2], [bx + 0.9, by - 8.4], [bx + 0.9, by - 0.3]]), P.dirndlApron, 77, { width: R.ow * 0.65 });
      R.shape(ell(tf(bx, by)[0], tf(bx, by)[1], 1.1, 1.1, 10), P.dirndlApron, 78, { width: R.ow * 0.7 });
    }
  }

  function drawArm(R, B, J, s, st) {
    const S = s < 0 ? 'L' : 'R';
    const sh = J['sh' + S], el = J['el' + S], wr = J['wr' + S];
    const k = s < 0 ? 200 : 240;
    const skin = st.skin;
    const sleeve = st.sleeve;
    const sc = st.sleeveColor;
    if (sleeve === 'long') {
      R.limb2(sh, el, wr, B.armR, B.foreR * 1.1, B.foreR * 0.92, sc, k, SHADE);
      const fa = atan2(wr[1] - el[1], wr[0] - el[0]), c = l2(el, wr, 0.84), nx = -sin(fa) * B.foreR * 0.95, ny = cos(fa) * B.foreR * 0.95;
      R.line([[c[0] - nx, c[1] - ny], [c[0] + nx, c[1] + ny]], k + 1, { color: P.outline, alpha: 0.5 });
    } else if (sleeve === 'short' || sleeve === 'puff') {
      R.limb2(sh, el, wr, B.armR * 0.9, B.foreR * 1.02, B.foreR * 0.8, skin, k, SHADE_SKIN);
    } else {
      R.limb(el, wr, B.foreR, B.foreR * 0.8, skin, k, SHADE_SKIN);
    }
    if (sleeve === 'short' || sleeve === 'puff') {
      if (sleeve === 'puff') {
        const c = l2(sh, el, 0.2);
        R.shaded(ell(c[0], c[1], B.armR * 1.75, B.armR * 1.5, 16, atan2(el[1] - sh[1], el[0] - sh[0])), P.shirtWhite, k + 3, SHADE, 0.2);
        const e = l2(sh, el, 0.42);
        R.line([[e[0] - B.armR * 1.1, e[1] - 0.3], [e[0] + B.armR * 1.1, e[1] + 0.3]], k + 4, { alpha: 0.6 });
      } else {
        const end = l2(sh, el, 0.46);
        R.limb(l2(sh, el, -0.08), end, B.armR * 1.2, B.armR * 1.12, sc, k + 3, SHADE);
        if (st.sleeveTrim) R.limb(l2(sh, el, 0.38), l2(sh, el, 0.47), B.armR * 1.13, B.armR * 1.12, st.sleeveTrim, k + 4, false, { width: R.ow * 0.6 });
      }
    } else if (sleeve === 'rolled') {
      R.limb(sh, el, B.armR, B.foreR * 1.16, sc, k + 2, SHADE);
      R.limb(el, l2(el, wr, 0.22), B.foreR * 1.34, B.foreR * 1.26, sc, k + 3, SHADE);
      const a = l2(el, wr, 0.1), ang = atan2(wr[1] - el[1], wr[0] - el[0]), n = [-sin(ang) * B.foreR * 1.25, cos(ang) * B.foreR * 1.25];
      R.line([[a[0] - n[0], a[1] - n[1]], [a[0] + n[0], a[1] + n[1]]], k + 4, { alpha: 0.7 });
    }
    const hk = st.hands[s < 0 ? 0 : 1];
    drawHand(R, B, wr, J['ha' + S], s, hk, skin, k + 6, st.back);
  }

  function drawHead(R, B, J, p, st, H, HM, phi, wfh) {
    const back = st.back;
    const skin = st.skin;
    const chef = st.kind === 'chef';
    // ears
    for (const e of [-1, 1]) {
      const th = e * PI / 2 + phi;
      if (!back && cos(th) < -0.2) continue;
      const ex = back ? e * 0.5 : 0.5 * sin(clamp(th, -PI / 2, PI / 2)) * 1.0;
      const c = H(ex * 0.98, chef ? 0.06 : 0.07);
      const rx = B.headW * 0.085, ry = B.head * 0.13;
      R.shape(ell(c[0], c[1], rx, ry, 12, J.headAng), skin, 300 + e, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.2 } });
    }
    if (st.waitress && !back) for (const e of [-1, 1]) { const q = H(e * 0.5, 0.2); R.dot(q, B.headW * 0.035, P.gold); }
    // skull
    const jaw = chef ? 0.12 : st.kind === 'waitress' ? 0.16 : st.spec && st.spec.build === 'stocky' ? 0.1 : st.spec && st.spec.build === 'slim' ? 0.17 : 0.13;
    R.shape(HM(headShape(jaw, chef ? 0.02 : st.kind === 'team' ? 0.07 : 0.04)), skin, 310, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.15 } });
    if (back) {
      if (chef) return drawChefHeadBack(R, B, J, st, H, HM);
      const hc = hairCoverPts(st.hair);
      R.shaded(HM(hc), st.hair === 'buzz' ? L.mix(hairOf(st.hairColor), st.skin, 0.3) : hairOf(st.hairColor), 320, SHADE, 0.16);
      if (st.hair === 'ponytail') {
        R.shaded(HM([[-0.1, 0.0], [0.1, 0.0], [0.14, 0.5], [0.06, 0.95], [-0.04, 0.98], [-0.12, 0.5]]), hairOf(st.hairColor), 321, SHADE, 0.2);
        R.shape(HM([[-0.1, -0.02], [0.1, -0.02], [0.1, 0.06], [-0.1, 0.06]]), P.dirndlSkirt, 322, { width: R.ow * 0.5 });
      }
      if (st.hair === 'bun') R.shaded(HM(ell(0, -0.45, 0.2, 0.17, 16)), hairOf(st.hairColor), 323, SHADE, 0.2);
      if (st.hair === 'tied') {
        R.shaded(HM(ell(0, -0.3, 0.15, 0.13, 14)), hairOf(st.hairColor), 324, SHADE, 0.2);
        R.shape(HM([[-0.1, -0.18], [0.1, -0.18], [0.1, -0.12], [-0.1, -0.12]]), P.outlineSoft, 325, { width: R.ow * 0.5 });
      }
      if (st.kind === 'waitress') drawBraid(R, B, H, 0, true);
      return;
    }
    // beard mass (live) before the features
    if (chef) {
      // a short, neatly trimmed beard along the jaw and chin (about 12 px at an 800 px figure)
      R.shaded(HM(CHEF_BEARD, true), P.beard, 330, SHADE, 0.14);
      const hl = P.beardLight || P.beard, gr = P.beardGrey;
      R.line(HM([[-0.38, 0.36], [-0.28, 0.45]], true), 331, { color: hl, width: R.dw * 1.4 });
      R.line(HM([[-0.07, 0.56], [-0.01, 0.6]], true), 332, { color: gr, width: R.dw * 0.9 });
      R.line(HM([[0.06, 0.54], [0.11, 0.58]], true), 333, { color: gr, width: R.dw * 0.9 });
      R.line(HM([[-0.475, 0.12], [-0.465, 0.2]], true), 334, { color: gr, width: R.dw * 0.8 });
      R.line(HM([[0.475, 0.13], [0.465, 0.21]], true), 335, { color: gr, width: R.dw * 0.8 });
    } else if (st.spec && st.spec.beard === 'stubble') {
      R.fill(HM([[-0.49, 0.04], [-0.47, 0.28], [-0.34, 0.47], [-0.16, 0.55], [0, 0.57], [0.16, 0.55], [0.34, 0.47], [0.47, 0.28], [0.49, 0.04], [0.38, 0.2], [0.2, 0.2], [0.12, 0.33], [0, 0.35], [-0.12, 0.33], [-0.2, 0.2], [-0.38, 0.2]], true), L.rgba(hairOf(st.hairColor), 0.24));
    } else if (st.spec && st.spec.beard === 'short') {
      const beard = [[-0.48, 0.14], [-0.45, 0.32], [-0.34, 0.47], [-0.17, 0.55], [0, 0.57], [0.17, 0.55], [0.34, 0.47], [0.45, 0.32], [0.48, 0.14], [0.4, 0.27], [0.22, 0.37], [0.1, 0.39], [0, 0.41], [-0.1, 0.39], [-0.22, 0.37], [-0.4, 0.27]];
      R.shaded(HM(beard, true), L.mix(hairOf(st.hairColor), skinOf(st.spec.skin), 0.3), 330, SHADE, 0.16, { width: R.ow * 0.8 });
    }
    // face (cached)
    faceBlit(R, J, B, wfh, st.faceKey + '|' + (st.face.expr || '') + '|' + Math.round((st.look || 0) * 10) + '|' + Math.round((p.nod || 0) * 4), Object.assign({}, st.face, { look: st.look, nod: p.nod }));
    // hair front, bandana, braid
    if (chef) {
      if (st.bandana === 'on') drawBandana(R, B, H, HM, st, phi);
      drawGleam(R, B, H, st);
      return;
    }
    if (st.kind === 'waitress') {
      R.shaded(HM([[-0.5, 0.04], [-0.55, -0.22], [-0.46, -0.46], [-0.24, -0.6], [0, -0.63], [0.24, -0.6], [0.46, -0.46], [0.55, -0.22], [0.5, 0.04], [0.44, -0.12], [0.3, -0.26], [0.1, -0.3], [0, -0.26], [-0.1, -0.3], [-0.3, -0.26], [-0.44, -0.12]], true), P.hairBlonde, 340, SHADE, 0.14);
      drawBraid(R, B, H, phi, false);
      return;
    }
    const hc = hairOf(st.hairColor);
    if (Math.abs(st.look) > 0.55) {
      // near-profile (turns): the hair covers the back of the skull, the near ear sits on top
      const sg = st.look > 0 ? 1 : -1;
      const bx = (y) => lerp(0.34, -0.1, clamp((y + 0.42) / 0.5));
      const prof = hairCoverPts(st.hair).map((q) => {
        const x = sg * q[0];
        return [sg * Math.min(x, bx(q[1])), q[1]];
      });
      R.shaded(HM(prof), hc, 341, SHADE, 0.14);
      const th = -sg * PI / 2 + phi;
      const ec = H(0.5 * sin(clamp(th, -PI / 2, PI / 2)), 0.07);
      R.shape(ell(ec[0], ec[1], B.headW * 0.085, B.head * 0.13, 12, J.headAng), st.skin, 342, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.2 } });
      return;
    }
    R.shaded(HM(hairFrontPts(st.hair), true), st.hair === 'buzz' ? L.mix(hc, st.skin, 0.3) : hc, 340, SHADE, 0.14, st.hair === 'buzz' ? { width: R.ow * 0.75 } : undefined);
    const sheenA = H(warpX(-0.3, phi), -0.44), sheenB = H(warpX(-0.12, phi), -0.54);
    R.gloss(sheenA, sheenB, B.headW * 0.04, 0.35);
  }

  function drawBraid(R, B, H, phi, back) {
    const n = 11, pts = [], inner = [];
    for (let i = 0; i <= n; i++) {
      const a = PI + 0.32 + (i / n) * (PI - 0.64);
      pts.push([cos(a) * 0.56, -0.02 + sin(a) * 0.66]);
      inner.push([cos(a) * 0.45, -0.02 + sin(a) * 0.52]);
    }
    const band = [...pts, ...inner.reverse()].map((q) => H(back ? q[0] : warpX(q[0], phi), q[1]));
    R.shaded(band, P.hairBlonde, 350, SHADE, 0.12);
    for (let i = 0; i < n; i++) {
      const a0 = PI + 0.32 + ((i + 0.15) / n) * (PI - 0.64), a1 = PI + 0.32 + ((i + 0.85) / n) * (PI - 0.64), am = (a0 + a1) / 2;
      const o = [cos(a0) * 0.545, -0.02 + sin(a0) * 0.645], m = [cos(am) * 0.5, -0.02 + sin(am) * 0.585], q = [cos(a1) * 0.46, -0.02 + sin(a1) * 0.535];
      R.line([o, m, q].map((z) => H(back ? z[0] : warpX(z[0], phi), z[1])), 351 + i, { color: P.wheatDeep, alpha: 0.9 });
    }
  }

  function drawBandanaTails(R, B, H, st, back) {
    const fl = st.tails || 0;
    const side = back ? 0 : st.look > 0.05 ? -1 : st.look < -0.05 ? 1 : -1;
    const kx = back ? 0 : side * 0.5, ky = back ? 0.02 : -0.12;
    const k = H(kx, ky);
    for (const e of [0, 1]) {
      const a = (back ? PI / 2 + (e ? 0.35 : -0.35) : side < 0 ? PI * 0.72 + e * 0.35 : PI * 0.28 - e * 0.35) + fl * (e ? 1.1 : 0.8);
      const len = B.head * (0.36 + e * 0.06);
      const w = B.head * 0.07;
      const tip = [k[0] + cos(a) * len, k[1] + sin(a) * len];
      const ang = a + PI / 2;
      const pts = [[k[0] + cos(ang) * w, k[1] + sin(ang) * w], [tip[0] + cos(ang) * w * 0.5, tip[1] + sin(ang) * w * 0.5], [tip[0] + cos(a) * w * 0.6, tip[1] + sin(a) * w * 0.6], [tip[0] - cos(ang) * w * 0.9, tip[1] - sin(ang) * w * 0.9], [k[0] - cos(ang) * w, k[1] - sin(ang) * w]];
      R.shape(pts, P.bandana, 360 + e, { shade: { color: SHADE, side: 'right', frac: 0.25 } });
      R.dot(l2(k, tip, 0.6), B.head * 0.018, P.bandanaDot);
    }
    R.shape(ell(k[0], k[1], B.head * 0.08, B.head * 0.065, 12), P.bandana, 363, { shade: { color: SHADE, side: 'right', frac: 0.25 } });
  }

  const BANDANA_DOTS = [[-0.34, -0.3], [-0.16, -0.4], [0.05, -0.44], [0.26, -0.36], [0.4, -0.22], [-0.42, -0.12], [-0.05, -0.33], [0.16, -0.26], [-0.26, -0.45], [0.33, -0.43], [0.02, -0.52], [-0.45, -0.3]];
  function bandanaPts(front) {
    const out = [];
    for (let i = 0; i <= 12; i++) {
      const a = -(i / 12) * PI;
      out.push([0.525 * cos(a), -0.015 + 0.535 * sin(a)]);
    }
    if (front) out.push([-0.46, -0.16], [-0.26, -0.28], [0, -0.32], [0.26, -0.28], [0.46, -0.16]);
    else out.push([-0.53, 0.06], [-0.3, 0.12], [0, 0.14], [0.3, 0.12], [0.53, 0.06]);
    return out;
  }
  function drawBandana(R, B, H, HM, st, phi) {
    const pts = HM(bandanaPts(true), true);
    R.shape(pts, P.bandana, 370, { shade: { color: SHADE, side: 'right', frac: 0.12 } });
    const S = R.ctx;
    if (R.draw >= 1) {
      S.save();
      S.beginPath();
      crTrace(S, R.M(pts), true);
      S.clip();
      for (const d of BANDANA_DOTS) R.dot(H(warpX(d[0], phi), d[1]), B.headW * 0.028, P.bandanaDot);
      S.restore();
    }
    R.line(HM([[-0.48, -0.22], [-0.27, -0.34], [0, -0.38], [0.27, -0.34], [0.48, -0.22]], true), 371, { color: L.mix(P.bandana, P.outline, 0.45) });
  }
  function drawGleam(R, B, H, st) {
    const g = st.gleam || 0;
    const on = st.bandana === 'on';
    const a = on ? H(-0.33, -0.12) : H(-0.36, -0.2), b = on ? H(-0.2, -0.22) : H(-0.16, -0.42);
    const w = B.headW * (on ? 0.045 : 0.07) * (1 + g * 0.6);
    if (R.draw < 1) return;
    const ctx = R.ctx, A = R.m(a), Bp = R.m(b), m = R.m(on ? H(-0.3, -0.2) : H(-0.32, -0.36));
    ctx.save();
    ctx.strokeStyle = P.gloss;
    ctx.lineCap = 'round';
    ctx.globalAlpha *= 0.92;
    ctx.lineWidth = w * R.U;
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.quadraticCurveTo(m[0], m[1], Bp[0], Bp[1]);
    ctx.stroke();
    ctx.restore();
    const d = on ? H(-0.1, -0.26) : H(-0.05, -0.47);
    R.dot(d, B.headW * 0.028 * (1 + g * 0.5), P.gloss);
    if (g > 0.01) {
      const sp = PR().sparkle;
      const q = R.m(on ? H(-0.14, -0.3) : H(-0.1, -0.44));
      const r = B.headW * R.U * (0.25 + 0.3 * g);
      if (typeof sp === 'function') sp(R.ctx, q[0], q[1], r, clamp(g));
    }
  }
  function drawChefHeadBack(R, B, J, st, H, HM) {
    // beard sides peeking out at the jaw
    for (const e of [-1, 1]) R.shaded(HM([[e * 0.47, 0.06], [e * 0.52, 0.22], [e * 0.47, 0.4], [e * 0.34, 0.52], [e * 0.38, 0.36], [e * 0.44, 0.2]]), P.beard, 380 + e, SHADE, 0.2);
    if (st.bandana === 'on') {
      R.shape(HM(bandanaPts(false)), P.bandana, 383, { shade: { color: SHADE, side: 'right', frac: 0.12 } });
      for (const d of BANDANA_DOTS) R.dot(H(d[0] * 0.95, d[1] * 0.9 + 0.08), B.headW * 0.028, P.bandanaDot);
      drawBandanaTails(R, B, H, st, true);
    } else {
      R.gloss(H(-0.34, -0.16), H(-0.18, -0.36), B.headW * 0.06, 0.9);
    }
  }

  // ---------------------------------------------------------------------------
  // Prints and logos (cached)
  // ---------------------------------------------------------------------------

  function logoCanvas(size) {
    const S = FILM.S || 1, q = bucket(size);
    const fl = PR().fesbLogo;
    return {
      q,
      c: cacheGet('logo|' + q.toFixed(2) + '|' + S + '|' + (typeof fl === 'function'), () => {
        const cv = newCanvas(q * 1.2 * S, q * 1.2 * S);
        const g = cv.getContext('2d');
        g.scale(S, S);
        if (typeof fl === 'function') fl(g, q * 0.6, q * 0.6, q, { outline: true, boil: false });
        else {
          g.fillStyle = P.fesbBlue;
          g.fillRect(q * 0.1, q * 0.1, q, q);
          g.fillStyle = P.gloss;
          g.fillRect(q * 0.27, q * 0.27, q * 0.17, q * 0.66);
          g.fillRect(q * 0.27, q * 0.27, q * 0.5, q * 0.17);
          g.fillRect(q * 0.27, q * 0.6, q * 0.5, q * 0.17);
        }
        return cv;
      }),
    };
  }
  /** the FESB logo on a chest at centre c (unit), width w (unit), height hgt (unit) */
  function chestLogo(R, c, w, hgt) {
    if (R.draw < 1) return;
    const pxW = Math.abs(w) * R.U, pxH = hgt * R.U;
    const L0 = logoCanvas(pxH);
    const p = R.m(c);
    const sx = pxW / L0.q, sy = pxH / L0.q;
    R.ctx.drawImage(L0.c, p[0] - L0.q * 0.6 * sx, p[1] - L0.q * 0.6 * sy, L0.q * 1.2 * sx, L0.q * 1.2 * sy);
  }
  function octoCanvas(size) {
    // one bucket for every tee: props.lockup costs ~20 ms a call and its line boils with lib.T, so it
    // is drawn at most once per boil drawing and scaled to each tee
    const S = FILM.S || 1, q = 160;
    const lk = PR().lockup;
    return {
      q,
      // the lockup's line boils with lib.T, so the boil drawing is part of the key
      c: cacheGet('octo|' + q.toFixed(2) + '|' + S + '|' + L.boil(L.T), () => {
        const cv = newCanvas(q * 1.3 * S, q * 1.1 * S);
        const g = cv.getContext('2d');
        g.scale(S, S);
        if (typeof lk === 'function') lk(g, q * 0.65, q * 0.55, q / 900, { mug: 1, foam: 1, wheat: 1, hops: 1, word: 1, year: 1, rim: 1, bubbles: 0, t: 0, sweep: 0, boil: false });
        return cv;
      }),
    };
  }
  function octoChest(R, c, size) {
    if (R.draw < 1) return;
    const O = octoCanvas(size * R.U);
    const p = R.m(c);
    const s = (size * R.U) / O.q;
    R.ctx.drawImage(O.c, p[0] - O.q * 0.65 * s, p[1] - O.q * 0.55 * s, O.q * 1.3 * s, O.q * 1.1 * s);
  }

  /** the back print ("FESB" over a huge "9"): width w, the number 1.12 w tall; cached */
  function printCanvas(w, mask) {
    const S = FILM.S || 1, q = bucket(w);
    return {
      q,
      c: cacheGet('print|' + q.toFixed(2) + '|' + S + '|' + (mask ? 1 : 0), () => {
        const cw = q * 1.3, ch = q * 1.75;
        const cv = newCanvas(cw * S, ch * S);
        const g = cv.getContext('2d');
        g.scale(S, S);
        g.translate(cw / 2, 0);
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';
        g.lineJoin = 'round';
        let fs = q * 0.36;
        g.font = `900 ${fs}px ${FONT}`;
        const mw = g.measureText('FESB').width || fs * 2.6;
        fs *= q / mw;
        g.font = `900 ${fs}px ${FONT}`;
        const y1 = q * 0.1 + fs * 0.74;
        const outl = Math.max(1.5, q * 0.045);
        if (!mask) {
          g.lineWidth = outl * 2;
          g.strokeStyle = P.outline;
          g.strokeText('FESB', 0, y1);
        }
        g.fillStyle = P.gloss;
        g.fillText('FESB', 0, y1);
        let ns = q * 1.55;
        g.font = `900 ${ns}px ${FONT}`;
        const m9 = g.measureText('9');
        const asc = m9.actualBoundingBoxAscent || ns * 0.73;
        ns *= (q * 1.12) / asc;
        g.font = `900 ${ns}px ${FONT}`;
        const y2 = y1 + q * 0.12 + q * 1.12;
        g.save();
        g.translate(0, y2);
        g.scale(0.9, 1);
        if (!mask) {
          g.lineWidth = outl * 2.4;
          g.strokeStyle = P.outline;
          g.strokeText('9', 0, 0);
        }
        g.fillText('9', 0, 0);
        g.restore();
        return cv;
      }),
    };
  }
  /** draws the print centred at (x, y) in px: horizontal width wX, nominal width wY (sets the
   *  height, about 1.6 wY); never mirrored, so it reads on a flipped figure; optional gold gleam */
  function jerseyPrint(ctx, x, y, wX, wY, gleam) {
    const w = Math.max(4, Math.abs(wY || wX));
    const Pc = printCanvas(w, false);
    const sx = Math.abs(wX) / Pc.q, sy = w / Pc.q;
    const cw = Pc.q * 1.3, ch = Pc.q * 1.75;
    ctx.drawImage(Pc.c, x - (cw / 2) * sx, y - (ch / 2) * sy, cw * sx, ch * sy);
    if (gleam > 0 && gleam < 1) {
      const M = printCanvas(w, true);
      const S = FILM.S || 1;
      const sc = cacheGet('scratch|' + M.q.toFixed(2) + '|' + S, () => newCanvas(cw * S, ch * S));
      const g = sc.getContext('2d');
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'copy';
      g.drawImage(M.c, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.scale(S, S);
      const gx = lerp(-cw * 0.6, cw * 1.6, gleam);
      const gr = g.createLinearGradient(gx - cw * 0.35, 0, gx + cw * 0.05, ch * 0.4);
      gr.addColorStop(0, L.rgba(P.gold, 0));
      gr.addColorStop(0.5, L.rgba(P.beerLight, 0.95));
      gr.addColorStop(1, L.rgba(P.gold, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, cw, ch);
      g.restore();
      ctx.drawImage(sc, x - (cw / 2) * sx, y - (ch / 2) * sy, cw * sx, ch * sy);
    }
  }

  // ---------------------------------------------------------------------------
  // Mugs
  // ---------------------------------------------------------------------------

  function mugLocal(ctx, x, y, h, o) {
    const w = h * 0.69, f = o.flip ? -1 : 1;
    const lw = o.width || Math.max(1.5, (5 * h) / 300);
    const body = [[x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y], [x - w / 2, y]];
    const hdl = [[x + f * w * 0.45, y - h * 0.85], [x + f * w * 0.9, y - h * 0.8], [x + f * w * 0.92, y - h * 0.25], [x + f * w * 0.45, y - h * 0.2]];
    shapeFig(ctx, hdl, { fill: P.glass, width: lw, seed: 3 });
    shapeFig(ctx, body, { fill: P.beer, width: lw, seed: 4 });
    shapeFig(ctx, ell(x, y - h, w * 0.55, h * 0.12, 12), { fill: P.foam, width: lw, seed: 5 });
    return { handle: [x + f * 0.58 * h, y - 0.52 * h], rim: [x, y - h, w], logo: [x, y - h / 2, h * 0.23] };
  }
  function MUG(ctx, x, y, h, o) {
    const m = PR().mug;
    return typeof m === 'function' ? m(ctx, x, y, h, o) : mugLocal(ctx, x, y, h, o);
  }
  /** handle grip offset from the base centre for a mug of height h (px), from props.mug itself */
  function mugGrip(h, flip, tilt) {
    const m = PR().mug;
    let r = null;
    if (typeof m === 'function') {
      try {
        r = m(null, 0, 0, 100, { alpha: 0, flip: !!flip, tilt: 0 });
      } catch (e) {
        r = null;
      }
    }
    const hx = r && r.handle ? r.handle[0] / 100 : (flip ? -1 : 1) * 0.58;
    const hy = r && r.handle ? r.handle[1] / 100 : -0.52;
    const c = cos(tilt || 0), s = sin(tilt || 0);
    return [(hx * c - hy * s) * h, (hx * s + hy * c) * h];
  }

  // ===========================================================================
  // TEAM (art bible 10.3): fifteen men (skinA / skinB): nine who look 30 to 40, four in their
  // twenties, two older (45 to 55, greying, forehead lines). A third with light facial hair (stubble,
  // a short beard, a moustache) so the chef's full dark beard stays unique; glasses on four; nobody
  // bald but the chef. Extra fields beyond the contract: top, legs (the casual outfit) and tall.
  // ===========================================================================

  const TEAM = [
    { id: 'tm01', skin: 'skinA', age: 'mid', hair: 'short', hairColor: 'hairBrown', glasses: false, beard: 'stubble', build: 'average', shirt: 'denim', top: 'shirt', legs: 'chinos', tall: 1.0 },
    { id: 'tm02', skin: 'skinB', age: 'young', hair: 'quiff', hairColor: 'hairBlack', glasses: false, beard: null, build: 'slim', shirt: 'olive', top: 'tee', legs: 'jeans', tall: 1.02 },
    { id: 'tm03', skin: 'skinA', age: 'mid', hair: 'side', hairColor: 'hairBlonde', glasses: true, beard: null, build: 'average', shirt: 'grey', top: 'sweater', legs: 'jeans', tall: 0.98 },
    { id: 'tm04', skin: 'skinA', age: 'mid', hair: 'curly', hairColor: 'hairRed', glasses: false, beard: 'short', build: 'stocky', shirt: 'mustard', top: 'hoodie', legs: 'dark', tall: 0.99 },
    { id: 'tm05', skin: 'skinB', age: 'older', hair: 'receding', hairColor: 'grey', glasses: true, beard: 'moustache', build: 'stocky', shirt: 'maroon', top: 'shirt', legs: 'chinos', tall: 0.97 },
    { id: 'tm06', skin: 'skinA', age: 'mid', hair: 'buzz', hairColor: 'hairBrown', glasses: false, beard: null, build: 'slim', shirt: 'olive', top: 'sweater', legs: 'jeans', tall: 1.03 },
    { id: 'tm07', skin: 'skinB', age: 'mid', hair: 'tied', hairColor: 'hairBrown', glasses: false, beard: 'short', build: 'average', shirt: 'denim', top: 'tee', legs: 'dark', tall: 1.01 },
    { id: 'tm08', skin: 'skinA', age: 'young', hair: 'curly', hairColor: 'hairBlonde', glasses: false, beard: null, build: 'slim', shirt: 'maroon', top: 'hoodie', legs: 'jeans', tall: 0.99 },
    { id: 'tm09', skin: 'skinA', age: 'mid', hair: 'short', hairColor: 'hairBlack', glasses: true, beard: null, build: 'stocky', shirt: 'grey', top: 'shirt', legs: 'dark', tall: 1.0 },
    { id: 'tm10', skin: 'skinB', age: 'older', hair: 'side', hairColor: 'greying', glasses: false, beard: 'stubble', build: 'average', shirt: 'mustard', top: 'sweater', legs: 'chinos', tall: 0.98 },
    { id: 'tm11', skin: 'skinA', age: 'mid', hair: 'quiff', hairColor: 'hairBrown', glasses: false, beard: null, build: 'average', shirt: 'maroon', top: 'tee', legs: 'jeans', tall: 1.02 },
    { id: 'tm12', skin: 'skinB', age: 'young', hair: 'buzz', hairColor: 'hairBlonde', glasses: false, beard: null, build: 'slim', shirt: 'denim', top: 'hoodie', legs: 'dark', tall: 1.04 },
    { id: 'tm13', skin: 'skinA', age: 'mid', hair: 'side', hairColor: 'hairRed', glasses: false, beard: null, build: 'stocky', shirt: 'olive', top: 'shirt', legs: 'chinos', tall: 0.99 },
    { id: 'tm14', skin: 'skinB', age: 'young', hair: 'short', hairColor: 'hairBlack', glasses: true, beard: null, build: 'slim', shirt: 'grey', top: 'tee', legs: 'jeans', tall: 1.01 },
    { id: 'tm15', skin: 'skinA', age: 'mid', hair: 'side', hairColor: 'hairBlack', glasses: false, beard: null, build: 'average', shirt: 'denim', top: 'sweater', legs: 'dark', tall: 0.97 },
  ];
  TEAM.forEach((s) => Object.freeze(s));
  Object.freeze(TEAM);

  // ===========================================================================
  // person
  // ===========================================================================

  function crouchLegs(B) {
    const pose = { py: 17, fL: [-8.6, 0, 0.6], fR: [8.6, 0, 0.6], foreL: 0.55, foreR: 0.55, torsoK: 0.95 };
    const J = solve(B, full(pose));
    pose.ikL = [J.kneeL[0] + 0.6, J.kneeL[1] - 1.6, 1, 0.2, -0.3];
    pose.ikR = [J.kneeR[0] - 0.6, J.kneeR[1] - 1.6, 1, 0.2, -0.3];
    pose.hands = ['open', 'open'];
    return pose;
  }
  function personPose(spec, B, pose, o) {
    const name = pose.name || 'stand';
    const k = clamp(num(pose.k, 1));
    const t = num(pose.t, 0);
    const crouch = !!(pose.crouch || o.crouch || name === 'crouch');
    const idl = ((L.hash('idle', spec.id) % 7) - 3) * 0.018;
    const stand = { py: 0.3, head: idl, aL: [0.15 + idl, 0.12, 0], aR: [0.15 - idl, 0.12, 0], expr: L.hash('mouth', spec.id) % 5 < 2 ? 'calm' : 'smile' };
    const lower = crouch ? crouchLegs(B) : null;
    const withLegs = (q) => (lower ? Object.assign({}, q, { py: lower.py, fL: lower.fL, fR: lower.fR, foreL: lower.foreL, foreR: lower.foreR, torsoK: lower.torsoK }) : q);
    const armsDown = lower ? Object.assign({}, stand, lower) : stand;
    const R0 = (q) => resolve(B, withLegs(q));
    let p;
    switch (name) {
      case 'sit': {
        const pe = pelvisY(B);
        const view = o.view === 'side';
        const lift = -B.ankleH - (pe + 27);
        p = resolve(B, {
          py: 0, fL: [view ? 14 : -6.5, lift, view ? 0 : 1], fR: [view ? 16 : 6.5, lift, view ? 0 : 1],
          foreL: view ? 1 : 0.2, foreR: view ? 1 : 0.2, kneeL: view ? 0 : 1, kneeR: view ? 0 : 1,
          ikL: view ? [8, pe - 1, 0, 1] : [-6.5, pe - 3, 1, 0.3, 0.3], ikR: view ? [10, pe - 1, 0, 1] : [6.5, pe - 3, 1, 0.3, -0.3], expr: 'smile',
        });
        if (view) p.kneeP = [1, -0.6];
        p.seat = true;
        break;
      }
      case 'cheer': {
        const pump = pose.t != null ? 0.12 * sin(t * TAU * 2) : 0;
        p = mixPose(R0(stand), R0({ py: -0.6, aL: [2.55 + pump, 0.28, 0.2], aR: [2.55 - pump, 0.28, 0.2], hands: ['open', 'open'], expr: 'o' }), pose.k == null ? 1 : k);
        break;
      }
      case 'reach':
        p = mixPose(R0(stand), R0({ aR: [1.65, 0.45, 0], aL: [0.2, 0.2, 0], head: 0.05, hands: ['open', 'grip'], expr: 'grin' }), pose.k == null ? 1 : k);
        break;
      case 'catch': {
        const up = R0({ py: -0.4, aL: [2.45, 0.45, 0.2], aR: [2.45, 0.45, 0.2], hands: ['open', 'open'], expr: 'o' });
        const hug = R0({ ikL: [5, pelvisY(B) - B.torso * 0.62, 1, 1], ikR: [-5, pelvisY(B) - B.torso * 0.58, 1, 1], hands: ['open', 'open'], expr: 'grin', head: 0.06 });
        p = mixPose(up, hug, E.inOut(k));
        p.hug = k > 0.45;
        break;
      }
      case 'pullOn': {
        const up = R0({ aL: [2.9, 0.12, 0], aR: [2.9, 0.12, 0], hands: ['fist', 'fist'], expr: 'grin' });
        const mid = R0({ aL: [2.2, 0.9, 0], aR: [2.2, 0.9, 0], hands: ['fist', 'fist'], expr: 'grin' });
        const down = R0(Object.assign({}, lower ? armsDown : stand, { expr: 'grin' }));
        p = k < 0.5 ? mixPose(up, mid, k / 0.5) : mixPose(mid, down, (k - 0.5) / 0.5);
        break;
      }
      default:
        p = R0(Object.assign({}, armsDown));
    }
    if (name === 'turn') p.turn = k;
    if (name === 'back') p.turn = 1;
    if (name === 'look' || o.look != null) p.look = clamp(num(o.look, 0), -1, 1);
    return p;
  }
  const E = {
    inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)),
  };

  function teamFace(spec, expr) {
    const h = L.hash('face', spec.id);
    const v = (i) => (((h >>> (i * 4)) & 15) / 15 - 0.5) * 2; // -1..1, stable per person
    const young = spec.age === 'young' || (typeof spec.age === 'number' && spec.age < 30);
    const older = spec.age === 'older' || (typeof spec.age === 'number' && spec.age >= 45);
    return {
      eyeY: 0.03, eyeX: 0.2 + v(0) * 0.012, eyeRx: 0.089 + (young ? 0.006 : 0), eyeRy: 0.092 + (young ? 0.008 : 0) + v(1) * 0.005, pupil: 0.064,
      lashes: false, brow: browOf(spec.hairColor), browW: 0.058 + v(2) * 0.012, browLift: 0.026 + v(3) * 0.01,
      mouthY: 0.27, mouthW: 0.16 + v(4) * 0.015, expr, skin: skinOf(spec.skin), glasses: !!spec.glasses,
      lines: older, forehead: older, blush: L.rgba(P.confettiD, young ? 0.22 : 0.16),
      moustache: spec.beard === 'moustache' || spec.beard === 'short' ? { color: hairOf(spec.hairColor), thin: spec.beard === 'short' } : null,
      seed: h % 1000,
    };
  }

  function person(ctx, spec, x, y, h, pose, o) {
    o = o || {};
    pose = pose || { name: 'stand' };
    spec = spec || TEAM[0];
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    const hh = h * num(spec.tall, 1);
    if (alpha <= 0 || hh <= 0) return { hand: [x, y], head: [x, y - hh] };
    const B = teamBody(spec);
    const p = personPose(spec, B, pose, o);
    const side = o.view === 'side';
    let turn = p.turn || 0;
    if (side) turn = 0.5;
    const ph = turn * PI, c = cos(ph);
    const back = c < -0.02;
    const look = side ? 0.9 : back ? 0 : p.look + sin(ph) * 0.95;
    const J = solve(B, p);
    squashJ(J, side ? 1 : Math.max(0.5, Math.abs(c)));
    if (side) J.wf = 0.62;
    if (p.seat) shiftJ(J, 0, -J.pel[1] - 4);
    const R = makeRig(ctx, x, y, hh, o, spec.id);
    const outfit = pose.name === 'pullOn' ? (clamp(num(pose.k, 1)) >= 0.5 ? 'pull' : 'casual') : o.outfit || 'casual';
    const jersey = outfit === 'jersey', octo = outfit === 'octoTee';
    const top = jersey ? 'jersey' : octo ? 'octo' : spec.top;
    const color = jersey ? P.fesbBlue : octo ? P.shirtWhite : SHIRTS[spec.shirt] || COL.grey;
    const sleeve = jersey || octo || top === 'tee' ? 'short' : 'long';
    const st = {
      kind: 'team', spec, skin: skinOf(spec.skin), top, topColor: color, sleeve, sleeveColor: color,
      sleeveTrim: jersey ? COL.white : octo ? P.fesbBlue : null, cuffColor: top === 'shirt' ? L.mix(color, P.gloss, 0.2) : L.mix(color, P.outline, 0.15),
      legColor: LEGS[spec.legs] || COL.jeans, shoe: spec.legs === 'chinos' ? COL.shoeBrown : COL.shoe,
      hair: spec.hair, hairColor: spec.hairColor, back, look, hands: p.hands, gleam: o.gleam || 0,
      faceKey: spec.id, face: teamFace(spec, p.expr), side: side ? 1 : 0,
      armBehind: !back && Math.abs(c) < 0.4 ? (sin(ph) > 0 ? 'R' : 'L') : null,
      sitBack: p.seat && back, upper: !!o.upper,
    };
    if (o.hands) st.hands = o.hands;
    if (outfit === 'pull') {
      const kk = clamp((num(pose.k, 1) - 0.5) / 0.4);
      st.overJersey = lerp(B.torso * 0.72, -3.4, E.inOut(kk));
      if (kk >= 1) Object.assign(st, { top: 'jersey', topColor: P.fesbBlue, sleeve: 'short', sleeveColor: P.fesbBlue, sleeveTrim: COL.white, overJersey: null });
      else Object.assign(st, { sleeve: 'short', sleeveColor: P.fesbBlue, sleeveTrim: COL.white });
    }
    if (pose.name === 'reach') st.hands = [p.hands[0], o.mug ? 'none' : 'fist'];
    if (p.hug && !back) st.skipArms = true;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    // the jersey held above the head (pullOn, first half)
    const pk = clamp(num(pose.k, 1));
    drawFigure(R, B, J, p, st);
    if (pose.name === 'pullOn' && pk < 0.5) {
      const a = R.m(J.hcL), b = R.m(J.hcR);
      const cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) + hh * 0.05;
      tshirt(ctx, cx, cy, Math.abs(b[0] - a[0]) * 1.25 + hh * 0.08, { design: 'jersey', view: 'front', flap: 0.5 + pk, line: o.line, lineRef: hh });
      drawHand(R, B, J.wrL, J.haL, -1, 'fist', st.skin, 250, back);
      drawHand(R, B, J.wrR, J.haR, 1, 'fist', st.skin, 260, back);
    }
    if (p.hug && !back) {
      const c0 = R.m(l2(J.chest, J.pel, 0.3));
      tshirt(ctx, c0[0], c0[1], B.chest * 2.2 * R.U, { design: o.shirt === 'octo' ? 'octo' : 'jersey', view: 'front', rot: 0.25, flap: 0.3, line: o.line, lineRef: hh, folded: true });
      drawArm(R, B, J, -1, st);
      drawArm(R, B, J, 1, st);
    }
    let hand = R.m(J.hcR);
    if (o.mug && pose.name === 'reach') {
      const mh = num(o.mug.h, hh * 0.2);
      const g = mugGrip(mh, false, o.mug.tilt);
      MUG(ctx, hand[0] - g[0], hand[1] - g[1], mh, Object.assign({ line: o.line, width: R.ow * 0.85, t: pose.t || 0 }, o.mug));
      drawHand(R, B, J.wrR, J.haR, 1, 'fist', st.skin, 270, back);
    }
    ctx.restore();
    return { hand, head: R.m(J.head) };
  }

  // ===========================================================================
  // chef
  // ===========================================================================

  const G3 = { dx: 120 / 860, dy: -(1010 - 430) / 860, mh: 200 / 860 };
  // salsa basic on 8ths: counts 1-2-3 step, 4 hold; 5-6-7 step, 8 hold; hips sway away from the moving foot
  const SB = [0.3, 1.95, 0.3, 0.5], SE = [1.2, 0.35, 0.2, 1], SE2 = [1.02, 0.45, 0.2, 1], SHI = [2.45, 0.45, 0.3, 1], SLO = [0.38, 0.85, 0.3, 0.75];
  const SALSA = [
    { px: 1.8, tilt: -0.1, lean: -0.04, shL: -0.7, shR: 0.4, fL: [-6.5, 0, 1.1], fR: [7, 0.8, 0], kneeR: -1, aL: SB, aR: SE, head: -0.05, expr: 'smile' },
    { px: -1.4, tilt: 0.08, lean: 0.03, shL: 0.4, shR: -0.5, fL: [-6.5, 1.2, 1.1], fR: [7, 0, 0], kneeL: -1, aL: SB, aR: SE2, head: 0.04, expr: 'smile' },
    { px: 1.6, tilt: -0.1, lean: -0.03, shL: -0.6, shR: 0.4, fL: [-5.5, 0, 0], fR: [6.5, 0.6, 0], kneeR: -1, aL: SB, aR: SE, head: -0.04, expr: 'smile' },
    { px: 2.2, py: 0.8, tilt: -0.13, lean: -0.05, shL: -0.9, shR: 0.5, fL: [-5.5, 1.6, 0], fR: [6.5, 0, 0], kneeL: -1, aL: SLO, aR: SHI, head: 0.08, look: 0.15, expr: 'grin' },
    { px: -1.8, tilt: 0.1, lean: 0.04, shL: 0.4, shR: -0.7, fL: [-6.5, 0.8, 0], fR: [7, 0, -1], kneeL: -1, aL: SE, aR: SB, head: 0.05, expr: 'smile' },
    { px: 1.4, tilt: -0.08, lean: -0.03, shL: -0.5, shR: 0.4, fL: [-6.5, 0, 0], fR: [7, 1.2, -1], kneeR: -1, aL: SE2, aR: SB, head: -0.04, expr: 'smile' },
    { px: -1.6, tilt: 0.1, lean: 0.03, shL: 0.4, shR: -0.6, fL: [-6.5, 0.6, 0], fR: [5.5, 0, 0], kneeL: -1, aL: SE, aR: SB, head: 0.04, expr: 'smile' },
    { px: -2.2, py: 0.8, tilt: 0.13, lean: 0.05, shL: 0.5, shR: -0.9, fL: [-6.5, 0, 0], fR: [5.5, 1.6, 0], kneeR: -1, aL: SHI, aR: SLO, head: -0.08, look: -0.15, expr: 'grin' },
  ];
  function chefPose(B, pose, o, mh) {
    const name = pose.name || 'stand';
    const k = clamp(num(pose.k, 1));
    const t = Math.max(0, num(pose.t, 0));
    const pe = pelvisY(B);
    // at rest he is already about to dance: weight on the toes, shoulders loose, hands up and open
    const stand = { py: 1.4, px: 1.1, tilt: -0.06, lean: -0.03, shL: -0.6, shR: 0.3, fL: [-7.5, 1.3, 0.4], fR: [7.8, 0, 0], kneeL: -1, aL: [0.5, 1.75, 0.3, 0.6], aR: [0.95, 0.8, 0.3, 1], hands: ['open', 'open'], head: 0.07, expr: 'smile' };
    const R0 = (q) => resolve(B, q);
    const g = mugGrip(mh, false, 0);
    const gu = [g[0] / (B._U || 1), g[1] / (B._U || 1)];
    let p;
    switch (name) {
      case 'grin':
        p = R0({ py: 1.0, px: -1, tilt: 0.05, fL: [-9, 0, 0], fR: [9, 1.2, 0.4], kneeR: -1, shR: -0.8, aL: [0.82, -1.78, 0.3], aR: [1.05, 1.75, 0.2, 0.9], hands: ['fist', 'thumb'], head: 0.1, expr: 'grin' });
        break;
      case 'armsCrossed':
      case 'nod': {
        p = R0({ py: 0.9, px: 1.2, tilt: -0.06, fL: [-9.5, 1.0, 0.4], fR: [9.5, 0, 0], kneeL: -1, shR: -1.6, aL: [-0.1, -1.5, 0.1, 1.05], aR: [-0.06, -1.55, -0.1, 1.05], hands: ['fist', 'fist'], head: -0.09, expr: 'grin' });
        if (name === 'nod') p.nod = sin(k * PI);
        break;
      }
      case 'tieBandana': {
        const hk = [
          [0, R0(Object.assign({}, stand, { ikR: [11.5, pe + 2, 1, 0.2], hands: ['open', 'fist'], expr: 'smile' }))],
          [0.25, R0({ py: 0.6, fL: [-7.5, 0, 0], fR: [7.5, 0, 0], ikL: [-9, pe - 57, 1, 0.8], ikR: [9, pe - 57, 1, 0.8], hands: ['fist', 'fist'], head: 0, expr: 'grin' })],
          [0.5, R0({ py: 0.6, fL: [-7.5, 0, 0], fR: [7.5, 0, 0], ikL: [-4.5, pe - 47.5, 1, -0.4], ikR: [4.5, pe - 47.5, 1, -0.4], hands: ['fist', 'fist'], head: 0.06, expr: 'smile' })],
          [0.75, R0({ py: 0.6, fL: [-7.5, 0, 0], fR: [7.5, 0, 0], ikL: [-8, pe - 45, 1, -0.2], ikR: [3, pe - 49, 1, -0.6], hands: ['fist', 'fist'], head: -0.08, expr: 'grin', tails: 0.4 })],
          [1, R0({ py: 0.4, fL: [-8.5, 0, 0], fR: [8.5, 0, 0], aL: [1.25, 0.55, 0.3], aR: [1.25, 0.55, 0.3], hands: ['open', 'open'], expr: 'grin', head: 0.05 })],
        ];
        p = track(hk, k);
        p.bandana = k < 0.2 ? 'hand' : k < 0.45 ? 'stretch' : 'on';
        break;
      }
      case 'salsa': {
        const c = Math.floor(t / EIGHTH + 1e-6);
        const fr = t / EIGHTH - c;
        const cur = R0(Object.assign({}, stand, SALSA[c % 8], { hands: ['open', 'open'] }));
        p = cur;
        p.py += 0.9 * (1 - clamp(fr * 3));
        break;
      }
      case 'spin': {
        const base = R0({ py: -0.6, fL: [-3.5, 1.2, 0], fR: [3.5, 0, 0], aL: [0.55, 1.3, 0.2], aR: [2.95, 0.15, 0], hands: ['open', 'open'], expr: 'grin' });
        p = base;
        p.spin = k;
        p.tails = 1.2 * sin(k * PI);
        break;
      }
      case 'throw': {
        const kf = [
          [0, R0({ py: 2.6, px: -1.6, lean: -0.1, fL: [-8.5, 0, 0], fR: [8.5, 0, 0], aL: [0.95, 0.5, 0.2], aR: [-0.15, -0.35, 0], hands: ['open', 'fist'], expr: 'grin', head: -0.05 })],
          [0.5, R0({ py: 1.4, px: 0, lean: 0, fL: [-8.5, 0, 0], fR: [8.5, 0, 0], aL: [0.8, 0.7, 0.2], aR: [1.55, 0.15, 0], hands: ['open', 'open'], expr: 'grin' })],
          [1, R0({ py: 0.6, px: 1.8, lean: 0.1, fL: [-8.5, 1.4, 0], fR: [8.5, 0, 0], kneeL: -1, aL: [0.7, 0.9, 0.2], aR: [2.45, 0.2, 0.1], hands: ['open', 'open'], expr: 'grin', head: 0.06, look: 0.1 })],
        ];
        p = track(kf, k);
        break;
      }
      case 'raiseMug': {
        const base = [G3.dx * 100, G3.dy * 100];
        const grip = [base[0] + gu[0], base[1] + gu[1]];
        const low = R0(Object.assign({}, stand, { ikR: [14.5, pe + 4, 1, 0.3], hands: ['open', 'none'] }));
        const high = R0({ py: 0.4, fL: [-8.5, 0, 0], fR: [8.5, 0, 0], ikR: [grip[0], grip[1], 1, 1], aL: [0.82, -1.78, 0.3], hands: ['fist', 'none'], head: 0.05, look: 0.05, expr: 'grin' });
        p = mixPose(low, high, E.inOut(k));
        break;
      }
      default:
        p = R0(stand);
    }
    if (o.look != null) p.look = clamp(num(o.look, 0), -1, 1);
    if (!p.bandana) p.bandana = o.bandana === false ? 'off' : 'on';
    return p;
  }

  const CHEF_BEARD = [
    [-0.515, 0.04], [-0.51, 0.2], [-0.46, 0.36], [-0.34, 0.5], [-0.2, 0.6], [-0.08, 0.655], [0, 0.665], [0.08, 0.655], [0.2, 0.6], [0.34, 0.5], [0.46, 0.36], [0.51, 0.2], [0.515, 0.04],
    [0.44, 0.1], [0.4, 0.24], [0.32, 0.33], [0.23, 0.37], [0.19, 0.345], [0.15, 0.43], [0.1, 0.475], [0, 0.49], [-0.1, 0.475], [-0.15, 0.43], [-0.19, 0.345], [-0.23, 0.37], [-0.32, 0.33], [-0.4, 0.24], [-0.44, 0.1],
  ];
  const CHEF_FACE = {
    eyeY: 0.0, eyeX: 0.2, eyeRx: 0.084, eyeRy: 0.074, pupil: 0.054, lashes: false, brow: P.chefBrow || P.beard, browW: 0.075, browLift: 0.055, browGrey: P.beardGrey,
    iris: L.mix(P.woodMid, P.woodDeep, 0.35), forehead: true,
    mouthY: 0.37, mouthW: 0.15, skin: P.chefSkin, glasses: false, lines: true, blush: L.rgba(P.confettiD, 0.18), chef: true,
    moustache: { color: P.beard, trim: true }, seed: 77,
  };

  function chef(ctx, x, y, h, pose, o) {
    o = o || {};
    pose = pose || { name: 'stand' };
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    const B = chefBody();
    const U = h / 100;
    B._U = U;
    const mh = o.mug ? num(o.mug.h, h * G3.mh) : h * G3.mh;
    const p = chefPose(B, pose, o, mh);
    if (alpha <= 0) return { handR: [x, y - h / 2], handL: [x, y - h / 2], head: [x, y - h] };
    const spin = p.spin != null ? p.spin : null;
    const ph = spin != null ? spin * TAU : 0;
    const c = cos(ph);
    const back = c < -0.02;
    const J = solve(B, p);
    squashJ(J, Math.max(0.5, Math.abs(c)));
    const R = makeRig(ctx, x, y, h, o, 'chef');
    const look = back ? 0 : clamp((p.look || 0) + (spin != null ? sin(ph) * 0.95 : 0), -1, 1);
    const hands = p.hands.slice();
    if (o.mug) hands[1] = 'none';
    const st = {
      kind: 'chef', skin: P.chefSkin, top: 'chef', topColor: P.shirtWhite, sleeve: 'rolled', sleeveColor: P.shirtWhite,
      shoe: COL.shoeBrown, back, look, hands, bandana: p.bandana, gleam: num(o.gleam, 0), tails: p.tails || 0,
      faceKey: 'chef', face: Object.assign({}, CHEF_FACE, { expr: p.expr }),
      armBehind: !back && spin != null && Math.abs(c) < 0.4 ? (sin(ph) > 0 ? 'R' : 'L') : null,
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    drawFigure(R, B, J, p, st);
    // the bandana while it is being tied
    if (p.bandana === 'hand') {
      const hnd = J.hcR;
      const pts = [[hnd[0] - 1, hnd[1]], [hnd[0] + 2.6, hnd[1] + 1], [hnd[0] + 3.6, hnd[1] + 9], [hnd[0] + 0.5, hnd[1] + 12], [hnd[0] - 1.8, hnd[1] + 7]];
      R.shape(pts, P.bandana, 400, { shade: { color: SHADE, side: 'right', frac: 0.3 } });
      for (const d of [[0.8, 4], [1.6, 8], [-0.4, 7.5], [2.2, 5.5]]) R.dot([hnd[0] + d[0], hnd[1] + d[1]], 0.45, P.bandanaDot);
      drawHand(R, B, J.wrR, J.haR, 1, 'fist', st.skin, 405, back);
    } else if (p.bandana === 'stretch') {
      const a = J.hcL, b = J.hcR;
      const sag = 3;
      const pts = [[a[0], a[1] - 1.6], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.2 + sag * 0.4], [b[0], b[1] - 1.6], [b[0], b[1] + 1.6], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag], [a[0], a[1] + 1.6]];
      R.shape(pts, P.bandana, 401, { shade: { color: SHADE, side: 'bottom', frac: 0.35 } });
      for (let i = 1; i < 6; i++) {
        const q = l2(a, b, i / 6);
        R.dot([q[0], q[1] + sag * 0.45 * sin((i / 6) * PI)], 0.5, P.bandanaDot);
      }
      drawHand(R, B, J.wrL, J.haL, -1, 'fist', st.skin, 406, back);
      drawHand(R, B, J.wrR, J.haR, 1, 'fist', st.skin, 407, back);
    }
    let handR = R.m(J.hcR);
    if (o.mug) {
      const tilt = num(o.mug.tilt, 0);
      const g = mugGrip(mh, !!o.flip, tilt);
      MUG(ctx, handR[0] - g[0], handR[1] - g[1], mh, Object.assign({ line: o.line, width: R.ow * 0.85, t: num(pose.t, 0) }, o.mug, { flip: !!o.flip }));
      drawHand(R, B, J.wrR, J.haR, 1, 'grip', st.skin, 410, back);
    }
    ctx.restore();
    return { handR, handL: R.m(J.hcL), head: R.m(J.head) };
  }

  // ===========================================================================
  // chefHand, chefBeardEdge (shot 02)
  // ===========================================================================

  function chefHand(ctx, x, y, s, o) {
    o = o || {};
    s = num(s, 1);
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    if (alpha <= 0) return;
    const press = clamp(num(o.press, 0));
    // local units: 1 = 3 px at s = 1 (wrist to fingertip about 85 units = 255 px); fingertip at (0, 0)
    const R = makeRig(ctx, x, y, 100 * s * 3, { line: o.line || 'hero', draw: o.draw, flip: o.flip }, 'chefHand', 300);
    const fl = 40 * (1 - 0.42 * press); // the index foreshortens as it bends onto the button
    const kn = -fl, wy = kn - 44;
    const skin = P.chefSkin;
    const sk = { color: SHADE_SKIN, side: 'right', frac: 0.22 };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    // hoodie sleeve from the top of the frame
    R.shaded([[-31, wy - 700], [31, wy - 700], [33, wy - 30], [31, wy - 6], [-31, wy - 6], [-33, wy - 30]], COL.hoodie, 1, SHADE_DEEP, 0.3);
    R.line([[-14, wy - 120], [-8, wy - 50]], 2, { color: COL.hoodieDeep, width: R.dw * 1.3 });
    R.line([[16, wy - 90], [10, wy - 40]], 3, { color: COL.hoodieDeep, width: R.dw * 1.3 });
    // back of the hand
    R.shape([[-23, wy - 2], [21, wy - 2], [26, wy + 16], [27, kn + 1], [12, kn + 5], [-6, kn + 5], [-26, kn + 3], [-29, kn - 12], [-27, wy + 14]], skin, 4, { shade: sk });
    // the middle, ring and little fingers curled under: three short rounded fingers left of the index
    for (let i = 0; i < 3; i++) {
      const x0 = -28 + i * 10.4, len = i === 0 ? 8 : 11;
      R.shape([[x0, kn - 4], [x0 + 10.6, kn - 4], [x0 + 10.8, kn + len - 3], [x0 + 5.4, kn + len + 1.5], [x0 - 0.2, kn + len - 3]], skin, 5 + i, { shade: sk });
    }
    R.line([[-24, kn - 8], [-12, kn - 10], [-1, kn - 9]], 8, { alpha: 0.45 });
    // the index finger to the fingertip
    R.shape(cap([10, kn + 3], [0.5, -6.2], 6.8, 6.2, 7), skin, 9, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.3 } });
    R.shape([[-3.4, -12.5], [4.2, -12.5], [4.2, -6], [0.4, -3.4], [-3.6, -6]], L.mix(skin, P.gloss, 0.5), 10, { width: R.dw * 1.1 });
    const mj = l2([10, kn + 3], [0.5, -6.2], 0.45);
    R.line([[mj[0] - 4.5, mj[1] - 1], [mj[0] + 4.5, mj[1] + 0.5]], 11, { alpha: 0.7 });
    // thumb tucked along the screen-right edge, its tip beside the index knuckle
    R.shape(cap([24, wy + 16], [20, kn - 2], 7, 5.6, 7), skin, 12, { shade: { color: SHADE_SKIN, side: 'right', frac: 0.3 } });
    R.shape([[17.6, kn - 7], [22.4, kn - 7], [22.6, kn - 2], [20, kn + 0.8], [17.4, kn - 2]], L.mix(skin, P.gloss, 0.5), 13, { width: R.dw });
    R.line([[-12, wy + 16], [-4, wy + 10]], 14, { alpha: 0.45 });
    R.gloss([-16, wy + 8], [-8, wy + 3], 1.8, 0.55);
    // ribbed cuff over the wrist
    R.shaded([[-32, wy - 26], [32, wy - 26], [31, wy + 4], [-31, wy + 4]], COL.hoodie, 15, SHADE_DEEP, 0.25);
    for (let i = -2; i <= 2; i++) R.line([[i * 11, wy - 22], [i * 11, wy + 1]], 16 + i, { color: COL.hoodieDeep });
    ctx.restore();
  }

  /** the chef's chin with his short trimmed beard, entering from the top of the frame; (x, y) is
   *  the bottom of the beard, w the width of the jaw; the face above stays off frame (shot 02) */
  function chefBeardEdge(ctx, x, y, w, o) {
    o = o || {};
    w = num(w, 360);
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    if (alpha <= 0) return;
    const R = makeRig(ctx, x, y, w, { line: o.line || 'hero', draw: o.draw, flip: o.flip }, 'chefBeard', 360);
    // local units: 1 % of w; the jaw is the lower half of an ellipse, the beard a 7 to 12 unit band on it
    const arc = (rx, ry, cy, n, rev) => {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const a = (rev ? 1 - i / n : i / n) * PI;
        out.push([cos(a) * rx, cy + sin(a) * ry]);
      }
      return out;
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    R.shaded([[-51, -170], [51, -170], ...arc(51, 72, -72, 16, false).slice(0, 17)], P.chefSkin, 1, SHADE_SKIN, 0.22);
    const band = [...arc(51, 72, -72, 18, false), ...arc(44, 56, -76, 18, true)];
    R.shaded(band, P.beard, 2, SHADE, 0.14);
    const hl = P.beardLight || P.beard;
    R.line([[-30, -18], [-21, -10]], 3, { color: hl, width: R.dw * 1.6 });
    R.line([[-6, -9], [1, -6]], 4, { color: P.beardGrey, width: R.dw });
    R.line([[8, -8], [14, -11]], 5, { color: P.beardGrey, width: R.dw });
    R.gloss([-30, -40], [-22, -30], 1.4, 0.4);
    ctx.restore();
  }

  // ===========================================================================
  // waitress
  // ===========================================================================

  const FAN = { x: 180 / 820, y: 400 / 820, mh: 136 / 820 };
  const FAN_MUGS = [
    // [x, y] in mug heights from the fan centre (the fist), tilt, handle side flip, draw order
    { i: 2, x: 0, y: -0.14, tilt: 0, flip: false },
    { i: 0, x: -0.72, y: 0.1, tilt: 0.26, flip: false },
    { i: 4, x: 0.72, y: 0.1, tilt: -0.26, flip: true },
    { i: 3, x: 0.46, y: 0.03, tilt: -0.1, flip: true },
    { i: 1, x: -0.46, y: 0.03, tilt: 0.1, flip: false },
  ];
  const WAITRESS_FACE = {
    eyeY: 0.04, eyeX: 0.2, eyeRx: 0.095, eyeRy: 0.105, pupil: 0.072, lashes: true, brow: P.wheatDeep, browW: 0.04, browLift: 0.05,
    mouthY: 0.28, mouthW: 0.17, skin: P.skinA, glasses: false, lines: false, blush: L.rgba(P.confettiD, 0.42), seed: 55,
  };
  function waitress(ctx, x, y, h, pose, o) {
    o = o || {};
    pose = pose || { name: 'stand' };
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    const facing = o.facing === -1 ? -1 : 1;
    const flip = (o.flip ? -1 : 1) * facing < 0;
    const U = h / 100;
    const fanPx = (sx, dy) => [x + (flip ? -1 : 1) * sx * FAN.x * h, y - FAN.y * h + dy * U];
    if (alpha <= 0) return { fanL: fanPx(-1, 0), fanR: fanPx(1, 0) };
    const B = waitressBody();
    const walk = pose.name === 'walk';
    const t = Math.max(0, num(pose.t, 0));
    const n = Math.floor(t / 0.5 + 1e-6), fr = walk ? t / 0.5 - n : 0;
    const even = n % 2 === 0;
    const bob = walk ? -1.46 * sin(PI * fr) : 0;
    const lag = walk ? 0.9 * sin(PI * fr - 0.9) : 0;
    const fy = -FAN.y * 100 + lag - bob * 0.3;
    const fist = [FAN.x * 100, fy];
    const pe = pelvisY(B);
    let fL = [-5.5, 0, 0], fR = [5.5, 0, 0], px = 0, tilt = 0;
    if (walk) {
      const lift = 3.2 * sin(PI * fr), g = even ? 1 : -1;
      if (even) fR = [6.5, lift, 0.6 * sin(PI * fr)];
      else fL = [-6.5, lift, 0.6 * sin(PI * fr)];
      px = -g * 1.1 * sin(PI * fr);
      tilt = g * 0.05 * sin(PI * fr);
    }
    const p = resolve(B, {
      py: 0.4 + bob, px, tilt, fL, fR, kneeL: walk && !even ? -1 : 1, kneeR: walk && even ? -1 : 1, lean: walk ? 0.02 * sin(TAU * t) : 0, shL: -0.2, shR: -0.2,
      ikL: [-fist[0], fist[1] + bob, 1, 0.2, 0], ikR: [fist[0], fist[1] + bob, 1, 0.2, 0], hands: ['none', 'none'], expr: 'grin', head: walk ? 0.03 * sin(TAU * t) : 0.03,
    });
    p.look = 0.3;
    const J = solve(B, p);
    J.wf = 1;
    const R = makeRig(ctx, x, y, h, { line: o.line, draw: o.draw, flip }, 'waitress');
    const st = {
      kind: 'waitress', waitress: true, skin: P.skinA, top: 'blouse', topColor: P.shirtWhite, sleeve: 'puff', sleeveColor: P.shirtWhite,
      shoe: COL.shoe, back: false, look: 0.3, hands: ['none', 'none'], faceKey: 'waitress', face: Object.assign({}, WAITRESS_FACE, { expr: 'grin' }),
      skirtSway: walk ? -1.4 * sin(TAU * t * 0.5 + 0.6) : 0,
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    drawFigure(R, B, J, p, st);
    const mh = FAN.mh * h;
    const out = {};
    for (const s of [-1, 1]) {
      const S = s < 0 ? 'L' : 'R';
      const c = R.m(J['hc' + S]);
      const slosh = walk ? 0.6 * sin(PI * fr + (s < 0 ? 0.6 : 0)) : 0;
      const order = s > 0 ? FAN_MUGS : FAN_MUGS.map((m) => ({ i: m.i, x: -m.x, y: m.y, tilt: -m.tilt, flip: !m.flip }));
      const list = order;
      const ff = flip ? -1 : 1;
      for (const m of list) {
        const cx = c[0] + ff * m.x * mh, cy = c[1] + m.y * mh;
        const tl = ff * m.tilt;
        const bx = cx - 0.5 * mh * sin(tl), by = cy + 0.5 * mh * cos(tl);
        const hero = !!o.heroMug && s > 0 && m.i === 1;
        MUG(ctx, bx, by, mh, { fill: 0.88, foam: 1.12, logo: hero, tilt: tl, flip: ff < 0 ? !m.flip : m.flip, slosh, bubbles: true, t, line: o.line, width: R.ow * 0.8, seed: 'fan' + s + m.i });
      }
      const wr = J['wr' + S];
      drawHand(R, B, wr, J['ha' + S], s, 'fist', st.skin, 500 + s, false, 1.12);
      out['fan' + S] = [c[0], c[1]];
    }
    ctx.restore();
    // screen order: fanL is always the left one on screen
    return flip ? { fanL: out.fanR, fanR: out.fanL } : { fanL: out.fanL, fanR: out.fanR };
  }

  // ===========================================================================
  // tshirt, jerseyBack
  // ===========================================================================

  function tshirt(ctx, x, y, s, o) {
    o = o || {};
    s = num(s, 200);
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    if (alpha <= 0 || s <= 0) return;
    const design = o.design === 'octo' ? 'octo' : 'jersey';
    const view = o.view === 'back' ? 'back' : 'front';
    const rot = num(o.rot, 0), fl = sin(num(o.flap, 0) * TAU);
    const LN = lineSet();
    const kind = o.line && LN.W[o.line] != null ? o.line : 'secondary';
    const ow = Math.max(1.5, (LN.W[kind] * (o.lineRef ? o.lineRef : s * 3)) / 800);
    const dw = Math.max(1.2, (LN.W.detail * (o.lineRef ? o.lineRef : s * 3)) / 800);
    const cr = cos(rot), sr = sin(rot);
    const M = (q) => [x + (q[0] * cr - q[1] * sr) * s, y + (q[0] * sr + q[1] * cr) * s];
    const MM = (list) => list.map(M);
    const col = design === 'jersey' ? P.fesbBlue : P.shirtWhite;
    const trim = design === 'jersey' ? COL.white : P.fesbBlue;
    const seed = L.hash('tee', design, view) % 5000;
    const draw = o.draw == null ? 1 : clamp(o.draw);
    const sh = (pts, fill, k, extra) => SHP(ctx, MM(pts), Object.assign({ fill, width: ow, seed: seed + k, draw, shade: { color: SHADE, side: 'right', frac: 0.14 } }, extra));
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    // sleeves, rotating about the shoulders
    for (const e of [-1, 1]) {
      const a = e * (0.28 * fl + (o.folded ? 0.5 : 0));
      const pv = [e * 0.29, -0.3];
      const rp = (q) => {
        const dx = q[0] - pv[0], dy = q[1] - pv[1];
        return [pv[0] + dx * cos(a) - dy * sin(a), pv[1] + dx * sin(a) + dy * cos(a)];
      };
      const sl = [[e * 0.27, -0.39], [e * 0.5, -0.27], [e * 0.43, -0.08], [e * 0.28, -0.14]].map(rp);
      sh(sl, col, 10 + e);
      const tr = [l2(sl[1], sl[2], 0), l2(sl[1], sl[2], 1), l2(sl[2], sl[3], 0.16), l2(sl[0], sl[1], 0.84)];
      sh(tr, trim, 12 + e, { shade: null, width: ow * 0.6 });
    }
    const hemW = (u) => 0.018 * sin(num(o.flap, 0) * TAU + u * 7);
    const body = [[-0.3, -0.38], [-0.11, -0.42], [0, view === 'front' ? -0.33 : -0.39], [0.11, -0.42], [0.3, -0.38], [0.3, -0.1], [0.3, 0.2], [0.29, 0.42 + hemW(1)], [0.1, 0.43 + hemW(0.66)], [-0.1, 0.43 + hemW(0.33)], [-0.29, 0.42 + hemW(0)], [-0.3, 0.2], [-0.3, -0.1]];
    sh(body, col, 20);
    // collar trim
    if (view === 'front') {
      const v = design === 'jersey'
        ? [[-0.12, -0.425], [0, -0.3], [0.12, -0.425], [0.09, -0.425], [0, -0.335], [-0.09, -0.425]]
        : [[-0.12, -0.425], [0, -0.32], [0.12, -0.425], [0.09, -0.425], [0, -0.345], [-0.09, -0.425]];
      sh(v, trim, 21, { shade: null, width: ow * 0.6 });
    } else {
      sh([[-0.12, -0.425], [0, -0.385], [0.12, -0.425], [0.1, -0.44], [0, -0.41], [-0.1, -0.44]], trim, 21, { shade: null, width: ow * 0.6 });
    }
    if (draw >= 1) {
      const center = (lx, ly) => M([lx, ly]);
      ctx.save();
      ctx.translate(...center(0, 0));
      ctx.rotate(rot);
      ctx.translate(-x, -y);
      if (design === 'jersey' && view === 'front') {
        const Lg = logoCanvas(s * 0.13);
        const sc = (s * 0.13) / Lg.q;
        ctx.drawImage(Lg.c, x + 0.13 * s - Lg.q * 0.6 * sc, y - 0.2 * s - Lg.q * 0.6 * sc, Lg.q * 1.2 * sc, Lg.q * 1.2 * sc);
      } else if (design === 'jersey') {
        jerseyPrint(ctx, x, y + 0.02 * s, s * 0.36, s * 0.36, 0);
      } else if (view === 'front') {
        const O = octoCanvas(s * 0.46);
        const sc = (s * 0.46) / O.q;
        ctx.drawImage(O.c, x - O.q * 0.65 * sc, y - 0.05 * s - O.q * 0.55 * sc, O.q * 1.3 * sc, O.q * 1.1 * sc);
      } else {
        const Lg = logoCanvas(s * 0.09);
        const sc = (s * 0.09) / Lg.q;
        ctx.drawImage(Lg.c, x - Lg.q * 0.6 * sc, y - 0.28 * s - Lg.q * 0.6 * sc, Lg.q * 1.2 * sc, Lg.q * 1.2 * sc);
      }
      ctx.restore();
      inkLine(ctx, MM([[-0.08, 0.1 + fl * 0.02], [0.02, 0.2], [0.18, 0.18 - fl * 0.02]]), { width: dw, color: P.outline, alpha: 0.35, seed: seed + 30 });
    }
    ctx.restore();
  }

  function jerseyBack(ctx, x, y, w, o) {
    o = o || {};
    w = num(w, 300);
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    if (alpha <= 0 || w <= 0) return;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    jerseyPrint(ctx, x, y, w, w, clamp(num(o.gleam, 0)));
    ctx.restore();
  }

  FILM.cast = { TEAM, person, chef, chefHand, chefBeardEdge, waitress, tshirt, jerseyBack };
})();
