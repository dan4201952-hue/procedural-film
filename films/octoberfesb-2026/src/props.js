/*
 * props.js : FILM.props, the objects, brand pieces and scenery of OktoberFESB 2026
 * (docs/cast-api.md, docs/art-bible.md sections 3, 4, 6 and 10). Loaded after lib.js, before cast.js.
 *
 * Every function is pure: it draws from its arguments alone (plus FILM.lib.T for the 12 fps line
 * boil) and keeps no state between frames. Outlines go through FILM.lib.inkPath with FILM.props.LINE;
 * fills sit under them. Seeds come from opts.seed (default: the function name).
 *
 * Common options: draw 0..1 (outline draw-on, fills when complete), alpha 0..1, flip (mirror about x),
 * line 'hero' | 'secondary' | 'background' (outline weight, art bible 3), seed.
 * Sizes: each object states a reference size at which the art bible's line widths apply; widths scale
 * linearly with the drawn size and never drop below 1.5 px.
 */
(function () {
  'use strict';

  const FILM = window.FILM;
  const L = FILM.lib;
  const P = Object.assign({}, L.pal); // hoisted: the read-only palette proxy is slow in loops
  const TAU = Math.PI * 2;
  const clamp = L.clamp;
  const lerp = L.lerp;
  const rgba = L.rgba;
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const b01 = (v, d = 1) => clamp(num(v, d));
  const outBack = (p, s = 1.70158) => {
    p = clamp(p) - 1;
    return 1 + p * p * ((s + 1) * p + s);
  };
  const outCubic = (p) => 1 - Math.pow(1 - clamp(p), 3);

  // ===========================================================================
  // Line (art bible 3)
  // ===========================================================================

  const LINE = Object.freeze({
    wobble: 0.8,
    tremble: 0.25,
    rough: 0.35,
    boilAmp: 0.5,
    widthJitter: 0.12,
    taper: 6,
    taperOpen: Object.freeze([6, 10]),
    W: Object.freeze({ hero: 7, secondary: 5, background: 3, detail: 2.5 }),
  });

  /** outline width in px for opts.line at scale k (drawn size / reference size), min 1.5 px */
  function lineW(o, k, def) {
    const w = LINE.W[o && o.line] || LINE.W[def || 'secondary'];
    return Math.max(1.5, w * k);
  }

  /**
   * ink(ctx, pts, q): lib.inkPath with LINE, compensated for a local scale u (px per local unit) so a
   * prop drawn under ctx.scale keeps a screen-true line. q: closed, width (px), color, alpha, seed,
   * draw, boil, u, smooth, pressure, taper (px), swell, step (px between samples, default 4).
   */
  function ink(ctx, pts, q) {
    const u = q.u || 1;
    const closed = !!q.closed;
    const tp = q.taper != null ? q.taper : closed ? LINE.taper : LINE.taperOpen;
    L.inkPath(ctx, pts, {
      closed,
      width: q.width / u,
      color: q.color || P.outline,
      alpha: q.alpha == null ? 1 : q.alpha,
      seed: q.seed == null ? 1 : q.seed,
      draw: q.draw == null ? 1 : q.draw,
      boil: q.boil,
      smooth: q.smooth,
      pressure: q.pressure || null,
      wobble: LINE.wobble / u,
      tremble: LINE.tremble / u,
      rough: LINE.rough / u,
      boilAmp: LINE.boilAmp / u,
      widthJitter: LINE.widthJitter,
      taper: Array.isArray(tp) ? [tp[0] / u, tp[1] / u] : tp / u,
      step: (q.step || 4) / u,
      wobbleFreq: u / 150,
      overlap: 14 / u,
      swell: q.swell != null ? q.swell : 0.08,
      minWidth: q.minWidth != null ? q.minWidth : 0.3,
    });
  }

  // ===========================================================================
  // Geometry helpers (local units)
  // ===========================================================================

  function polyPath(pts, closed = true) {
    const p = new Path2D();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) p.moveTo(pts[i][0], pts[i][1]);
      else p.lineTo(pts[i][0], pts[i][1]);
    }
    if (closed) p.closePath();
    return p;
  }
  /** Catmull-Rom (uniform) through the points as cubic Beziers: matches inkPath's smooth line closely */
  function smoothPath(pts, closed = true) {
    const n = pts.length;
    const p = new Path2D();
    if (n < 3) return polyPath(pts, closed);
    const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    p.moveTo(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      p.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
      );
    }
    if (closed) p.closePath();
    return p;
  }
  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) {
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[1] > y1) y1 = q[1];
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function ellPts(cx, cy, rx, ry, n = 32, rot = 0, a0 = 0, a1 = TAU, closed = true) {
    const out = [];
    const c = Math.cos(rot), s = Math.sin(rot);
    const m = closed ? n : n - 1;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / m;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  /** rounded rectangle outline points (corner radius r, ~step spacing) */
  function rrPts(x, y, w, h, r, step = 12) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const out = [];
    const edge = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i < n; i++) out.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
    };
    const arc = (cx, cy, a0) => {
      if (r <= 0) return;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i / 4) * (Math.PI / 2);
        out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    edge(x + r, y, x + w - r, y);
    arc(x + w - r, y + r, -Math.PI / 2);
    edge(x + w, y + r, x + w, y + h - r);
    arc(x + w - r, y + h - r, 0);
    edge(x + w - r, y + h, x + r, y + h);
    arc(x + r, y + h - r, Math.PI / 2);
    edge(x, y + h - r, x, y + r);
    arc(x + r, y + r, Math.PI);
    return out;
  }
  function xform(pts, dx, dy, rot = 0, sx = 1, sy = sx) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return pts.map(([x, y]) => [dx + (x * sx) * c - (y * sy) * s, dy + (x * sx) * s + (y * sy) * c]);
  }
  /** Catmull-Rom samples of an open control polyline (per samples per segment) */
  function crSample(ctrl, per = 8) {
    const n = ctrl.length;
    if (n < 3) return ctrl.slice();
    const out = [];
    const at = (i) => ctrl[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(ctrl[n - 1].slice());
    return out;
  }
  /** tube(ctrl, wfn): closed outline of a rounded tube along a smooth centreline, width wfn(u 0..1) */
  function tube(ctrl, wfn, per = 6, capN = 5) {
    const C = crSample(ctrl, per);
    const m = C.length;
    const S = [0];
    for (let i = 1; i < m; i++) S.push(S[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
    const len = S[m - 1] || 1;
    const Lf = [], Rt = [];
    const nrm = (i) => {
      const a = C[Math.max(0, i - 1)], b = C[Math.min(m - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      return [-dy / d, dx / d];
    };
    for (let i = 0; i < m; i++) {
      const [nx, ny] = nrm(i);
      const w = wfn(S[i] / len) / 2;
      Lf.push([C[i][0] + nx * w, C[i][1] + ny * w]);
      Rt.push([C[i][0] - nx * w, C[i][1] - ny * w]);
    }
    const out = Lf.slice();
    // end cap at the end: from Lf[m-1] to Rt[m-1], bulging forward along the tangent
    {
      const i = m - 1;
      const [nx, ny] = nrm(i);
      const tx = ny, ty = -nx; // tangent (normal rotated back)
      const w = wfn(1) / 2;
      for (let k = 1; k < capN; k++) {
        const a = (k / capN) * Math.PI;
        out.push([C[i][0] + nx * w * Math.cos(a) + tx * w * Math.sin(a), C[i][1] + ny * w * Math.cos(a) + ty * w * Math.sin(a)]);
      }
    }
    for (let i = m - 1; i >= 0; i--) out.push(Rt[i]);
    {
      const [nx, ny] = nrm(0);
      const tx = -ny, ty = nx; // backwards tangent
      const w = wfn(0) / 2;
      for (let k = 1; k < capN; k++) {
        const a = (k / capN) * Math.PI;
        out.push([C[0][0] - nx * w * Math.cos(a) + tx * w * Math.sin(a), C[0][1] - ny * w * Math.cos(a) + ty * w * Math.sin(a)]);
      }
    }
    return out;
  }
  /** offset a convex-ish closed polygon inward by d (vertex normals toward the centroid) */
  function insetPts(pts, d) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const q of pts) (cx += q[0]), (cy += q[1]);
    cx /= n;
    cy /= n;
    return pts.map((q, i) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      if (nx * (cx - q[0]) + ny * (cy - q[1]) < 0) (nx = -nx), (ny = -ny);
      return [q[0] + nx * d, q[1] + ny * d];
    });
  }

  // ===========================================================================
  // shape: the house primitive
  // ===========================================================================

  function glossStrokes(ctx, list, u, color, alpha) {
    if (!list || !list.length) return;
    ctx.save();
    ctx.strokeStyle = color || P.gloss;
    ctx.fillStyle = color || P.gloss;
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    for (const g of list) {
      const gx = g[0], gy = g[1], len = g[2] || 0, ang = g[3] || 0;
      const w = g[4] != null ? g[4] : Math.max(2 / u, len * 0.22);
      if (len < 0.01) {
        ctx.beginPath();
        ctx.arc(gx, gy, w / 2, 0, TAU);
        ctx.fill();
      } else {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(ang) * len, gy + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** the cel tone: explicit polygon, or the shape minus a copy of itself shifted toward the light */
  function shadeFill(ctx, path, pts, sh) {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = sh.color || rgba('#000000', 0.15);
    if (sh.pts) {
      ctx.fill(sh.smooth ? smoothPath(sh.pts, true) : polyPath(sh.pts, true));
    } else {
      const b = bbox(pts);
      const f = sh.frac != null ? sh.frac : 0.25;
      const side = sh.side || 'right';
      let dx = 0, dy = 0;
      if (sh.dx != null || sh.dy != null) (dx = num(sh.dx, 0)), (dy = num(sh.dy, 0));
      else if (side === 'right') (dx = -f * b.w), (dy = -f * b.h * 0.3);
      else if (side === 'left') (dx = f * b.w), (dy = -f * b.h * 0.3);
      else if (side === 'bottom') (dx = -f * b.w * 0.15), (dy = -f * b.h);
      else if (side === 'top') dy = f * b.h;
      const p2 = new Path2D();
      p2.rect(b.x - b.w - 10, b.y - b.h - 10, b.w * 3 + 20, b.h * 3 + 20);
      p2.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy]));
      ctx.fill(p2, 'evenodd');
    }
    ctx.restore();
  }

  /**
   * shape(ctx, pts, o): a closed filled shape with a cel tone, gloss and a boiling outline.
   *   fill      colour or gradient (none = outline only)
   *   shade     { color, pts } or { color, side: 'right'|'left'|'bottom'|'top', frac 0.25 } or { color, dx, dy }
   *             (the shape minus a copy of itself shifted by dx, dy: a crescent on the far side)
   *   gloss     [[x, y, len, angle, width?], ...] white strokes (len 0 = a dot)
   *   width     outline px (default LINE.W.secondary); outline false skips it; color (outline)
   *   u         px per local unit of the current transform (default 1) so widths stay screen-true
   *   smooth    true (Catmull-Rom through the points), draw, alpha, seed, boil
   */
  function shape(ctx, pts, o = {}) {
    if (!pts || pts.length < 3) return;
    const draw = o.draw == null ? 1 : clamp(o.draw);
    const alpha = o.alpha == null ? 1 : clamp(o.alpha);
    if (draw <= 0 || alpha <= 0) return;
    const u = o.u || o.k || 1;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    if (draw >= 1) {
      const path = o.smooth === false ? polyPath(pts, true) : smoothPath(pts, true);
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fill(path);
      }
      if (o.shade) shadeFill(ctx, path, pts, o.shade);
      if (o.gloss) glossStrokes(ctx, o.gloss, u, o.glossColor, o.glossAlpha);
    }
    if (o.outline !== false) {
      ink(ctx, pts, {
        closed: true,
        width: o.width != null ? o.width : LINE.W.secondary,
        color: o.color,
        alpha: o.lineAlpha,
        seed: o.seed == null ? 'shape' : o.seed,
        draw,
        boil: o.boil,
        u,
        smooth: o.smooth,
      });
    }
    ctx.restore();
  }

  /** silhouette pass (sticker rims): fill plus a wide round stroke of the same path */
  function silhouette(ctx, pts, color, width, smooth = true) {
    const p = smooth ? smoothPath(pts, true) : polyPath(pts, true);
    ctx.fillStyle = color;
    ctx.fill(p);
    if (width > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.stroke(p);
    }
  }

  // ===========================================================================
  // FESB logo (art bible 10.9)
  // ===========================================================================

  const LOGO_OUTER = (() => {
    const out = [];
    const r1 = 0.16, r2 = 0.17;
    const edge = (x0, y0, x1, y1, n) => {
      for (let i = 0; i < n; i++) out.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
    };
    edge(r1, 0, 1, 0, 12);
    edge(1, 0, 1, 1 - r2, 12);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      out.push([1 - r2 + Math.cos(a) * r2, 1 - r2 + Math.sin(a) * r2]);
    }
    edge(1 - r2, 1, 0, 1, 12);
    edge(0, 1, 0, r1, 12);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 6) * (Math.PI / 2);
      out.push([r1 + Math.cos(a) * r1, r1 + Math.sin(a) * r1]);
    }
    return out;
  })();
  const LOGO_F = [
    [0.168, 0.168], [0.67, 0.168], [0.67, 0.334], [0.334, 0.334], [0.334, 0.498], [0.67, 0.498],
    [0.67, 0.67], [0.334, 0.67], [0.334, 0.832], [0.168, 0.832],
  ];
  function logoOuterPath() {
    const p = new Path2D();
    const r1 = 0.16, r2 = 0.17;
    p.moveTo(r1, 0);
    p.lineTo(1, 0);
    p.lineTo(1, 1 - r2);
    p.arc(1 - r2, 1 - r2, r2, 0, Math.PI / 2);
    p.lineTo(0, 1);
    p.lineTo(0, r1);
    p.arc(r1, r1, r1, Math.PI, Math.PI * 1.5);
    p.closePath();
    return p;
  }

  /**
   * fesbLogo(ctx, cx, cy, size, o): the FESB logo centred at (cx, cy), size px square.
   *   lineArt  blueprint version in lineWhite     outline  adds the 3 px (at size 120) outline stroke
   *   rot, alpha, u (px per unit of the current transform, for callers drawing under ctx.scale)
   */
  function fesbLogo(ctx, cx, cy, size, o = {}) {
    size = clamp(num(size, 120), 0.5, 8000);
    const alpha = b01(o.alpha);
    if (alpha <= 0) return;
    const u = (o.u || 1) * size; // px per logo unit
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(size, size);
    ctx.translate(-0.5, -0.5);
    const outer = logoOuterPath();
    if (o.lineArt) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, (size * (o.u || 1)) / 45) / u;
      ctx.strokeStyle = rgba(P.lineWhite, 0.85);
      ctx.stroke(outer);
      ctx.stroke(polyPath(LOGO_F, true));
      ctx.lineWidth *= 0.7;
      ctx.strokeStyle = rgba(P.paleBlue, 0.6);
      ctx.strokeRect(0.168, 0.168, 0.664, 0.664);
    } else {
      ctx.save();
      ctx.clip(outer);
      ctx.fillStyle = P.fesbSky;
      ctx.fillRect(-0.01, -0.01, 1.02, 1.02);
      let g = ctx.createLinearGradient(0.168, 0, 1, 0);
      g.addColorStop(0, P.fesbDeep);
      g.addColorStop(1, P.fesbSky);
      ctx.fillStyle = g;
      ctx.fillRect(0.168, -0.01, 0.842, 0.178);
      g = ctx.createLinearGradient(0.168, 0, 0.832, 0);
      g.addColorStop(0, P.fesbSky);
      g.addColorStop(1, P.fesbDeep);
      ctx.fillStyle = g;
      ctx.fillRect(0.168, 0.832, 0.664, 0.178);
      g = ctx.createLinearGradient(0.168, 0.168, 0.832, 0.832);
      g.addColorStop(0, P.fesbCyan);
      g.addColorStop(1, P.fesbTeal);
      ctx.fillStyle = g;
      ctx.fillRect(0.168, 0.168, 0.664, 0.664);
      ctx.fillStyle = P.gloss;
      ctx.fill(polyPath(LOGO_F, true));
      ctx.restore();
      if (o.outline) {
        ink(ctx, LOGO_OUTER, {
          closed: true,
          width: Math.max(1.5, (3 * size * (o.u || 1)) / 120),
          u,
          seed: o.seed == null ? 'fesbLogo' : o.seed,
          boil: o.boil,
          smooth: false,
        });
      }
    }
    ctx.restore();
  }

  // ===========================================================================
  // The Maß (art bible 10.4). Local units: body height 100, origin at the base centre, y up negative.
  // ===========================================================================

  const MUG_REF = 300; // body height (px) at which LINE.W applies
  const MG = { hwB: 34.6, hwT: 32.7, base: 12, ry: 4, wall: 3.2, foamH: 27.5, logoY: -50, logoS: 23.08 };
  const wallX = (yy) => MG.hwB + (MG.hwT - MG.hwB) * (-yy / 100);
  const innerX = (yy) => wallX(yy) - MG.wall;

  const MUG_BODY = (() => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const yy = -100 + i * 11.625;
      pts.push([-wallX(yy), yy]);
    }
    pts.push([-MG.hwB + 1.2, -3.2], [-MG.hwB + 4, -1.3]);
    for (let i = 0; i <= 6; i++) {
      const x = lerp(-MG.hwB + 8.5, MG.hwB - 8.5, i / 6);
      pts.push([x, -1.1 + 1.1 * Math.sqrt(Math.max(0, 1 - (x / (MG.hwB - 8.5)) ** 2))]);
    }
    pts.push([MG.hwB - 4, -1.3], [MG.hwB - 1.2, -3.2]);
    for (let i = 8; i >= 0; i--) {
      const yy = -100 + i * 11.625;
      pts.push([wallX(yy), yy]);
    }
    for (let i = 1; i < 12; i++) {
      const a = (i / 12) * Math.PI;
      pts.push([MG.hwT * Math.cos(a), -100 - MG.ry * Math.sin(a)]);
    }
    return pts;
  })();
  const MUG_HANDLE = [
    [31, -86], [44, -87.5], [56, -84.5], [62.5, -77], [63.5, -66], [63.5, -40], [62, -29], [55, -22], [44, -19.2], [32, -19.5],
    [33.5, -31], [44, -31.5], [49.5, -36], [51.5, -44], [51.5, -63], [49.5, -71], [44, -75], [33, -75],
  ];
  const MUG_INTERIOR = (() => {
    const pts = [[-innerX(-100), -101]];
    const iw = innerX(-MG.base);
    for (let i = 0; i <= 12; i++) {
      const x = lerp(-iw, iw, i / 12);
      pts.push([x, -MG.base + 2.2 * Math.sqrt(Math.max(0, 1 - (x / iw) ** 2))]);
    }
    pts.push([innerX(-100), -101]);
    return pts;
  })();
  const MUG_INTERIOR_PATH = () => polyPath(MUG_INTERIOR, true);
  const rimFrontY = (x) => -100 + MG.ry * Math.sqrt(Math.max(0, 1 - (x / MG.hwT) ** 2));

  /** the foam crown above the rim (with drips when foam > 1), or null. Local mug units. */
  function mugCrown(fill, foam, seed, crownK = 1) {
    const surfaceY = -(MG.base + fill * (100 - MG.base));
    const foamTop = surfaceY - foam * MG.foamH;
    if (foam <= 0.01 || fill <= 0.005 || foamTop > -101) return null;
    const hc = -100 - foamTop;
    const r = L.rng(L.hash('crown', seed));
    const hw = MG.hwT;
    const n = 5;
    const ck = clamp(crownK, 0.6, 1.5);
    const C = [];
    for (let i = 0; i < n; i++) {
      const x = lerp(-hw * 0.8, hw * 0.8, i / (n - 1)) * Math.sqrt(ck) + r.range(-1.5, 1.5);
      let rad = hw * (i === 0 || i === n - 1 ? 0.3 : 0.36) * ck * r.range(0.92, 1.12);
      rad = Math.min(rad, Math.max(3.5, hc * 0.95));
      const drop = (x / hw) ** 2 * Math.min(9, hc * 0.45) + r.range(0, Math.min(3, hc * 0.15));
      let cy = foamTop + rad + drop;
      if (cy > -101) cy = -101;
      C.push([x, cy, rad]);
    }
    const env = (x) => {
      let best = Infinity;
      for (const c of C) {
        const dx = x - c[0];
        if (Math.abs(dx) < c[2]) best = Math.min(best, c[1] - Math.sqrt(c[2] * c[2] - dx * dx));
      }
      return best;
    };
    const pts = [];
    const c0 = C[0], cn = C[n - 1];
    const xa = c0[0] - c0[2] * 0.999, xb = cn[0] + cn[2] * 0.999;
    const steps = 44;
    for (let i = 0; i <= steps; i++) {
      const x = lerp(xa, xb, i / steps);
      const y = env(x);
      if (isFinite(y)) pts.push([x, y]);
    }
    // right end: down the last circle's lower-right arc
    for (let k = 1; k <= 3; k++) {
      const a = (k / 3) * 0.42 * Math.PI;
      pts.push([cn[0] + Math.cos(a) * cn[2], cn[1] + Math.sin(a) * cn[2]]);
    }
    // bottom edge right to left along the rim front, with drips
    const yb = (x) => (Math.abs(x) < hw ? rimFrontY(x) : -100) + 1.4;
    const dk = clamp((foam - 1) / 0.3);
    const drips = dk > 0.02
      ? [[0.38, 6.5, 14], [-0.15, 7.5, 22], [-0.6, 9, 38]].map(([fx, w, len]) => [fx * hw + r.range(-1.5, 1.5), w, len * dk * r.range(0.85, 1.1)])
      : [];
    const xr = cn[0] + Math.cos(0.42 * Math.PI) * cn[2];
    const xl = c0[0] - Math.cos(0.42 * Math.PI) * c0[2];
    let x = xr;
    const stepX = 4;
    let di = 0;
    while (x > xl) {
      const d = drips[di];
      if (d && x - stepX <= d[0] + d[1] / 2) {
        const [xd, w, len] = d;
        const y0 = yb(xd);
        if (len > 1.5) {
          pts.push([xd + w / 2, yb(xd + w / 2)]);
          pts.push([xd + w * 0.46, y0 + len * 0.55]);
          const by = y0 + Math.max(len - w * 0.5, len * 0.6);
          for (let k = 0; k <= 4; k++) {
            const a = (k / 4) * Math.PI;
            pts.push([xd + Math.cos(a) * w * 0.56, by + Math.sin(a) * w * 0.56]);
          }
          pts.push([xd - w * 0.46, y0 + len * 0.55]);
          pts.push([xd - w / 2, yb(xd - w / 2)]);
        }
        x = xd - w / 2 - stepX * 0.5;
        di++;
        continue;
      }
      pts.push([x, yb(x)]);
      x -= stepX;
    }
    for (let k = 3; k >= 1; k--) {
      const a = Math.PI - (k / 3) * 0.42 * Math.PI;
      pts.push([c0[0] + Math.cos(a) * c0[2], c0[1] + Math.sin(a) * c0[2]]);
    }
    return { pts, circles: C, top: foamTop };
  }

  function mugPoint(x, y, u, f, tilt, lx, ly) {
    const c = Math.cos(tilt), s = Math.sin(tilt);
    const X = f * u * lx, Y = u * ly;
    return [x + c * X - s * Y, y + s * X + c * Y];
  }

  /**
   * mug(ctx, x, y, h, o): the glass Maß standing at base centre (x, y), body height h px (base to rim;
   * the foam crown rises above). Reference size 300 px. G1: mug(ctx, 960, 900, 520, { logo: true, line: 'hero' }).
   *   fill 0.86 (beer level 0..1 of the inside)    foam 1 (0..1.4; above 1 it overflows in drips)
   *   logo false   tilt 0 (radians about the base)   slosh 0 (-1..1)   bubbles false   t 0 (seconds)
   *   blueprint false (art bible 5 line art)   dimples true   crown 1 (foam crown size)   line 'secondary'
   *   width (outline px override), flip, alpha, draw, seed
   * Returns { handle: [x, y], rim: [x, y, w], logo: [x, y, size], top: [x, y] } in canvas px (top: the
   * foam or beer top). alpha 0 or draw 0 returns the anchors without touching ctx (it may be null).
   */
  function mug(ctx, x, y, h, o = {}) {
    x = num(x, 0);
    y = num(y, 0);
    h = clamp(num(h, 200), 2, 8000);
    const u = h / 100;
    const k = h / MUG_REF;
    const f = o.flip ? -1 : 1;
    const tilt = clamp(num(o.tilt, 0), -Math.PI, Math.PI);
    const fill = b01(o.fill, 0.86);
    const foam = clamp(num(o.foam, 1), 0, 1.4);
    const seed = o.seed == null ? 'mug' : o.seed;
    const surfaceY = -(MG.base + fill * (100 - MG.base));
    const foamTop = Math.max(-100 - 60, surfaceY - foam * MG.foamH);
    const P0 = (lx, ly) => mugPoint(x, y, u, f, tilt, lx, ly);
    const ret = {
      handle: P0(58, -52),
      rim: [...P0(0, -100), 2 * MG.hwT * u],
      logo: [...P0(0, MG.logoY), MG.logoS * u],
      top: P0(0, fill > 0.005 && foam > 0.01 ? Math.min(foamTop, surfaceY) : -100),
    };
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return ret;
    const st = {
      u, k, f, tilt, fill, foam, seed, surfaceY, foamTop, draw, h,
      t: num(o.t, 0),
      slosh: clamp(num(o.slosh, 0), -1, 1),
      lw: o.width != null ? o.width : lineW(o, k),
      logo: !!o.logo,
      bubbles: !!o.bubbles,
      dimples: o.dimples !== false,
      crown: num(o.crown, 1),
      boil: o.boil,
    };
    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);
    ctx.scale(f * u, u);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    if (o.blueprint) mugBlueprint(ctx, st);
    else mugIllustrated(ctx, st);
    ctx.restore();
    return ret;
  }

  function mugSurface(st) {
    const slope = clamp(-st.f * Math.tan(st.tilt) + st.f * st.slosh * 0.3, -0.9, 0.9);
    const amp = 0.35 + 2.2 * Math.abs(st.slosh);
    const t = st.t;
    return (x) => st.surfaceY + slope * x + amp * Math.sin(x * 0.16 + t * 6.5);
  }

  function mugIllustrated(ctx, st) {
    const { u, k, f, seed, draw, lw, fill, foam } = st;
    const bodyP = MUG_BODY;
    if (draw < 1) {
      ink(ctx, MUG_HANDLE, { closed: true, width: lw, u, seed: L.hash(seed, 1), draw, boil: st.boil });
      ink(ctx, bodyP, { closed: true, width: lw, u, seed, draw, boil: st.boil });
      return;
    }
    const surf = mugSurface(st);
    const hwIn = innerX(-50);
    // 1. handle
    shape(ctx, MUG_HANDLE, {
      fill: P.glass,
      shade: st.h >= 150 ? { color: rgba(P.glassEdge, 0.55), side: 'right', frac: 0.28 } : null,
      width: lw, u, seed: L.hash(seed, 1), boil: st.boil,
    });
    // 2. body glass
    const bodyPath = smoothPath(bodyP, true);
    ctx.fillStyle = P.glass;
    ctx.fill(bodyPath);
    // 3. beer and the foam band inside the glass
    const interior = MUG_INTERIOR_PATH();
    const hasBeer = fill > 0.005;
    const crown = mugCrown(fill, foam, seed, st.crown);
    if (hasBeer) {
      ctx.save();
      ctx.clip(interior);
      // regions between two curves over an x range: no nested clips
      const band = (xa, xb, top, bot) => {
        const p = new Path2D();
        p.moveTo(xa, top(xa));
        for (let xx = xa + 4; xx < xb; xx += 4) p.lineTo(xx, top(xx));
        p.lineTo(xb, top(xb));
        for (let xx = xb; xx > xa; xx -= 4) p.lineTo(xx, bot(xx));
        p.lineTo(xa, bot(xa));
        p.closePath();
        return p;
      };
      const floor = () => 4;
      const g = ctx.createLinearGradient(0, st.surfaceY - 4, 0, -MG.base);
      g.addColorStop(0, P.beerLight);
      g.addColorStop(0.3, P.beer);
      g.addColorStop(1, P.beerDeep);
      ctx.fillStyle = g;
      ctx.fill(band(-40, 40, surf, floor));
      ctx.fillStyle = rgba(P.beerDeep, 0.55);
      ctx.fill(band(hwIn * 0.42, 40, surf, floor));
      ctx.fillStyle = rgba(P.beerLight, 0.55);
      ctx.fill(band(-hwIn * 0.86, -hwIn * 0.56, surf, floor));
      // carbonation
      if (st.bubbles && st.h >= 50) {
        const r = L.rng(L.hash('fizz', seed));
        const n = st.h >= 160 ? 16 : 8;
        const bot = -MG.base - 3, top = st.surfaceY + 3, span = bot - top;
        if (span > 3) {
          ctx.fillStyle = rgba(P.gloss, 0.6);
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const bx = r.range(-0.8, 0.8) * hwIn, sp = r.range(9, 20), ph = r(), rad = r.range(1, 2.5) / u;
            const yy = bot - ((ph * span + sp * st.t) % span);
            const xx = bx + Math.sin(st.t * 3 + i * 1.7) * 0.8;
            if (yy - rad < surf(xx) + 1) continue;
            ctx.moveTo(xx + rad, yy);
            ctx.arc(xx, yy, rad, 0, TAU);
          }
          ctx.fill();
        }
      }
      // foam band on the beer
      if (foam > 0.01) {
        const thick = st.surfaceY - st.foamTop;
        const top = crown ? () => -104 : (xx) => surf(xx) - thick + 0.9 * Math.sin(xx * 0.45 + 1.3);
        const bot = (xx) => surf(xx) + 1.2 + 1.5 * Math.abs(Math.sin(xx * 0.42 + 0.7));
        ctx.fillStyle = P.foam;
        ctx.fill(band(-40, 40, top, bot));
        ctx.fillStyle = P.foamShade;
        ctx.fill(band(hwIn * 0.5, 40, top, bot));
      }
      ctx.restore();
    }
    // 4. dimples (six rows of rounded rectangles), glass edges, rim
    ctx.save();
    ctx.lineJoin = 'round';
    if (st.dimples && st.h >= 90) {
      ctx.strokeStyle = rgba(P.glassEdge, 0.5);
      ctx.lineWidth = Math.max(1, 1.6 * k) / u;
      ctx.beginPath();
      const cols = [-0.64, -0.22, 0.22, 0.64];
      for (let j = 0; j < 6; j++) {
        const yy = -24 - j * 12.3;
        for (const s of cols) {
          const cx = s * wallX(yy);
          const cf = Math.cos(Math.asin(s));
          if (st.logo && Math.abs(cx) < 17 && yy > -66 && yy < -32) continue;
          const w = 12.5 * cf, hh = 8.4;
          roundRectPath(ctx, cx - w / 2, yy - hh / 2, w, hh, 2.6 * cf);
        }
      }
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(P.glassEdge, 0.9);
    ctx.lineWidth = Math.max(1.2, 2 * k) / u;
    ctx.beginPath();
    ctx.moveTo(-innerX(-98), -98);
    ctx.lineTo(-innerX(-MG.base - 1), -MG.base - 1);
    ctx.moveTo(innerX(-98), -98);
    ctx.lineTo(innerX(-MG.base - 1), -MG.base - 1);
    const iw = innerX(-MG.base);
    ctx.moveTo(-iw, -MG.base);
    ctx.ellipse(0, -MG.base, iw, 2.2, 0, Math.PI, 0, true);
    ctx.stroke();
    if (!crown) {
      // the opening seen from above, then the rim's front edge
      ctx.fillStyle = rgba(P.glassEdge, 0.3);
      ctx.beginPath();
      ctx.ellipse(0, -100, MG.hwT - 1, MG.ry - 0.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.lineWidth = Math.max(1.5, 2.6 * k) / u;
    ctx.beginPath();
    ctx.ellipse(0, -100, MG.hwT - 0.8, MG.ry - 0.4, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
    // 5. gloss: a long soft stroke upper left and a dot beside it, a thin reflection right, the handle
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(P.gloss, 0.35);
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(-MG.hwT * 0.7, -84);
    ctx.lineTo(-MG.hwB * 0.7, -34);
    ctx.stroke();
    ctx.strokeStyle = rgba(P.gloss, 0.9);
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.fillStyle = rgba(P.gloss, 0.9);
    ctx.beginPath();
    ctx.arc(-MG.hwB * 0.71, -25.5, 2.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(P.gloss, 0.5);
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(MG.hwT * 0.8, -82);
    ctx.lineTo(MG.hwB * 0.8, -48);
    ctx.stroke();
    ctx.strokeStyle = rgba(P.gloss, 0.85);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(47, -84.5);
    ctx.quadraticCurveTo(58, -82, 59.5, -70);
    ctx.stroke();
    ctx.restore();
    // 6. logo on the front (never mirrored)
    if (st.logo) {
      ctx.save();
      ctx.translate(0, MG.logoY);
      if (f < 0) ctx.scale(-1, 1);
      fesbLogo(ctx, 0, 0, MG.logoS, { outline: true, u, seed: L.hash(seed, 3), boil: st.boil });
      ctx.restore();
    }
    // 7. body outline
    ink(ctx, bodyP, { closed: true, width: lw, u, seed, boil: st.boil });
    // 8. the foam crown
    if (crown) {
      const c1 = crown.circles[1], c2 = crown.circles[2];
      shape(ctx, crown.pts, {
        fill: P.foam,
        shade: { color: P.foamShade, side: 'right', frac: 0.2 },
        gloss: [
          [c1[0] - c1[2] * 0.55, c1[1] - c1[2] * 0.35, c1[2] * 0.5, -0.9, 2.4],
          [c2[0] - c2[2] * 0.2, c2[1] - c2[2] * 0.62, 0, 0, 2.4],
        ],
        width: lw, u, seed: L.hash(seed, 2), boil: st.boil,
      });
      if (st.h >= 140) {
        // foam texture: a few bubble rings
        const r = L.rng(L.hash('foamtex', seed));
        ctx.save();
        ctx.strokeStyle = P.foamShade;
        ctx.lineWidth = Math.max(1, 1.5 * k) / u;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const c = crown.circles[i % crown.circles.length];
          const bx = c[0] + r.range(-0.5, 0.5) * c[2], by = c[1] + r.range(-0.1, 0.5) * c[2];
          const br = r.range(0.9, 2.2);
          ctx.moveTo(bx + br, by);
          ctx.arc(bx, by, br, 0, TAU);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function mugBlueprint(ctx, st) {
    const { u, seed, draw, fill, foam } = st;
    const gap = Math.min(10, st.h * 0.05) / u;
    const outer = (pts, sd) => {
      ink(ctx, pts, { closed: true, width: 3, u, color: P.lineWhite, alpha: 0.85, seed: sd, draw, boil: st.boil });
      ink(ctx, insetPts(pts, gap), { closed: true, width: 2, u, color: P.paleBlue, alpha: 0.5, seed: L.hash(sd, 9), draw, boil: st.boil });
    };
    const surf = mugSurface(st);
    // beer: translucent schemBeer body and a solid fill line
    if (fill > 0.005 && draw >= 1) {
      ctx.save();
      ctx.clip(MUG_INTERIOR_PATH());
      const beer = new Path2D();
      beer.moveTo(-40, surf(-40));
      for (let xx = -35; xx <= 40; xx += 5) beer.lineTo(xx, surf(xx));
      beer.lineTo(40, 4);
      beer.lineTo(-40, 4);
      beer.closePath();
      ctx.fillStyle = rgba(P.schemBeer, 0.16);
      ctx.fill(beer);
      ctx.restore();
      const line = [];
      const iw = innerX(st.surfaceY) - 0.5;
      for (let i = 0; i <= 10; i++) {
        const xx = lerp(-iw, iw, i / 10);
        line.push([xx, surf(xx)]);
      }
      ink(ctx, line, { width: 3, u, color: P.schemBeer, seed: L.hash(seed, 5), boil: st.boil });
    }
    outer(MUG_HANDLE, L.hash(seed, 1));
    outer(MUG_BODY, seed);
    // rim and base
    ctx.save();
    ctx.strokeStyle = rgba(P.paleBlue, 0.6);
    ctx.lineWidth = 2 / u;
    ctx.beginPath();
    ctx.ellipse(0, -100, MG.hwT, MG.ry, 0, 0, TAU);
    const iw = innerX(-MG.base);
    ctx.moveTo(-iw, -MG.base);
    ctx.ellipse(0, -MG.base, iw, 2.2, 0, Math.PI, 0, true);
    ctx.stroke();
    ctx.restore();
    // foam as a scalloped outline
    const crown = mugCrown(fill, foam, seed, st.crown);
    if (crown) ink(ctx, crown.pts, { closed: true, width: 3, u, color: P.lineWhite, alpha: 0.85, seed: L.hash(seed, 2), draw, boil: st.boil });
    else if (foam > 0.01 && fill > 0.005) {
      const line = [];
      const iw2 = innerX(st.foamTop) - 0.5;
      for (let i = 0; i <= 14; i++) {
        const xx = lerp(-iw2, iw2, i / 14);
        line.push([xx, surf(xx) - (st.surfaceY - st.foamTop) - 1.2 * Math.abs(Math.sin(i * 1.1))]);
      }
      ink(ctx, line, { width: 2.5, u, color: P.lineWhite, alpha: 0.85, seed: L.hash(seed, 2), draw, boil: st.boil });
    }
    if (st.logo && draw >= 1) {
      ctx.save();
      ctx.translate(0, MG.logoY);
      if (st.f < 0) ctx.scale(-1, 1);
      fesbLogo(ctx, 0, 0, MG.logoS, { lineArt: true, u });
      ctx.restore();
    }
  }

  // ===========================================================================
  // Captions: sticker lettering (art bible 6 and 10.10)
  // ===========================================================================

  const FONT = '"Montserrat", "DejaVu Sans", sans-serif';
  const CAP_REF = 110; // size at which the 7 px outline and 14 px white rim apply

  function capGradient(ctx, style, capH) {
    const g = ctx.createLinearGradient(0, -capH, 0, 0);
    if (style === 'blue') {
      g.addColorStop(0, P.fesbSky);
      g.addColorStop(1, P.fesbBlue);
    } else if (style === 'white') {
      g.addColorStop(0, P.gloss);
      g.addColorStop(1, P.foamShade);
    } else {
      g.addColorStop(0, P.gold);
      g.addColorStop(1, P.goldDeep);
    }
    return g;
  }

  /**
   * caption(ctx, str, x, y, size, o): sticker lettering in Montserrat 900, y is the baseline.
   *   align 'center' | 'left' (| 'right')   style 'gold' | 'blue' | 'white' | 'split' (splitAt: index where
   *   blue starts, default the index of "FESB")   pop 0..1 (scale 0 -> 1.08 -> 1)   rot (radians)
   *   letters 0..1 (letter-by-letter slam)   alpha
   *   extras: arch (px rise at the middle), squeeze (x scale), maxW (squeeze to fit), border (px of navy
   *   sticker border outside the white rim), sweep 0..1 (gloss band), ribbon 0..1 (unrolling ribbon behind),
   *   ribbonColor (default fesbBlue)
   * Returns the drawn box { x, y, w, h } (including rims, at full pop).
   */
  function caption(ctx, str, x, y, size, o = {}) {
    const s = String(str == null ? '' : str);
    const chars = Array.from(s);
    const n = chars.length;
    x = num(x, 0);
    y = num(y, 0);
    size = clamp(num(size, 100), 2, 3000);
    const k = size / CAP_REF;
    const align = o.align === 'left' ? 'left' : o.align === 'right' ? 'right' : 'center';
    const style = ['gold', 'blue', 'white', 'split'].indexOf(o.style) >= 0 ? o.style : 'gold';
    ctx.save();
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const xs = new Array(n), ws = new Array(n);
    let pre = '';
    for (let i = 0; i < n; i++) {
      const wc = ctx.measureText(chars[i]).width;
      pre += chars[i];
      xs[i] = ctx.measureText(pre).width - wc;
      ws[i] = wc;
    }
    const natW = n ? ctx.measureText(s).width : 0;
    let sq = clamp(num(o.squeeze, 1), 0.3, 2);
    if (o.maxW > 0 && natW * sq > o.maxW) sq = Math.max(0.5, o.maxW / natW);
    const Wd = natW * sq;
    const mH = ctx.measureText('H');
    const capH = mH.actualBoundingBoxAscent > 0 ? mH.actualBoundingBoxAscent : size * 0.7;
    const desc = size * 0.2;
    const arch = num(o.arch, 0);
    const x0 = align === 'left' ? x : align === 'right' ? x - Wd : x - Wd / 2;
    const OUT = 7 * k, WH = 14 * k, SH = 6 * k;
    const BORDER = Math.max(0, num(o.border, 0));
    const pad = WH + BORDER;
    const box = { x: x0 - pad, y: y - capH - pad - Math.max(0, arch), w: Wd + 2 * pad, h: capH + desc + 2 * pad + SH + Math.abs(arch) };
    let ps = 1;
    if (o.pop != null) {
      const p = clamp(o.pop);
      ps = p < 0.6 ? 1.08 * outCubic(p / 0.6) : lerp(1.08, 1, L.smoothstep(0.6, 1, p));
    }
    const alpha = b01(o.alpha);
    if (!n || ps <= 0.002 || alpha <= 0) {
      ctx.restore();
      return box;
    }
    if (alpha < 1) ctx.globalAlpha *= alpha;
    const cx = x0 + Wd / 2, cy = y - capH / 2;
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot);
    if (ps !== 1) ctx.scale(ps, ps);
    ctx.translate(-cx, -cy);

    // ribbon behind (unrolls from the centre)
    if (o.ribbon != null && o.ribbon > 0) {
      const rp = outCubic(o.ribbon);
      const rw = (Wd / 2 + pad + 40 * k) * rp;
      const top = y - capH - pad * 0.7, bot = y + desc * 0.5 + pad * 0.7, hh = bot - top;
      const tail = 46 * k * clamp(rp * 1.5 - 0.5);
      if (tail > 1) {
        for (const sgn of [-1, 1]) {
          const ex = cx + sgn * rw;
          const pts = [
            [ex - sgn * 20 * k, top + hh * 0.28], [ex + sgn * tail, top + hh * 0.28], [ex + sgn * (tail - 22 * k), top + hh * 0.78],
            [ex + sgn * tail, bot + hh * 0.28], [ex - sgn * 20 * k, bot + hh * 0.28],
          ];
          shape(ctx, pts, { fill: L.mix(o.ribbonColor || P.fesbBlue, P.outline, 0.35), width: Math.max(1.5, 5 * k), smooth: false, seed: L.hash('ribbonTail', sgn) });
        }
      }
      if (rw > 2) {
        shape(ctx, rrPts(cx - rw, top, rw * 2, hh, 6 * k, 40 * k), {
          fill: o.ribbonColor || P.fesbBlue,
          shade: { color: rgba('#000000', 0.15), dx: 0, dy: -hh * 0.18 },
          width: Math.max(1.5, 6 * k), smooth: false, seed: 'ribbon',
        });
      }
    }

    const letters = o.letters == null ? 1 : clamp(o.letters);
    const nonSpace = chars.filter((c) => c.trim()).length || 1;
    const splitAt = o.splitAt != null ? o.splitAt : s.indexOf('FESB') > 0 ? s.indexOf('FESB') : Math.ceil(n / 2);
    const vis = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const c = chars[i];
      if (!c.trim()) continue;
      let sc = 1, a = 1;
      if (letters < 1) {
        const p = clamp(letters * nonSpace - j);
        j++;
        if (p <= 0) continue;
        sc = p < 0.55 ? lerp(2.1, 0.92, outCubic(p / 0.55)) : lerp(0.92, 1, L.smoothstep(0.55, 1, p));
        a = clamp(p * 4);
      } else j++;
      const lcx = x0 + (xs[i] + ws[i] / 2) * sq;
      const uu = Wd > 0 ? (lcx - x0) / Wd - 0.5 : 0;
      vis.push({
        c, i, lcx, sc, a,
        lx: x0 + xs[i] * sq,
        ly: y - arch * (1 - 4 * uu * uu),
        rot: arch ? Math.atan((8 * arch * uu) / Math.max(1, Wd)) : 0,
        st: style === 'split' ? (i < splitAt ? 'gold' : 'blue') : style,
      });
    }
    const each = (fn) => {
      for (const v of vis) {
        ctx.save();
        if (v.a < 1) ctx.globalAlpha *= v.a;
        ctx.translate(v.lcx, v.ly - capH / 2);
        if (v.rot) ctx.rotate(v.rot);
        ctx.scale(sq * v.sc, v.sc);
        ctx.translate(-ws[v.i] / 2, capH / 2);
        fn(v);
        ctx.restore();
      }
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 1. drop shadow, 2. navy sticker border, 3. white rim, 4. navy outline
    ctx.fillStyle = ctx.strokeStyle = rgba(P.outline, 0.4);
    ctx.lineWidth = 2 * pad;
    each((v) => {
      ctx.strokeText(v.c, 0, SH / v.sc);
      ctx.fillText(v.c, 0, SH / v.sc);
    });
    if (BORDER > 0) {
      ctx.fillStyle = ctx.strokeStyle = P.outline;
      each((v) => ctx.strokeText(v.c, 0, 0));
    }
    ctx.fillStyle = ctx.strokeStyle = P.gloss;
    ctx.lineWidth = 2 * WH;
    each((v) => {
      ctx.strokeText(v.c, 0, 0);
      ctx.fillText(v.c, 0, 0);
    });
    ctx.strokeStyle = P.outline;
    ctx.lineWidth = 2 * OUT;
    each((v) => ctx.strokeText(v.c, 0, 0));
    // 5. gradient fill, 6. top gloss
    const grads = { gold: capGradient(ctx, 'gold', capH), blue: capGradient(ctx, 'blue', capH), white: capGradient(ctx, 'white', capH) };
    each((v) => {
      ctx.fillStyle = grads[v.st];
      ctx.fillText(v.c, 0, 0);
    });
    const hg = ctx.createLinearGradient(0, -capH, 0, -capH * 0.35);
    hg.addColorStop(0, rgba(P.gloss, 0.55));
    hg.addColorStop(1, rgba(P.gloss, 0));
    ctx.fillStyle = hg;
    each((v) => ctx.fillText(v.c, 0, 0));
    // 7. gloss sweep
    if (o.sweep != null && o.sweep > 0 && o.sweep < 1) {
      const xc = x0 - 0.15 * Wd + o.sweep * 1.3 * Wd, half = 0.07 * Wd + 30 * k;
      each((v) => {
        const a0 = (xc - half - v.lx) / sq, a1 = (xc + half - v.lx) / sq;
        const g = ctx.createLinearGradient(a0, -capH, a1, 0);
        g.addColorStop(0, rgba(P.gloss, 0));
        g.addColorStop(0.5, rgba(P.gloss, 0.8));
        g.addColorStop(1, rgba(P.gloss, 0));
        ctx.fillStyle = g;
        ctx.fillText(v.c, 0, 0);
      });
    }
    ctx.restore();
    return box;
  }

  // ===========================================================================
  // Wheat and hops (art bible 10.10). rim = { color, pad } draws the sticker silhouette only.
  // ===========================================================================

  const WHEAT_REF = 300;
  const KERNEL = (len, wid) => [
    [0, -len], [0.36 * wid, -0.76 * len], [0.5 * wid, -0.44 * len], [0.42 * wid, -0.14 * len], [0.2 * wid, 0],
    [0, 0.04 * len], [-0.2 * wid, 0], [-0.42 * wid, -0.14 * len], [-0.5 * wid, -0.44 * len], [-0.36 * wid, -0.76 * len],
  ];
  const WHEAT_KERNELS = (() => {
    const out = [[0, -88, 14, 7.6, 0]];
    for (let j = 5; j >= 0; j--) {
      const yy = -44 - j * 8.4;
      const len = 17 - j * 1.05, wid = 9.6 - j * 0.5, ang = 0.52 - j * 0.035;
      out.push([-2, yy, len, wid, -ang], [2, yy, len, wid, ang]);
    }
    return out;
  })();
  function hull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
      up.push(p);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const WHEAT_HULL = hull([].concat(...WHEAT_KERNELS.map(([kx, ky, len, wid, ang]) => xform(KERNEL(len, wid), kx, ky, ang))));

  function wheatImpl(ctx, x, y, h, o, rim) {
    h = clamp(num(h, 300), 2, 6000);
    const u = h / 100, k = h / WHEAT_REF;
    const lw = o.width != null ? o.width : lineW(o, k);
    const seed = o.seed == null ? 'wheat' : o.seed;
    const bend = num(o.bend, 0);
    const bx = (yy) => bend * (yy / 100) * (yy / 100);
    ctx.save();
    ctx.translate(num(x, 0), num(y, 0));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flip ? -u : u, u);
    if (!rim && o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
    const stalk = tube([[0, 0], [bx(-25), -25], [bx(-50), -50], [bx(-80), -80]], (t) => lerp(3.2, 2.2, t), 5, 4);
    const kernels = WHEAT_KERNELS.map(([kx, ky, len, wid, ang]) => {
      const pts = xform(KERNEL(len, wid), kx + bx(ky), ky, ang + bend * 0.02 * (ky / 100));
      return { pts, len, wid, ang, kx: kx + bx(ky), ky };
    });
    if (rim) {
      const w = (2 * (rim.pad + lw * 0.4)) / u;
      silhouette(ctx, stalk, rim.color, w, false);
      if (!bend) silhouette(ctx, WHEAT_HULL, rim.color, w, false);
      else for (const kk of kernels) silhouette(ctx, kk.pts, rim.color, w);
    } else {
      const draw = o.draw == null ? 1 : clamp(o.draw);
      shape(ctx, stalk, { fill: P.wheatDeep, width: lw * 0.75, u, seed: L.hash(seed, 99), draw, boil: o.boil });
      kernels.forEach((kk, i) => {
        const gl = h >= 120 ? [[kk.kx - kk.wid * 0.18 + Math.sin(kk.ang) * kk.len * 0.5, kk.ky - kk.len * 0.62, kk.len * 0.28, -Math.PI / 2 + kk.ang, 1.6]] : null;
        shape(ctx, kk.pts, {
          fill: P.wheat,
          shade: { color: P.wheatDeep, side: 'right', frac: 0.32 },
          gloss: gl,
          width: lw * 0.75, u, seed: L.hash(seed, i), draw, boil: o.boil,
        });
      });
    }
    ctx.restore();
  }
  /** wheat(ctx, x, y, h, o): a wheat ear on its stalk, base at (x, y), height h (ref 300). rot, bend, flip */
  function wheat(ctx, x, y, h, o = {}) {
    wheatImpl(ctx, x, y, h, o, null);
  }

  const HOPS_REF = 150;
  const HOP_CONE = [
    [0, -80], [15, -77], [25, -67], [28.5, -52], [26.5, -35], [20, -19], [10, -6], [0, 0], [-10, -6], [-20, -19],
    [-26.5, -35], [-28.5, -52], [-25, -67], [-15, -77],
  ];
  const coneHW = (yy) => {
    const t = clamp(-yy / 80);
    return 29 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.05)), 0.75) * (0.55 + 0.45 * t);
  };
  function leafPts(len, wid) {
    const pts = [[0, 0]];
    const N = 14;
    for (let i = 1; i < N; i++) {
      const t = i / N;
      const hw = wid * 0.5 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1.1 - 0.35 * t) + (i % 2 ? 1.3 : -0.4);
      pts.push([hw, -len * t]);
    }
    pts.push([0, -len]);
    for (let i = N - 1; i >= 1; i--) {
      const t = i / N;
      const hw = wid * 0.5 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1.1 - 0.35 * t) + (i % 2 ? 1.3 : -0.4);
      pts.push([-hw, -len * t]);
    }
    return pts;
  }
  const HOP_LEAVES = [
    [-6, -56, 68, 42, -1.05],
    [7, -62, 62, 38, 0.95],
  ];

  function hopsImpl(ctx, x, y, h, o, rim) {
    h = clamp(num(h, 150), 2, 4000);
    const u = h / 100, k = h / HOPS_REF;
    const lw = o.width != null ? o.width : lineW(o, k);
    const seed = o.seed == null ? 'hops' : o.seed;
    ctx.save();
    ctx.translate(num(x, 0), num(y, 0));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flip ? -u : u, u);
    if (!rim && o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
    const leaves = HOP_LEAVES.map(([lx, ly, len, wid, rot]) => ({ pts: xform(leafPts(len, wid), lx, ly, rot), lx, ly, len, rot }));
    if (rim) {
      const w = (2 * (rim.pad + lw * 0.4)) / u;
      for (const lf of leaves) silhouette(ctx, lf.pts, rim.color, w);
      silhouette(ctx, HOP_CONE, rim.color, w);
      ctx.restore();
      return;
    }
    const draw = o.draw == null ? 1 : clamp(o.draw);
    leaves.forEach((lf, i) => {
      shape(ctx, lf.pts, {
        fill: P.leaf,
        shade: { color: P.leafDeep, side: i ? 'right' : 'bottom', frac: 0.3 },
        width: lw * 0.8, u, seed: L.hash(seed, 'leaf', i), draw, boil: o.boil,
      });
      if (draw >= 1) {
        const c = Math.cos(lf.rot), s = Math.sin(lf.rot);
        const P2 = (px, py) => [lf.lx + px * c - py * s, lf.ly + px * s + py * c];
        ctx.save();
        ctx.strokeStyle = P.leafDeep;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.2, 2.2 * k) / u;
        ctx.beginPath();
        let q = P2(0, -2);
        ctx.moveTo(q[0], q[1]);
        q = P2(0, -lf.len * 0.85);
        ctx.lineTo(q[0], q[1]);
        for (const t of [0.3, 0.5, 0.68]) {
          for (const sg of [-1, 1]) {
            q = P2(0, -lf.len * t);
            ctx.moveTo(q[0], q[1]);
            q = P2(sg * lf.len * 0.2, -lf.len * (t + 0.13));
            ctx.lineTo(q[0], q[1]);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    });
    if (draw >= 1) {
      // cone body (the dark gaps) then bracts row by row, lower rows in front
      ctx.fillStyle = P.hopDeep;
      ctx.fill(smoothPath(HOP_CONE, true));
      const rows = [[-66, 2], [-53, 3], [-40, 3], [-27, 3], [-14, 2]];
      rows.forEach(([ry, nb], ri) => {
        const hw = coneHW(ry + 6) * 0.98;
        const bw = ((2 * hw) / nb) * 1.18, bh = 17;
        for (let bi = 0; bi < nb; bi++) {
          const order = nb === 3 ? [0, 2, 1][bi] : bi;
          const bxx = -hw + (2 * hw * (order + 0.5)) / nb;
          const pts = xform(
            [[-bw / 2, -bh * 0.3], [bw / 2, -bh * 0.3], [bw * 0.48, bh * 0.2], [bw * 0.3, bh * 0.56], [0, bh * 0.72], [-bw * 0.3, bh * 0.56], [-bw * 0.48, bh * 0.2]],
            bxx, ry, bxx * 0.012
          );
          shape(ctx, pts, {
            fill: P.hop,
            shade: { color: P.hopDeep, side: 'right', frac: 0.3 },
            gloss: ri < 3 && order === 0 && h >= 60 ? [[bxx - bw * 0.2, ry + bh * 0.05, bw * 0.18, 0.9, 1.5]] : null,
            width: Math.max(1, 2.2 * k), color: P.leafDeep, u, seed: L.hash(seed, ri, bi), boil: o.boil,
          });
        }
      });
      // stem curl
      ink(ctx, [[0, -79], [1.5, -86], [5, -90], [8, -88]], { width: Math.max(1.5, 3.5 * k), color: P.leafDeep, u, seed: L.hash(seed, 'stem'), boil: o.boil });
    }
    ink(ctx, HOP_CONE, { closed: true, width: lw * 0.85, u, seed: L.hash(seed, 'cone'), draw, boil: o.boil });
    ctx.restore();
  }
  /** hops(ctx, x, y, h, o): a hop cone (tip at (x, y), height h, ref 150) with two leaves. rot, flip */
  function hops(ctx, x, y, h, o = {}) {
    hopsImpl(ctx, x, y, h, o, null);
  }

  // ===========================================================================
  // Particles: bubbles, confetti, sparkle (art bible 4, 7)
  // ===========================================================================

  /**
   * bubbles(ctx, seed, t, box, o): golden bubbles rising through box { x, y, w, h }.
   *   count 16, speed 1 (40..90 px/s), size [6, 22] (diameter px), alpha
   */
  function bubbles(ctx, seed, t, box, o = {}) {
    if (!box) return;
    const bx = num(box.x, 0), by = num(box.y, 0), bw = Math.max(1, num(box.w, 100)), bh = Math.max(1, num(box.h, 100));
    const count = clamp(Math.round(num(o.count, 16)), 0, 500);
    const speed = num(o.speed, 1);
    const sz = Array.isArray(o.size) ? o.size : [6, 22];
    const alpha = b01(o.alpha);
    t = num(t, 0);
    if (!count || alpha <= 0) return;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    const rimW = 2;
    ctx.lineWidth = rimW;
    for (let i = 0; i < count; i++) {
      const r = L.rng(L.hash('bubbles', seed, i));
      const d = lerp(sz[0], sz[1], Math.pow(r(), 1.6));
      const rad = d / 2;
      const v = lerp(40, 90, r()) * speed;
      const travel = bh + d * 2;
      const yy = by + bh + rad - ((r() * travel + v * t) % travel + travel) % travel;
      const xx = bx + r() * bw + Math.sin(t * lerp(1.5, 3, r()) + r() * TAU) * lerp(4, 10, r());
      const edge = Math.min(1, (yy - by) / (bh * 0.15 + 1), (by + bh - yy) / (bh * 0.08 + 1));
      if (edge <= 0) continue;
      ctx.globalAlpha = alpha * clamp(edge);
      ctx.beginPath();
      ctx.arc(xx, yy, rad, 0, TAU);
      ctx.fillStyle = rgba(P.gold, 0.92);
      ctx.fill();
      ctx.strokeStyle = P.goldDeep;
      ctx.stroke();
      ctx.fillStyle = P.gloss;
      ctx.beginPath();
      ctx.arc(xx - rad * 0.32, yy - rad * 0.32, Math.max(0.8, rad * 0.26), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * confetti(ctx, seed, t, x, y, o): a burst from (x, y) at t = 0 that falls and flutters on twos.
   *   count 70, spread 520 (burst speed px/s), life 4 (s, fades over the last 0.6 s), size 1, alpha
   */
  function confetti(ctx, seed, t, x, y, o = {}) {
    t = num(t, 0);
    if (t <= 0) return;
    const count = clamp(Math.round(num(o.count, 70)), 0, 800);
    const spread = num(o.spread, 520);
    const life = num(o.life, 4);
    const sz = num(o.size, 1);
    const fade = clamp((life - t) / 0.6);
    const alpha = b01(o.alpha) * fade;
    if (!count || alpha <= 0) return;
    const tq = L.onTwos(t);
    const cols = [P.confettiA, P.confettiB, P.confettiC, P.confettiD];
    const kd = 2.6;
    const e = (1 - Math.exp(-kd * t)) / kd;
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let i = 0; i < count; i++) {
      const r = L.rng(L.hash('confetti', seed, i));
      const ang = -Math.PI / 2 + r.range(-1.25, 1.25);
      const v = spread * r.range(0.35, 1.3) * 1.7;
      const fall = r.range(70, 150);
      const ph = r() * TAU;
      const px = x + Math.cos(ang) * v * e + Math.sin(t * r.range(2.5, 5) + ph) * r.range(6, 22) * Math.min(1, t * 2);
      const py = y + Math.sin(ang) * v * e + fall * (t - e);
      const flip = Math.cos(tq * r.range(7, 13) + ph);
      const rot = ph + tq * r.range(-5, 5);
      ctx.fillStyle = cols[i % 4];
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      if (r() < 0.2) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 6 * sz, Math.max(0.6, 6 * sz * Math.abs(flip)), 0, 0, TAU);
        ctx.fill();
      } else {
        const w = r.range(10, 17) * sz, hh = r.range(6, 9) * sz;
        ctx.scale(1, Math.max(0.08, Math.abs(flip)));
        ctx.fillRect(-w / 2, -hh / 2, w, hh);
        if (flip < 0) {
          ctx.fillStyle = rgba('#000000', 0.18);
          ctx.fillRect(-w / 2, -hh / 2, w, hh);
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /** sparkle(ctx, x, y, r, k): a four-point white star, k 0..1 life (pops in, then shrinks and fades) */
  function sparkle(ctx, x, y, r, k) {
    k = num(k, 0.5);
    if (k <= 0 || k >= 1) return;
    r = Math.max(0.5, num(r, 20));
    const sc = k < 0.3 ? outBack(k / 0.3, 2.4) : 1 - Math.pow((k - 0.3) / 0.7, 2) * 0.85;
    const a = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
    const R = r * sc;
    if (R <= 0.3) return;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    ctx.translate(x, y);
    ctx.rotate(k * 0.7);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.1);
    g.addColorStop(0, rgba(P.gloss, 0.55));
    g.addColorStop(1, rgba(P.gloss, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.gloss;
    ctx.beginPath();
    const inr = R * 0.14;
    for (let i = 0; i < 4; i++) {
      const a0 = (i * Math.PI) / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
      ctx.quadraticCurveTo(Math.cos(a0 + Math.PI / 4) * inr, Math.sin(a0 + Math.PI / 4) * inr, Math.cos(a1) * R, Math.sin(a1) * R);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ===========================================================================
  // Food (art bible 10.5)
  // ===========================================================================

  const FOOD_PLATE_SHADE = () => rgba('#000000', 0.08);

  /**
   * knuckle(ctx, x, y, h, o): Schweinshaxe on its plate with dumpling, kraut and gravy; base centre (x, y),
   * height h (ref 400, width about 1.9 h). squash 0..1 (landing squash of the knuckle), line, flip, alpha, draw.
   */
  function knuckle(ctx, x, y, h, o = {}) {
    h = clamp(num(h, 300), 4, 6000);
    const u = h / 100, k = h / 400;
    const lw = o.width != null ? o.width : lineW(o, k);
    const dl = Math.max(1.5, LINE.W.detail * k);
    const seed = o.seed == null ? 'knuckle' : o.seed;
    const sq = b01(o.squash, 0);
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return;
    const S = (i) => L.hash(seed, i);
    const full = draw >= 1;
    ctx.save();
    ctx.translate(num(x, 0), num(y, 0));
    ctx.scale(o.flip ? -u : u, u);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    // plate
    shape(ctx, ellPts(0, -11, 94, 21, 44), { fill: P.plate, shade: { color: FOOD_PLATE_SHADE(), side: 'bottom', frac: 0.3 }, width: lw, u, seed: S(1), boil: o.boil, draw });
    if (full) {
    ctx.save();
    ctx.strokeStyle = rgba(P.outlineSoft, 0.3);
    ctx.lineWidth = dl / u;
    ctx.beginPath();
    ctx.ellipse(0, -12, 74, 15, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    }
    // gravy pool
    const r = L.rng(S(2));
    const gravy = ellPts(-2, -13, 64, 12.5, 26).map(([gx, gy], i) => [gx + r.range(-2, 2), gy + r.range(-1, 1) + (i % 3 === 0 ? 1.2 : 0)]);
    shape(ctx, gravy, { fill: P.crust, shade: { color: rgba(P.crackling, 0.45), side: 'top', frac: 0.35 }, gloss: [[-34, -18, 12, 0.08, 1.8], [22, -9, 0, 0, 2]], width: dl, color: P.outlineSoft, u, seed: S(3), boil: o.boil, draw });
    // sauerkraut on the left
    const kraut = [[-84, -12], [-82, -22], [-74, -30], [-62, -34], [-50, -31], [-42, -22], [-40, -13], [-60, -9]];
    shape(ctx, kraut, { fill: P.kraut, shade: { color: rgba(P.wheatDeep, 0.35), side: 'right', frac: 0.3 }, width: lw * 0.8, u, seed: S(4), boil: o.boil, draw });
    if (full) {
    ctx.save();
    ctx.strokeStyle = rgba(P.wheatDeep, 0.55);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 1.8 * k) / u;
    ctx.beginPath();
    const kr = L.rng(S(5));
    for (let i = 0; i < 9; i++) {
      const kx = kr.range(-78, -48), ky = kr.range(-29, -14);
      ctx.moveTo(kx, ky);
      ctx.quadraticCurveTo(kx + 4, ky - 3, kx + kr.range(6, 10), ky + kr.range(-1, 2));
    }
    ctx.stroke();
    ctx.restore();
    }
    // the knuckle (squashes about its base)
    ctx.save();
    ctx.translate(-4, -16);
    ctx.scale(1 + 0.1 * sq, 1 - 0.12 * sq);
    // bone behind the dome, at 30 degrees up-right
    shape(ctx, ellPts(44, -63, 7.5, 7.5, 16), { fill: P.plate, shade: { color: P.foamShade, side: 'right', frac: 0.3 }, width: lw * 0.85, u, seed: S(6), boil: o.boil, draw });
    shape(ctx, ellPts(50, -53, 7.5, 7.5, 16), { fill: P.plate, shade: { color: P.foamShade, side: 'right', frac: 0.3 }, width: lw * 0.85, u, seed: S(7), boil: o.boil, draw });
    shape(ctx, xform(rrPts(-2, -5.5, 36, 11, 5, 6), 18, -38, -Math.PI / 6), { fill: P.plate, shade: { color: P.foamShade, side: 'bottom', frac: 0.3 }, gloss: [[24, -44, 12, -Math.PI / 6, 2]], width: lw * 0.85, u, seed: S(8), boil: o.boil, draw });
    const dr = L.rng(S(9));
    const dome = [];
    for (let i = 0; i <= 22; i++) {
      const a = Math.PI + (i / 22) * Math.PI;
      const bump = 1 + 0.045 * Math.sin(i * 2.3 + dr() * 2) + dr.range(-0.015, 0.015);
      dome.push([Math.cos(a) * 50 * bump, Math.sin(a) * 62 * bump]);
    }
    dome.push([46, 3], [20, 5], [-20, 5], [-46, 3]);
    shape(ctx, dome, {
      fill: P.crackling,
      shade: { color: P.crust, side: 'right', frac: 0.26 },
      gloss: [[-34, -34, 20, -1.2, 4.4], [-22, -52, 0, 0, 4]],
      width: lw, u, seed: S(10), boil: o.boil, draw,
    });
    // blistered bumps
    const br = L.rng(S(11));
    const light = L.mix(P.crackling, P.gold, 0.3);
    if (full) {
    ctx.save();
    ctx.clip(smoothPath(dome, true));
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * br.range(1.1, 1.9), rr = br.range(0.25, 0.85);
      const bxx = Math.cos(a) * 50 * rr, byy = Math.sin(a) * 60 * rr - 4, rad = br.range(3.2, 6.5);
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(bxx, byy, rad, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = P.crust;
      ctx.lineWidth = Math.max(1, 2 * k) / u;
      ctx.beginPath();
      ctx.arc(bxx, byy, rad, 0.1, Math.PI - 0.1);
      ctx.stroke();
      if (bxx < 10) {
        ctx.fillStyle = rgba(P.gloss, 0.85);
        ctx.beginPath();
        ctx.arc(bxx - rad * 0.35, byy - rad * 0.4, rad * 0.25, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    }
    // the cut, showing the meat on the left
    shape(ctx, ellPts(-31, -24, 12.5, 18, 20, 0.35), { fill: P.meat, shade: { color: rgba(P.crust, 0.35), side: 'right', frac: 0.25 }, width: dl, color: P.outlineSoft, u, seed: S(12), boil: o.boil, draw });
    if (full) {
    ctx.save();
    ctx.strokeStyle = rgba(P.crust, 0.55);
    ctx.lineWidth = Math.max(1, 1.8 * k) / u;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-38 + i * 4, -35 + i * 2);
      ctx.quadraticCurveTo(-30 + i * 3, -24, -33 + i * 5, -11 + i);
    }
    ctx.stroke();
    ctx.restore();
    }
    ctx.restore();
    // dumpling front right
    shape(ctx, ellPts(56, -20, 16.5, 15.5, 22), {
      fill: P.hallWarm, shade: { color: rgba('#000000', 0.12), side: 'right', frac: 0.3 },
      gloss: [[48, -27, 5, -0.8, 2.6]], width: lw * 0.9, u, seed: S(13), boil: o.boil, draw,
    });
    ctx.fillStyle = P.leaf;
    if (full) for (const [px, py] of [[54, -33], [60, -31], [57, -35.5]]) {
      ctx.beginPath();
      ctx.arc(px, py, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function tubeShape(ctx, ctrl, wfn, fill, shadeCol, o) {
    const pts = tube(ctrl, wfn, 7, 6);
    shape(ctx, pts, { fill, shade: { color: shadeCol, dx: -o.sh, dy: -o.sh * 1.4 }, gloss: o.gloss, width: o.lw, u: o.u, seed: o.seed, boil: o.boil, draw: o.draw });
    return pts;
  }

  const PRETZEL = {
    loop: [[12, -74], [26, -88], [44, -92], [58, -84], [63, -66], [58, -46], [44, -28], [24, -14], [0, -9], [-24, -14], [-44, -28], [-58, -46], [-63, -66], [-58, -84], [-44, -92], [-26, -88], [-12, -74]],
    a: [[-12, -74], [-3, -66], [4, -60], [8, -54], [4, -48], [-2, -44], [-10, -36], [-22, -26], [-30, -19]],
    b: [[12, -74], [3, -66], [-4, -60], [-8, -54], [-4, -48], [2, -44], [10, -36], [22, -26], [30, -19]],
  };
  /** pretzel(ctx, x, y, h, o): a salted Brezel, base centre (x, y), height h (ref 150, width 1.3 h). rot, flip */
  function pretzel(ctx, x, y, h, o = {}) {
    h = clamp(num(h, 150), 4, 4000);
    const u = h / 100, k = h / 150;
    const lw = o.width != null ? o.width : lineW(o, k);
    const seed = o.seed == null ? 'pretzel' : o.seed;
    const alpha = b01(o.alpha);
    if (alpha <= 0) return;
    ctx.save();
    ctx.translate(num(x, 0), num(y, 0));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flip ? -u : u, u);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    const q = { lw, u, boil: o.boil, sh: 2.2, draw: o.draw };
    tubeShape(ctx, PRETZEL.loop, (t) => 9.5 + 10 * Math.pow(Math.sin(Math.PI * t), 2), P.pretzel, P.crust, Object.assign({}, q, { seed: L.hash(seed, 1), gloss: [[-50, -40, 14, -1.1, 2.4], [-30, -20, 10, -0.5, 2.2], [-50, -84, 8, -0.3, 2]] }));
    const armW = (t) => 8 + 1.5 * t;
    tubeShape(ctx, PRETZEL.a, armW, P.pretzel, P.crust, Object.assign({}, q, { sh: 1.5, seed: L.hash(seed, 2) }));
    tubeShape(ctx, PRETZEL.b, armW, P.pretzel, P.crust, Object.assign({}, q, { sh: 1.5, seed: L.hash(seed, 3) }));
    // the lower crossing: arm a over arm b
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -45.5, 8.5, 0, TAU);
    ctx.clip();
    tubeShape(ctx, PRETZEL.a, armW, P.pretzel, P.crust, Object.assign({}, q, { sh: 1.5, seed: L.hash(seed, 2) }));
    ctx.restore();
    // coarse salt
    if ((o.draw == null || o.draw >= 1) && h >= 30) {
      const r = L.rng(L.hash(seed, 'salt'));
      const src = crSample(PRETZEL.loop, 4).concat(crSample(PRETZEL.a, 3), crSample(PRETZEL.b, 3));
      ctx.save();
      ctx.lineWidth = Math.max(0.8, 1.2 * k) / u;
      ctx.strokeStyle = P.outlineSoft;
      ctx.fillStyle = P.plate;
      for (let i = 0; i < 18; i++) {
        const p = src[Math.floor(r() * src.length)];
        const sx = p[0] + r.range(-3, 1), sy = p[1] + r.range(-4, 0), s = r.range(1.6, 2.6);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(r() * TAU);
        ctx.beginPath();
        ctx.rect(-s / 2, -s / 2, s, s * 0.8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /** sausages(ctx, x, y, h, o): two grilled sausages with mustard on a small plate; base centre, height h (ref 150). rot, flip, draw */
  function sausages(ctx, x, y, h, o = {}) {
    h = clamp(num(h, 120), 4, 4000);
    const u = h / 100, k = h / 150;
    const lw = o.width != null ? o.width : lineW(o, k);
    const seed = o.seed == null ? 'sausages' : o.seed;
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return;
    ctx.save();
    ctx.translate(num(x, 0), num(y, 0));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flip ? -u : u, u);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    shape(ctx, ellPts(0, -16, 86, 19, 40), { fill: P.plate, shade: { color: FOOD_PLATE_SHADE(), side: 'bottom', frac: 0.3 }, width: lw, u, seed: L.hash(seed, 1), boil: o.boil, draw });
    const sw = (t) => 18 * (0.86 + 0.14 * Math.sin(Math.PI * t));
    const S2 = [[-58, -40], [-24, -54], [18, -56], [56, -46]];
    const S1 = [[-62, -24], [-26, -36], [16, -38], [54, -28]];
    for (const [ctrl, i] of [[S2, 2], [S1, 3]]) {
      const pts = tubeShape(ctx, ctrl, sw, P.sausage, P.crust, { lw, u, sh: 3, seed: L.hash(seed, i), boil: o.boil, draw, gloss: [[ctrl[1][0] - 6, ctrl[1][1] - 5, 20, 0.15, 3]] });
      if (draw < 1) continue;
      // grill marks
      ctx.save();
      ctx.clip(smoothPath(pts, true));
      ctx.strokeStyle = rgba(P.crust, 0.9);
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const C = crSample(ctrl, 6);
      for (const f of [0.22, 0.4, 0.58, 0.76]) {
        const p = C[Math.floor(f * (C.length - 1))];
        ctx.moveTo(p[0] - 4, p[1] - 7);
        ctx.lineTo(p[0] + 4, p[1] + 6);
      }
      ctx.stroke();
      ctx.restore();
    }
    // mustard dollop
    shape(ctx, [[48, -10], [62, -14], [72, -12], [70, -18], [62, -22], [59, -27], [54, -21], [46, -18]], {
      fill: P.beer, shade: { color: P.beerDeep, side: 'right', frac: 0.3 }, gloss: [[55, -20, 0, 0, 2.2]],
      width: lw * 0.8, u, seed: L.hash(seed, 4), boil: o.boil, draw,
    });
    ctx.restore();
  }

  // ===========================================================================
  // The lockup (art bible 10.10). s = 1 is 900 px tall; local units are px at s = 1, origin at the centre.
  // ===========================================================================

  const LK = {
    mugH: 460, base: 153,
    ears: [[-178, 158, 410, -0.27], [-214, 168, 360, -0.64], [178, 158, 410, 0.27], [214, 168, 360, 0.64]],
    hops: [[-196, 206, 190, -0.12, false], [222, 208, 190, 0.1, true]],
    crown: 1.22,
    word: { y: 302, size: 150, maxW: 880, arch: 34 },
    year: { y: 416, size: 100 },
    sprigs: [[-162, 384, 150, -Math.PI / 2 - 0.04], [162, 384, 150, Math.PI / 2 + 0.04]],
  };

  /**
   * lockup(ctx, cx, cy, s, o): the OktoberFESB 2026 lockup centred at (cx, cy), 900 * s px tall.
   *   build values 0..1 (default 1): mug, foam, wheat, hops, word, year, rim, bubbles
   *   t (s) bubbles and foam breathing   sweep 0..1 gloss sweep across the lettering   alpha
   * Returns { mug: { x, y, h } }: the mug's base centre and body height in canvas px.
   */
  function lockup(ctx, cx, cy, s, o = {}) {
    cx = num(cx, 960);
    cy = num(cy, 540);
    s = clamp(num(s, 1), 0.01, 50);
    const ret = { mug: { x: cx, y: cy + LK.base * s, h: LK.mugH * s } };
    const alpha = b01(o.alpha);
    if (alpha <= 0) return ret;
    const t = num(o.t, 0);
    const bM = b01(o.mug), bF = b01(o.foam), bW = b01(o.wheat), bH = b01(o.hops), bWd = b01(o.word), bY = b01(o.year), bR = b01(o.rim), bB = b01(o.bubbles);
    const seed = o.seed == null ? 'lockup' : o.seed;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    const mugS = bM >= 1 ? 1 : Math.max(0, outBack(bM, 2));
    const mh = LK.mugH * mugS;
    const foam = clamp(bF * (1.3 + 0.035 * Math.sin(t * 2.6)), 0, 1.4);
    const wK = bW >= 1 ? 1 : outBack(bW, 1.6);
    const ears = LK.ears.map(([ex, ey, eh, rot]) => [ex, ey, eh * clamp(bW * 2.5), rot * wK]);
    const hK = bH >= 1 ? 1 : Math.max(0, outBack(bH, 2.2));
    const rimK = bR >= 1 ? 1 : Math.max(0, outBack(bR, 1.6));
    const heroLine = { line: 'hero' };
    // bubbles behind
    if (bB > 0) bubbles(ctx, L.hash(seed, 'back'), t, { x: -470, y: -470, w: 940, h: 600 }, { count: 22, alpha: bB, size: [8, 26] });
    // the white sticker rim behind the mug cluster, with its navy border
    if (rimK > 0.01) {
      const R = 12 * rimK, B = 7 * Math.min(1, rimK);
      for (const pass of [0, 1]) {
        const color = pass ? P.gloss : P.outline;
        const pad = pass ? R : R + B;
        for (const [ex, ey, eh, rot] of ears) if (eh > 4) wheatImpl(ctx, ex, ey, eh, Object.assign({ rot, flip: ex > 0, seed: L.hash(seed, 'ear', ex) }, heroLine), { color, pad });
        if (mh > 2) {
          const u = mh / 100, lw = lineW(heroLine, mh / MUG_REF);
          ctx.save();
          ctx.translate(0, LK.base);
          ctx.scale(u, u);
          const w = (2 * (pad + lw * 0.45)) / u;
          silhouette(ctx, MUG_BODY, color, w);
          silhouette(ctx, MUG_HANDLE, color, w);
          const cr = mugCrown(0.86, foam, L.hash(seed, 'mug'), LK.crown);
          if (cr) silhouette(ctx, cr.pts, color, w);
          ctx.restore();
        }
        if (hK > 0.01) for (const [hx, hy, hh, rot, fl] of LK.hops) hopsImpl(ctx, hx, hy, hh * hK, Object.assign({ rot, flip: fl }, heroLine), { color, pad });
      }
    }
    // wheat behind the mug, the mug, hops in front
    ears.forEach(([ex, ey, eh, rot]) => {
      if (eh > 4) wheat(ctx, ex, ey, eh, Object.assign({ rot, flip: ex > 0, seed: L.hash(seed, 'ear', ex) }, heroLine));
    });
    if (mh > 2) mug(ctx, 0, LK.base, mh, { fill: 0.86, foam, crown: LK.crown, logo: true, bubbles: true, t, line: 'hero', seed: L.hash(seed, 'mug') });
    if (hK > 0.01) for (const [hx, hy, hh, rot, fl] of LK.hops) hops(ctx, hx, hy, hh * hK, Object.assign({ rot, flip: fl, seed: L.hash(seed, 'hop', hx) }, heroLine));
    // lettering
    const sweep = o.sweep != null && o.sweep > 0 && o.sweep < 1 ? o.sweep : null;
    if (bY > 0) {
      const yk = outBack(bY, 1.8);
      for (const [sx, sy, sh, rot] of LK.sprigs) wheat(ctx, sx, sy, sh * clamp(yk), { rot, seed: L.hash(seed, 'sprig', sx), line: 'secondary' });
    }
    if (bWd > 0) {
      caption(ctx, 'OktoberFESB', 0, LK.word.y, LK.word.size, { style: 'split', splitAt: 7, letters: bWd, arch: LK.word.arch, maxW: LK.word.maxW, border: 7 * rimK, sweep });
    }
    if (bY > 0) caption(ctx, '2026', 0, LK.year.y, LK.year.size, { style: 'gold', pop: bY, border: 7 * rimK, sweep });
    // a few bubbles in front
    if (bB > 0) bubbles(ctx, L.hash(seed, 'front'), t, { x: -440, y: -420, w: 880, h: 520 }, { count: 7, alpha: bB, size: [6, 16] });
    ctx.restore();
    return ret;
  }

  // ===========================================================================
  // Spaten House (art bible 10.6)
  // ===========================================================================

  function glowSprite(color) {
    const S = FILM.S || 1;
    return L.cached(['fesbGlow', color, S].join('|'), () => {
      const px = Math.max(8, Math.round(128 * S));
      const c = FILM.makeCanvas(px, px);
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
      gr.addColorStop(0, rgba(color, 0.9));
      gr.addColorStop(0.22, rgba(color, 0.45));
      gr.addColorStop(0.55, rgba(color, 0.12));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, px, px);
      return c;
    });
  }

  const HALL_W = 1920, HALL_H = 1080, HALL_M = 480, HALL_PAR = 0.6;
  const HALL_CHAND = { hall: [-480, 480, 1440, 2400], door: [-560, 380, 1540, 2480], counter: [-600, 330, 1590, 2520] };
  function chandBulbs(cx, small) {
    const rx = small ? 118 : 150, ry = small ? 20 : 26, cy = small ? 270 : 300;
    const out = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry - 34, Math.sin(a) > 0 ? 1 : 0.8]);
    }
    return { rx, ry, cy, bulbs: out };
  }

  function drawHall(g, variant, b) {
    const X0 = -HALL_M, X1 = HALL_W + HALL_M, WW = X1 - X0;
    const bg = (pts, seed, closed = true, width = 3, alpha = 0.7) => ink(g, pts, { closed, width, color: P.outline, alpha, seed, boil: b, smooth: false, step: 7 });
    const rect = (x, y, w, h) => rrPts(x, y, w, h, 1.5, 60);
    const isCounter = variant === 'counter', isDoor = variant === 'door';
    const floorY = 880;
    const wallBot = isCounter ? 866 : 700;
    const door = { x0: 690, x1: 1230, spring: 330, top: 128 };
    const inDoor = (x) => isDoor && x > door.x0 - 30 && x < door.x1 + 30;
    // ceiling boards and the main beam
    g.fillStyle = L.mix(P.woodDeep, P.hallDim, 0.45);
    g.fillRect(X0, 0, WW, 112);
    g.strokeStyle = rgba(P.woodMid, 0.35);
    g.lineWidth = 2;
    g.beginPath();
    for (let x = X0; x < X1; x += 64) {
      g.moveTo(x, 0);
      g.lineTo(x, 110);
    }
    g.stroke();
    g.fillStyle = P.woodDeep;
    g.fillRect(X0, 106, WW, 54);
    g.fillStyle = rgba(P.woodMid, 0.45);
    g.fillRect(X0, 106, WW, 8);
    // plaster
    g.fillStyle = P.hallWarm;
    g.fillRect(X0, 160, WW, wallBot - 160);
    // posts every 360 px, bays between them
    const posts = [];
    for (let px = -300; px <= X1 + 1; px += 360) if (!(isDoor && px > door.x0 - 40 && px < door.x1 + 40)) posts.push(px);
    const bays = [];
    for (let bx = -120; bx <= X1; bx += 360) bays.push(bx);
    // bay contents: arched windows (hall, door) or the back bar (counter)
    if (!isCounter) {
      for (const bx of bays) {
        if (inDoor(bx)) continue;
        const w = 150, top = 262, spring = 330, bot = 580;
        const pts = [[bx - w / 2, bot], [bx - w / 2, spring]];
        for (let i = 1; i < 12; i++) {
          const a = Math.PI + (i / 12) * Math.PI;
          pts.push([bx + Math.cos(a) * (w / 2), spring + Math.sin(a) * (spring - top)]);
        }
        pts.push([bx + w / 2, spring], [bx + w / 2, bot]);
        const path = polyPath(pts, true);
        g.fillStyle = P.officeNight;
        g.fill(path);
        g.save();
        g.clip(path);
        g.fillStyle = rgba(P.bavBlue, 0.14);
        g.beginPath();
        g.moveTo(bx - w, bot);
        g.lineTo(bx - w * 0.1, top - 40);
        g.lineTo(bx + w * 0.2, top - 40);
        g.lineTo(bx - w * 0.7, bot);
        g.fill();
        g.fillStyle = P.woodDeep;
        g.fillRect(bx - 4, top - 60, 8, bot - top + 60);
        g.fillRect(bx - w, 420, w * 2, 8);
        g.restore();
        g.fillStyle = P.woodDeep;
        g.fillRect(bx - w / 2 - 14, bot, w + 28, 16);
        bg(pts, L.hash('win', bx));
      }
    } else {
      // back bar: a shelf of mugs and barrel stacks either side
      g.fillStyle = rgba(P.woodDeep, 0.9);
      g.fillRect(420, 486, 1080, 18);
      bg(rect(420, 486, 1080, 18), 'shelf');
      for (let i = 0; i < 11; i++) {
        const mx = 470 + i * 98;
        if (mx > 800 && mx < 1120) continue;
        mug(g, mx, 486, 64, { fill: 0, foam: 0, line: 'background', seed: L.hash('shelfmug', i), boil: b, dimples: false });
      }
      const barrel = (bx, by, r, sd) => {
        shape(g, ellPts(bx, by, r, r, 40), { fill: P.woodMid, shade: { color: rgba(P.woodDeep, 0.6), side: 'right', frac: 0.2 }, width: 4, alpha: 1, seed: sd, boil: b });
        g.save();
        g.beginPath();
        g.arc(bx, by, r * 0.9, 0, TAU);
        g.clip();
        g.strokeStyle = rgba(P.woodDeep, 0.55);
        g.lineWidth = 2;
        g.beginPath();
        for (let x = bx - r; x < bx + r; x += r / 4.5) {
          g.moveTo(x, by - r);
          g.lineTo(x, by + r);
        }
        g.stroke();
        g.restore();
        g.strokeStyle = P.outline;
        g.lineWidth = 7;
        g.beginPath();
        g.arc(bx, by, r * 0.9, 0, TAU);
        g.stroke();
        g.strokeStyle = rgba(P.outlineSoft, 0.8);
        g.lineWidth = 3;
        g.beginPath();
        g.arc(bx, by, r * 0.62, 0, TAU);
        g.stroke();
        shape(g, rrPts(bx - 9, by + r * 0.45, 18, 20, 5, 8), { fill: P.gold, shade: { color: P.goldDeep, side: 'right', frac: 0.3 }, width: 3, seed: L.hash(sd, 'spigot'), boil: b });
      };
      for (const sgn of [-1, 1]) {
        const c = 960 + sgn * 700;
        barrel(c - 110, 752, 104, L.hash('barrel', sgn, 0));
        barrel(c + 110, 752, 104, L.hash('barrel', sgn, 1));
        barrel(c, 570, 100, L.hash('barrel', sgn, 2));
        g.fillStyle = P.woodDeep;
        g.fillRect(c - 230, 852, 460, 16);
      }
    }
    // posts and knee braces
    for (const px of posts) {
      g.fillStyle = P.woodDeep;
      g.fillRect(px - 18, 160, 36, wallBot - 160);
      bg(rect(px - 18, 150, 36, wallBot - 150), L.hash('post', px));
      for (const sgn of [-1, 1]) {
        const br = [[px + sgn * 18, 258], [px + sgn * 18, 232], [px + sgn * 96, 160], [px + sgn * 124, 160]];
        g.fillStyle = P.woodDeep;
        g.fill(polyPath(br, true));
        bg(br, L.hash('brace', px, sgn));
      }
    }
    bg([[X0, 160], [X1, 160]], 'beamline', false);
    // doorway
    if (isDoor) {
      const outer = [[door.x0, floorY], [door.x0, door.spring]];
      const inner = [[door.x0 + 40, floorY], [door.x0 + 40, door.spring]];
      const cxd = (door.x0 + door.x1) / 2, rxo = (door.x1 - door.x0) / 2;
      for (let i = 1; i < 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI;
        outer.push([cxd + Math.cos(a) * rxo, door.spring + Math.sin(a) * (door.spring - door.top)]);
        inner.push([cxd + Math.cos(a) * (rxo - 40), door.spring + Math.sin(a) * (door.spring - door.top - 34)]);
      }
      outer.push([door.x1, door.spring], [door.x1, floorY]);
      inner.push([door.x1 - 40, door.spring], [door.x1 - 40, floorY]);
      g.fillStyle = P.woodDeep;
      g.fill(polyPath(outer, true));
      const ip = polyPath(inner, true);
      const gr = g.createLinearGradient(0, door.top, 0, floorY);
      gr.addColorStop(0, P.hallDim);
      gr.addColorStop(0.6, L.mix(P.hallDim, P.woodMid, 0.4));
      gr.addColorStop(1, L.mix(P.hallDim, P.hallWarm, 0.45));
      g.fillStyle = gr;
      g.fill(ip);
      g.save();
      g.clip(ip);
      g.fillStyle = rgba(P.woodDeep, 0.8);
      g.fillRect(door.x0, 800, door.x1 - door.x0, 90);
      const rg = g.createRadialGradient(cxd, 520, 10, cxd, 520, 300);
      rg.addColorStop(0, rgba(P.hallWarm, 0.35));
      rg.addColorStop(1, rgba(P.hallWarm, 0));
      g.fillStyle = rg;
      g.fillRect(door.x0, door.top, door.x1 - door.x0, floorY - door.top);
      g.restore();
      shape(g, [[cxd - 26, door.top - 6], [cxd + 26, door.top - 6], [cxd + 18, door.top + 46], [cxd - 18, door.top + 46]], { fill: P.woodMid, width: 3, lineAlpha: 0.7, smooth: false, seed: 'key', boil: b });
      bg(outer, 'doorOuter', false, 4, 0.8);
      bg(inner, 'doorInner', false, 3, 0.7);
    }
    if (!isCounter) {
      // wainscot
      g.save();
      if (isDoor) {
        g.beginPath();
        g.rect(X0, 0, door.x0 - X0, HALL_H);
        g.rect(door.x1, 0, X1 - door.x1, HALL_H);
        g.clip();
      }
      g.fillStyle = P.woodMid;
      g.fillRect(X0, 700, WW, floorY - 700);
      g.fillStyle = rgba(P.woodDeep, 0.3);
      g.strokeStyle = rgba(P.woodLight, 0.45);
      g.lineWidth = 2;
      for (let x = X0 + 16; x < X1; x += 180) {
        g.fillRect(x + 12, 736, 152, 124);
        g.beginPath();
        g.moveTo(x + 12, 860);
        g.lineTo(x + 12, 736);
        g.lineTo(x + 164, 736);
        g.stroke();
      }
      // far crowd: flat, dim, behind the haze
      const r = L.rng(L.hash('farcrowd', variant));
      const tones = [L.mix(P.hallDim, P.woodMid, 0.3), L.mix(P.hallDim, P.woodMid, 0.5), L.mix(P.hallDim, P.bavBlue, 0.25)];
      for (let x = X0 + 20; x < X1; x += r.range(58, 84)) {
        const hy = r.range(642, 676), hr = r.range(17, 22);
        g.fillStyle = tones[Math.floor(r() * 3)];
        g.beginPath();
        g.arc(x, hy, hr, 0, TAU);
        g.fill();
        g.beginPath();
        g.moveTo(x - hr * 2, 790);
        g.quadraticCurveTo(x - hr * 2.1, hy + hr * 1.1, x, hy + hr * 1.05);
        g.quadraticCurveTo(x + hr * 2.1, hy + hr * 1.1, x + hr * 2, 790);
        g.fill();
      }
      g.fillStyle = L.mix(P.woodDeep, P.hallDim, 0.3);
      g.fillRect(X0, 764, WW, 26);
      g.fillStyle = P.woodDeep;
      g.fillRect(X0, 692, WW, 0);
      g.restore();
      g.fillStyle = P.woodDeep;
      if (isDoor) {
        g.fillRect(X0, 690, door.x0 - X0, 20);
        g.fillRect(door.x1, 690, X1 - door.x1, 20);
      } else g.fillRect(X0, 690, WW, 20);
    }
    // haze over the far wall
    g.fillStyle = rgba(P.hallDim, 0.35);
    g.fillRect(X0, 0, WW, isCounter ? 866 : floorY);
    // floor
    if (!isCounter) {
      g.fillStyle = L.mix(P.woodDeep, P.hallDim, 0.25);
      g.fillRect(X0, floorY, WW, HALL_H - floorY);
      g.strokeStyle = rgba(P.woodMid, 0.5);
      g.lineWidth = 2;
      g.beginPath();
      let yy = floorY, gap = 9;
      const r = L.rng(L.hash('floor', variant));
      while (yy < HALL_H) {
        yy += gap;
        gap *= 1.28;
        g.moveTo(X0, yy);
        g.lineTo(X1, yy);
        for (let x = X0 + r.range(0, 200); x < X1; x += r.range(180, 320)) {
          g.moveTo(x, yy);
          g.lineTo(x, yy - gap / 1.28);
        }
      }
      g.stroke();
      bg([[X0, floorY], [X1, floorY]], 'floorline', false, 3, 0.6);
    }
    // lamp glow and the chandeliers
    const small = isCounter;
    for (const cx of HALL_CHAND[variant]) {
      const cb = chandBulbs(cx, small);
      const rg = g.createRadialGradient(cx, cb.cy, 20, cx, cb.cy, small ? 380 : 480);
      rg.addColorStop(0, rgba(P.hallWarm, 0.55));
      rg.addColorStop(0.5, rgba(P.hallWarm, 0.18));
      rg.addColorStop(1, rgba(P.hallWarm, 0));
      g.fillStyle = rg;
      g.fillRect(cx - 500, 0, 1000, 900);
    }
    for (const cx of HALL_CHAND[variant]) {
      const cb = chandBulbs(cx, small);
      g.strokeStyle = P.outline;
      g.lineCap = 'round';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx, 158);
      g.lineTo(cx, cb.cy - 70);
      for (const sgn of [-1, 1]) {
        g.moveTo(cx, cb.cy - 70);
        g.lineTo(cx + sgn * cb.rx, cb.cy);
        g.moveTo(cx, cb.cy - 70);
        g.lineTo(cx + sgn * cb.rx * 0.4, cb.cy + cb.ry * 0.9);
      }
      g.stroke();
      // back half of the ring, candles, front half
      g.lineWidth = 11;
      g.beginPath();
      g.ellipse(cx, cb.cy, cb.rx, cb.ry, 0, Math.PI, TAU);
      g.stroke();
      for (const [bx, by, front] of cb.bulbs.slice().sort((p, q) => p[1] - q[1])) {
        g.fillStyle = front < 1 ? L.mix(P.shirtWhite, P.hallDim, 0.25) : P.shirtWhite;
        g.fillRect(bx - 5, by + 6, 10, 28);
        g.strokeStyle = P.outline;
        g.lineWidth = 2;
        g.strokeRect(bx - 5, by + 6, 10, 28);
      }
      g.strokeStyle = P.outline;
      g.lineWidth = 11;
      g.beginPath();
      g.ellipse(cx, cb.cy, cb.rx, cb.ry, 0, 0, Math.PI);
      g.stroke();
      g.strokeStyle = rgba(P.outlineSoft, 0.9);
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(cx, cb.cy - 2, cb.rx, cb.ry, 0, 0.15, Math.PI - 0.15);
      g.stroke();
      g.fillStyle = P.outline;
      g.beginPath();
      g.arc(cx, cb.cy - 70, 9, 0, TAU);
      g.fill();
    }
    // the counter (tap shots): top at 866..905, the mug stands at y 900
    if (isCounter) {
      g.fillStyle = P.woodMid;
      g.fillRect(X0, 905, WW, HALL_H - 905);
      g.strokeStyle = rgba(P.woodDeep, 0.6);
      g.lineWidth = 3;
      g.beginPath();
      for (let x = X0 + 60; x < X1; x += 240) {
        g.rect(x, 934, 200, 120);
      }
      g.stroke();
      g.fillStyle = P.woodLight;
      g.fillRect(X0, 866, WW, 39);
      g.fillStyle = rgba(P.gloss, 0.18);
      g.fillRect(X0, 868, WW, 6);
      g.strokeStyle = rgba(P.outlineSoft, 0.35);
      g.lineWidth = 2;
      g.beginPath();
      for (const yy of [878, 889, 897]) {
        g.moveTo(X0, yy);
        g.lineTo(X1, yy);
      }
      g.stroke();
      bg([[X0, 866], [X1, 866]], 'ctop', false, 4, 0.8);
      bg([[X0, 905], [X1, 905]], 'cedge', false, 4, 0.9);
      g.fillStyle = P.gold;
      g.fillRect(X0, 1032, WW, 14);
      g.fillStyle = P.goldDeep;
      g.fillRect(X0, 1040, WW, 6);
      bg([[X0, 1031], [X1, 1031]], 'rail1', false, 3, 0.9);
      bg([[X0, 1047], [X1, 1047]], 'rail2', false, 3, 0.9);
    }
    // vertical vignette (background light), baked: it does not move with the parallax
    const vt = g.createLinearGradient(0, 0, 0, 320);
    vt.addColorStop(0, rgba(P.hallDim, 0.5));
    vt.addColorStop(1, rgba(P.hallDim, 0));
    g.fillStyle = vt;
    g.fillRect(X0, 0, WW, 320);
    const vb = g.createLinearGradient(0, 860, 0, HALL_H);
    vb.addColorStop(0, rgba(P.hallDim, 0));
    vb.addColorStop(1, rgba(P.hallDim, 0.45));
    g.fillStyle = vb;
    g.fillRect(X0, 860, WW, HALL_H - 860);
  }

  /**
   * hallBack(ctx, o): the full-frame Spaten House background.
   *   variant 'hall' (default) | 'counter' (tap counter with barrels; counter top y 866..905) | 'door'
   *   (doorway at x 690..1230, floor y 880)   camX 0 (camera x offset; the wall moves at 0.6, within +-800)
   *   dim 0..1 (darkens for the spotlight)   t (bulb shimmer)
   * The static wall is cached per variant, render scale and one of three boil drawings.
   */
  function hallBack(ctx, o = {}) {
    const variant = o.variant === 'counter' || o.variant === 'door' ? o.variant : 'hall';
    const S = FILM.S || 1;
    const b = ((L.boil(L.T) % 3) + 3) % 3;
    const shift = clamp(num(o.camX, 0) * HALL_PAR, -HALL_M, HALL_M);
    const t = num(o.t, 0);
    const c = L.cached(['fesbHall', variant, b, S].join('|'), () => {
      const cv = FILM.makeCanvas(Math.max(1, Math.round((HALL_W + 2 * HALL_M) * S)), Math.max(1, Math.round(HALL_H * S)));
      const g = cv.getContext('2d');
      g.scale(S, S);
      g.translate(HALL_M, 0);
      drawHall(g, variant, b);
      return cv;
    });
    ctx.save();
    ctx.drawImage(c, (HALL_M + shift) * S, 0, HALL_W * S, c.height, 0, 0, HALL_W, HALL_H);
    // bulbs with a gentle shimmer
    const spr = glowSprite(P.bulb);
    const small = variant === 'counter';
    let i = 0;
    for (const cx of HALL_CHAND[variant]) {
      const cb = chandBulbs(cx, small);
      for (const [bx0, by] of cb.bulbs) {
        const bx = bx0 - shift;
        i++;
        if (bx < -80 || bx > HALL_W + 80) continue;
        const tw = 0.8 + 0.2 * L.noise1(t * 3 + i * 1.7, 11);
        const R = 46 * tw;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(spr, bx - R, by - R, R * 2, R * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bulb;
        ctx.beginPath();
        ctx.ellipse(bx, by, 5, 8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = P.gloss;
        ctx.beginPath();
        ctx.arc(bx, by + 1, 2.4, 0, TAU);
        ctx.fill();
      }
    }
    // the dim, for the spotlight
    const dim = b01(o.dim, 0);
    if (dim > 0) {
      ctx.fillStyle = rgba(L.mix(P.hallDim, '#000000', 0.3), 0.82 * dim);
      ctx.fillRect(0, 0, HALL_W, HALL_H);
    }
    ctx.restore();
  }

  function swagPt(x0, y0, x1, y1, sag, u) {
    return [lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u)];
  }

  /**
   * bunting(ctx, x0, y0, x1, y1, sag, o): a swag of Bavarian lozenge pennants between two points.
   *   size 60 (pennant width px)   t (gentle sway)   line 'background' (default: 3 px at 70%)   seed, alpha,
   *   draw (the cord draws on and pennants appear along it)
   */
  function bunting(ctx, x0, y0, x1, y1, sag, o = {}) {
    x0 = num(x0, 0); y0 = num(y0, 0); x1 = num(x1, 1920); y1 = num(y1, 0); sag = num(sag, 60);
    const size = clamp(num(o.size, 60), 6, 400);
    const k = size / 60;
    const t = num(o.t, 0);
    const seed = o.seed == null ? 'bunting' : o.seed;
    const line = o.line || 'background';
    const lw = o.width != null ? o.width : lineW({ line }, k);
    const la = line === 'background' ? 0.7 : 1;
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return;
    const len = Math.hypot(x1 - x0, y1 - y0 + sag);
    const n = Math.max(1, Math.floor(len / (size * 1.1)));
    const ph0 = (L.hash(seed) % 1000) / 159;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    const cord = [];
    for (let i = 0; i <= 24; i++) cord.push(swagPt(x0, y0, x1, y1, sag, i / 24));
    const w = size, h = size * 1.15;
    const tri = [[-w / 2, 0], [w / 2, 0], [w * 0.05, h * 0.97], [0, h], [-w * 0.05, h * 0.97]];
    const cell = size * 0.21;
    // Bavarian lozenges: a checker tile under a rotate-squash-rotate transform (tilted diamonds)
    const tile = L.cached('fesbLozengeTile', () => {
      const c = FILM.makeCanvas(64, 64);
      const g = c.getContext('2d');
      g.fillStyle = P.bavWhite;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = P.bavBlue;
      g.fillRect(0, 0, 32, 32);
      g.fillRect(32, 32, 32, 32);
      return c;
    });
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().rotate((-0.38 * 180) / Math.PI).scale(1, 0.62).rotate(45).scale(cell / 32));
    const nShow = draw >= 1 ? n : Math.floor(n * draw);
    for (let i = 0; i < nShow; i++) {
      const uu = (i + 0.5) / n;
      const [px, py] = swagPt(x0, y0, x1, y1, sag, uu);
      const ang = Math.atan2(y1 - y0 + sag * 4 * (1 - 2 * uu), x1 - x0 || 1e-6);
      const rot = ang * 0.9 + 0.07 * Math.sin(t * 2.1 + i * 0.9 + ph0);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      const path = polyPath(tri, true);
      ctx.fillStyle = pat;
      ctx.fill(path);
      ctx.fillStyle = rgba('#000000', 0.1);
      ctx.fill(polyPath([[w * 0.18, 0], [w / 2, 0], [w * 0.05, h * 0.97], [0, h]], true));
      ink(ctx, tri, { closed: true, width: lw, alpha: la, seed: L.hash(seed, i), boil: o.boil, smooth: false });
      ctx.restore();
    }
    ink(ctx, cord, { width: Math.max(1.5, 2.5 * k), color: P.outlineSoft, seed: L.hash(seed, 'cord'), boil: o.boil, draw });
    ctx.restore();
  }

  /**
   * garland(ctx, x0, y0, x1, y1, sag, o): a string of warm bulbs with soft glows.
   *   spacing 54 px, r 8 (bulb radius), glow 1, t (twinkle), seed, alpha, draw
   */
  function garland(ctx, x0, y0, x1, y1, sag, o = {}) {
    x0 = num(x0, 0); y0 = num(y0, 0); x1 = num(x1, 1920); y1 = num(y1, 0); sag = num(sag, 50);
    const spacing = clamp(num(o.spacing, 54), 6, 1000);
    const r = clamp(num(o.r, 8), 1, 200);
    const glow = b01(o.glow);
    const t = num(o.t, 0);
    const seed = o.seed == null ? 'garland' : o.seed;
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return;
    const len = Math.hypot(x1 - x0, y1 - y0 + sag);
    const n = Math.max(1, Math.floor(len / spacing));
    const sn = L.hash(seed) & 1023;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    const cord = [];
    for (let i = 0; i <= 24; i++) cord.push(swagPt(x0, y0, x1, y1, sag, i / 24));
    const spr = glowSprite(P.bulb);
    const pts = [];
    const nShow = draw >= 1 ? n : Math.floor(n * draw);
    for (let i = 0; i < nShow; i++) {
      const uu = (i + 0.5) / n;
      const [px, py] = swagPt(x0, y0, x1, y1, sag, uu);
      const tw = 0.78 + 0.22 * L.noise1(t * 2.6 + i * 1.37, sn);
      pts.push([px, py, tw]);
    }
    if (glow > 0) {
      for (const [px, py, tw] of pts) {
        const R = r * 5.5 * tw;
        ctx.globalAlpha = alpha * glow * 0.85 * tw;
        ctx.drawImage(spr, px - R, py + r * 1.6 - R, R * 2, R * 2);
      }
      ctx.globalAlpha = alpha;
    }
    ink(ctx, cord, { width: Math.max(1.5, r * 0.28), color: P.outlineSoft, seed: L.hash(seed, 'cord'), boil: o.boil, draw });
    ctx.fillStyle = P.outline;
    for (const [px, py] of pts) ctx.fillRect(px - r * 0.42, py - 1, r * 0.84, r * 0.8);
    const bulbs = new Path2D(), dots = new Path2D();
    for (const [px, py] of pts) {
      bulbs.moveTo(px + r * 0.78, py + r * 1.55);
      bulbs.ellipse(px, py + r * 1.55, r * 0.78, r, 0, 0, TAU);
      dots.moveTo(px - r * 0.06, py + r * 1.2);
      dots.arc(px - r * 0.28, py + r * 1.2, r * 0.22, 0, TAU);
    }
    ctx.fillStyle = L.mix(P.bulb, P.gloss, 0.3);
    ctx.fill(bulbs);
    ctx.lineWidth = Math.max(1.5, r * 0.26);
    ctx.strokeStyle = P.outline;
    ctx.stroke(bulbs);
    ctx.fillStyle = P.gloss;
    ctx.fill(dots);
    ctx.restore();
  }

  /**
   * table(ctx, x, y, w, o): a long wooden table seen from the side at slight elevation; (x, y) is the
   * centre of the top's front edge. depth 34 (px of top surface visible), legs 170 (top to floor),
   * bench 'both' | 'front' | 'back' | 'none', line 'secondary', seed, alpha, draw.
   * Returns { top, seatFront, seatBack, floor } (y values: where mugs stand, bench seats, the floor).
   */
  function table(ctx, x, y, w, o = {}) {
    x = num(x, 960); y = num(y, 700);
    w = clamp(num(w, 800), 40, 6000);
    const depth = clamp(num(o.depth, 34), 0, 400);
    const legs = clamp(num(o.legs, 170), 20, 2000);
    const k = legs / 170;
    const lw = o.width != null ? o.width : lineW(o, k);
    const seed = o.seed == null ? 'table' : o.seed;
    const bench = o.bench || 'both';
    const th = 16 * k;
    const floor = y + legs;
    const seatF = y + legs * 0.42, seatB = seatF - depth * 1.1 - 10 * k;
    const bw = w * 0.94, bd = depth * 0.55, bt = 11 * k;
    const ret = { top: y - depth / 2, seatFront: seatF, seatBack: seatB, floor };
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return ret;
    const full = draw >= 1;
    const S = (i) => L.hash(seed, i);
    const inkBox = (x0, y0, ww, hh, sd) =>
      ink(ctx, rrPts(x0, y0, ww, hh, Math.min(3 * k, ww / 3), 80), { closed: true, width: lw, seed: sd, boil: o.boil, smooth: false, step: 7, draw });
    const shadeCol = rgba('#000000', 0.2);
    const leg = (x0, y0, ww, hh, fill, sd) => {
      if (full) {
        ctx.fillStyle = fill;
        ctx.fillRect(x0, y0, ww, hh);
        ctx.fillStyle = shadeCol;
        ctx.fillRect(x0 + ww * 0.55, y0, ww * 0.45, hh);
      }
      inkBox(x0, y0, ww, hh, sd);
    };
    const edge = (x0, x1, yy, sd) => ink(ctx, [[x0, yy], [x1, yy]], { width: lw * 0.6, seed: sd, boil: o.boil, step: 7, draw });
    const benchAt = (sy, floorB, sd) => {
      const lx = bw / 2 - 50 * k, lwid = 16 * k;
      for (const sg of [-1, 1]) leg(x + sg * lx - lwid / 2, sy + bt, lwid, floorB - sy - bt, P.woodMid, L.hash(sd, sg));
      if (full) {
        ctx.fillStyle = P.woodLight;
        ctx.fillRect(x - bw / 2, sy - bd, bw, bd);
        ctx.fillStyle = P.woodMid;
        ctx.fillRect(x - bw / 2, sy, bw, bt);
      }
      inkBox(x - bw / 2, sy - bd, bw, bd + bt, L.hash(sd, 'top'));
      if (bd > 3) edge(x - bw / 2 + 2, x + bw / 2 - 2, sy, L.hash(sd, 'edge'));
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    if (bench === 'back' || bench === 'both') benchAt(seatB, floor - depth * 1.1 - 10 * k, S('bb'));
    const lx = w / 2 - 70 * k, lwid = 22 * k;
    for (const sg of [-1, 1]) leg(x + sg * lx - lwid / 2 + 8 * k, y + th, lwid * 0.9, legs - th - depth * 0.8, L.mix(P.woodDeep, P.hallDim, 0.3), S(sg * 3));
    // top surface with grain, the front edge, legs
    if (full) {
      ctx.fillStyle = P.woodLight;
      ctx.fillRect(x - w / 2, y - depth, w, depth);
      ctx.fillStyle = P.woodMid;
      ctx.fillRect(x - w / 2, y, w, th);
    }
    if (full && depth > 6) {
      ctx.strokeStyle = rgba(P.outlineSoft, 0.28);
      ctx.lineWidth = Math.max(1.2, 2 * k);
      ctx.beginPath();
      const r = L.rng(S('grain'));
      for (let i = 0; i < 3; i++) {
        const gy = y - depth * (0.25 + 0.25 * i);
        const gx0 = x - w / 2 + r.range(20, 120), gx1 = x + w / 2 - r.range(20, 160);
        ctx.moveTo(gx0, gy);
        ctx.lineTo(gx1, gy + r.range(-1.5, 1.5));
      }
      ctx.stroke();
    }
    inkBox(x - w / 2, y - depth, w, depth + th, S('top'));
    edge(x - w / 2 + 2, x + w / 2 - 2, y, S('edge'));
    for (const sg of [-1, 1]) leg(x + sg * lx - lwid / 2, y + th, lwid, legs - th, P.woodMid, S(sg * 5));
    if (bench === 'front' || bench === 'both') benchAt(seatF, floor, S('bf'));
    ctx.restore();
    return ret;
  }

  /**
   * tap(ctx, x, y, h, o): the brass tap; (x, y) is the nozzle tip (G1: 960, 190), h the height from the
   * tip to the top of the handle (ref 200; about 300 reads well over the G1 mug). flow 0..1 pours a stream
   * down to flowTo (canvas y), pull 0..1 tilts the handle (default: pulled while flowing), t (s) animates the
   * stream, line, flip, alpha, draw.
   */
  function tap(ctx, x, y, h, o = {}) {
    x = num(x, 960); y = num(y, 190);
    h = clamp(num(h, 180), 4, 4000);
    const u = h / 100, k = h / 200;
    const lw = o.width != null ? o.width : lineW(o, k);
    const flow = b01(o.flow, 0);
    const pull = b01(o.pull, flow > 0 ? 1 : 0);
    const t = num(o.t, 0);
    const seed = o.seed == null ? 'tap' : o.seed;
    const alpha = b01(o.alpha);
    const draw = o.draw == null ? 1 : clamp(o.draw);
    if (alpha <= 0 || draw <= 0) return;
    const S = (i) => L.hash(seed, i);
    const brass = (pts, sd, extra) => shape(ctx, pts, Object.assign({ fill: P.gold, shade: { color: P.goldDeep, side: 'right', frac: 0.3 }, width: lw, u, seed: S(sd), boil: o.boil, draw }, extra || {}));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.flip ? -u : u, u);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    // the stream (behind the nozzle)
    const yEnd = (num(o.flowTo, y + 3 * h) - y) / u;
    if (draw >= 1 && flow > 0.01 && yEnd > 2) {
      if (flow >= 0.14) {
        const w0 = 9.5 * Math.sqrt(flow);
        const edge = (sg) => {
          const pts = [];
          for (let i = 0; i <= 16; i++) {
            const yy = (yEnd * i) / 16;
            const v = i / 16;
            pts.push([sg * (w0 / 2) * (1 - 0.18 * v + 0.25 * v * v) + 0.5 * Math.sin(yy * 0.12 - t * 24 + sg), yy]);
          }
          return pts;
        };
        const L0 = edge(-1), R0 = edge(1).reverse();
        const pts = [[-w0 / 2, -3]].concat(L0, R0, [[w0 / 2, -3]]);
        const g = ctx.createLinearGradient(-w0 / 2, 0, w0 / 2, 0);
        g.addColorStop(0, P.beerDeep);
        g.addColorStop(0.35, P.beerLight);
        g.addColorStop(0.6, P.beer);
        g.addColorStop(1, P.beerDeep);
        shape(ctx, pts, { fill: g, width: Math.max(1.5, 3 * k), u, seed: S('stream'), boil: o.boil, smooth: false });
        ctx.save();
        ctx.strokeStyle = rgba(P.gloss, 0.75);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.2, w0 * 0.14);
        ctx.beginPath();
        ctx.moveTo(-w0 * 0.2, 4);
        ctx.lineTo(-w0 * 0.2, yEnd * 0.8);
        ctx.stroke();
        ctx.fillStyle = rgba(P.gloss, 0.7);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const by = ((t * 3.1 + i / 5) % 1) * yEnd;
          ctx.moveTo(w0 * 0.1 + 1, by);
          ctx.arc(w0 * 0.1, by, Math.max(0.5, w0 * 0.1), 0, TAU);
        }
        ctx.fill();
        ctx.restore();
      } else {
        for (let i = 0; i < 3; i++) {
          const f = (t * 2.2 + i / 3) % 1;
          shape(ctx, ellPts(0, f * yEnd, 2.2, 3.2, 12), { fill: P.beer, width: Math.max(1.5, 2.5 * k), u, seed: S(40 + i), boil: o.boil });
        }
      }
      // splash
      if (flow > 0.2) {
        const r = L.rng(S('splash'));
        ctx.fillStyle = P.foam;
        ctx.strokeStyle = P.outline;
        ctx.lineWidth = Math.max(1, 2 * k) / u;
        for (let i = 0; i < 6; i++) {
          const f = (t * r.range(2.5, 4) + r()) % 1;
          const vx = r.range(-14, 14), vy = r.range(8, 16);
          const dx = vx * f, dy = -vy * f + 30 * f * f;
          ctx.beginPath();
          ctx.arc(dx, yEnd + dy - 1, r.range(0.9, 1.8) * (1 - f * 0.5), 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    // wall flange, spout, nozzle lip, body
    brass(ellPts(0, -44, 30, 30, 32), 1, { fill: L.mix(P.gold, P.goldDeep, 0.45), shade: { color: rgba(P.crust, 0.45), side: 'right', frac: 0.25 } });
    brass([[-7, -34], [7, -34], [5.6, -12], [5, -3.5], [-5, -3.5], [-5.6, -12]], 2, { smooth: false, gloss: [[-3.2, -28, 16, Math.PI / 2, 1.8]] });
    brass(rrPts(-7, -6, 14, 6, 2, 4), 3, { fill: P.goldDeep, shade: null, smooth: false });
    brass(rrPts(-22, -64, 44, 34, 13, 8), 4, { smooth: false, gloss: [[-14, -57, 18, Math.PI / 2 - 0.05, 4], [-14, -35, 0, 0, 3.4]] });
    brass(rrPts(-10, -70, 20, 8, 3, 6), 8, { smooth: false });
    // handle: ferrule then the lever, pivoting on the body top
    ctx.save();
    ctx.translate(0, -68);
    ctx.rotate(-pull * 0.42);
    brass(rrPts(-7.5, -10, 15, 10, 2.5, 6), 5, { smooth: false });
    shape(ctx, [[-6.5, -10], [6.5, -10], [9.5, -30], [8.5, -36], [0, -38.5], [-8.5, -36], [-9.5, -30]], {
      fill: P.woodDeep, shade: { color: rgba('#000000', 0.3), side: 'right', frac: 0.3 }, gloss: [[-4.4, -31, 17, Math.PI / 2 - 0.08, 2.4]],
      width: lw, u, seed: S(6), boil: o.boil, draw,
    });
    brass(rrPts(-9.8, -26, 19.6, 5, 1.6, 6), 7, { smooth: false, shade: null });
    ctx.restore();
    ctx.restore();
  }

  /**
   * spotlight(ctx, x0, y0, x1, y1, w, o): a soft light cone from (x0, y0) to a floor ellipse centred at
   * (x1, y1), w px wide. alpha 1, color (default a warm white), additive.
   */
  function spotlight(ctx, x0, y0, x1, y1, w, o = {}) {
    x0 = num(x0, 0); y0 = num(y0, 0); x1 = num(x1, 960); y1 = num(y1, 1000);
    w = clamp(num(w, 500), 2, 8000);
    const a = b01(o.alpha);
    if (a <= 0) return;
    const col = o.color || L.mix(P.gloss, P.bulb, 0.45);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [wk, al] of [[1.15, 0.08], [0.9, 0.1], [0.55, 0.1]]) {
      const hw0 = w * 0.05 * wk, hw1 = (w / 2) * wk;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgba(col, al * a * 1.6));
      g.addColorStop(1, rgba(col, al * a * 0.7));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * hw0, y0 + ny * hw0);
      ctx.lineTo(x1 + nx * hw1, y1 + ny * hw1);
      ctx.lineTo(x1 - nx * hw1, y1 - ny * hw1);
      ctx.lineTo(x0 - nx * hw0, y0 - ny * hw0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.translate(x1, y1);
    ctx.scale(1, 0.24);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
    rg.addColorStop(0, rgba(col, 0.42 * a));
    rg.addColorStop(0.6, rgba(col, 0.2 * a));
    rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.55, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ===========================================================================

  FILM.props = Object.freeze({
    LINE,
    shape,
    mug,
    fesbLogo,
    caption,
    lockup,
    wheat,
    hops,
    bubbles,
    confetti,
    sparkle,
    knuckle,
    pretzel,
    sausages,
    hallBack,
    bunting,
    garland,
    table,
    tap,
    spotlight,
    // helpers for cast.js and scenes that build their own shapes (not part of the contract)
    _: Object.freeze({ ink, tube, smoothPath, polyPath, ellPts, rrPts, xform, insetPts, silhouette, lineW, mugCrown, MG }),
  });
})();
