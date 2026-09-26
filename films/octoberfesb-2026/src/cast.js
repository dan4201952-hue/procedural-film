/*
 * cast.js : FILM.cast, the characters of OktoberFESB 2026 (docs/cast-api.md; art bible 4, 4.1,
 * 10.1 to 10.3 and 10.8). Loaded after props.js, before the timeline and the scenes.
 *
 *   TEAM                                  the 15 teammate specs (art bible 10.3)
 *   CHEF_TALL                             the chef's height as a fraction of the team average (0.95)
 *   person(ctx, spec, x, y, h, pose, o)   a teammate                      -> { hand, head }
 *   chef(ctx, x, y, h, pose, o)           the chef (10.1)                 -> { handR, handL, head }
 *   chefHand(ctx, x, y, s, o)             his hand in the hoodie sleeve (shot 02)
 *   chefBeardEdge(ctx, x, y, w, o)        his chin and short beard from the top of the frame (shot 02)
 *   waitress(ctx, x, y, h, pose, o)       the waitress with ten Maß       -> { fanL, fanR }
 *   tshirt(ctx, x, y, s, o)               a flying or held t-shirt (10.8)
 *   jerseyBack(ctx, x, y, w, o)           the FESB 9 back print alone
 *
 * Rig. A body (proportions in units of 1 % of the figure's own height, head about 1/7) and a pose
 * (pelvis offset and tilt, spine lean, head tilt and turn, shoulder / elbow / wrist angles, foot
 * targets solved to hip / knee / ankle by two-bone IK) go through solve() to joints; drawFigure()
 * dresses them. Named poses are keyframes mixed by k, so every pose runs through the same bones.
 * Scenes pass lib.onTwos(t) as pose.t and quantise k; the chef's salsa holds one pose per 8th.
 *
 * Rendering (art bible 4). Every part is one smooth closed silhouette (tube() for limbs: deltoid,
 * forearm, calf and ankle are in the radius profile), filled with a gradient across the form from
 * the lit upper left through a core shadow to a thin rim light, outlined through lib.inkPath with
 * FILM.props.LINE (boil 0.3 on people). Limb roots are hidden under the garment they grow from, so
 * no joint shows. Soft contact shadows and ambient occlusion are radial fades. Heads (skull,
 * ears, face, hair, beard, glasses, bandana cap) are painted once per character, expression,
 * turn, size bucket and render scale into a cached canvas; the rest of the body is live.
 *
 * Conventions
 *   - h is the figure's own drawn height; teammates are drawn at h * spec.tall (0.92 to 1.12 of
 *     the team average), the chef at the h a scene passes (use h * CHEF_TALL next to the team).
 *   - L and R are SCREEN left and right of an unflipped figure (the chef's mug hand 'R' is his
 *     screen-right hand, storyboard G3). o.flip mirrors the figure; prints and logos never mirror.
 *   - o.line 'hero' | 'secondary' (default) | 'background' = 7 / 5 / 3 px at 800 px, scaled with
 *     h (min 1.5 px). Mugs, logos, the lockup, sparkles and t-shirts come from FILM.props.
 *
 * Options beyond docs/cast-api.md (all optional)
 *   person: pose 'crouch' (team-photo front row, hands on knees), pose.crouch or o.crouch crouches
 *     any pose; o.upper draws the waist up (behind a table); o.shirt 'jersey' | 'octo' (the shirt
 *     hugged in 'catch'); o.gleam 0..1 (gold sweep over the jersey back print); o.hands [L, R];
 *     o.shadow false drops the contact shadow.
 *   chef: expressions 'smile' (rest) and 'grin' (performing); o.mug.h (default h * 200 / 860,
 *     storyboard G3); o.shadow false.
 *   TEAM specs also carry top, legs (the casual outfit), tall and label (the four named ones).
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
  const BOIL = 0.3; // boil amplitude on people (px)
  const LX = -0.6, LY = -0.8; // toward the light (upper left)

  // ===========================================================================
  // Line, colours, tones
  // ===========================================================================

  const LINE0 = { wobble: 0.8, tremble: 0.25, rough: 0.35, boilAmp: 0.5, widthJitter: 0.12, taper: 6, taperOpen: [6, 10], W: { hero: 7, secondary: 5, background: 3, detail: 2.5 } };
  const PR = () => FILM.props || {};
  function lineSet() {
    const l = PR().LINE;
    return l && typeof l.wobble === 'number' && l.W ? l : LINE0;
  }

  const RGBA = new Map();
  const rgba = (c, a) => {
    const k = c + '|' + a;
    let v = RGBA.get(k);
    if (!v) RGBA.set(k, (v = L.rgba(c, a)));
    return v;
  };
  const MIX = new Map();
  const mix = (a, b, t) => {
    const k = a + b + t;
    let v = MIX.get(k);
    if (!v) MIX.set(k, (v = L.mix(a, b, t)));
    return v;
  };

  const COL = {
    grey: L.mix(P.outlineSoft, P.bavWhite, 0.52),
    olive: L.mix(P.leafDeep, P.wheatDeep, 0.5),
    mustard: L.mix(P.wheatDeep, P.wheat, 0.35),
    maroon: L.mix(P.dirndlSkirt, P.outlineSoft, 0.3),
    denim: L.mix(P.bavBlue, P.outlineSoft, 0.52),
    jeans: L.mix(P.fesbDeep, P.outline, 0.5),
    chinos: L.mix(P.wheatDeep, P.foamShade, 0.45),
    dark: L.mix(P.outlineSoft, P.hallDim, 0.35),
    shoe: L.mix(P.hallDim, P.outline, 0.3),
    shoeBrown: P.woodDeep,
    sock: P.foam,
    sockBand: L.mix(P.foamShade, P.leafDeep, 0.55),
    hoodie: P.officeDesk,
    lederLight: L.mix(P.lederhosen, P.woodLight, 0.6),
    stitch: L.mix(P.woodLight, P.wheat, 0.5),
    mouth: L.mix(P.dirndlSkirt, P.hallDim, 0.55),
    tongue: L.mix(P.confettiD, P.dirndlSkirt, 0.45),
    teeth: L.mix(P.gloss, P.foamShade, 0.25),
    eyeWhite: L.mix(P.gloss, P.foamShade, 0.3),
    lens: L.rgba(P.glass, 0.2),
    white: P.gloss,
  };
  const SHIRTS = { grey: COL.grey, olive: COL.olive, mustard: COL.mustard, maroon: COL.maroon, denim: COL.denim };
  const LEGS = { jeans: COL.jeans, chinos: COL.chinos, dark: COL.dark };
  const skinOf = (k) => P[k] || P.skinA;
  const HAIR_X = { grey: L.mix(P.beardGrey, P.bavWhite, 0.3), greying: L.mix(P.hairBrown, P.beardGrey, 0.6) };
  const hairOf = (k) => HAIR_X[k] || P[k] || P.hairBrown;
  const browOf = (k) =>
    k === 'hairBlonde' || k === 'hairAsh' ? L.mix(P.wheatDeep, P.hairBrown, 0.6) : k === 'grey' || k === 'greying' ? L.mix(P.beardGrey, P.outline, 0.35) : L.mix(hairOf(k), P.outline, 0.3);

  /** the tone ramp of a material: lit, base, mid, core shadow, rim (warm = skin and leather) */
  const TONES = new Map();
  function tone(base, warm) {
    const key = base + (warm ? 'w' : 'c');
    let t = TONES.get(key);
    if (!t) {
      const dark = warm ? P.crust : P.outline;
      const core = L.mix(base, dark, warm ? 0.3 : 0.3);
      t = {
        base,
        hi: L.mix(base, P.gloss, 0.32),
        lit: L.mix(base, P.gloss, 0.13),
        mid: L.mix(base, dark, 0.13),
        core,
        rim: L.mix(core, P.bavWhite, warm ? 0.32 : 0.36),
        deep: L.mix(base, dark, 0.5),
      };
      TONES.set(key, t);
    }
    return t;
  }
  /** linear ramp from the lit edge (0) to the rim on the shadow edge (1) */
  function linRamp(ctx, x0, y0, x1, y1, T, rimF) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    const r = clamp(rimF, 0.03, 0.22);
    g.addColorStop(0, T.lit);
    g.addColorStop(0.28, T.base);
    g.addColorStop(0.56, T.mid);
    g.addColorStop(Math.max(0.6, 0.86 - r), T.core);
    g.addColorStop(1 - r, T.core);
    g.addColorStop(1, T.rim);
    return g;
  }
  /** radial ramp for round forms, its hot centre offset to the upper left */
  function radRamp(ctx, cx, cy, r, T, rimF) {
    const ox = cx + r * LX * 0.55, oy = cy + r * LY * 0.55;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 1.5);
    const rr = clamp(rimF, 0.03, 0.2);
    g.addColorStop(0, T.hi);
    g.addColorStop(0.2, T.lit);
    g.addColorStop(0.48, T.base);
    g.addColorStop(0.7, T.mid);
    g.addColorStop(Math.max(0.74, 0.92 - rr), T.core);
    g.addColorStop(1 - rr * 0.6, T.core);
    g.addColorStop(1, T.rim);
    return g;
  }

  // ===========================================================================
  // Paths and ink
  // ===========================================================================

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
  function polyLen(pts, closed) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    if (closed && pts.length > 2) s += Math.abs(pts[0][0] - pts[pts.length - 1][0]) + Math.abs(pts[0][1] - pts[pts.length - 1][1]);
    return s;
  }
  /** the film's ink line on people: LINE settings, low boil, an adaptive resample step */
  function ink(ctx, pts, o) {
    if (!pts || pts.length < 2) return;
    const LN = lineSet();
    const closed = !!o.closed;
    const len = polyLen(pts, closed);
    const tp = closed ? LN.taper : o.taper || LN.taperOpen || [6, 10];
    L.inkPath(ctx, pts, {
      closed, width: o.width, color: o.color || P.outline, alpha: o.alpha, seed: o.seed || 1, draw: o.draw == null ? 1 : o.draw,
      boil: o.boil, wobble: LN.wobble * (o.wob == null ? 1 : o.wob), tremble: LN.tremble, rough: LN.rough, boilAmp: o.boil === false ? 0 : BOIL,
      widthJitter: LN.widthJitter, taper: Array.isArray(tp) ? [Math.min(tp[0], len * 0.25), Math.min(tp[1], len * 0.3)] : tp,
      step: clamp(len / 45, 2.5, 5), swell: 0.08, minWidth: 0.3, fill: o.fill,
    });
  }
  function dotPx(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.3, r), 0, TAU);
    ctx.fill();
  }
  /** a soft radial fade (contact shadow, ambient occlusion, cheek tone, highlight) */
  function soft(ctx, x, y, rx, ry, rot, color, a) {
    if (rx <= 0.2 || ry <= 0.2 || a <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.55, rgba(color, a * 0.55));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  /** fill a shape with a ramp across the axis (ax, ay) from its lit side to its shadow side */
  function rampFill(ctx, pts, T, ax, ay, rimPx) {
    let nx = -ay, ny = ax;
    const l = hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (nx * -LX + ny * -LY < 0) (nx = -nx), (ny = -ny);
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = pts[i][0] * nx + pts[i][1] * ny;
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    ctx.beginPath();
    crTrace(ctx, pts, true);
    ctx.fillStyle = linRamp(ctx, nx * mn, ny * mn, nx * mx, ny * mx, T, rimPx / Math.max(1, mx - mn));
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
      if (m.size > 900) m.delete(m.keys().next().value);
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
  /** piecewise-linear profile through knots [[u, r], ...] */
  function pw(u, K) {
    if (u <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (u <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (u - K[i - 1][0]) / (K[i][0] - K[i - 1][0] || 1));
    return K[K.length - 1][1];
  }
  /** a centreline through the joints with rounded bends; u is arc length 0..1, ju the joints' u */
  function centreN(path, step) {
    const pts = [path[0]];
    const jIdx = [];
    const n = path.length;
    const addLine = (a, b) => {
      const d = hypot(b[0] - a[0], b[1] - a[1]);
      const m = Math.max(1, Math.ceil(d / step));
      for (let i = 1; i <= m; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / m, a[1] + ((b[1] - a[1]) * i) / m]);
    };
    let prev = path[0];
    for (let i = 1; i < n - 1; i++) {
      const a = path[i - 1], b = path[i], c = path[i + 1];
      const la = hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, lb = hypot(c[0] - b[0], c[1] - b[1]) || 1e-6;
      const k = Math.min(la, lb) * 0.3;
      const p1 = [b[0] - ((b[0] - a[0]) / la) * k, b[1] - ((b[1] - a[1]) / la) * k];
      const p2 = [b[0] + ((c[0] - b[0]) / lb) * k, b[1] + ((c[1] - b[1]) / lb) * k];
      addLine(prev, p1);
      for (let j = 1; j <= 6; j++) {
        const t = j / 6, s = 1 - t;
        pts.push([s * s * p1[0] + 2 * s * t * b[0] + t * t * p2[0], s * s * p1[1] + 2 * s * t * b[1] + t * t * p2[1]]);
        if (j === 3) jIdx.push(pts.length - 1);
      }
      prev = p2;
    }
    addLine(prev, path[n - 1]);
    const S = [0];
    for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = S[S.length - 1] || 1;
    return { pts, u: S.map((s) => s / tot), ju: jIdx.map((i) => S[i] / tot), len: tot };
  }
  /**
   * tube(path, profile, u0, u1, caps, outerLeft): a continuous limb or sleeve silhouette along the
   * joints. profile(ju) returns (u, outer) => radius; u0 < 0 or u1 > 1 extend past the ends.
   * caps [start, end]: 'round' | 'flat' | 'open' (open ends are hidden under something else and get
   * no ink). Returns { fill, ink: [polylines], closed, ax, ay } in the path's units.
   */
  function tube(path, profile, u0, u1, caps, outerLeft) {
    const C = centreN(path, 2.2);
    const prof = profile(C.ju);
    const n = C.pts.length;
    const at = (u) => {
      if (u <= 0) {
        const a = C.pts[0], b = C.pts[1], l = hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [a[0] + ((a[0] - b[0]) / l) * -u * C.len, a[1] + ((a[1] - b[1]) / l) * -u * C.len];
      }
      if (u >= 1) {
        const a = C.pts[n - 1], b = C.pts[n - 2], l = hypot(a[0] - b[0], a[1] - b[1]) || 1;
        return [a[0] + ((a[0] - b[0]) / l) * (u - 1) * C.len, a[1] + ((a[1] - b[1]) / l) * (u - 1) * C.len];
      }
      let i = 1;
      while (i < n - 1 && C.u[i] < u) i++;
      const t = (u - C.u[i - 1]) / (C.u[i] - C.u[i - 1] || 1);
      return l2(C.pts[i - 1], C.pts[i], clamp(t));
    };
    const list = [[at(u0), u0]];
    for (let i = 0; i < n; i++) if (C.u[i] > u0 + 0.004 && C.u[i] < u1 - 0.004) list.push([C.pts[i], C.u[i]]);
    list.push([at(u1), u1]);
    const m = list.length;
    const Lp = [], Rp = [];
    let tx0 = 0, ty0 = 0, tx1 = 0, ty1 = 0, r0 = 0, r1 = 0;
    for (let i = 0; i < m; i++) {
      const a = list[Math.max(0, i - 1)][0], b = list[Math.min(m - 1, i + 1)][0];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const p = list[i][0], u = list[i][1];
      const rl = prof(u, outerLeft), rr = prof(u, !outerLeft);
      Lp.push([p[0] - ty * rl, p[1] + tx * rl]);
      Rp.push([p[0] + ty * rr, p[1] - tx * rr]);
      if (i === 0) (tx0 = tx), (ty0 = ty), (r0 = (rl + rr) / 2);
      if (i === m - 1) (tx1 = tx), (ty1 = ty), (r1 = (rl + rr) / 2);
    }
    const capPts = (end) => {
      const kind = caps[end ? 1 : 0];
      const out = [];
      if (kind === 'open') return out;
      const A = end ? Lp[m - 1] : Rp[0], Bq = end ? Rp[m - 1] : Lp[0];
      const tx = end ? tx1 : -tx0, ty = end ? ty1 : -ty0, r = end ? r1 : r0;
      const c = l2(A, Bq, 0.5);
      if (kind === 'flat') out.push([c[0] + tx * r * 0.22, c[1] + ty * r * 0.22]);
      else {
        const a0 = atan2(A[1] - c[1], A[0] - c[0]);
        let a1 = atan2(Bq[1] - c[1], Bq[0] - c[0]);
        const tA = atan2(ty, tx);
        // sweep through the tangent direction
        let d = wrapPi(a1 - a0);
        const mid = wrapPi(tA - a0);
        if (Math.sign(mid) !== Math.sign(d)) d = d > 0 ? d - TAU : d + TAU;
        for (let k = 1; k < 6; k++) {
          const a = a0 + (d * k) / 6;
          out.push([c[0] + cos(a) * r, c[1] + sin(a) * r]);
        }
      }
      return out;
    };
    const endCap = capPts(true), startCap = capPts(false);
    const Rrev = Rp.slice().reverse();
    const fill = [...Lp, ...endCap, ...Rrev, ...startCap];
    const so = caps[0] === 'open', eo = caps[1] === 'open';
    let inkL;
    let closed = false;
    if (so && eo) inkL = [Lp, Rp];
    else if (so) inkL = [[...Lp, ...endCap, ...Rrev]];
    else if (eo) inkL = [[...Lp.slice().reverse(), ...startCap.slice().reverse(), ...Rp]];
    else (inkL = [fill]), (closed = true);
    const mi = Math.floor(m / 2);
    const a = list[Math.max(0, mi - 1)][0], b = list[Math.min(m - 1, mi + 1)][0];
    return { fill, ink: inkL, closed, ax: b[0] - a[0], ay: b[1] - a[1] };
  }
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
      ctx, x, y, h, U, f, kind,
      ow: Math.max(1.5, (W[kind] * h) / ref),
      dw: Math.max(1.1, (W.detail * h) / ref),
      seed: (L.hash('cast', key) % 90000) * 13,
      draw: o.draw == null ? 1 : clamp(o.draw),
    };
    R.rim = Math.max(1.4, 0.5 * U);
    R.m = (p) => [x + f * p[0] * U, y + p[1] * U];
    R.M = (pts) => {
      const out = new Array(pts.length);
      for (let i = 0; i < pts.length; i++) out[i] = [x + f * pts[i][0] * U, y + pts[i][1] * U];
      return out;
    };
    /** a closed form: ramp fill across axis [ax, ay] (units; default vertical) or radial {c, r}, ink */
    R.form = (pts, base, k, opt) => {
      opt = opt || {};
      const q = R.M(pts);
      if (R.draw >= 1 && base) {
        const T = tone(base, opt.warm);
        if (opt.radial) {
          const c = R.m(opt.radial.c);
          const r = opt.radial.r * U;
          ctx.beginPath();
          crTrace(ctx, q, true);
          ctx.fillStyle = radRamp(ctx, c[0], c[1], r, T, R.rim / Math.max(1, 2 * r));
          ctx.fill();
        } else {
          const ax = opt.axis ? opt.axis[0] * f : 0, ay = opt.axis ? opt.axis[1] : 1;
          rampFill(ctx, q, T, ax, ay, R.rim);
        }
      }
      if (opt.outline !== false) ink(ctx, q, { closed: true, width: opt.width || R.ow, seed: R.seed + k, draw: R.draw, color: opt.color });
      return q;
    };
    /** a limb or sleeve tube (see tube()); opt.warm for skin */
    R.tube = (path, profile, u0, u1, caps, base, k, opt) => {
      opt = opt || {};
      let outerLeft = true;
      if (opt.body) {
        const a = path[0], b = path[1];
        const tx = b[0] - a[0], ty = b[1] - a[1];
        outerLeft = -ty * (a[0] - opt.body[0]) + tx * (a[1] - opt.body[1]) > 0;
      }
      const T0 = tube(path, profile, u0, u1, caps, outerLeft);
      const q = R.M(T0.fill);
      if (R.draw >= 1 && base) rampFill(ctx, q, tone(base, opt.warm), T0.ax * f, T0.ay, R.rim);
      if (opt.outline !== false) {
        for (let i = 0; i < T0.ink.length; i++) ink(ctx, R.M(T0.ink[i]), { closed: T0.closed, width: opt.width || R.ow, seed: R.seed + k + i * 7, draw: R.draw });
      }
      return T0;
    };
    R.soft = (c, rx, ry, rot, color, a) => {
      if (R.draw < 1) return;
      const q = R.m(c);
      soft(ctx, q[0], q[1], rx * U, ry * U, rot * f, color, a);
    };
    /** a detail line (fold, seam, stitch, finger crease): a plain soft stroke, not an outline */
    R.line = (pts, k, extra) => {
      if (R.draw < 1) return;
      const q = R.M(pts);
      const a = q[0], b = q[q.length - 1];
      if (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) < 4) return;
      const e = extra || {};
      ctx.save();
      ctx.globalAlpha *= e.alpha == null ? 1 : e.alpha;
      ctx.strokeStyle = e.color || P.outlineSoft;
      ctx.lineWidth = e.width || R.dw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      crTrace(ctx, q, false);
      ctx.stroke();
      ctx.restore();
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
    R.stroke = (pts, w, color, alpha) => {
      if (R.draw < 1) return;
      const q = R.M(pts);
      ctx.save();
      ctx.globalAlpha *= alpha == null ? 1 : alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.8, w * U);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      crTrace(ctx, q, false);
      ctx.stroke();
      ctx.restore();
    };
    return R;
  }

  /** a plain filled, inked shape (the mug fallback only) */
  function shapeFig(ctx, pts, o) {
    ctx.beginPath();
    crTrace(ctx, pts, true);
    ctx.fillStyle = o.fill;
    ctx.fill();
    ink(ctx, pts, { closed: true, width: o.width, seed: o.seed });
  }

  // ===========================================================================
  // Bodies (units of 1 % of the figure's own height; head about 1/7)
  // ===========================================================================

  const BODY0 = {
    head: 15.6, headW: 12.4, neck: 3.0, neckR: 3.0, torso: 29.5, thigh: 23.6, shin: 23.5, ankleH: 3.4, hipJ: 5.3,
    shW: 11.0, chest: 11.4, waist: 9.9, hip: 10.4, belly: 0, upper: 16.6, fore: 14, hand: 10, armR: 3.2, foreR: 2.75,
    thighR: 5.0, shinR: 3.6, zStep: 2, fore2: 1, calf: 1,
  };
  const BUILDS = {
    lanky: { sh: 0.98, chest: 0.92, waist: 0.84, hip: 0.9, limb: 0.86, neck: 0.92, head: 0.96, belly: 0, legK: 1.045, neckL: 1.18 },
    slim: { sh: 0.93, chest: 0.88, waist: 0.86, hip: 0.9, limb: 0.84, neck: 0.9, head: 0.97, belly: 0 },
    athletic: { sh: 1.05, chest: 1.02, waist: 0.86, hip: 0.92, limb: 0.98, neck: 1.0, head: 0.99, belly: 0, fore2: 1.06 },
    average: { sh: 1, chest: 1, waist: 1, hip: 1, limb: 1, neck: 1, head: 1, belly: 0 },
    stocky: { sh: 1.13, chest: 1.16, waist: 1.12, hip: 1.08, limb: 1.18, neck: 1.18, head: 1.05, belly: 0.4 },
    heavy: { sh: 1.08, chest: 1.18, waist: 1.3, hip: 1.16, limb: 1.2, neck: 1.2, head: 1.06, belly: 1.7 },
  };
  function teamBody(spec) {
    const B = Object.assign({}, BODY0, { headK: 'team' });
    const m = BUILDS[spec.build] || BUILDS.average;
    B.shW *= m.sh;
    B.chest *= m.chest;
    B.waist *= m.waist;
    B.hip *= m.hip;
    B.armR *= m.limb;
    B.foreR *= m.limb;
    B.thighR *= m.limb;
    B.shinR *= m.limb;
    B.neckR *= m.neck;
    B.headW *= m.head;
    B.belly = m.belly;
    B.fore2 = m.fore2 || 1;
    B.build = spec.build;
    if (m.legK) {
      const dl0 = (m.legK - 1) * (B.thigh + B.shin) * 0.985, dn = (m.neckL - 1) * B.neck;
      B.thigh *= m.legK;
      B.shin *= m.legK;
      B.neck *= m.neckL;
      B.torso -= dl0 + dn;
    }
    return B;
  }
  function chefBody() {
    // lean and wiry: narrow waist, flat stomach, defined forearms and calves
    return Object.assign({}, BODY0, { headK: 'chef', headW: 12.7, neckR: 3.05, shW: 11.3, chest: 11.3, waist: 8.8, hip: 9.5, armR: 3.05, foreR: 2.85, thighR: 4.8, shinR: 3.5, fore2: 1.2, calf: 1.18, build: 'lean' });
  }
  function waitressBody() {
    return Object.assign({}, BODY0, { headK: 'waitress', headW: 12.9, neckR: 2.8, shW: 10.6, chest: 12.2, waist: 10.6, hip: 14.2, upper: 16, fore: 13.6, hand: 9.4, armR: 3.7, foreR: 3.0, thighR: 5.6, shinR: 3.8, build: 'full' });
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
  const E = { inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)) };
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
  /** head centre height (units) for a neutral pose */
  const headY = (B) => pelvisY(B) - B.torso - 0.6 - B.neck - B.head / 2;
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
      if (s < 0) (J.kneeL = r.mid), (J.ankL = r.end), (J.zL = f[2]), (J.liftL = f[1]);
      else (J.kneeR = r.mid), (J.ankR = r.end), (J.zR = f[2]), (J.liftR = f[1]);
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
    J.head = [J.neck[0] + sin(ha) * hd, J.neck[1] - cos(ha) * hd + p.nod * 0.9];
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
    J.wf = 1;
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
  // Anatomy profiles (radius along a limb; ju are the joints' positions along it)
  // ===========================================================================

  const armSkin = (B) => (ju) => {
    const ue = ju[0] || 0.55, f2 = B.fore2 || 1;
    return (u, outer) =>
      outer
        ? pw(u, [[-0.2, B.armR * 0.88], [0, B.armR * 0.92], [0.16 * ue, B.armR * 1.22], [0.6 * ue, B.armR * 0.98], [ue, B.foreR * 1.0], [ue + 0.3 * (1 - ue), B.foreR * 1.13 * f2], [ue + 0.72 * (1 - ue), B.foreR * 0.86], [1, B.foreR * 0.7]])
        : pw(u, [[-0.2, B.armR * 0.9], [0.25 * ue, B.armR * 0.95], [0.55 * ue, B.armR * 1.02], [ue, B.foreR * 0.9], [ue + 0.24 * (1 - ue), B.foreR * 1.05 * f2], [ue + 0.7 * (1 - ue), B.foreR * 0.82], [1, B.foreR * 0.7]]);
  };
  const sleeveLong = (B) => (ju) => {
    const ue = ju[0] || 0.55;
    return (u, outer) =>
      outer
        ? pw(u, [[-0.2, B.armR * 0.98], [0, B.armR * 1.02], [0.16 * ue, B.armR * 1.36], [0.7 * ue, B.armR * 1.2], [ue, B.foreR * 1.42], [1, B.foreR * 1.2]])
        : pw(u, [[-0.2, B.armR * 0.9], [0.2 * ue, B.armR * 1.08], [0.5 * ue, B.armR * 1.14], [ue, B.foreR * 1.3], [1, B.foreR * 1.16]]);
  };
  const sleeveShort = (B) => (ju) => {
    const ue = ju[0] || 0.55;
    return (u, outer) => (outer ? pw(u, [[-0.2, B.armR * 0.98], [0, B.armR * 1.04], [0.16 * ue, B.armR * 1.4], [0.6 * ue, B.armR * 1.3]]) : pw(u, [[-0.2, B.armR * 0.9], [0.25 * ue, B.armR * 1.12], [0.6 * ue, B.armR * 1.24]]));
  };
  const sleeveRolled = (B) => (ju) => {
    const ue = ju[0] || 0.55;
    return (u, outer) => (outer ? pw(u, [[-0.2, B.armR * 0.98], [0, B.armR * 1.02], [0.16 * ue, B.armR * 1.34], [0.7 * ue, B.armR * 1.2], [ue, B.foreR * 1.36]]) : pw(u, [[-0.2, B.armR * 0.9], [0.2 * ue, B.armR * 1.06], [ue, B.foreR * 1.26]]));
  };
  const rollBand = (B) => () => (u, outer) => B.foreR * (outer ? 1.58 : 1.48);
  const puffSleeve = (B) => (ju) => {
    const ue = ju[0] || 0.55;
    return (u, outer) =>
      outer ? pw(u, [[-0.14, B.armR * 1.0], [0, B.armR * 1.1], [0.14 * ue, B.armR * 1.62], [0.32 * ue, B.armR * 1.7], [0.5 * ue, B.armR * 1.3]]) : pw(u, [[-0.14, B.armR * 0.9], [0.22 * ue, B.armR * 1.3], [0.5 * ue, B.armR * 1.2]]);
  };
  const legSkin = (B) => (ju) => {
    const uk = ju[0] || 0.5, c = B.calf || 1;
    return (u, outer) =>
      outer
        ? pw(u, [[-0.1, B.thighR * 1.05], [0.3 * uk, B.thighR * 1.0], [0.85 * uk, B.shinR * 1.18], [uk, B.shinR * 1.06], [uk + 0.27 * (1 - uk), B.shinR * 1.3 * c], [uk + 0.72 * (1 - uk), B.shinR * 0.84], [1, B.shinR * 0.66]])
        : pw(u, [[-0.1, B.thighR * 0.95], [0.5 * uk, B.thighR * 0.84], [uk, B.shinR * 1.0], [uk + 0.2 * (1 - uk), B.shinR * 1.2 * c], [uk + 0.7 * (1 - uk), B.shinR * 0.8], [1, B.shinR * 0.66]]);
  };
  const sockProf = (B) => (ju) => {
    const s = legSkin(B)(ju);
    return (u, outer) => s(u, outer) + 0.14;
  };
  const trouserLeg = (B) => (ju) => {
    const uh = ju[0] || 0.12, uk = ju[1] || 0.55;
    return (u, outer) =>
      outer
        ? pw(u, [[0, B.hip - B.hipJ + 0.3], [uh, B.thighR * 1.12], [lerp(uh, uk, 0.55), B.thighR * 1.02], [uk, B.shinR * 1.34], [lerp(uk, 1, 0.5), B.shinR * 1.3], [1, B.shinR * 1.24]])
        : pw(u, [[0, B.hipJ * 1.1], [uh, B.thighR * 1.02], [uk, B.shinR * 1.24], [1, B.shinR * 1.18]]);
  };
  const leatherLeg = (B) => (ju) => {
    const uh = ju[0] || 0.2;
    return (u, outer) => (outer ? pw(u, [[0, B.hip - B.hipJ + 0.4], [uh, B.thighR * 1.14], [1, B.thighR * 1.0]]) : pw(u, [[0, B.hipJ * 1.12], [uh, B.thighR * 1.06], [1, B.thighR * 0.94]]));
  };
  const neckProf = (B) => () => (u) => B.neckR * lerp(1.14, 0.94, clamp(u));

  // ===========================================================================
  // Parts
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
  function torsoOutline(B, T, hem, neckW, neckDip) {
    const sh = B.shW, ar = B.armR, bel = B.belly || 0;
    const half = [
      [-neckW, T + 1.5],
      [-Math.max(sh * 0.58, neckW + 0.8), T + 0.75],
      [-(sh + ar * 0.82), T - 1.6],
      [-(sh + ar * 0.92), T - 5.2],
      [-B.chest, T - 9.5],
      [-lerp(B.chest, B.waist, 0.45) - bel * 0.3, T * 0.58],
      [-B.waist - bel, T * 0.33],
      [-B.hip - bel * 0.4, 2.6],
      [-B.hip, hem + 1.2],
      [-B.hip * 0.55, hem],
    ];
    const pts = mirrorPts(half, [0, hem - 0.3]);
    pts.push([0, T + neckDip]);
    return pts;
  }

  function contactShadow(R, B, J) {
    const x0 = Math.min(J.ankL[0], J.ankR[0]), x1 = Math.max(J.ankL[0], J.ankR[0]);
    const floor = Math.max(J.ankL[1] - J.liftL, J.ankR[1] - J.liftR) + B.ankleH;
    const rx = (x1 - x0) / 2 + B.shinR * 2.6;
    R.soft([(x0 + x1) / 2, floor - 0.2], rx, rx * 0.15, 0, P.outline, 0.32);
  }

  function drawShoe(R, B, ank, s, z, color, k, side) {
    const zs = 1 + z * 0.05;
    const hw = B.shinR * 1.45 * zs, hh = B.ankleH * 1.05 * zs;
    const ex = side ? 1.7 : 1;
    const cx = ank[0] + s * 0.45 + (side ? side * hw * 0.6 : 0), cy = ank[1] + B.ankleH * 0.42;
    const pts = [[-1, 0.62], [-1.07, 0.02], [-0.85, -0.55], [-0.35, -0.86], [0.35, -0.86], [0.85, -0.55], [1.07, 0.02], [1, 0.62], [0, 0.72]].map(([u, v]) => [cx + u * hw * ex, cy + v * hh]);
    R.form(pts, color, k, { radial: { c: [cx, cy], r: hw * ex }, warm: color === COL.shoeBrown });
    R.fill([[cx - hw * ex, cy + 0.36 * hh], [cx + hw * ex, cy + 0.36 * hh], [cx + hw * ex, cy + 0.62 * hh], [cx, cy + 0.72 * hh], [cx - hw * ex, cy + 0.62 * hh]], mix(color, P.outline, 0.45));
    R.soft([cx - hw * 0.4 * ex, cy - hh * 0.42], hw * 0.34 * ex, hh * 0.2, -0.2, P.gloss, 0.55);
    R.dot([cx - hw * 0.5 * ex, cy - hh * 0.5], hh * 0.09, P.gloss);
  }

  function drawLeg(R, B, J, p, s, st, tf) {
    const S = s < 0 ? 'L' : 'R';
    const hip = J['hip' + S], knee = J['knee' + S], ank = J['ank' + S], z = J['z' + S];
    const k = s < 0 ? 100 : 130;
    const skin = st.skin;
    if (st.kind === 'chef' || st.kind === 'waitress') {
      const path = [hip, knee, ank];
      const uk = hypot(knee[0] - hip[0], knee[1] - hip[1]) / (hypot(knee[0] - hip[0], knee[1] - hip[1]) + hypot(ank[0] - knee[0], ank[1] - knee[1]));
      const u0 = st.kind === 'waitress' ? uk + 0.1 : 0;
      R.tube(path, legSkin(B), u0, 1, ['round', 'open'], skin, k, { warm: true, body: J.pel });
      const top = st.kind === 'chef' ? uk + 0.2 * (1 - uk) : uk + 0.55 * (1 - uk);
      R.tube(path, sockProf(B), top, 1.02, ['flat', 'open'], COL.sock, k + 4, { body: J.pel });
      if (st.kind === 'chef') {
        R.tube(path, (ju) => { const f = sockProf(B)(ju); return (u, o) => f(u, o) + 0.22; }, top - 0.008, top + 0.035, ['flat', 'flat'], COL.sock, k + 8, { body: J.pel, width: R.ow * 0.6 });
        const c = l2(knee, ank, (top + 0.02 - uk) / (1 - uk)), an = atan2(ank[1] - knee[1], ank[0] - knee[0]);
        const nx = -sin(an) * B.shinR * 1.25, ny = cos(an) * B.shinR * 1.25;
        R.line([[c[0] - nx, c[1] - ny], [c[0] + nx, c[1] + ny]], k + 9, { color: COL.sockBand, width: R.dw * 1.6 });
        if (R.U >= 6) {
          const a = l2(knee, ank, 0.45), b = l2(knee, ank, 0.85);
          R.line([[a[0] + s * B.shinR * 0.35, a[1]], [b[0] + s * B.shinR * 0.25, b[1]]], k + 10, { alpha: 0.35 });
        }
      }
      drawShoe(R, B, ank, s, z, st.shoe, k + 12, st.side || 0);
      return;
    }
    // trousers: one continuous leg from under the shirt hem to the shoe
    drawShoe(R, B, ank, s, z, st.shoe, k + 12, st.side || 0);
    const upP = [sin(p.tilt), -cos(p.tilt)];
    const top = [hip[0] + upP[0] * 7, hip[1] + upP[1] * 7];
    R.tube([top, hip, knee, ank], trouserLeg(B), 0, 1, ['open', 'flat'], st.legColor, k, { body: J.pel });
    if (R.U >= 5.5) {
      const kk = l2(hip, knee, 0.93), an = atan2(ank[1] - knee[1], ank[0] - knee[0]);
      const nx = -sin(an), ny = cos(an), w = B.shinR * 1.1;
      R.line([[kk[0] - nx * w * 0.2 * s, kk[1] - ny * w * 0.2 * s], [kk[0] + nx * w * 0.9 * s, kk[1] + ny * w * 0.9 * s + 1.2]], k + 20, { alpha: 0.45 });
    }
  }

  function drawNeck(R, B, J, st) {
    const a = l2(J.chest, J.head, -0.2), b = l2(J.chest, J.head, 0.72);
    R.tube([a, b], neckProf(B), 0, 1, ['open', 'round'], st.skin, 20, { warm: true, body: J.chest });
    const T = tone(st.skin, true);
    R.soft(l2(J.chest, J.head, 0.52), B.neckR * 1.25, 1.9, J.headAng, T.deep, 0.55);
    R.soft(l2(J.chest, J.head, 0.06), B.neckR * 1.4, 1.4, J.headAng, T.deep, 0.35);
  }

  function drawSkirt(R, B, J, p, st, tf) {
    const T = B.torso * p.torsoK;
    const sway = st.skirtSway || 0;
    const top = T * 0.36;
    const hy = pelvisY(B) + B.ankleH + B.shin * 0.48, hw = B.hip * 1.42;
    const pts = [
      [-B.waist * 1.02, top], [-B.hip * 1.08, top * 0.45], [-hw * 0.95 + sway, hy + 8], [-hw + sway * 1.4, hy + 0.6],
      [-hw * 0.6 + sway * 1.4, hy - 0.9], [-hw * 0.2 + sway * 1.4, hy - 0.2], [hw * 0.2 + sway * 1.4, hy - 0.9], [hw * 0.6 + sway * 1.4, hy - 0.2],
      [hw + sway * 1.4, hy + 0.6], [hw * 0.95 + sway, hy + 8], [B.hip * 1.08, top * 0.45], [B.waist * 1.02, top],
    ].map((q) => tf(q[0], q[1]));
    const q = R.form(pts, st.skirt || P.dirndlSkirt, 31, { axis: [0, 1] });
    if (st.check && R.draw >= 1) {
      // a blue-and-white check, clipped to the skirt
      const ctx = R.ctx, bb = bboxOf(q), stp = Math.max(4, 2.2 * R.U);
      ctx.save();
      ctx.beginPath();
      crTrace(ctx, q, true);
      ctx.clip();
      ctx.lineWidth = stp * 0.42;
      ctx.strokeStyle = rgba(P.bavWhite, 0.32);
      ctx.beginPath();
      for (let xx = bb.x; xx < bb.x + bb.w; xx += stp) (ctx.moveTo(xx, bb.y), ctx.lineTo(xx, bb.y + bb.h));
      for (let yy = bb.y; yy < bb.y + bb.h; yy += stp) (ctx.moveTo(bb.x, yy), ctx.lineTo(bb.x + bb.w, yy));
      ctx.stroke();
      ctx.restore();
    }
    // folds: a soft shadow strip and a line per fold
    for (const fx of [-0.55, 0.05, 0.62]) {
      const a = tf(B.waist * fx * 1.3, top * 0.6), b = tf(hw * fx * 1.1 + sway * 1.3, hy + 1.2);
      R.soft(l2(a, b, 0.62), 1.1, (hypot(b[0] - a[0], b[1] - a[1]) * 0.42), atan2(b[1] - a[1], b[0] - a[0]) - PI / 2, P.outline, 0.22);
      R.line([l2(a, b, 0.25), b], 32 + fx * 10, { color: P.outline, alpha: 0.4 });
    }
    st.skirtHem = hy;
  }

  function drawTorso(R, B, J, p, st, tf, T) {
    const back = st.back;
    const top = st.top;
    const F = (list) => list.map((q) => tf(q[0], q[1]));
    const spine = [sin(p.lean), -cos(p.lean)];
    let hem = -3.4, dip = back ? 0.6 : -0.8;
    let neckW = B.neckR * 1.2;
    if (top === 'jersey' && !back) dip = -3.4;
    if (top === 'chef' && !back) dip = -5;
    if (top === 'blouse') {
      hem = T * 0.36;
      dip = back ? 0.6 : -1.3;
      if (st.neck === 'low' && !back) {
        // the traditional low, rounded dirndl neckline: natural, in proportion
        neckW = Math.min(B.neckR * 2.4, B.shW * 0.58);
        dip = -6.9;
        R.form(F([[-neckW * 1.02, T + 1.3], [neckW * 1.02, T + 1.3], [neckW * 0.86, T - 3.4], [0, T - 7.0], [-neckW * 0.86, T - 3.4]]), st.skin, 34, { warm: true, outline: false, axis: spine });
        R.soft(tf(0, T - 6.3), 0.7, 1.4, 0, tone(st.skin, true).core, 0.3);
        R.line(F([[-neckW * 0.85, T - 0.1], [-neckW * 0.35, T - 0.9]]), 33, { alpha: 0.3 });
        R.line(F([[neckW * 0.85, T - 0.1], [neckW * 0.35, T - 0.9]]), 32, { alpha: 0.3 });
      }
    }
    const color = st.topColor;
    if (top === 'chef' && !back) R.form(F([[-neckW * 1.2, T + 1.2], [neckW * 1.2, T + 1.2], [0, T - 6]]), st.skin, 34, { warm: true, outline: false });
    const outline = torsoOutline(B, T, hem, neckW, dip);
    if (top === 'hoodie' && !back) R.form(F([[-B.shW * 0.72, T - 0.5], [-B.shW * 0.64, T + 2.9], [0, T + 3.5], [B.shW * 0.64, T + 2.9], [B.shW * 0.72, T - 0.5]]), mix(color, P.outline, 0.12), 35, { axis: spine });
    R.form(F(outline), color, 36, { axis: spine });
    if (st.overJersey != null) return drawJerseyOver(R, B, J, p, st, tf, T, F);
    // folds at the waist, the belly curve on a heavy build
    if (R.U >= 4.2 && top !== 'blouse') {
      R.line(F([[-B.chest * 0.92, T * 0.5], [-B.chest * 0.62, T * 0.4], [-B.chest * 0.42, T * 0.42]]), 40, { alpha: 0.5 });
      R.line(F([[B.chest * 0.95, T * 0.44], [B.chest * 0.7, T * 0.32], [B.chest * 0.48, T * 0.3]]), 41, { alpha: 0.5 });
    }
    if (B.belly > 0.8 && !back) {
      R.line(F([[-B.waist * 0.7, T * 0.2], [0, T * 0.1], [B.waist * 0.75, T * 0.2]]), 42, { alpha: 0.4 });
      R.soft(tf(-B.waist * 0.25, T * 0.34), B.waist * 0.5, 3, 0, P.gloss, 0.12);
    }
    if (st.kind === 'chef') return drawChefClothes(R, B, J, p, st, tf, T, F);
    if (st.kind === 'waitress') return drawBodice(R, B, J, p, st, tf, T, F);
    const detail = { color: P.outline, alpha: 0.55 };
    if (!back) {
      if (top === 'tee' || top === 'sweater' || top === 'hoodie' || top === 'octo') {
        const band = [[-neckW * 1.3, T + 1.3], [0, T - 1.8], [neckW * 1.3, T + 1.3], [neckW * 0.98, T + 1.35], [0, T - 0.6], [-neckW * 0.98, T + 1.35]];
        R.form(F(band), top === 'octo' ? P.fesbBlue : mix(color, P.outline, 0.18), 38, { axis: spine, width: R.ow * 0.6 });
      }
      if (top === 'sweater') R.line(F([[-B.hip * 0.95, hem + 2.2], [0, hem + 1.9], [B.hip * 0.95, hem + 2.2]]), 39, detail);
      if (top === 'hoodie') {
        R.line(F([[-B.hip * 0.5, T * 0.12], [-B.hip * 0.62, T * 0.4], [B.hip * 0.62, T * 0.4], [B.hip * 0.5, T * 0.12]]), 39, detail);
        R.stroke(F([[-1.3, T - 1.2], [-1.5, T - 6.5]]), 0.35, COL.white, 0.9);
        R.stroke(F([[1.3, T - 1.2], [1.5, T - 6.5]]), 0.35, COL.white, 0.9);
      }
      if (top === 'shirt') {
        const cc = mix(color, P.gloss, 0.22);
        R.form(F([[-neckW * 1.55, T + 1.4], [-0.2, T - 2.8], [-neckW * 0.55, T - 3.4], [-neckW * 1.85, T - 0.8]]), cc, 38, { axis: spine, width: R.ow * 0.6 });
        R.form(F([[neckW * 1.55, T + 1.4], [0.2, T - 2.8], [neckW * 0.55, T - 3.4], [neckW * 1.85, T - 0.8]]), cc, 39, { axis: spine, width: R.ow * 0.6 });
        R.line(F([[0.4, T - 3], [0.5, hem + 0.8]]), 43, detail);
        for (let i = 0; i < 3; i++) R.dot(tf(1.3, T - 7.5 - i * 7), 0.42, mix(color, P.gloss, 0.6));
      }
      if (top === 'jersey') {
        const v = [[-neckW * 1.32, T + 1.3], [0, T - 4.5], [neckW * 1.32, T + 1.3], [neckW * 0.98, T + 1.35], [0, T - 3.0], [-neckW * 0.98, T + 1.35]];
        R.form(F(v), COL.white, 38, { axis: spine, width: R.ow * 0.6 });
        chestLogo(R, tf(B.chest * 0.44, T - 8.6), B.chest * 0.34 * J.wf, B.chest * 0.34);
      }
      if (top === 'octo') octoChest(R, tf(0, T * 0.52), B.chest * 1.05);
    } else {
      R.line(F([[-neckW * 1.2, T + 1.2], [0, T + 0.3], [neckW * 1.2, T + 1.2]]), 38, { color: P.outline, alpha: 0.5 });
      if (top === 'jersey') {
        // "FESB" over a huge "9": the number is 45 % of the back's height
        const wq = (0.45 * (T + 3.4)) / 1.12;
        const c = R.m(tf(0, T * 0.47));
        if (R.draw >= 1) jerseyPrint(R.ctx, c[0], c[1], wq * J.wf * R.U, wq * R.U, st.gleam || 0);
      }
      if (top === 'octo') chestLogo(R, tf(0, T - 6), B.chest * 0.3 * J.wf, B.chest * 0.3);
      if (top === 'shirt') R.line(F([[-B.chest * 0.95, T - 5], [0, T - 6.5], [B.chest * 0.95, T - 5]]), 39, { color: P.outline, alpha: 0.4 });
      if (top === 'hoodie') R.form(F([[-B.shW * 0.8, T + 0.6], [B.shW * 0.8, T + 0.6], [B.shW * 0.45, T - 9], [0, T - 11], [-B.shW * 0.45, T - 9]]), mix(color, P.outline, 0.08), 37, { axis: spine });
    }
  }

  function drawJerseyOver(R, B, J, p, st, tf, T, F) {
    const hemV = st.overJersey;
    const neckW = B.neckR * 1.2;
    const outline = torsoOutline(B, T, -3.4, neckW, -3.4).map((q) => [q[0] * 1.04, Math.max(q[1], hemV)]);
    R.form(F(outline), P.fesbBlue, 44, { axis: [sin(p.lean), -cos(p.lean)] });
    R.form(F([[-neckW * 1.32, T + 1.3], [0, T - 4.5], [neckW * 1.32, T + 1.3], [neckW * 0.98, T + 1.35], [0, T - 3.0], [-neckW * 0.98, T + 1.35]]), COL.white, 45, { width: R.ow * 0.6 });
    R.soft(tf(0, hemV - 1.2), B.hip * 1.1, 1.4, 0, P.outline, 0.3);
  }

  function drawChefClothes(R, B, J, p, st, tf, T, F) {
    const back = st.back;
    const neckW = B.neckR * 1.2;
    const spine = [sin(p.lean), -cos(p.lean)];
    if (!back) {
      // open collar and a few shirt folds
      R.form(F([[-neckW * 1.3, T + 1.4], [-0.5, T - 5], [-neckW * 1.55, T - 4.2], [-neckW * 2.2, T - 0.3]]), P.shirtWhite, 38, { axis: spine, width: R.ow * 0.7 });
      R.form(F([[neckW * 1.3, T + 1.4], [0.5, T - 5], [neckW * 1.55, T - 4.2], [neckW * 2.2, T - 0.3]]), P.shirtWhite, 39, { axis: spine, width: R.ow * 0.7 });
      if (R.U >= 3) {
        R.line(F([[-B.chest * 0.25, T - 12], [-B.chest * 0.55, T - 17]]), 40, { alpha: 0.5 });
        R.line(F([[B.chest * 0.28, T - 11], [B.chest * 0.6, T - 15.5]]), 41, { alpha: 0.5 });
      }
    }
    // lederhosen: fitted leather legs from the waistband to above the knee
    const wb = T * 0.33;
    const upP = [sin(p.tilt), -cos(p.tilt)];
    const leather = P.lederhosen;
    for (const s of [-1, 1]) {
      const S = s < 0 ? 'L' : 'R';
      const hip = J['hip' + S], knee = J['knee' + S];
      const top = [hip[0] + upP[0] * wb, hip[1] + upP[1] * wb];
      R.tube([top, hip, knee], leatherLeg(B), 0, 0.84, ['open', 'flat'], leather, 50 + s * 3, { warm: true, body: J.pel });
      // hem stitching, side seam, leather sheen
      const a = l2(hip, knee, 0.62), an = atan2(knee[1] - hip[1], knee[0] - hip[0]);
      const nx = -sin(an) * B.thighR * 1.0, ny = cos(an) * B.thighR * 1.0;
      if (R.U >= 4.5) R.line([[a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny]], 56 + s, { color: COL.stitch, width: R.dw * 0.9, alpha: 0.85 });
      if (R.U >= 6) {
        const sh = l2(hip, knee, 0.25);
        R.stroke([[sh[0] - s * 1.2, sh[1]], [sh[0] - s * 1.6, sh[1] + 4]], 0.7, P.gloss, 0.28);
        const o0 = l2(top, hip, 0.2), o1 = l2(hip, knee, 0.5);
        R.line([[o0[0] + s * (B.hip - B.hipJ) * 0.9, o0[1]], [o1[0] + s * B.thighR * 0.95, o1[1]]], 58 + s, { color: COL.stitch, alpha: 0.6, width: R.dw * 0.8 });
      }
    }
    // waistband, front flap with horn buttons
    R.form(F([[-B.waist * 1.04, wb + 0.4], [B.waist * 1.04, wb + 0.4], [B.waist * 1.06, wb - 2.2], [-B.waist * 1.06, wb - 2.2]]), leather, 60, { warm: true, axis: spine, width: R.ow * 0.8 });
    R.stroke(F([[-B.waist * 0.98, wb - 0.9], [B.waist * 0.98, wb - 0.9]]), 0.14, COL.stitch, 0.8);
    if (!back) {
      R.form(F([[-B.hipJ * 1.05, wb - 2.2], [B.hipJ * 1.05, wb - 2.2], [B.hipJ * 1.0, -3.2], [0, -5.2], [-B.hipJ * 1.0, -3.2]]), mix(leather, P.woodMid, 0.25), 62, { warm: true, axis: spine, width: R.ow * 0.75 });
      R.stroke(F([[-B.hipJ * 0.8, wb - 3.2], [-B.hipJ * 0.78, -2.6], [0, -4.2], [B.hipJ * 0.78, -2.6], [B.hipJ * 0.8, wb - 3.2]]), 0.14, COL.stitch, 0.75);
      for (const e of [-1, 1]) {
        const c = tf(e * B.hipJ * 0.72, wb - 3.6);
        R.dot(c, 0.85, mix(P.woodLight, P.outline, 0.35));
        R.dot(c, 0.62, P.woodLight);
        R.dot([c[0] - 0.2, c[1] - 0.2], 0.2, P.gloss);
      }
    }
    // suspenders with the embroidered H-bar
    const sw = 1.3;
    const strap = (x0, x1, k) => R.form(F([[x0 - sw, wb - 1], [x1 - sw, T + 0.9], [x1 + sw, T + 0.9], [x0 + sw, wb - 1]]), leather, k, { warm: true, axis: spine, width: R.ow * 0.65 });
    if (!back) {
      strap(-B.waist * 0.5, -B.shW * 0.55, 65);
      strap(B.waist * 0.5, B.shW * 0.55, 66);
      const cy = T * 0.74;
      const cx0 = -B.waist * 0.5 + (-B.shW * 0.55 + B.waist * 0.5) * ((cy - wb) / (T - wb)) - sw;
      R.form(F([[cx0, cy + 2.4], [-cx0, cy + 2.4], [-cx0, cy - 2.4], [cx0, cy - 2.4]]), leather, 67, { warm: true, axis: spine, width: R.ow * 0.65 });
      if (R.U >= 4.5) {
        R.stroke(F([[cx0 + 0.6, cy + 1.7], [-cx0 - 0.6, cy + 1.7]]), 0.14, COL.stitch, 0.8);
        R.stroke(F([[cx0 + 0.6, cy - 1.7], [-cx0 - 0.6, cy - 1.7]]), 0.14, COL.stitch, 0.8);
      }
      // edelweiss
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const c = tf(cos(a) * 1.05, cy + sin(a) * 1.05);
        R.dot(c, 0.62, P.bavWhite);
      }
      R.dot(tf(0, cy), 0.55, P.gold);
    } else {
      R.form(F([[-B.waist * 0.45 - sw, wb - 1], [B.shW * 0.5 - sw, T + 0.9], [B.shW * 0.5 + sw, T + 0.9], [-B.waist * 0.45 + sw, wb - 1]]), leather, 65, { warm: true, axis: spine, width: R.ow * 0.65 });
      R.form(F([[B.waist * 0.45 - sw, wb - 1], [-B.shW * 0.5 - sw, T + 0.9], [-B.shW * 0.5 + sw, T + 0.9], [B.waist * 0.45 + sw, wb - 1]]), leather, 66, { warm: true, axis: spine, width: R.ow * 0.65 });
    }
  }

  function drawBodice(R, B, J, p, st, tf, T, F) {
    const back = st.back;
    const wb = T * 0.36;
    const spine = [sin(p.lean), -cos(p.lean)];
    // the bodice scoop: close under the low blouse neckline (a narrow frilled blouse band shows), or
    // lower under a high-necked blouse
    const low = st.neck === 'low';
    const sx0 = low ? 0.54 : 0.4, sx1 = low ? 0.5 : 0.36, sy1 = low ? T - 3.6 : T - 4.4, sx2 = low ? 0.42 : 0.48, sy2 = low ? T - 6.8 : T - 8.4, sy3 = low ? T - 8.4 : T - 9.4;
    const bod = [
      [-B.shW * 0.72, T + 0.6], [-B.shW * sx0, T + 0.7], [-B.shW * sx1, sy1], [-B.chest * sx2, sy2], [0, sy3], [B.chest * sx2, sy2], [B.shW * sx1, sy1], [B.shW * sx0, T + 0.7], [B.shW * 0.72, T + 0.6],
      [B.shW * 0.95, T - 2.5], [B.chest * 0.98, T - 7], [B.waist * 1.02, wb + 2], [B.waist * 0.6, wb - 1.2], [0, wb - 2.6], [-B.waist * 0.6, wb - 1.2], [-B.waist * 1.02, wb + 2], [-B.chest * 0.98, T - 7], [-B.shW * 0.95, T - 2.5],
    ];
    const bodBack = [[-B.shW * 0.8, T + 0.7], [B.shW * 0.8, T + 0.7], [B.shW * 0.95, T - 2.5], [B.chest, T - 7], [B.waist * 1.02, wb + 2], [0, wb - 1], [-B.waist * 1.02, wb + 2], [-B.chest, T - 7], [-B.shW * 0.95, T - 2.5]];
    R.form(F(back ? bodBack : bod), st.bodice || P.dirndlBodice, 60, { axis: spine });
    if (back) return;
    R.soft(tf(-B.chest * 0.35, T - 13), 2.2, 4, 0.2, P.gloss, 0.16);
    // the blouse edge: a frill along the neckline
    if (low) {
      const nw = Math.min(B.neckR * 2.4, B.shW * 0.58);
      R.line(F([[-nw * 0.95, T - 0.6], [-nw * 0.72, T - 4.4], [0, T - 7.6], [nw * 0.72, T - 4.4], [nw * 0.95, T - 0.6]]), 61, { alpha: 0.5 });
    }
    else R.line(F([[-B.neckR * 1.5, T + 0.4], [-B.neckR * 0.8, T - 0.8], [0, T - 1.2], [B.neckR * 0.8, T - 0.8], [B.neckR * 1.5, T + 0.4]]), 61, { alpha: 0.6 });
    // lacing
    const y0 = T - 10.2, y1 = wb + 0.5, n = 4;
    for (let i = 0; i < n; i++) {
      const a = lerp(y0, y1, i / n), b = lerp(y0, y1, (i + 1) / n);
      R.stroke(F([[-1.6, a], [1.6, b]]), 0.32, COL.white, 0.95);
      R.stroke(F([[1.6, a], [-1.6, b]]), 0.32, COL.white, 0.95);
    }
    for (let i = 0; i <= n; i++) {
      const a = lerp(y0, y1, i / n);
      R.dot(tf(-1.9, a), 0.4, P.gloss);
      R.dot(tf(1.9, a), 0.4, P.gloss);
    }
  }
  function drawApron(R, B, J, p, st, tf, T) {
    const F = (list) => list.map((q) => tf(q[0], q[1]));
    const wb = T * 0.36;
    const hy = st.skirtHem != null ? st.skirtHem : -12;
    const sway = (st.skirtSway || 0) * 1.3;
    const ap = [[-B.waist * 0.78, wb - 0.4], [-B.hip * 0.95 + sway * 0.6, hy + 12], [-B.hip * 0.98 + sway, hy + 3.4], [0 + sway, hy + 2.8], [B.hip * 0.98 + sway, hy + 3.4], [B.hip * 0.95 + sway * 0.6, hy + 12], [B.waist * 0.78, wb - 0.4]];
    const apc = st.apron || P.dirndlApron;
    R.form(F(ap), apc, 70, { axis: [0, 1] });
    R.soft(tf(-B.hip * 0.35 + sway * 0.3, (wb + hy) / 2), 2.2, 11, 0.05, P.gloss, 0.3);
    if (R.U >= 5) for (const fx of [-0.45, 0.12, 0.55]) R.line(F([[B.waist * fx, wb - 3], [B.hip * fx * 1.1 + sway, hy + 5]]), 71 + fx * 10, { color: P.outline, alpha: 0.3 });
    R.form(F([[-B.waist * 1.03, wb + 0.4], [B.waist * 1.03, wb + 0.4], [B.waist * 1.03, wb - 1.5], [-B.waist * 1.03, wb - 1.5]]), apc, 73, { width: R.ow * 0.7 });
    const bx = B.waist * 0.72, by = wb - 0.5;
    // the bow on her left (the viewer's right): two loops and two tails
    R.form(F([[bx - 0.2, by - 0.6], [bx - 0.6, by - 8.2], [bx + 0.9, by - 8.4], [bx + 1.6, by - 3], [bx + 1.8, by - 7.5], [bx + 3.2, by - 7], [bx + 1.3, by - 0.2]]), apc, 76, { width: R.ow * 0.65 });
    R.form(F([[bx, by], [bx - 3.2, by + 2.2], [bx - 3.9, by - 0.6], [bx - 2.6, by - 2.2], [bx, by - 0.6], [bx + 3.4, by - 2.2], [bx + 4.4, by - 0.4], [bx + 3.8, by + 2.4]]), apc, 74, { width: R.ow * 0.7 });
    R.dot(tf(bx, by - 0.3), 1.0, mix(apc, P.outline, 0.2));
  }

  function drawArm(R, B, J, s, st) {
    const S = s < 0 ? 'L' : 'R';
    const sh = J['sh' + S], el = J['el' + S], wr = J['wr' + S];
    const path = [sh, el, wr];
    const la = hypot(el[0] - sh[0], el[1] - sh[1]), lb = hypot(wr[0] - el[0], wr[1] - el[1]);
    const ue = la / (la + lb || 1);
    const k = s < 0 ? 200 : 240;
    const skin = st.skin, sc = st.sleeveColor, body = J.chest;
    const hk = st.hands[s < 0 ? 0 : 1];
    const hand = () => drawHand(R, B, wr, J['ha' + S], s, hk, skin, k + 30, st.back, 1);
    const fine = R.U >= 5;
    switch (st.sleeve) {
      case 'long': {
        hand();
        R.tube(path, sleeveLong(B), -0.02, 1, ['open', 'flat'], sc, k, { body });
        const fa = atan2(wr[1] - el[1], wr[0] - el[0]), c = l2(el, wr, 0.84), nx = -sin(fa) * B.foreR * 1.3, ny = cos(fa) * B.foreR * 1.3;
        R.line([[c[0] - nx, c[1] - ny], [c[0] + nx, c[1] + ny]], k + 1, { color: P.outline, alpha: 0.45 });
        if (fine) {
          const e = l2(sh, el, 0.96);
          R.line([[e[0] - s * 1.2, e[1] - 0.6], [e[0] + s * 0.6, e[1] + 0.9]], k + 2, { alpha: 0.5 });
        }
        break;
      }
      case 'rolled': {
        R.tube(path, armSkin(B), ue - 0.08, 1, ['round', 'round'], skin, k, { warm: true, body });
        hand();
        R.tube(path, sleeveRolled(B), -0.02, ue + 0.03, ['open', 'flat'], sc, k + 4, { body });
        R.tube(path, rollBand(B), ue - 0.02, ue + 0.1, ['flat', 'flat'], sc, k + 6, { body, width: R.ow * 0.8 });
        const fa = atan2(wr[1] - el[1], wr[0] - el[0]), c = l2(sh, wr, ue + 0.04), nx = -sin(fa) * B.foreR * 1.45, ny = cos(fa) * B.foreR * 1.45;
        R.line([[c[0] - nx, c[1] - ny], [c[0] + nx, c[1] + ny]], k + 8, { alpha: 0.6 });
        if (fine) {
          const e = l2(sh, el, 0.7);
          R.line([[e[0] - s * 1.6, e[1] - 1], [e[0] + s * 0.4, e[1] + 1.4]], k + 9, { alpha: 0.45 });
        }
        break;
      }
      case 'puff': {
        R.tube(path, armSkin(B), 0.1, 1, ['open', 'round'], skin, k, { warm: true, body });
        hand();
        R.tube(path, puffSleeve(B), -0.02, 0.5 * ue, ['open', 'flat'], P.shirtWhite, k + 4, { body });
        const c = l2(sh, el, 0.3);
        if (fine) for (const d of [-1, 1]) R.line([[c[0] + d * B.armR * 0.7 - s * 0.5, c[1] - 2.6], [c[0] + d * B.armR * 0.85, c[1] + 2.2]], k + 10 + d, { alpha: 0.45 });
        break;
      }
      default: {
        // short sleeves: the bare arm grows out from under the sleeve
        R.tube(path, armSkin(B), 0.08, 1, ['open', 'round'], skin, k, { warm: true, body });
        hand();
        R.tube(path, sleeveShort(B), -0.02, 0.6 * ue, ['open', 'flat'], sc, k + 4, { body });
        if (st.sleeveTrim) R.tube(path, (ju) => { const f = sleeveShort(B)(ju); return (u, o) => f(u, o) + 0.06; }, 0.51 * ue, 0.6 * ue, ['flat', 'flat'], st.sleeveTrim, k + 6, { body, outline: false });
      }
    }
  }

  // Hands, in hand units: u from the wrist along the hand (1 = middle fingertip), v across, thumb +v
  const HAND = {
    open: [[-0.02, -0.25], [0.25, -0.3], [0.5, -0.31], [0.68, -0.29], [0.8, -0.25], [0.84, -0.19], [0.8, -0.15], [0.9, -0.12], [0.94, -0.06], [0.9, -0.01], [0.98, 0.02], [1.0, 0.09], [0.95, 0.13], [0.97, 0.17], [0.94, 0.23], [0.85, 0.26], [0.66, 0.27], [0.56, 0.3], [0.64, 0.42], [0.62, 0.5], [0.54, 0.53], [0.42, 0.47], [0.28, 0.4], [0.12, 0.33], [-0.02, 0.26]],
    fist: [[-0.02, -0.27], [0.3, -0.33], [0.55, -0.33], [0.67, -0.29], [0.72, -0.2], [0.7, -0.12], [0.75, -0.06], [0.74, 0.03], [0.77, 0.09], [0.75, 0.18], [0.68, 0.26], [0.52, 0.32], [0.32, 0.36], [0.12, 0.33], [-0.02, 0.27]],
  };
  function drawHand(R, B, wr, ang, s, kind, skin, k, back, scale) {
    if (!kind || kind === 'none') return;
    const hs = B.hand * (scale || 1);
    const dx = cos(ang), dy = sin(ang);
    const ts = s * (back ? -1 : 1);
    const nx = -dy * ts, ny = dx * ts;
    const H = (u, v) => [wr[0] + dx * u * hs + nx * v * hs, wr[1] + dy * u * hs + ny * v * hs];
    const HS = (list) => list.map((q) => H(q[0], q[1]));
    const fine = hs * R.U >= 52;
    const axis = [dx, dy];
    if (kind === 'open') {
      R.form(HS(HAND.open), skin, k, { warm: true, axis });
      if (fine) {
        R.line(HS([[0.8, -0.15], [0.62, -0.13]]), k + 1, { alpha: 0.7 });
        R.line(HS([[0.9, -0.01], [0.68, 0.0]]), k + 2, { alpha: 0.7 });
        R.line(HS([[0.95, 0.13], [0.72, 0.13]]), k + 3, { alpha: 0.7 });
      }
      return;
    }
    R.form(HS(HAND.fist), skin, k, { warm: true, axis });
    if (fine) {
      R.line(HS([[0.6, -0.26], [0.67, -0.12]]), k + 1, { alpha: 0.65 });
      R.line(HS([[0.62, -0.05], [0.69, 0.08]]), k + 2, { alpha: 0.65 });
    }
    if (kind === 'thumb') {
      R.form(HS([[0.22, 0.3], [0.3, 0.55], [0.3, 0.8], [0.4, 0.86], [0.48, 0.8], [0.46, 0.5], [0.44, 0.3]]), skin, k + 4, { warm: true, axis: [nx, ny] });
    } else if (kind === 'point') {
      R.form(HS([[0.58, -0.02], [1.22, -0.03], [1.28, 0.06], [1.22, 0.15], [0.6, 0.16]]), skin, k + 4, { warm: true, axis });
    } else if (fine) {
      R.line(HS([[0.2, 0.3], [0.45, 0.2], [0.6, 0.1]]), k + 3, { alpha: 0.75 });
    }
  }

  // ===========================================================================
  // Heads: skull, ears, face, hair, beard, glasses and bandana cap, painted once per character,
  // expression, turn, size bucket and render scale into a cached canvas (boil frozen)
  // ===========================================================================

  /** turn a head-surface x (in head widths, -0.5..0.5) by phi on the sphere */
  function warpX(x, phi) {
    if (!phi) return x;
    const c = clamp(x * 2, -1, 1);
    const extra = x - c * 0.5;
    const th = Math.asin(c) + phi;
    return 0.5 * sin(clamp(th, -PI / 2, PI / 2)) + extra * cos(phi);
  }
  function skullPts(kind, build) {
    let jw = 0.43, jy = 0.3, chw = 0.15, ch = 0.52, tw = 0.47;
    if (kind === 'chef') (jw = 0.42), (jy = 0.31), (chw = 0.16), (tw = 0.465);
    else if (kind === 'waitress') (jw = 0.4), (jy = 0.25), (chw = 0.18), (ch = 0.51);
    else if (build === 'stocky' || build === 'heavy') (jw = 0.475), (jy = 0.33), (chw = 0.2), (ch = 0.53);
    else if (build === 'slim' || build === 'lanky') (jw = 0.395), (jy = 0.29), (chw = 0.13), (ch = 0.535);
    const half = [[0, -0.5], [0.24, -0.47], [0.4, -0.37], [tw, -0.22], [0.5, -0.04], [0.49, 0.1], [jw, jy], [0.3, 0.44], [chw, ch - 0.015], [0, ch]];
    const out = half.slice();
    for (let i = half.length - 2; i >= 1; i--) out.push([-half[i][0], half[i][1]]);
    return out;
  }
  function bumpy(cx, cy, rx, ry, a0, a1, n, amp, freq) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      const r = 1 + amp * Math.abs(sin(a * freq));
      out.push([cx + cos(a) * rx * r, cy + sin(a) * ry * r]);
    }
    return out;
  }
  // hair, in head units (x head widths, y head heights, origin the head centre)
  const HAIR_FRONT = {
    short: [[-0.5, 0.02], [-0.55, -0.2], [-0.5, -0.43], [-0.3, -0.59], [0, -0.64], [0.3, -0.59], [0.5, -0.43], [0.55, -0.2], [0.5, 0.02], [0.45, -0.12], [0.39, -0.25], [0.18, -0.31], [-0.02, -0.28], [-0.16, -0.32], [-0.37, -0.26], [-0.45, -0.12]],
    buzz: [[-0.5, -0.02], [-0.525, -0.24], [-0.46, -0.46], [-0.26, -0.575], [0, -0.595], [0.26, -0.575], [0.46, -0.46], [0.525, -0.24], [0.5, -0.02], [0.45, -0.2], [0.3, -0.31], [0, -0.33], [-0.3, -0.31], [-0.45, -0.2]],
    side: [[-0.5, 0.0], [-0.56, -0.25], [-0.46, -0.52], [-0.2, -0.67], [0.16, -0.67], [0.46, -0.53], [0.56, -0.28], [0.51, 0.0], [0.46, -0.1], [0.42, -0.2], [0.2, -0.21], [-0.12, -0.26], [-0.38, -0.28], [-0.46, -0.14]],
    quiff: [[-0.5, 0.02], [-0.56, -0.22], [-0.5, -0.46], [-0.32, -0.62], [-0.08, -0.74], [0.18, -0.83], [0.4, -0.75], [0.54, -0.5], [0.56, -0.22], [0.5, 0.02], [0.45, -0.14], [0.4, -0.29], [0.22, -0.37], [0.02, -0.35], [-0.2, -0.33], [-0.38, -0.27], [-0.45, -0.12]],
    tied: [[-0.5, 0.0], [-0.55, -0.24], [-0.47, -0.47], [-0.26, -0.6], [0, -0.63], [0.26, -0.6], [0.47, -0.47], [0.55, -0.24], [0.5, 0.0], [0.44, -0.16], [0.34, -0.3], [0.16, -0.36], [0, -0.35], [-0.16, -0.36], [-0.34, -0.3], [-0.44, -0.16]],
    receding: [[-0.5, 0.05], [-0.55, -0.2], [-0.49, -0.42], [-0.3, -0.57], [0, -0.6], [0.3, -0.57], [0.49, -0.42], [0.55, -0.2], [0.5, 0.05], [0.44, -0.04], [0.42, -0.27], [0.26, -0.43], [0.08, -0.44], [0, -0.48], [-0.08, -0.44], [-0.26, -0.43], [-0.42, -0.27], [-0.44, -0.04]],
    part: [[-0.5, 0.06], [-0.56, -0.22], [-0.47, -0.47], [-0.25, -0.61], [0, -0.64], [0.25, -0.61], [0.47, -0.47], [0.56, -0.22], [0.5, 0.06], [0.43, -0.1], [0.34, -0.26], [0.16, -0.34], [0.01, -0.36], [-0.14, -0.34], [-0.33, -0.26], [-0.43, -0.1]],
  };
  function hairFrontPts(style) {
    if (style === 'curly') {
      const top = bumpy(0, -0.1, 0.57, 0.58, PI + 0.05, TAU - 0.05, 22, 0.1, 6.5);
      const line = bumpy(0, 0.02, 0.44, 0.3, -0.25, -PI + 0.25, 9, 0.13, 7).map((q) => [q[0], q[1] - 0.02]);
      return [[0.5, 0.0], ...line, [-0.5, 0.0], ...top];
    }
    return HAIR_FRONT[style] || HAIR_FRONT.short;
  }
  function hairCoverPts(style) {
    if (style === 'curly') return [...bumpy(0, -0.06, 0.57, 0.6, PI - 0.4, TAU + 0.4, 24, 0.1, 6.5), [0.44, 0.34], [0.2, 0.4], [0, 0.36], [-0.2, 0.4], [-0.44, 0.34]];
    return [[-0.53, -0.1], [-0.52, 0.2], [-0.4, 0.33], [-0.2, 0.37], [0, 0.34], [0.2, 0.37], [0.4, 0.33], [0.52, 0.2], [0.53, -0.1], [0.46, -0.44], [0.26, -0.6], [0, style === 'quiff' ? -0.7 : -0.64], [-0.26, -0.6], [-0.46, -0.44]];
  }

  function fInk(g, pts, w, color, seed, closed, alpha) {
    const LN = lineSet();
    L.inkPath(g, pts, { width: w, color: color || P.outline, seed, closed: !!closed, alpha, boil: false, wobble: LN.wobble * 0.5, tremble: LN.tremble * 0.4, rough: LN.rough * 0.5, widthJitter: LN.widthJitter, taper: closed ? 2 : [Math.max(1, w * 1.2), Math.max(1.5, w * 1.5)], minWidth: 0.3, swell: 0.15 });
  }
  function fillPts(g, pts, style, smooth) {
    g.beginPath();
    if (smooth === false) L.tracePath(g, pts, true);
    else crTrace(g, pts, true);
    g.fillStyle = style;
    g.fill();
  }
  function strokeCurve(g, a, c, b, w, color, alpha) {
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    g.stroke();
    g.globalAlpha = 1;
  }
  /** short strand strokes inside a polygon, following a flow direction fn(x, y) -> angle */
  function strands(g, poly, n, len, flow, lit, dark, w, seed) {
    const r = L.rng(seed);
    const b = bboxOf(poly);
    g.lineCap = 'round';
    let placed = 0;
    for (let tries = 0; tries < n * 6 && placed < n; tries++) {
      const x = b.x + r() * b.w, y = b.y + r() * b.h;
      if (!L.polyContains(poly, x, y)) continue;
      const a = flow(x, y) + r.range(-0.25, 0.25);
      const l = len * r.range(0.6, 1.2);
      const bend = r.range(-0.3, 0.3) * l;
      const ex = x + cos(a) * l, ey = y + sin(a) * l;
      const litSide = x * -LX + y * -LY < 0;
      strokeCurve(g, [x, y], [(x + ex) / 2 - sin(a) * bend, (y + ey) / 2 + cos(a) * bend], [ex, ey], w * r.range(0.7, 1.1), litSide ? lit : dark, litSide ? 0.55 : 0.5);
      placed++;
    }
  }

  const IRIS = { brown: L.mix(P.woodMid, P.woodDeep, 0.35), blue: L.mix(P.bavBlue, P.outlineSoft, 0.3), green: L.mix(P.leaf, P.woodMid, 0.35), hazel: L.mix(P.wheatDeep, P.leafDeep, 0.4), grey: L.mix(P.glassEdge, P.outlineSoft, 0.4) };

  function paintHead(g, hw, hh, H) {
    const back = !!H.back;
    const phi = back ? 0 : Math.asin(clamp(H.look || 0, -0.95, 0.95)) * 0.9;
    const X = (xn) => warpX(xn, phi);
    const Q = (xn, yn) => [xn * hw, yn * hh];
    const W = (xn, yn) => [X(xn) * hw, yn * hh];
    const QM = (list) => list.map((q) => Q(q[0], q[1]));
    const WM = (list) => list.map((q) => W(q[0], q[1]));
    const ow = H.ow, dl = Math.max(0.7, hw * 0.017);
    const sk = tone(H.skin, true);
    const chef = H.kind === 'chef', wt = H.kind === 'waitress';
    const seed = 5000 + (H.seed || 0);
    const hc = hairOf(H.hairColor);
    const hT = tone(hc, true);
    const profile = !back && Math.abs(H.look || 0) > 0.55;
    const sg = (H.look || 0) > 0 ? 1 : -1;

    // 1. behind the skull: buns, ponytails, braids
    if (!back && wt) waitressHairBehind(g, hw, hh, H, hT, W, dl, seed);
    if (!back && H.hair === 'tied') {
      const bun = QM(ell(0.17 * (profile ? -sg : 1), -0.6, 0.15, 0.13, 14));
      fillPts(g, bun, linRampPts(g, bun, hT, 0.1));
      fInk(g, bun, ow * 0.8, P.outline, seed + 1, true);
    }
    // 2. ears
    for (const e of [-1, 1]) {
      const th = (e * PI) / 2 + phi;
      if (!back && cos(th) < -0.25) continue;
      if (profile && e === sg) continue;
      const ex = back ? e * 0.495 : 0.495 * sin(clamp(th, -PI / 2, PI / 2));
      const ek = chef ? 0.78 : 1;
      const ear = [[-0.02, -0.12], [0.05, -0.13], [0.092, -0.08], [0.098, 0.0], [0.072, 0.085], [0.03, 0.13], [-0.01, 0.12]].map((q) => [(ex + e * q[0] * ek) * hw, (0.08 + q[1]) * hh]);
      fillPts(g, ear, linRampPts(g, ear, sk, 0.12));
      fInk(g, ear, ow * 0.85, P.outline, seed + 3 + e, true);
      if (!back) {
        strokeCurve(g, [(ex + e * 0.012) * hw, (0.08 - 0.075) * hh], [(ex + e * 0.07) * hw, 0.02 * hh], [(ex + e * 0.045) * hw, (0.08 + 0.065) * hh], dl * 0.9, sk.deep, 0.7);
        soft(g, (ex + e * 0.035) * hw, 0.09 * hh, 0.025 * hw, 0.045 * hh, 0, sk.deep, 0.45);
      }
    }
    // 3. skull with its volume
    const skull = QM(skullPts(H.kind, H.build));
    g.beginPath();
    crTrace(g, skull, true);
    g.fillStyle = radRamp(g, 0, -0.05 * hh, hw * 0.56, sk, 0.05);
    g.fill();
    g.save();
    g.beginPath();
    crTrace(g, skull, true);
    g.clip();
    if (!back) {
      const eyeY = H.eyeY * hh;
      soft(g, X(0.4) * hw, 0.08 * hh, 0.2 * hw, 0.42 * hh, 0, sk.core, 0.35);
      soft(g, X(0.2) * hw, 0.43 * hh, 0.34 * hw, 0.12 * hh, -0.3, sk.core, 0.35);
      soft(g, X(-0.26) * hw, 0.1 * hh, 0.11 * hw, 0.065 * hh, 0, P.gloss, 0.16);
      for (const e of [-1, 1]) soft(g, X(e * 0.2) * hw, eyeY, 0.14 * hw, 0.07 * hh, 0, sk.mid, 0.3);
      for (const e of [-1, 1]) soft(g, X(e * 0.27) * hw, 0.17 * hh, 0.09 * hw, 0.05 * hh, 0, P.confettiD, wt ? 0.2 : 0.06);
      if (H.build === 'heavy' || H.build === 'stocky') soft(g, 0, 0.5 * hh, 0.22 * hw, 0.05 * hh, 0, sk.core, 0.3);
    } else {
      soft(g, 0.25 * hw, 0.1 * hh, 0.28 * hw, 0.45 * hh, 0, sk.core, 0.3);
    }
    g.restore();
    fInk(g, skull, ow, P.outline, seed + 5, true);

    if (back) {
      if (chef) return paintChefBack(g, hw, hh, H, Q, QM, ow, dl, seed);
      if (wt) return paintWaitressBackHair(g, hw, hh, H, hT, Q, QM, ow, dl, seed);
      const cov = QM(hairCoverPts(H.hair));
      const T2 = H.hair === 'buzz' ? tone(mix(hc, H.skin, 0.3), true) : hT;
      fillPts(g, cov, linRampPts(g, cov, T2, 0.08));
      strands(g, cov, 22, 0.12 * hw, (x, y) => atan2(y + 0.5 * hh, x) , T2.hi, T2.deep, dl * 0.9, seed + 7);
      fInk(g, cov, ow, P.outline, seed + 8, true);
      if (H.hair === 'tied') {
        const bun = QM(ell(0, -0.3, 0.15, 0.13, 14));
        fillPts(g, bun, linRampPts(g, bun, hT, 0.1));
        fInk(g, bun, ow * 0.8, P.outline, seed + 9, true);
      }
      return;
    }

    // 4. face
    const F = H;
    const eyeY = F.eyeY * hh + (F.nod || 0) * 0.04 * hh;
    const expr = F.expr || 'smile';
    const sm = expr === 'grin' ? 0.62 : expr === 'smile' ? 0.34 : expr === 'o' ? 0.12 : 0.2;
    // beards under the features
    if (chef) paintChefBeard(g, hw, hh, W, WM, ow, dl, seed, sk);
    else if (F.beard === 'stubble') {
      const reg = WM([[-0.49, 0.04], [-0.47, 0.28], [-0.34, 0.45], [-0.16, 0.53], [0, 0.55], [0.16, 0.53], [0.34, 0.45], [0.47, 0.28], [0.49, 0.04], [0.38, 0.19], [0.2, 0.22], [0.12, 0.3], [0, 0.32], [-0.12, 0.3], [-0.2, 0.22], [-0.38, 0.19]]);
      fillPts(g, reg, rgba(hc, 0.14));
      const r = L.rng(seed + 11);
      const b = bboxOf(reg);
      g.fillStyle = rgba(hT.deep, 0.45);
      for (let i = 0; i < 140; i++) {
        const x = b.x + r() * b.w, y = b.y + r() * b.h;
        if (!L.polyContains(reg, x, y)) continue;
        g.fillRect(x, y, dl * 0.7, dl * 0.7);
      }
    } else if (F.beard === 'short') {
      const beard = WM([[-0.49, 0.1], [-0.47, 0.3], [-0.35, 0.47], [-0.17, 0.56], [0, 0.58], [0.17, 0.56], [0.35, 0.47], [0.47, 0.3], [0.49, 0.1], [0.4, 0.24], [0.24, 0.34], [0.12, 0.37], [0, 0.39], [-0.12, 0.37], [-0.24, 0.34], [-0.4, 0.24]]);
      const bt = tone(mix(hc, F.skin, 0.12), true);
      fillPts(g, beard, linRampPts(g, beard, bt, 0.06));
      strands(g, beard, 34, 0.05 * hw, () => PI / 2, bt.hi, bt.deep, dl * 0.8, seed + 12);
      fInk(g, WM([[-0.49, 0.1], [-0.47, 0.3], [-0.35, 0.47], [-0.17, 0.56], [0, 0.58], [0.17, 0.56], [0.35, 0.47], [0.47, 0.3], [0.49, 0.1]]), ow * 0.8, P.outline, seed + 13, false);
    }
    // forehead lines (older men, the chef faintly)
    if (F.forehead) {
      for (const k of [0, 1]) {
        const y = eyeY - (0.26 + k * 0.06) * hh;
        fInk(g, [W(-0.16 + k * 0.03, 0 + y / hh + 0.012), W(0, y / hh - 0.008), W(0.16 - k * 0.03, y / hh + 0.012)], dl * 0.8, chef ? rgba(P.outlineSoft, 0.45) : rgba(P.outlineSoft, 0.7), seed + 15 + k);
      }
    }
    // eyes and brows
    const eyes = [];
    for (const e of [-1, 1]) {
      const th = Math.asin(e * F.eyeX * 2) + phi;
      const vis = cos(th);
      if (vis < 0.22) continue;
      const ex = 0.5 * sin(th) * hw;
      const ew = F.eyeW * hw * (0.45 + 0.55 * vis), eh = F.eyeH * hh;
      eyes.push({ e, ex, ew, eh });
      paintEye(g, e, ex, eyeY, ew, eh, { sm, look: F.look || 0, iris: F.iris, lw: ow * 0.75, dl, female: wt, crow: (F.lines || chef) && sm > 0.3, seed: seed + 20 + e * 5, skin: sk });
      const lift = (expr === 'grin' ? 0.03 : expr === 'o' ? 0.04 : 0.012) + F.browLift;
      paintBrow(g, e, ex, eyeY - eh - lift * hh, ew, hh, F, seed + 30 + e);
    }
    // nose
    const nx = X(0) * hw * 1.04, ny = F.noseY * hh;
    paintNose(g, nx + (F.look || 0) * 0.05 * hw, eyeY, ny, hw, hh, F, sk, dl, seed + 40);
    // mouth
    const mx = X(0) * hw * 0.98, my = F.mouthY * hh;
    const mw = F.mouthW * hw * (0.55 + 0.45 * cos(phi));
    if (sm > 0.25) for (const e of [-1, 1]) fInk(g, [[nx + e * F.noseW * hw * 1.1, ny + 0.015 * hh], [mx + e * (mw + 0.035 * hw), my - 0.02 * hh], [mx + e * (mw + 0.02 * hw), my + 0.04 * hh]], dl * 0.8, rgba(P.outlineSoft, 0.5), seed + 45 + e);
    paintMouth(g, mx, my, mw, hh, hw, expr, F, sk, ow, dl, seed + 50);
    if (chef) paintMoustache(g, mx, my, mw, hw, hh, P.beard, P.beardLight || P.beard, ow, dl, seed + 60, true);
    else if (F.beard === 'moustache' || F.beard === 'short') paintMoustache(g, mx, my, mw, hw, hh, mix(hc, F.skin, F.beard === 'short' ? 0.12 : 0), hT.hi, ow, dl, seed + 60, false);
    // 5. hair, bandana, glasses
    if (chef) {
      if (H.bandana === 'on') paintBandanaCap(g, hw, hh, W, WM, ow, dl, seed, phi);
      const on = H.bandana === 'on';
      soft(g, X(on ? -0.22 : -0.2) * hw, (on ? -0.2 : -0.33) * hh, (on ? 0.1 : 0.15) * hw, (on ? 0.045 : 0.08) * hh, -0.5, P.gloss, 0.62);
      soft(g, X(on ? -0.25 : -0.24) * hw, (on ? -0.215 : -0.35) * hh, 0.035 * hw, 0.022 * hh, -0.5, P.gloss, 0.95);
    } else if (wt) paintWaitressHair(g, hw, hh, H, hT, W, WM, ow, dl, seed, phi);
    else if (profile) {
      const bx = (y) => lerp(0.34, -0.1, clamp((y + 0.42) / 0.5));
      const prof = QM(hairCoverPts(H.hair).map((q) => [sg * Math.min(sg * q[0], bx(q[1])), q[1]]));
      fillPts(g, prof, linRampPts(g, prof, hT, 0.08));
      strands(g, prof, 16, 0.1 * hw, () => (sg > 0 ? PI * 0.85 : PI * 0.15), hT.hi, hT.deep, dl * 0.9, seed + 70);
      fInk(g, prof, ow, P.outline, seed + 71, true);
      const th = (-sg * PI) / 2 + phi;
      const ex = 0.495 * sin(clamp(th, -PI / 2, PI / 2));
      const ear = [[-0.02, -0.12], [0.05, -0.13], [0.092, -0.08], [0.098, 0.0], [0.072, 0.085], [0.03, 0.13], [-0.01, 0.12]].map((q) => [(ex - sg * q[0]) * hw, (0.08 + q[1]) * hh]);
      fillPts(g, ear, linRampPts(g, ear, sk, 0.12));
      fInk(g, ear, ow * 0.85, P.outline, seed + 72, true);
    } else {
      const style = H.hair;
      const T2 = style === 'buzz' ? tone(mix(hc, H.skin, 0.32), true) : hT;
      const hp = WM(hairFrontPts(style));
      fillPts(g, hp, linRampPts(g, hp, T2, 0.07));
      const flow = style === 'side' ? () => 0.15 : style === 'quiff' ? (x) => -PI / 2 + x / hw : style === 'curly' ? () => 0 : style === 'receding' ? (x) => (x < 0 ? PI * 0.6 : PI * 0.4) : (x, y) => atan2(y + 0.55 * hh, x) + 0.3;
      if (style === 'curly') {
        const r = L.rng(seed + 73);
        const b = bboxOf(hp);
        g.lineCap = 'round';
        for (let i = 0, n = 0; i < 160 && n < 30; i++) {
          const x = b.x + r() * b.w, y = b.y + r() * b.h;
          if (!L.polyContains(hp, x, y)) continue;
          n++;
          const rr = hw * r.range(0.025, 0.045);
          g.strokeStyle = x < 0 ? T2.hi : T2.deep;
          g.globalAlpha = 0.6;
          g.lineWidth = dl * 0.9;
          g.beginPath();
          g.arc(x, y, rr, r.range(0, TAU), r.range(0, TAU) + PI * 1.3);
          g.stroke();
        }
        g.globalAlpha = 1;
      } else strands(g, hp, 22, 0.13 * hw, flow, T2.hi, T2.deep, dl * 0.9, seed + 74);
      soft(g, X(-0.2) * hw, -0.46 * hh, 0.16 * hw, 0.05 * hh, -0.3, P.gloss, 0.28);
      fInk(g, hp, style === 'buzz' ? ow * 0.75 : ow, P.outline, seed + 75, true);
    }
    if (F.glasses && eyes.length) paintGlasses(g, eyes, eyeY, hw, hh, ow, dl, seed + 80);
  }

  /** a linear ramp over a px polygon for the head painter (light from the upper left) */
  function linRampPts(g, pts, T, rimF) {
    let mn = Infinity, mx = -Infinity;
    const nx = 0.72, ny = 0.69;
    for (const p of pts) {
      const d = p[0] * nx + p[1] * ny;
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    return linRamp(g, nx * mn, ny * mn, nx * mx, ny * mx, T, rimF);
  }

  function paintEye(g, e, cx, cy, ew, eh, F) {
    const inner = [cx - e * ew, cy + 0.08 * eh], outer = [cx + e * ew, cy - 0.04 * eh];
    const lo = 0.78 - F.sm * 0.6;
    const upper = [inner, [cx - e * 0.5 * ew, cy - 0.78 * eh], [cx + e * 0.08 * ew, cy - eh], [cx + e * 0.62 * ew, cy - 0.72 * eh], outer];
    const lower = [[cx + e * 0.5 * ew, cy + (lo - 0.12) * eh], [cx - e * 0.12 * ew, cy + lo * eh], [cx - e * 0.66 * ew, cy + lo * 0.72 * eh]];
    const shape = [...upper, ...lower];
    g.save();
    g.beginPath();
    crTrace(g, shape, true);
    g.fillStyle = COL.eyeWhite;
    g.fill();
    g.clip();
    const ir = eh * 0.95, ix = cx + F.look * ew * 0.28 - e * ew * 0.04, iy = cy + 0.06 * eh;
    const ig = g.createRadialGradient(ix - ir * 0.15, iy + ir * 0.3, 0, ix, iy, ir);
    ig.addColorStop(0, mix(F.iris, P.gloss, 0.35));
    ig.addColorStop(0.62, F.iris);
    ig.addColorStop(1, mix(F.iris, P.outline, 0.6));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fill();
    dotPx(g, ix, iy, ir * 0.44, P.outline);
    dotPx(g, ix - ir * 0.34, iy - ir * 0.36, ir * 0.27, P.gloss);
    dotPx(g, ix + ir * 0.3, iy + ir * 0.3, ir * 0.1, P.gloss);
    const ls = g.createLinearGradient(0, cy - eh, 0, cy + eh * 0.15);
    ls.addColorStop(0, rgba(P.outline, 0.45));
    ls.addColorStop(1, rgba(P.outline, 0));
    g.fillStyle = ls;
    g.fillRect(cx - ew * 1.2, cy - eh * 1.2, ew * 2.4, eh * 1.4);
    g.restore();
    fInk(g, upper, F.lw, P.outline, F.seed, false);
    fInk(g, [outer, ...lower.slice(0, 2)], F.dl * 0.8, rgba(P.outlineSoft, 0.7), F.seed + 1, false);
    fInk(g, [[cx - e * 0.4 * ew, cy - 1.32 * eh], [cx + e * 0.15 * ew, cy - 1.55 * eh], [cx + e * 0.75 * ew, cy - 1.08 * eh]], F.dl * 0.8, rgba(P.outlineSoft, 0.55), F.seed + 2, false);
    if (F.female) fInk(g, [outer, [cx + e * 1.22 * ew, cy - 0.32 * eh]], F.lw * 0.8, P.outline, F.seed + 3, false);
    if (F.sm > 0.3) fInk(g, [[cx - e * 0.55 * ew, cy + (lo + 0.5) * eh], [cx + e * 0.1 * ew, cy + (lo + 0.66) * eh], [cx + e * 0.72 * ew, cy + (lo + 0.38) * eh]], F.dl * 0.8, rgba(P.outlineSoft, 0.55), F.seed + 4, false);
    if (F.crow) {
      const ox = cx + e * ew * 1.12;
      fInk(g, [[ox, cy - 0.1 * eh], [ox + e * ew * 0.3, cy - 0.35 * eh]], F.dl * 0.7, rgba(P.outlineSoft, 0.7), F.seed + 5, false);
      fInk(g, [[ox, cy + 0.2 * eh], [ox + e * ew * 0.32, cy + 0.36 * eh]], F.dl * 0.7, rgba(P.outlineSoft, 0.7), F.seed + 6, false);
    }
  }

  function paintBrow(g, e, ex, by, ew, hh, F, seed) {
    const t = F.browT * hh, arch = F.browArch * hh;
    const xi = ex - e * 1.0 * ew, xo = ex + e * 1.22 * ew;
    const X = (k) => lerp(xi, xo, k);
    const top = [[xi, by - t * 0.35], [X(0.35), by - t * 0.72 - arch], [X(0.72), by - t * 0.5 - arch * 0.9], [xo, by + t * 0.25]];
    const bot = [[xo, by + t * 0.42], [X(0.68), by + t * 0.18 - arch * 0.8], [X(0.32), by + t * 0.35 - arch * 0.6], [xi, by + t * 0.62]];
    const pts = [...top, ...bot];
    fillPts(g, pts, F.brow);
    const r = L.rng(seed);
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const k = r.range(0.05, 0.9);
      const x = X(k), y = lerp(by - t * 0.3 - arch * (1 - Math.abs(k - 0.5)), by + t * 0.3, r());
      strokeCurve(g, [x, y], [x + e * t * 0.6, y - t * 0.2], [x + e * t * 1.1, y - t * 0.05], Math.max(0.6, t * 0.18), i < 2 && F.browGrey ? F.browGrey : mix(F.brow, P.gloss, 0.25), 0.55);
    }
    fInk(g, pts, Math.max(0.6, t * 0.12), mix(F.brow, P.outline, 0.5), seed + 3, true, 0.8);
  }

  function paintNose(g, nx, ey, ny, hw, hh, F, sk, dl, seed) {
    const w = F.noseW * hw;
    const top = ey + 0.03 * hh;
    const sh = [[nx + 0.012 * hw, top], [nx + w * 0.55, ny - 0.035 * hh], [nx + w * 0.85, ny + 0.02 * hh], [nx + w * 0.25, ny + 0.035 * hh], [nx - 0.002 * hw, ny - 0.04 * hh]];
    const strong = !!F.noseStrong;
    const gr = g.createLinearGradient(0, top, 0, ny + 0.04 * hh);
    gr.addColorStop(0, rgba(sk.core, strong ? 0.3 : 0));
    gr.addColorStop(0.6, rgba(sk.core, strong ? 0.62 : 0.45));
    gr.addColorStop(1, rgba(sk.core, strong ? 0.78 : 0.6));
    fillPts(g, sh, gr);
    if (strong) fInk(g, [[nx + 0.022 * hw, ey - 0.01 * hh], [nx + w * 0.45, ny - 0.07 * hh], [nx + w * 0.78, ny - 0.015 * hh]], dl * 1.35, mix(sk.deep, P.outline, 0.35), seed + 5, false, 0.85);
    soft(g, nx + 0.01 * hw, ny + 0.062 * hh, w * 0.95, 0.024 * hh, 0, sk.deep, 0.4);
    soft(g, nx - 0.012 * hw, ny - 0.008 * hh, w * 0.4, 0.024 * hh, 0, P.gloss, 0.5);
    for (const e of [-1, 1]) soft(g, nx + e * w * 0.42, ny + 0.037 * hh, w * 0.2, 0.012 * hh, 0, mix(sk.deep, P.outline, 0.4), F.noseStrong ? 1 : 0.85);
    fInk(g, [[nx - w, ny + 0.005 * hh], [nx - w * 0.92, ny + 0.045 * hh], [nx - w * 0.42, ny + 0.058 * hh]], dl, mix(sk.deep, P.outline, 0.3), seed, false);
    fInk(g, [[nx + w * 0.42, ny + 0.058 * hh], [nx + w * 0.95, ny + 0.045 * hh], [nx + w * 1.02, ny + 0.0]], dl * 1.1, mix(sk.deep, P.outline, 0.4), seed + 1, false);
    fInk(g, [[nx - w * 0.3, ny + 0.06 * hh], [nx, ny + 0.066 * hh], [nx + w * 0.3, ny + 0.06 * hh]], dl * 0.9, rgba(P.outlineSoft, 0.6), seed + 2, false);
    fInk(g, [[nx + 0.03 * hw, top + 0.02 * hh], [nx + w * 0.62, ny - 0.03 * hh]], dl * 0.8, rgba(P.outlineSoft, 0.55), seed + 3, false);
  }

  function paintMouth(g, mx, my, mw, hh, hw, expr, F, sk, ow, dl, seed) {
    const lip = F.lip;
    const litLip = mix(lip, P.gloss, 0.22);
    const upperLip = (y0, w, lift) => [[mx - w * 1.02, y0 + lift], [mx - w * 0.5, y0 - 0.02 * hh], [mx - w * 0.08, y0 - 0.013 * hh], [mx, y0 - 0.007 * hh], [mx + w * 0.08, y0 - 0.013 * hh], [mx + w * 0.5, y0 - 0.02 * hh], [mx + w * 1.02, y0 + lift], [mx + w * 0.5, y0 + 0.002 * hh], [mx, y0 + 0.006 * hh], [mx - w * 0.5, y0 + 0.002 * hh]];
    if (expr === 'calm') {
      fillPts(g, upperLip(my, mw * 0.95, -0.012 * hh), rgba(lip, 0.7));
      const lower = [[mx - mw * 0.62, my + 0.012 * hh], [mx, my + 0.05 * hh], [mx + mw * 0.62, my + 0.012 * hh], [mx, my + 0.018 * hh]];
      fillPts(g, lower, litLip);
      soft(g, mx - mw * 0.15, my + 0.028 * hh, mw * 0.22, 0.008 * hh, 0, P.gloss, 0.5);
      fInk(g, [[mx - mw * 0.98, my - 0.016 * hh], [mx - mw * 0.4, my + 0.006 * hh], [mx, my + 0.01 * hh], [mx + mw * 0.4, my + 0.006 * hh], [mx + mw * 1.0, my - 0.018 * hh]], ow * 0.62, P.outline, seed, false);
      return;
    }
    const wide = expr === 'grin' ? 1.22 : expr === 'o' ? 0.55 : 1;
    const w = mw * wide;
    const d = (expr === 'grin' ? 0.13 : expr === 'o' ? 0.12 : 0.085) * hh;
    const lift = expr === 'o' ? 0.01 * hh : -0.026 * hh;
    let opening;
    if (expr === 'o') opening = ell(mx, my + d * 0.45, w, d * 0.55, 16);
    else opening = [[mx - w, my + lift], [mx - w * 0.5, my + 0.004 * hh], [mx, my + 0.008 * hh], [mx + w * 0.5, my + 0.004 * hh], [mx + w, my + lift], [mx + w * 0.72, my + d * 0.62], [mx, my + d], [mx - w * 0.72, my + d * 0.62]];
    fillPts(g, upperLip(expr === 'o' ? my - d * 0.08 : my, w, lift), lip);
    g.save();
    g.beginPath();
    crTrace(g, opening, true);
    g.fillStyle = COL.mouth;
    g.fill();
    g.clip();
    g.fillStyle = COL.tongue;
    g.beginPath();
    g.ellipse(mx, my + d * 1.02, w * 0.55, d * 0.42, 0, 0, TAU);
    g.fill();
    const tg = g.createLinearGradient(mx - w, 0, mx + w, 0);
    tg.addColorStop(0, mix(COL.teeth, P.outlineSoft, 0.35));
    tg.addColorStop(0.25, COL.teeth);
    tg.addColorStop(0.75, COL.teeth);
    tg.addColorStop(1, mix(COL.teeth, P.outlineSoft, 0.35));
    g.fillStyle = tg;
    g.fillRect(mx - w, my - 0.06 * hh, w * 2, (expr === 'o' ? 0.03 : expr === 'grin' ? 0.05 : 0.042) * hh + 0.06 * hh);
    if (expr === 'grin') g.fillRect(mx - w * 0.6, my + d - 0.03 * hh, w * 1.2, 0.04 * hh);
    g.strokeStyle = rgba(P.outlineSoft, 0.35);
    g.lineWidth = dl * 0.6;
    for (const k of [-0.5, -0.17, 0.17, 0.5]) {
      g.beginPath();
      g.moveTo(mx + k * w, my);
      g.lineTo(mx + k * w, my + 0.035 * hh);
      g.stroke();
    }
    g.restore();
    const lower = [[mx - w * 0.72, my + d * 0.62], [mx, my + d], [mx + w * 0.72, my + d * 0.62], [mx + w * 0.58, my + d * 0.62 + 0.03 * hh], [mx, my + d + 0.032 * hh], [mx - w * 0.58, my + d * 0.62 + 0.03 * hh]];
    if (expr !== 'o') fillPts(g, lower, litLip);
    soft(g, mx - w * 0.15, my + d + 0.014 * hh, w * 0.2, 0.008 * hh, 0, P.gloss, 0.5);
    fInk(g, opening, ow * 0.62, P.outline, seed, true);
    soft(g, mx, my + d + 0.06 * hh, w * 0.45, 0.02 * hh, 0, sk.core, 0.3);
  }

  function paintMoustache(g, mx, my, mw, hw, hh, color, lit, ow, dl, seed, chef) {
    const s = chef ? 1.05 : 0.95;
    const y0 = my - 0.012 * hh;
    const pts = [[mx - mw * 1.18 * s, y0 + 0.03 * hh], [mx - mw * 1.02 * s, y0 - 0.025 * hh], [mx - mw * 0.45, y0 - 0.05 * hh], [mx, y0 - 0.043 * hh], [mx + mw * 0.45, y0 - 0.05 * hh], [mx + mw * 1.02 * s, y0 - 0.025 * hh], [mx + mw * 1.18 * s, y0 + 0.03 * hh], [mx + mw * 0.7, y0 + 0.0], [mx, y0 + 0.004 * hh], [mx - mw * 0.7, y0 + 0.0]];
    const T = tone(color, true);
    fillPts(g, pts, linRampPts(g, pts, T, 0.1));
    strands(g, pts, 14, 0.035 * hw, (x) => PI / 2 + (x - mx) / (mw * 3), T.hi, T.deep, dl * 0.7, seed);
    fInk(g, pts, ow * 0.6, P.outline, seed + 1, true);
  }

  function paintChefBeard(g, hw, hh, W, WM, ow, dl, seed, sk) {
    // a short, neatly trimmed black beard along the jaw, a little fuller on the chin; low clean cheek line
    const beard = WM([
      [-0.515, 0.04], [-0.51, 0.2], [-0.46, 0.36], [-0.34, 0.5], [-0.2, 0.585], [-0.08, 0.62], [0, 0.628], [0.08, 0.62], [0.2, 0.585], [0.34, 0.5], [0.46, 0.36], [0.51, 0.2], [0.515, 0.04],
      [0.44, 0.1], [0.41, 0.24], [0.33, 0.33], [0.24, 0.37], [0.2, 0.35], [0.16, 0.43], [0.1, 0.465], [0, 0.475], [-0.1, 0.465], [-0.16, 0.43], [-0.2, 0.35], [-0.24, 0.37], [-0.33, 0.33], [-0.41, 0.24], [-0.44, 0.1],
    ]);
    const T = tone(P.beard, false);
    const T2 = { lit: mix(P.beard, P.beardLight || P.beard, 0.9), base: P.beard, mid: P.beard, core: mix(P.beard, P.outline, 0.3), rim: mix(P.beard, P.bavWhite, 0.18) };
    fillPts(g, beard, linRampPts(g, beard, T2, 0.05));
    strands(g, beard, 46, 0.045 * hw, (x) => PI / 2 + x / (hw * 2.2), P.beardLight || T.lit, mix(P.beard, P.outline, 0.4), dl * 0.8, seed + 90);
    strands(g, beard, 8, 0.035 * hw, () => PI / 2, P.beardGrey, P.beardGrey, dl * 0.7, seed + 91);
    fInk(g, WM([[-0.515, 0.04], [-0.51, 0.2], [-0.46, 0.36], [-0.34, 0.5], [-0.2, 0.585], [-0.08, 0.62], [0, 0.628], [0.08, 0.62], [0.2, 0.585], [0.34, 0.5], [0.46, 0.36], [0.51, 0.2], [0.515, 0.04]]), ow * 0.85, P.outline, seed + 92, false);
    // a soft cheek edge: short tufts across the cheek line
    const r = L.rng(seed + 93);
    g.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const k = i / 17, side = k < 0.5 ? -1 : 1, kk = side < 0 ? k * 2 : (k - 0.5) * 2;
      const p = W(side * lerp(0.44, 0.22, kk), lerp(0.1, 0.36, kk) + r.range(-0.01, 0.01));
      strokeCurve(g, [p[0], p[1] + 0.012 * hh], [p[0] + side * 0.004 * hw, p[1] - 0.01 * hh], [p[0] + side * 0.008 * hw, p[1] - 0.022 * hh], dl * 0.7, P.beard, 0.55);
    }
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
  function paintBandanaCap(g, hw, hh, W, WM, ow, dl, seed, phi) {
    const pts = WM(bandanaPts(true));
    const T = tone(P.bandana, true);
    g.beginPath();
    crTrace(g, pts, true);
    g.fillStyle = radRamp(g, W(-0.05, -0.3)[0], -0.3 * hh, hw * 0.55, T, 0.06);
    g.fill();
    g.save();
    g.beginPath();
    crTrace(g, pts, true);
    g.clip();
    for (const d of BANDANA_DOTS) {
      const q = W(d[0], d[1]);
      dotPx(g, q[0], q[1], hw * 0.03, P.bandanaDot);
      dotPx(g, q[0] + hw * 0.008, q[1] + hw * 0.008, hw * 0.012, rgba(T.core, 0.5));
    }
    fInk(g, WM([[-0.3, -0.42], [-0.1, -0.36], [0.12, -0.4]]), dl, rgba(T.deep, 0.6), seed + 101, false);
    fInk(g, WM([[0.1, -0.48], [0.3, -0.38], [0.42, -0.26]]), dl, rgba(T.deep, 0.6), seed + 102, false);
    g.restore();
    fInk(g, pts, ow, P.outline, seed + 103, true);
    fInk(g, WM([[-0.48, -0.22], [-0.27, -0.34], [0, -0.38], [0.27, -0.34], [0.48, -0.22]]), dl * 1.2, T.deep, seed + 104, false);
  }
  function paintChefBack(g, hw, hh, H, Q, QM, ow, dl, seed) {
    for (const e of [-1, 1]) {
      const sidePts = QM([[e * 0.47, 0.06], [e * 0.52, 0.22], [e * 0.47, 0.4], [e * 0.34, 0.52], [e * 0.38, 0.36], [e * 0.44, 0.2]]);
      fillPts(g, sidePts, P.beard);
      fInk(g, sidePts, ow * 0.8, P.outline, seed + 110 + e, true);
    }
    if (H.bandana === 'on') {
      const pts = QM(bandanaPts(false));
      const T = tone(P.bandana, true);
      fillPts(g, pts, linRampPts(g, pts, T, 0.06));
      g.save();
      g.beginPath();
      crTrace(g, pts, true);
      g.clip();
      for (const d of BANDANA_DOTS) {
        const q = Q(d[0] * 0.95, d[1] * 0.9 + 0.08);
        dotPx(g, q[0], q[1], hw * 0.03, P.bandanaDot);
      }
      g.restore();
      fInk(g, pts, ow, P.outline, seed + 113, true);
    } else {
      soft(g, -0.2 * hw, -0.3 * hh, 0.15 * hw, 0.08 * hh, -0.5, P.gloss, 0.6);
      soft(g, -0.23 * hw, -0.32 * hh, 0.035 * hw, 0.022 * hh, -0.5, P.gloss, 0.95);
    }
  }

  function paintGlasses(g, eyes, eyeY, hw, hh, ow, dl, seed) {
    // big glasses (a nudged trait): thin dark frames, a tinted lens with a reflection
    const fw = Math.max(0.8, ow * 0.55);
    for (const E0 of eyes) {
      const gx = E0.ew * 1.55, gy = E0.eh * 2.3;
      const rr = [];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU, c = cos(a), s = sin(a);
        rr.push([E0.ex + Math.sign(c) * Math.pow(Math.abs(c), 0.72) * gx, eyeY + 0.01 * hh + Math.sign(s) * Math.pow(Math.abs(s), 0.72) * gy]);
      }
      fillPts(g, rr, COL.lens);
      g.save();
      g.globalAlpha = 0.55;
      g.strokeStyle = P.gloss;
      g.lineCap = 'round';
      g.lineWidth = Math.max(1, gx * 0.16);
      g.beginPath();
      g.moveTo(E0.ex - gx * 0.55, eyeY + gy * 0.2);
      g.lineTo(E0.ex - gx * 0.1, eyeY - gy * 0.55);
      g.stroke();
      g.restore();
      fInk(g, rr, fw * 1.4, P.outline, seed + E0.e, true);
    }
    if (eyes.length === 2) {
      const a = eyes[0], b = eyes[1];
      fInk(g, [[a.ex + a.ew * 1.5, eyeY - a.eh * 0.5], [(a.ex + b.ex) / 2, eyeY - a.eh * 1.0], [b.ex - b.ew * 1.5, eyeY - b.eh * 0.5]], fw * 1.3, P.outline, seed + 3);
    }
    for (const E0 of eyes) fInk(g, [[E0.ex + E0.e * E0.ew * 1.55, eyeY - E0.eh * 0.6], [E0.ex + E0.e * (E0.ew * 1.55 + 0.1 * hw), eyeY - E0.eh * 0.3]], fw * 1.2, P.outline, seed + 5 + E0.e);
  }

  // waitresses' hair
  function plait(g, c, rx, ry, rot, T, ow, dl, seed) {
    const pts = ell(c[0], c[1], rx, ry, 12, rot);
    fillPts(g, pts, linRampPts(g, pts, T, 0.1));
    strokeCurve(g, [c[0] - cos(rot) * rx * 0.6, c[1] - sin(rot) * rx * 0.6], [c[0], c[1] - ry * 0.3], [c[0] + cos(rot) * rx * 0.6, c[1] + sin(rot) * rx * 0.6], dl * 0.8, T.hi, 0.6);
    fInk(g, pts, ow * 0.55, P.outline, seed, true);
  }
  function waitressHairBehind(g, hw, hh, H, hT, W, dl, seed) {
    const ow = H.ow;
    if (H.style === 'bun') {
      const bun = ell(W(-0.36, 0.3)[0], 0.3 * hh, 0.2 * hw, 0.17 * hh, 16);
      fillPts(g, bun, linRampPts(g, bun, hT, 0.1));
      fInk(g, bun, ow * 0.8, P.outline, seed + 120, true);
    }
    if (H.style === 'ponytail') {
      const pts = [[0.1, -0.55], [0.34, -0.72], [0.56, -0.62], [0.66, -0.3], [0.64, 0.1], [0.56, 0.42], [0.46, 0.2], [0.44, -0.2], [0.3, -0.48]].map((q) => [q[0] * hw, q[1] * hh]);
      fillPts(g, pts, linRampPts(g, pts, hT, 0.08));
      strands(g, pts, 12, 0.14 * hw, () => PI * 0.45, hT.hi, hT.deep, dl * 0.9, seed + 121);
      fInk(g, pts, ow * 0.85, P.outline, seed + 122, true);
    }
  }
  function paintWaitressHair(g, hw, hh, H, hT, W, WM, ow, dl, seed, phi) {
    const hp = WM(HAIR_FRONT.part);
    fillPts(g, hp, linRampPts(g, hp, hT, 0.07));
    strands(g, hp, 22, 0.14 * hw, (x) => (x < 0 ? PI * 0.72 : PI * 0.28), hT.hi, hT.deep, dl * 0.9, seed + 130);
    soft(g, W(-0.2, 0)[0], -0.45 * hh, 0.16 * hw, 0.05 * hh, -0.3, P.gloss, 0.3);
    fInk(g, hp, ow, P.outline, seed + 131, true);
    if (H.style === 'crown') {
      for (let i = 0; i < 10; i++) {
        const a = PI + 0.35 + (i / 9) * (PI - 0.7);
        const c = W(cos(a) * 0.5, -0.02 + sin(a) * 0.6);
        plait(g, c, 0.075 * hw, 0.05 * hh, a + PI / 2 + 0.5, hT, ow, dl, seed + 140 + i);
      }
    } else if (H.style === 'braids') {
      for (const e of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const c = W(e * (0.46 + i * 0.012), 0.2 + i * 0.13);
          plait(g, c, 0.07 * hw, 0.055 * hh, e * 0.4 + (i % 2 ? 0.5 : -0.5), hT, ow, dl, seed + 150 + i + e * 20);
        }
        const tie = W(e * 0.57, 1.36);
        dotPx(g, tie[0], tie[1], 0.045 * hw, P.fesbBlue);
      }
    } else if (H.style === 'ponytail') {
      const c = W(0.2, -0.56);
      const bow = [[-0.12, -0.06], [0, 0], [-0.12, 0.06], [0.12, -0.06], [0, 0], [0.12, 0.06]];
      for (const s0 of [-1, 1]) {
        const lobe = [[0, 0], [s0 * 0.13 * hw, -0.06 * hh], [s0 * 0.14 * hw, 0.06 * hh]].map((q) => [c[0] + q[0], c[1] + q[1]]);
        fillPts(g, lobe, H.ribbon);
        fInk(g, lobe, ow * 0.55, P.outline, seed + 160 + s0, true);
      }
      void bow;
      dotPx(g, c[0], c[1], 0.03 * hw, mix(H.ribbon, P.outline, 0.3));
    } else if (H.style === 'bun' && H.flower) {
      const c = W(0.4, -0.3);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const pe = ell(c[0] + cos(a) * 0.045 * hw, c[1] + sin(a) * 0.045 * hw, 0.04 * hw, 0.028 * hw, 10, a);
        fillPts(g, pe, P.bavWhite);
        fInk(g, pe, ow * 0.4, P.outline, seed + 170 + i, true);
      }
      dotPx(g, c[0], c[1], 0.026 * hw, P.gold);
    }
  }
  function paintWaitressBackHair(g, hw, hh, H, hT, Q, QM, ow, dl, seed) {
    const cov = QM(hairCoverPts('short'));
    fillPts(g, cov, linRampPts(g, cov, hT, 0.08));
    strands(g, cov, 22, 0.13 * hw, (x) => (x < 0 ? PI * 0.6 : PI * 0.4), hT.hi, hT.deep, dl * 0.9, seed + 180);
    fInk(g, cov, ow, P.outline, seed + 181, true);
  }

  /** draw a cached head at the rig's head joint */
  function headBlit(R, J, B, key, H) {
    const S = FILM.S || 1;
    const wfh = 0.9 + 0.1 * J.wf;
    // painted unsquashed at a bucketed size; the turn squash is applied when drawing
    const hwPx = B.headW * R.U;
    const q = bucket(hwPx);
    const sc = hwPx / q;
    const qh = Math.round(((q * B.head) / B.headW) * 100) / 100;
    const extra = H.style === 'braids' ? 0.75 : 0;
    const cw = q * 2.0, top = qh * 1.02, ch = qh * (2.02 + extra);
    const owq = Math.round((R.ow / sc) * 4) / 4;
    const c = cacheGet('head|' + key + '|' + owq + '|' + q.toFixed(2) + '|' + qh + '|' + S, () => {
      const cv = newCanvas(cw * S, ch * S);
      const g = cv.getContext('2d');
      g.scale(S, S);
      g.translate(cw / 2, top);
      paintHead(g, q, qh, Object.assign({}, H, { ow: owq }));
      return cv;
    });
    if (R.draw < 1) return;
    const ctx = R.ctx;
    const p = R.m(J.head);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(R.f * J.headAng);
    ctx.scale(R.f * sc * wfh, sc);
    ctx.drawImage(c, -cw / 2, -top, cw, ch);
    ctx.restore();
  }

  // ===========================================================================
  // Prints and logos (cached), mugs
  // ===========================================================================

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
  // TEAM (art bible 10.3): fifteen men (skinA / skinB): nine 30 to 40, four in their twenties, two
  // older (45 to 55, greying). The four named ones (label) are fixed by the real team. About a
  // quarter with stubble or a short beard, one moustache, glasses on four; nobody bald but the chef.
  // Extra fields beyond the contract: label, top, legs (the casual outfit), tall, iris.
  // ===========================================================================

  const TEAM = [
    { id: 'tm01', label: 'tallest', skin: 'skinA', age: 33, hair: 'side', hairColor: 'hairFair', glasses: false, beard: null, build: 'lanky', shirt: 'denim', top: 'shirt', legs: 'chinos', tall: 1.12, iris: 'blue' },
    { id: 'tm02', label: 'tall', skin: 'skinA', age: 'mid', hair: 'short', hairColor: 'hairAsh', glasses: false, beard: 'stubble', build: 'slim', shirt: 'grey', top: 'sweater', legs: 'jeans', tall: 1.07, iris: 'grey' },
    { id: 'tm03', label: 'tall and stocky', skin: 'skinB', age: 'mid', hair: 'buzz', hairColor: 'hairBlack', glasses: false, beard: 'short', build: 'stocky', shirt: 'olive', top: 'hoodie', legs: 'dark', tall: 1.06, iris: 'brown' },
    { id: 'tm04', label: 'stocky', skin: 'skinA', age: 'mid', hair: 'curly', hairColor: 'hairChestnut', glasses: true, beard: null, build: 'stocky', shirt: 'maroon', top: 'tee', legs: 'jeans', tall: 0.94, iris: 'hazel' },
    { id: 'tm05', skin: 'skinB', age: 'older', hair: 'receding', hairColor: 'grey', glasses: true, beard: 'moustache', build: 'heavy', shirt: 'mustard', top: 'shirt', legs: 'chinos', tall: 0.98, iris: 'brown' },
    { id: 'tm06', skin: 'skinA', age: 'young', hair: 'quiff', hairColor: 'hairBlack', glasses: false, beard: null, build: 'slim', shirt: 'olive', top: 'tee', legs: 'jeans', tall: 1.02, iris: 'green' },
    { id: 'tm07', skin: 'skinB', age: 'mid', hair: 'tied', hairColor: 'hairBrown', glasses: false, beard: 'short', build: 'average', shirt: 'denim', top: 'tee', legs: 'dark', tall: 0.97, iris: 'brown' },
    { id: 'tm08', skin: 'skinA', age: 'young', hair: 'curly', hairColor: 'hairBlonde', glasses: false, beard: null, build: 'slim', shirt: 'maroon', top: 'hoodie', legs: 'jeans', tall: 0.95, iris: 'blue' },
    { id: 'tm09', skin: 'skinA', age: 'mid', hair: 'short', hairColor: 'hairBrown', glasses: true, beard: null, build: 'heavy', shirt: 'grey', top: 'shirt', legs: 'dark', tall: 1.0, iris: 'hazel' },
    { id: 'tm10', skin: 'skinB', age: 'older', hair: 'side', hairColor: 'greying', glasses: false, beard: 'stubble', build: 'average', shirt: 'mustard', top: 'sweater', legs: 'chinos', tall: 1.01, iris: 'grey' },
    { id: 'tm11', skin: 'skinA', age: 'mid', hair: 'quiff', hairColor: 'hairBrown', glasses: false, beard: null, build: 'athletic', shirt: 'maroon', top: 'tee', legs: 'jeans', tall: 1.04, iris: 'brown' },
    { id: 'tm12', skin: 'skinB', age: 'young', hair: 'buzz', hairColor: 'hairBlonde', glasses: false, beard: null, build: 'slim', shirt: 'denim', top: 'hoodie', legs: 'dark', tall: 0.92, iris: 'blue' },
    { id: 'tm13', skin: 'skinA', age: 'mid', hair: 'side', hairColor: 'hairRed', glasses: false, beard: null, build: 'stocky', shirt: 'olive', top: 'shirt', legs: 'chinos', tall: 0.99, iris: 'green' },
    { id: 'tm14', skin: 'skinB', age: 'young', hair: 'short', hairColor: 'hairBlack', glasses: true, beard: null, build: 'slim', shirt: 'grey', top: 'tee', legs: 'jeans', tall: 1.03, iris: 'brown' },
    { id: 'tm15', skin: 'skinA', age: 'mid', hair: 'part', hairColor: 'hairChestnut', glasses: false, beard: null, build: 'average', shirt: 'maroon', top: 'sweater', legs: 'dark', tall: 0.96, iris: 'hazel' },
  ];
  TEAM.forEach((s) => Object.freeze(s));
  Object.freeze(TEAM);
  const CHEF_TALL = 0.95;

  // ===========================================================================
  // person
  // ===========================================================================

  function crouchLegs(B) {
    const pose = { py: 17.5, fL: [-9, 0, 0.6], fR: [9, 0, 0.6], foreL: 0.55, foreR: 0.55, torsoK: 0.95 };
    const J = solve(B, full(pose));
    pose.ikL = [J.kneeL[0] + 0.8, J.kneeL[1] - 2.2, 1, 0.2, -0.4];
    pose.ikR = [J.kneeR[0] - 0.8, J.kneeR[1] - 2.2, 1, 0.2, -0.4];
    pose.hands = ['open', 'open'];
    return pose;
  }
  /** a relaxed idle per person: weight on one leg, the other knee soft, arms slightly bent, head tilt */
  function idleOf(id) {
    const hsh = L.hash('idle', id);
    const w = hsh % 2 ? 1 : -1;
    const v = (((hsh >>> 3) % 7) - 3) / 3, v2 = (((hsh >>> 7) % 7) - 3) / 3;
    return {
      px: w * 1.3, py: 0.4, tilt: -w * 0.045, lean: w * 0.012, head: v * 0.07, look: v2 * 0.12, shL: w > 0 ? 0.3 : -0.2, shR: w > 0 ? -0.2 : 0.3,
      fL: w > 0 ? [-6.8, 1.0, 0.5] : [-5.2, 0, 0], fR: w > 0 ? [5.2, 0, 0] : [6.8, 1.0, 0.5], kneeL: w > 0 ? -1 : 1, kneeR: w > 0 ? 1 : -1,
      aL: [0.13 + 0.05 * v, 0.34 + 0.1 * v2, 0.1, 1], aR: [0.13 - 0.05 * v, 0.3 - 0.1 * v2, -0.1, 1],
    };
  }
  function clapPose(B, t, extra) {
    const ph = ((t % 0.5) + 0.5) % 0.5 / 0.5;
    const d = 1.2 + 7 * Math.pow(sin(PI * ph), 0.7);
    const cy = pelvisY(B) - B.torso * 0.72;
    return Object.assign({ ikL: [-d / 2, cy, 1, 1.2, -1.2], ikR: [d / 2, cy, 1, 1.2, 1.2], hands: ['open', 'open'], expr: 'grin', head: 0.05 * sin(TAU * t * 2) }, extra || {});
  }
  function personPose(spec, B, pose, o) {
    const name = pose.name || 'stand';
    const k = clamp(num(pose.k, 1));
    const t = num(pose.t, 0);
    const crouch = !!(pose.crouch || o.crouch || name === 'crouch');
    const stand = Object.assign(idleOf(spec.id), { expr: L.hash('mouth', spec.id) % 5 < 2 ? 'calm' : 'smile' });
    const lower = crouch ? crouchLegs(B) : null;
    const withLegs = (q) => (lower ? Object.assign({}, q, { py: lower.py, px: 0, tilt: 0, fL: lower.fL, fR: lower.fR, foreL: lower.foreL, foreR: lower.foreR, torsoK: lower.torsoK, kneeL: 1, kneeR: 1 }) : q);
    const armsDown = lower ? Object.assign({}, stand, lower, { px: 0, tilt: 0 }) : stand;
    const R0 = (q) => resolve(B, withLegs(q));
    const legs = (q) => Object.assign({}, stand, q);
    let p;
    switch (name) {
      case 'sit': {
        const pe = pelvisY(B);
        const view = o.view === 'side';
        const lift = -B.ankleH - (pe + 25.5);
        p = resolve(B, {
          py: 0, fL: [view ? 14 : -6.5, lift, view ? 0 : 1], fR: [view ? 16 : 6.5, lift, view ? 0 : 1],
          foreL: view ? 1 : 0.2, foreR: view ? 1 : 0.2, kneeL: 1, kneeR: 1, head: stand.head, look: stand.look,
          ikL: view ? [8, pe - 1, 0, 1] : [-6.5, pe - 3, 1, 0.3, 0.3], ikR: view ? [10, pe - 1, 0, 1] : [6.5, pe - 3, 1, 0.3, -0.3], expr: stand.expr,
        });
        if (view) p.kneeP = [1, -0.6];
        p.seat = true;
        break;
      }
      case 'cheer': {
        const pump = pose.t != null ? 0.12 * sin(t * TAU * 2) : 0;
        p = mixPose(R0(stand), R0(legs({ py: -0.6, px: 0, tilt: 0, aL: [2.55 + pump, 0.28, 0.2], aR: [2.55 - pump, 0.28, 0.2], hands: ['open', 'open'], expr: 'o', head: -0.04 })), pose.k == null ? 1 : k);
        break;
      }
      case 'clap':
        p = R0(legs(clapPose(B, t)));
        break;
      case 'reach':
        p = mixPose(R0(stand), R0(legs({ aR: [1.65, 0.45, 0], aL: [0.2, 0.25, 0], head: 0.06, hands: ['open', 'grip'], expr: 'grin' })), pose.k == null ? 1 : k);
        break;
      case 'catch': {
        const up = R0(legs({ py: -0.4, aL: [2.45, 0.45, 0.2], aR: [2.45, 0.45, 0.2], hands: ['open', 'open'], expr: 'o' }));
        const hug = R0(legs({ ikL: [5, pelvisY(B) - B.torso * 0.62, 1, 1], ikR: [-5, pelvisY(B) - B.torso * 0.58, 1, 1], hands: ['open', 'open'], expr: 'grin', head: 0.08 }));
        p = mixPose(up, hug, E.inOut(k));
        p.hug = k > 0.45;
        break;
      }
      case 'pullOn': {
        const up = R0(legs({ aL: [2.9, 0.12, 0], aR: [2.9, 0.12, 0], hands: ['fist', 'fist'], expr: 'grin' }));
        const mid = R0(legs({ aL: [2.2, 0.9, 0], aR: [2.2, 0.9, 0], hands: ['fist', 'fist'], expr: 'grin' }));
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

  function teamHead(spec, expr) {
    const h = L.hash('face', spec.id);
    const v = (i) => (((h >>> (i * 4)) & 15) / 15 - 0.5) * 2;
    const young = spec.age === 'young' || (typeof spec.age === 'number' && spec.age < 30);
    const older = spec.age === 'older' || (typeof spec.age === 'number' && spec.age >= 45);
    const broad = spec.build === 'stocky' || spec.build === 'heavy';
    const skin = skinOf(spec.skin);
    return {
      kind: 'team', build: spec.build, skin, hair: spec.hair, hairColor: spec.hairColor, beard: spec.beard, glasses: !!spec.glasses,
      eyeY: 0.02, eyeX: 0.205 + v(0) * 0.01, eyeW: 0.098 + v(1) * 0.006, eyeH: 0.047 + (young ? 0.004 : 0), iris: IRIS[spec.iris] || IRIS.brown,
      browT: 0.034 + v(2) * 0.006 + (broad ? 0.006 : 0), browArch: 0.012 + v(3) * 0.008, browLift: 0.072 + v(4) * 0.01, brow: browOf(spec.hairColor),
      noseY: 0.2, noseW: 0.078 + v(5) * 0.012 + (broad ? 0.01 : 0), mouthY: 0.318, mouthW: 0.14 + v(6) * 0.012,
      lip: mix(skin, P.dirndlSkirt, 0.14), lines: older, forehead: older, expr, seed: h % 1000,
    };
  }
  function lookKey(v) {
    return Math.round(clamp(v, -1, 1) * 10);
  }
  // heads are cached per quantised turn and nod, so they are painted with the quantised values
  const lookQ = (v) => lookKey(v) / 10;
  const nodQ = (v) => Math.round((v || 0) * 4) / 4;

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
    const look = side ? 0.9 : back ? 0 : clamp(p.look + sin(ph) * 0.95, -1, 1);
    const J = solve(B, p);
    squashJ(J, side ? 1 : Math.max(0.5, Math.abs(c)));
    if (side) J.wf = 0.62;
    if (p.seat) shiftJ(J, 0, -J.pel[1] - 4);
    const R = makeRig(ctx, x, y, hh, o, spec.id);
    const outfit = pose.name === 'pullOn' ? (clamp(num(pose.k, 1)) >= 0.5 ? 'pull' : 'casual') : o.outfit || 'casual';
    const jersey = outfit === 'jersey', octo = outfit === 'octoTee';
    const top = jersey ? 'jersey' : octo ? 'octo' : spec.top;
    const color = jersey ? P.fesbBlue : octo ? P.shirtWhite : SHIRTS[spec.shirt] || COL.grey;
    const st = {
      kind: 'team', spec, skin: skinOf(spec.skin), top, topColor: color, sleeve: jersey || octo || top === 'tee' ? 'short' : 'long', sleeveColor: color,
      sleeveTrim: jersey ? COL.white : octo ? P.fesbBlue : null, legColor: LEGS[spec.legs] || COL.jeans, shoe: spec.legs === 'chinos' ? COL.shoeBrown : COL.shoe,
      back, look, hands: o.hands || p.hands, gleam: o.gleam || 0, side: side ? 1 : 0,
      armBehind: !back && Math.abs(c) < 0.4 ? (sin(ph) > 0 ? 'R' : 'L') : null,
      sitBack: p.seat && back, upper: !!o.upper, ground: !p.seat && !o.upper && o.shadow !== false,
    };
    if (pose.name === 'reach') st.hands = [p.hands[0], o.mug ? 'none' : 'fist'];
    if (p.hug && !back) st.skipArms = true;
    if (outfit === 'pull') {
      const kk = clamp((num(pose.k, 1) - 0.5) / 0.4);
      st.overJersey = lerp(B.torso * 0.72, -3.4, E.inOut(kk));
      if (kk >= 1) Object.assign(st, { top: 'jersey', topColor: P.fesbBlue, sleeve: 'short', sleeveColor: P.fesbBlue, sleeveTrim: COL.white, overJersey: null });
      else Object.assign(st, { sleeve: 'short', sleeveColor: P.fesbBlue, sleeveTrim: COL.white });
    }
    const H = teamHead(spec, p.expr);
    H.look = lookQ(look);
    H.nod = nodQ(p.nod);
    H.back = back;
    st.head = { key: spec.id + '|' + p.expr + '|' + lookKey(look) + '|' + Math.round((p.nod || 0) * 4) + '|' + (back ? 1 : 0), H };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    drawFigure(R, B, J, p, st);
    const pk = clamp(num(pose.k, 1));
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
    const hand = R.m(J.hcR);
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
  // The figure
  // ===========================================================================

  function headMap(B, J) {
    const hc = J.head, a = J.headAng, ca = cos(a), sa = sin(a);
    const hw = B.headW * (0.9 + 0.1 * J.wf), hh = B.head;
    return (x, y) => {
      const X = x * hw, Y = y * hh;
      return [hc[0] + X * ca - Y * sa, hc[1] + X * sa + Y * ca];
    };
  }
  function drawFigure(R, B, J, p, st) {
    const back = st.back;
    const T = B.torso * p.torsoK;
    const tf = torsoFrame(B, J, p);
    if (st.ground) contactShadow(R, B, J);
    if (st.kind === 'chef' && st.bandana === 'on' && !back) drawBandanaTails(R, B, J, st, false);
    if (!st.upper && !st.sitBack) {
      const order = J.zL > J.zR ? [1, -1] : [-1, 1];
      for (const s of order) drawLeg(R, B, J, p, s, st, tf);
      if (st.kind === 'team') R.soft(tf(0, -2.4), B.hip * 1.05, 1.8, p.tilt, P.outline, 0.32);
    }
    if (st.kind === 'waitress') drawSkirt(R, B, J, p, st, tf);
    drawNeck(R, B, J, st);
    if (st.armBehind) drawArm(R, B, J, st.armBehind === 'L' ? -1 : 1, st);
    drawTorso(R, B, J, p, st, tf, T);
    if (st.kind === 'waitress' && !back) drawApron(R, B, J, p, st, tf, T);
    if (!back) for (const e of [-1, 1]) R.soft(tf(e * (B.chest - 1.3), T - 8.5), 2.2, 5.5, 0, P.outline, 0.22);
    if (!st.skipArms) for (const s of [-1, 1]) if (st.armBehind !== (s < 0 ? 'L' : 'R')) drawArm(R, B, J, s, st);
    headBlit(R, J, B, st.head.key, st.head.H);
    if (st.kind === 'chef') {
      if (back && st.bandana === 'on') drawBandanaTails(R, B, J, st, true);
      if (st.gleam > 0.01 && !back) {
        const HM = headMap(B, J);
        const on = st.bandana === 'on';
        const q = HM(on ? -0.22 : -0.2, on ? -0.21 : -0.34);
        R.soft(q, B.headW * (0.25 + 0.2 * st.gleam), B.headW * (0.14 + 0.1 * st.gleam), -0.5, P.gloss, 0.5 * st.gleam);
        const sp = PR().sparkle;
        const qq = R.m(q);
        if (typeof sp === 'function') sp(R.ctx, qq[0], qq[1], B.headW * R.U * (0.25 + 0.3 * st.gleam), clamp(st.gleam));
      }
    }
  }

  function drawBandanaTails(R, B, J, st, back) {
    const HM = headMap(B, J);
    const fl = st.tails || 0;
    const side = back ? 0 : st.look > 0.05 ? -1 : st.look < -0.05 ? 1 : -1;
    const k = HM(back ? 0 : side * 0.5, back ? 0.02 : -0.12);
    const T = tone(P.bandana, true);
    for (const e of [0, 1]) {
      const a = (back ? PI / 2 + (e ? 0.35 : -0.35) : side < 0 ? PI * 0.72 + e * 0.35 : PI * 0.28 - e * 0.35) + fl * (e ? 1.1 : 0.8);
      const len = B.head * (0.34 + e * 0.06), w = B.head * 0.065;
      const tip = [k[0] + cos(a) * len, k[1] + sin(a) * len];
      const ang = a + PI / 2;
      const pts = [[k[0] + cos(ang) * w, k[1] + sin(ang) * w], [tip[0] + cos(ang) * w * 0.5, tip[1] + sin(ang) * w * 0.5], [tip[0] + cos(a) * w * 0.6, tip[1] + sin(a) * w * 0.6], [tip[0] - cos(ang) * w * 0.9, tip[1] - sin(ang) * w * 0.9], [k[0] - cos(ang) * w, k[1] - sin(ang) * w]];
      R.form(pts, P.bandana, 360 + e, { warm: true, axis: [cos(a), sin(a)] });
      R.dot(l2(k, tip, 0.6), B.head * 0.018, P.bandanaDot);
    }
    const kn = ell(k[0], k[1], B.head * 0.075, B.head * 0.06, 12);
    R.form(kn, P.bandana, 363, { warm: true, radial: { c: k, r: B.head * 0.075 } });
    void T;
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
    const pe = pelvisY(B), hy = headY(B);
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
        p = R0({ py: 0.9, px: 1.2, tilt: -0.06, fL: [-9.5, 1.0, 0.4], fR: [9.5, 0, 0], kneeL: -1, shR: -1.6, aL: [-0.1, -1.5, 0.1, 1.0], aR: [-0.06, -1.55, -0.1, 1.0], hands: ['fist', 'fist'], head: -0.09, expr: 'grin' });
        if (name === 'nod') p.nod = sin(k * PI);
        break;
      }
      case 'tieBandana': {
        const hk = [
          [0, R0(Object.assign({}, stand, { ikR: [11.5, pe + 2, 1, 0.2], hands: ['open', 'fist'], expr: 'smile' }))],
          [0.25, R0({ py: 0.6, fL: [-7.5, 0, 0], fR: [7.5, 0, 0], ikL: [-9, hy - 12, 1, 0.8], ikR: [9, hy - 12, 1, 0.8], hands: ['fist', 'fist'], head: 0, expr: 'grin' })],
          [0.5, R0({ py: 0.6, fL: [-7.5, 0, 0], fR: [7.5, 0, 0], ikL: [-5, hy - 3.5, 1, -0.4], ikR: [5, hy - 3.5, 1, -0.4], hands: ['fist', 'fist'], head: 0.06, expr: 'smile' })],
          [0.75, R0({ py: 0.6, fL: [-7.5, 0, 0], fR: [7.5, 0, 0], ikL: [-8.5, hy - 1, 1, -0.2], ikR: [3, hy - 5, 1, -0.6], hands: ['fist', 'fist'], head: -0.08, expr: 'grin', tails: 0.4 })],
          [1, R0({ py: 0.4, fL: [-8.5, 0, 0], fR: [8.5, 0, 0], aL: [1.25, 0.55, 0.3], aR: [1.25, 0.55, 0.3], hands: ['open', 'open'], expr: 'grin', head: 0.05 })],
        ];
        p = track(hk, k);
        p.bandana = k < 0.2 ? 'hand' : k < 0.45 ? 'stretch' : 'on';
        break;
      }
      case 'salsa': {
        const c = Math.floor(t / EIGHTH + 1e-6);
        const fr = t / EIGHTH - c;
        p = R0(Object.assign({}, stand, SALSA[c % 8], { hands: ['open', 'open'] }));
        p.py += 0.9 * (1 - clamp(fr * 3));
        break;
      }
      case 'spin': {
        p = R0({ py: -0.6, fL: [-3.5, 1.2, 0], fR: [3.5, 0, 0], aL: [0.55, 1.3, 0.2], aR: [2.95, 0.15, 0], hands: ['open', 'open'], expr: 'grin' });
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
  const CHEF_HEAD = {
    kind: 'chef', build: 'lean', skin: P.chefSkin, eyeY: 0.0, eyeX: 0.2, eyeW: 0.098, eyeH: 0.041, iris: IRIS.brown,
    browT: 0.058, browArch: 0.002, browLift: 0.052, brow: P.chefBrow || P.beard, browGrey: P.beardGrey,
    noseY: 0.21, noseW: 0.098, noseStrong: true, mouthY: 0.34, mouthW: 0.155, lip: L.mix(P.chefSkin, P.dirndlSkirt, 0.16), lines: true, forehead: true, seed: 77,
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
    const bandana = p.bandana === 'on' ? 'on' : 'off';
    const st = {
      kind: 'chef', skin: P.chefSkin, top: 'chef', topColor: P.shirtWhite, sleeve: 'rolled', sleeveColor: P.shirtWhite,
      shoe: COL.shoeBrown, back, look, hands, bandana: p.bandana, gleam: num(o.gleam, 0), tails: p.tails || 0,
      armBehind: !back && spin != null && Math.abs(c) < 0.4 ? (sin(ph) > 0 ? 'R' : 'L') : null, ground: o.shadow !== false,
      head: { key: 'chef|' + p.expr + '|' + lookKey(look) + '|' + Math.round((p.nod || 0) * 4) + '|' + (back ? 1 : 0) + '|' + bandana, H: Object.assign({}, CHEF_HEAD, { expr: p.expr, look: lookQ(look), nod: nodQ(p.nod), back, bandana }) },
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    drawFigure(R, B, J, p, st);
    // the bandana while it is being tied
    if (p.bandana === 'hand') {
      const hnd = J.hcR;
      const pts = [[hnd[0] - 1, hnd[1]], [hnd[0] + 2.6, hnd[1] + 1], [hnd[0] + 3.6, hnd[1] + 9], [hnd[0] + 0.5, hnd[1] + 12], [hnd[0] - 1.8, hnd[1] + 7]];
      R.form(pts, P.bandana, 400, { warm: true });
      for (const d of [[0.8, 4], [1.6, 8], [-0.4, 7.5], [2.2, 5.5]]) R.dot([hnd[0] + d[0], hnd[1] + d[1]], 0.45, P.bandanaDot);
      drawHand(R, B, J.wrR, J.haR, 1, 'fist', st.skin, 405, back);
    } else if (p.bandana === 'stretch') {
      const a = J.hcL, b = J.hcR;
      const sag = 3;
      const pts = [[a[0], a[1] - 1.6], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.2 + sag * 0.4], [b[0], b[1] - 1.6], [b[0], b[1] + 1.6], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag], [a[0], a[1] + 1.6]];
      R.form(pts, P.bandana, 401, { warm: true, axis: [b[0] - a[0], b[1] - a[1]] });
      for (let i = 1; i < 6; i++) {
        const q = l2(a, b, i / 6);
        R.dot([q[0], q[1] + sag * 0.45 * sin((i / 6) * PI)], 0.5, P.bandanaDot);
      }
      drawHand(R, B, J.wrL, J.haL, -1, 'fist', st.skin, 406, back);
      drawHand(R, B, J.wrR, J.haR, 1, 'fist', st.skin, 407, back);
    }
    const handR = R.m(J.hcR);
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
    R.rim = Math.max(1.5, 4 * s);
    const fl = 40 * (1 - 0.42 * press);
    const kn = -fl, wy = kn - 44;
    const skin = P.chefSkin;
    const sk = { warm: true, axis: [0, 1] };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    R.form([[-31, wy - 700], [31, wy - 700], [33, wy - 30], [31, wy - 6], [-31, wy - 6], [-33, wy - 30]], COL.hoodie, 1, { axis: [0, 1] });
    R.line([[-14, wy - 120], [-8, wy - 50]], 2, { color: mix(COL.hoodie, P.outline, 0.5), width: R.dw * 1.3 });
    R.line([[16, wy - 90], [10, wy - 40]], 3, { color: mix(COL.hoodie, P.outline, 0.5), width: R.dw * 1.3 });
    R.form([[-23, wy - 2], [21, wy - 2], [26, wy + 16], [27, kn + 1], [12, kn + 5], [-6, kn + 5], [-26, kn + 3], [-29, kn - 12], [-27, wy + 14]], skin, 4, sk);
    R.soft([6, wy + 22], 12, 8, 0, P.gloss, 0.14);
    for (let i = 0; i < 3; i++) {
      const x0 = -28 + i * 10.4, len = i === 0 ? 8 : 11;
      R.form([[x0, kn - 4], [x0 + 10.6, kn - 4], [x0 + 10.8, kn + len - 3], [x0 + 5.4, kn + len + 1.5], [x0 - 0.2, kn + len - 3]], skin, 5 + i, sk);
    }
    R.line([[-24, kn - 8], [-12, kn - 10], [-1, kn - 9]], 8, { alpha: 0.45 });
    R.form([[3.4, kn + 1], [16.6, kn + 1], [16, kn + 10], [7, -9], [4.5, -2], [0.5, 0.2], [-3.4, -2], [-5.2, -8], [3, kn + 12]], skin, 9, sk);
    R.form([[-3.4, -12.5], [4.2, -12.5], [4.2, -6], [0.4, -3.4], [-3.6, -6]], mix(skin, P.gloss, 0.5), 10, { width: R.dw * 1.1, warm: true });
    const mj = l2([10, kn + 3], [0.5, -6.2], 0.45);
    R.line([[mj[0] - 4.5, mj[1] - 1], [mj[0] + 4.5, mj[1] + 0.5]], 11, { alpha: 0.7 });
    R.form([[20, wy + 12], [28, wy + 16], [26, kn - 4], [22.6, kn + 1], [17.4, kn - 1], [17, wy + 24]], skin, 12, sk);
    R.form([[17.6, kn - 7], [22.4, kn - 7], [22.6, kn - 2], [20, kn + 0.8], [17.4, kn - 2]], mix(skin, P.gloss, 0.5), 13, { width: R.dw, warm: true });
    R.line([[-12, wy + 16], [-4, wy + 10]], 14, { alpha: 0.45 });
    R.form([[-32, wy - 26], [32, wy - 26], [31, wy + 4], [-31, wy + 4]], COL.hoodie, 15, { axis: [0, 1] });
    for (let i = -2; i <= 2; i++) R.line([[i * 11, wy - 22], [i * 11, wy + 1]], 16 + i, { color: mix(COL.hoodie, P.outline, 0.5) });
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
    R.form([[-51, -170], [51, -170], ...arc(51, 72, -72, 16, false).slice(0, 17)], P.chefSkin, 1, { warm: true, radial: { c: [0, -60], r: 60 } });
    const band = [...arc(51, 72, -72, 18, false), ...arc(44, 56, -76, 18, true)];
    const T2 = { lit: mix(P.beard, P.beardLight || P.beard, 0.9), base: P.beard, mid: P.beard, core: mix(P.beard, P.outline, 0.3), rim: mix(P.beard, P.bavWhite, 0.18) };
    const q = R.M(band);
    if (R.draw >= 1) {
      rampFill(ctx, q, T2, 1, 0, R.rim);
      const r = L.rng(71);
      ctx.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        const a = r.range(0.05, 0.95) * PI, rr = r.range(0.2, 0.9);
        const px = cos(a) * lerp(44, 51, rr), py = lerp(-76 + sin(a) * 56, -72 + sin(a) * 72, rr);
        const p0 = R.m([px, py]), p1 = R.m([px + cos(a) * 0.5, py + 3.2]);
        ctx.strokeStyle = i < 6 ? P.beardGrey : px < 0 ? (P.beardLight || P.beard) : mix(P.beard, P.outline, 0.4);
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = Math.max(0.8, R.dw * 0.8);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ink(ctx, R.M(arc(51, 72, -72, 18, false)), { width: R.ow, seed: R.seed + 3, draw: R.draw });
    ctx.restore();
  }

  // ===========================================================================
  // waitresses (art bible 10.2)
  // ===========================================================================

  const WAIT = {
    liesl: { style: 'crown', hairColor: 'hairBlonde', skin: 'skinA', iris: 'blue', bodice: P.dirndlBodice, skirt: P.dirndlSkirt, apron: P.dirndlApron, neck: 'low', tall: 1.0, fig: { chest: 12.2, waist: 10.6, hip: 14.2 } },
    resi: { style: 'bun', flower: true, hairColor: 'hairBrown', skin: 'skinB', iris: 'brown', bodice: P.dirndlSkirt, skirt: P.dirndlBodice, apron: L.mix(P.foam, P.foamShade, 0.35), neck: 'low', tall: 0.96, fig: { chest: 12.9, waist: 10.2, hip: 15.3 } },
    vroni: { style: 'braids', hairColor: 'hairRed', skin: 'skinA', iris: 'green', bodice: L.mix(P.outline, P.fesbDeep, 0.35), skirt: P.dirndlApron, check: true, apron: P.shirtWhite, neck: 'high', tall: 0.99, fig: { chest: 11.2, waist: 9.3, hip: 12.6, armR: 3.3, foreR: 2.8 } },
    gretl: { style: 'ponytail', ribbon: L.mix(P.confettiD, P.dirndlSkirt, 0.3), hairColor: 'hairFair', skin: 'skinA', iris: 'hazel', bodice: L.mix(P.confettiD, P.gloss, 0.3), skirt: L.mix(P.bavBlue, P.outlineSoft, 0.55), apron: L.mix(P.confettiD, P.gloss, 0.62), neck: 'low', tall: 1.06, fig: { chest: 12.6, waist: 11.0, hip: 14.8 } },
  };
  const FAN = { x: 180 / 820, y: 400 / 820, mh: 136 / 820 };
  const FAN_MUGS = [
    // [x, y] in mug heights from the fan centre (the fist), tilt, handle side flip, draw order
    { i: 2, x: 0, y: -0.14, tilt: 0, flip: false },
    { i: 0, x: -0.72, y: 0.1, tilt: 0.26, flip: false },
    { i: 4, x: 0.72, y: 0.1, tilt: -0.26, flip: true },
    { i: 3, x: 0.46, y: 0.03, tilt: -0.1, flip: true },
    { i: 1, x: -0.46, y: 0.03, tilt: 0.1, flip: false },
  ];
  function waitressHead(who, Wd, expr, look) {
    const skin = skinOf(Wd.skin);
    return {
      kind: 'waitress', who, style: Wd.style, flower: Wd.flower, ribbon: Wd.ribbon, hairColor: Wd.hairColor, skin, build: 'full',
      eyeY: 0.02, eyeX: 0.2, eyeW: 0.108, eyeH: 0.054, iris: IRIS[Wd.iris] || IRIS.blue, browT: 0.026, browArch: 0.02, browLift: 0.08,
      brow: browOf(Wd.hairColor), noseY: 0.2, noseW: 0.07, mouthY: 0.315, mouthW: 0.15, lip: L.mix(skin, P.confettiD, 0.42), lines: false, forehead: false,
      expr, look, seed: L.hash('w', who) % 1000,
    };
  }
  /** a plate of food whose centre is (x, y), w px wide: 'knuckle' | 'pretzels' | 'sausages' */
  function plateFood(ctx, x, y, w, kind, line) {
    const pr = PR();
    if (kind === 'pretzels' || typeof pr.knuckle !== 'function') {
      const pts = ell(x, y, w * 0.5, w * 0.13, 22);
      ctx.beginPath();
      crTrace(ctx, pts, true);
      ctx.fillStyle = radRamp(ctx, x, y, w * 0.5, tone(P.plate, false), 0.05);
      ctx.fill();
      ink(ctx, pts, { closed: true, width: Math.max(1.5, w / 70), seed: 91 });
      if (typeof pr.pretzel === 'function') {
        pr.pretzel(ctx, x - w * 0.16, y + w * 0.02, w * 0.36, { rot: -0.2, line });
        pr.pretzel(ctx, x + w * 0.17, y + w * 0.03, w * 0.34, { rot: 0.25, line });
      }
      return;
    }
    if (kind === 'sausages' && typeof pr.sausages === 'function') {
      pr.sausages(ctx, x, y + w * 0.12, w * 0.6, { line });
      return;
    }
    pr.knuckle(ctx, x, y + w * 0.13, w / 1.9, { line });
  }

  function waitress(ctx, x, y, h, pose, o) {
    o = o || {};
    pose = pose || { name: 'stand' };
    const who = WAIT[o.who] ? o.who : 'liesl';
    const Wd = WAIT[who];
    const hh = h * Wd.tall;
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    const facing = o.facing === -1 ? -1 : 1;
    const flip = (o.flip ? -1 : 1) * facing < 0;
    const carry = o.carry === 'plate' || o.carry === 'none' ? o.carry : 'mugs';
    const U = hh / 100;
    const fanPx = (sx) => [x + (flip ? -1 : 1) * sx * FAN.x * hh, y - FAN.y * hh];
    if (alpha <= 0) return flip ? { fanL: fanPx(1), fanR: fanPx(-1) } : { fanL: fanPx(-1), fanR: fanPx(1) };
    const B = Object.assign(waitressBody(), Wd.fig);
    const walk = pose.name === 'walk';
    const clap = pose.name === 'clap';
    const t = Math.max(0, num(pose.t, 0));
    const n = Math.floor(t / 0.5 + 1e-6), fr = walk ? t / 0.5 - n : 0;
    const even = n % 2 === 0;
    const bob = walk ? -1.46 * sin(PI * fr) : 0;
    const lag = walk ? 0.9 * sin(PI * fr - 0.9) : 0;
    const fist = [FAN.x * 100, -FAN.y * 100 + lag - bob * 0.3];
    let fL = [-5.5, 0, 0], fR = [5.5, 0, 0], px = 0, tilt = 0;
    if (walk) {
      const lift = 3.2 * sin(PI * fr), g = even ? 1 : -1;
      if (even) fR = [6.5, lift, 0.6 * sin(PI * fr)];
      else fL = [-6.5, lift, 0.6 * sin(PI * fr)];
      px = -g * 1.1 * sin(PI * fr);
      tilt = g * 0.05 * sin(PI * fr);
    } else if (!clap) (px = 1.1), (tilt = -0.045), (fL = [-6.5, 0.9, 0.5]);
    const base = { py: 0.4 + bob, px, tilt, fL, fR, kneeL: walk && !even ? -1 : !walk && !clap ? -1 : 1, kneeR: walk && even ? -1 : 1, lean: walk ? 0.02 * sin(TAU * t) : 0, shL: -0.2, shR: -0.2, expr: 'grin', head: walk ? 0.03 * sin(TAU * t) : 0.04 };
    let arms;
    if (clap) arms = clapPose(B, t, {});
    else if (carry === 'mugs') arms = { ikL: [-fist[0], fist[1] + bob, 1, 0.2, 0], ikR: [fist[0], fist[1] + bob, 1, 0.2, 0], hands: ['none', 'none'] };
    else if (carry === 'plate') arms = { ikR: [B.shW + 6, headY(B) + 9, 1, 0.8, -1.4], aL: [0.82, -1.78, 0.3], hands: ['fist', 'open'] };
    else arms = { aL: [0.82, -1.78, 0.3], aR: [0.82, -1.78, 0.3], hands: ['fist', 'fist'] };
    const p = resolve(B, Object.assign(base, arms));
    p.look = 0.3;
    const J = solve(B, p);
    const R = makeRig(ctx, x, y, hh, { line: o.line, draw: o.draw, flip }, 'waitress-' + who);
    const expr = 'grin';
    const H = waitressHead(who, Wd, expr, 0.3);
    const st = {
      kind: 'waitress', who, skin: skinOf(Wd.skin), top: 'blouse', neck: Wd.neck, topColor: P.shirtWhite, sleeve: 'puff', sleeveColor: P.shirtWhite,
      bodice: Wd.bodice, skirt: Wd.skirt, apron: Wd.apron, check: Wd.check, shoe: COL.shoe, back: false, look: 0.3, hands: p.hands, ground: o.shadow !== false,
      skirtSway: walk ? -1.4 * sin(TAU * t * 0.5 + 0.6) : 0,
      head: { key: 'w-' + who + '|' + expr + '|3|0|0', H },
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    drawFigure(R, B, J, p, st);
    const out = { fanL: R.m(J.hcL), fanR: R.m(J.hcR) };
    if (carry === 'mugs') {
      const mh = FAN.mh * hh;
      for (const s of [-1, 1]) {
        const S = s < 0 ? 'L' : 'R';
        const c = R.m(J['hc' + S]);
        const slosh = walk ? 0.6 * sin(PI * fr + (s < 0 ? 0.6 : 0)) : 0;
        const list = s > 0 ? FAN_MUGS : FAN_MUGS.map((m) => ({ i: m.i, x: -m.x, y: m.y, tilt: -m.tilt, flip: !m.flip }));
        const ff = flip ? -1 : 1;
        for (const m of list) {
          const cx = c[0] + ff * m.x * mh, cy = c[1] + m.y * mh;
          const tl = ff * m.tilt;
          const bx = cx - 0.5 * mh * sin(tl), by = cy + 0.5 * mh * cos(tl);
          const hero = !!o.heroMug && s > 0 && m.i === 1;
          MUG(ctx, bx, by, mh, { fill: 0.88, foam: 1.12, logo: hero, tilt: tl, flip: ff < 0 ? !m.flip : m.flip, slosh, bubbles: true, t, line: o.line, width: R.ow * 0.8, seed: 'fan' + s + m.i });
        }
        drawHand(R, B, J['wr' + S], J['ha' + S], s, 'fist', st.skin, 500 + s, false, 1.0);
        out['fan' + S] = [c[0], c[1]];
      }
    } else if (carry === 'plate') {
      const c = R.m(J.hcR);
      const w = 30 * U;
      plateFood(ctx, c[0] + (flip ? 1 : -1) * w * 0.12, c[1] - 1.6 * U, w, o.plate || 'knuckle', o.line);
    }
    ctx.restore();
    // screen order: fanL is always the left one on screen
    return flip ? { fanL: out.fanR, fanR: out.fanL } : { fanL: out.fanL, fanR: out.fanR };
  }

  /** Resi's puffed sleeve, forearm and hand holding a plate, entering from the frame edge (shot 08).
   *  (x, y) is the plate centre; s = 1 makes the plate 300 px wide. o.from is the direction toward her
   *  shoulder in radians (0: the arm comes in from the right, PI: from the left); o.plate as waitress. */
  function serveArm(ctx, x, y, s, o) {
    o = o || {};
    s = num(s, 1);
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    if (alpha <= 0) return;
    const from = num(o.from, 0);
    const B = Object.assign(waitressBody(), WAIT.resi.fig);
    const R = makeRig(ctx, x, y, 1000 * s, { line: o.line || 'secondary', draw: o.draw }, 'serveArm');
    const d = [cos(from), sin(from)];
    const hc = [d[0] * 4, 3.5];
    const wr = [hc[0] + d[0] * B.hand * 0.45, hc[1] + d[1] * B.hand * 0.45];
    const d2 = [cos(from + 0.12), sin(from + 0.12)];
    const el = [wr[0] + d2[0] * B.fore, wr[1] + d2[1] * B.fore];
    const d3 = [cos(from + 0.35), sin(from + 0.35)];
    const sh = [el[0] + d3[0] * B.upper, el[1] + d3[1] * B.upper];
    const st = { skin: skinOf(WAIT.resi.skin), sleeve: 'puff', sleeveColor: P.shirtWhite, hands: ['open', 'open'], back: false };
    const J = { shR: sh, elR: el, wrR: wr, haR: from + PI, chest: [sh[0] + d3[0] * 10, sh[1] + d3[1] * 10] };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    drawArm(R, B, J, 1, st);
    plateFood(ctx, x, y, 300 * s, o.plate || 'knuckle', o.line);
    ctx.restore();
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
    const sh = (pts, fill, k, extra) => {
      const q = MM(pts);
      if (draw >= 1 && fill) rampFill(ctx, q, tone(fill, false), -sr, cr, Math.max(1.5, s * 0.02));
      if (!extra || extra.outline !== false) ink(ctx, q, { closed: true, width: (extra && extra.width) || ow, seed: seed + k, draw });
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
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
      sh(tr, trim, 12 + e, { width: ow * 0.6 });
    }
    const hemW = (u) => 0.018 * sin(num(o.flap, 0) * TAU + u * 7);
    const body = [[-0.3, -0.38], [-0.11, -0.42], [0, view === 'front' ? -0.33 : -0.39], [0.11, -0.42], [0.3, -0.38], [0.3, -0.1], [0.3, 0.2], [0.29, 0.42 + hemW(1)], [0.1, 0.43 + hemW(0.66)], [-0.1, 0.43 + hemW(0.33)], [-0.29, 0.42 + hemW(0)], [-0.3, 0.2], [-0.3, -0.1]];
    sh(body, col, 20);
    if (view === 'front') {
      const v = design === 'jersey' ? [[-0.12, -0.425], [0, -0.3], [0.12, -0.425], [0.09, -0.425], [0, -0.335], [-0.09, -0.425]] : [[-0.12, -0.425], [0, -0.32], [0.12, -0.425], [0.09, -0.425], [0, -0.345], [-0.09, -0.425]];
      sh(v, trim, 21, { width: ow * 0.6 });
    } else sh([[-0.12, -0.425], [0, -0.385], [0.12, -0.425], [0.1, -0.44], [0, -0.41], [-0.1, -0.44]], trim, 21, { width: ow * 0.6 });
    if (draw >= 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.translate(-x, -y);
      if (design === 'jersey' && view === 'front') {
        const Lg = logoCanvas(s * 0.13);
        const sc = (s * 0.13) / Lg.q;
        ctx.drawImage(Lg.c, x + 0.13 * s - Lg.q * 0.6 * sc, y - 0.2 * s - Lg.q * 0.6 * sc, Lg.q * 1.2 * sc, Lg.q * 1.2 * sc);
      } else if (design === 'jersey') jerseyPrint(ctx, x, y + 0.02 * s, s * 0.36, s * 0.36, 0);
      else if (view === 'front') {
        const O = octoCanvas(s * 0.46);
        const sc = (s * 0.46) / O.q;
        ctx.drawImage(O.c, x - O.q * 0.65 * sc, y - 0.05 * s - O.q * 0.55 * sc, O.q * 1.3 * sc, O.q * 1.1 * sc);
      } else {
        const Lg = logoCanvas(s * 0.09);
        const sc = (s * 0.09) / Lg.q;
        ctx.drawImage(Lg.c, x - Lg.q * 0.6 * sc, y - 0.28 * s - Lg.q * 0.6 * sc, Lg.q * 1.2 * sc, Lg.q * 1.2 * sc);
      }
      ctx.restore();
      ink(ctx, MM([[-0.08, 0.1 + fl * 0.02], [0.02, 0.2], [0.18, 0.18 - fl * 0.02]]), { width: dw, color: P.outline, alpha: 0.35, seed: seed + 30 });
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

  FILM.cast = { TEAM, CHEF_TALL, person, chef, chefHand, chefBeardEdge, waitress, serveArm, tshirt, jerseyBack };
})();
