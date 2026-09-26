// Shot 07 'bp-route' — schematic (blueprint), T 12.5-14.0 (global), shot-local t 0..1.5.
// Match cut: the waitress's silhouette and the route hold the screen position she reaches at the end
// of 06 (G2: feet (1480, 1000), height 820, mug fans at (1300, 600) and (1660, 600)); everything here
// is present and static on frame 0.
//
// Layers back to front:
//   1. lib.blueprint plate
//   2. the route: tap node "Кран" (x 200) -> her feet -> table node "Стол FESB" (1760, 900), schemBeer,
//      turning schemTeal once delivery completes; a small travelling dot while it is in flight
//   3. the waitress at G2 as a double-outline silhouette, her ten mugs as ten message boxes in the fans
//   4. heading "Маршрутизация" + the small FESB line logo (top-right)
//   5. the ten boxes ticking schemTeal one by one from T 12.75, the "Доставка: k/10" counter following,
//      "10/10 ✓" popping at T 13.75
(function () {
  'use strict';

  const FILM = window.FILM;
  const L = FILM.lib;
  const P = L.pal;
  const TAU = Math.PI * 2;
  const ID = 'bp-route';

  const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;

  // --- G2 geometry (docs/storyboard.md) ---
  const FEET = [1480, 1000];
  const FIG_H = 820;
  const FANL = [1300, 600], FANR = [1660, 600];
  const TAP = [200, 1000], TABLE = [1760, 900];

  // waitress silhouette (dirndl): head + braided crown on a neck, puffed sleeves, laced bodice, a
  // flared skirt (waist -> hip -> hem) with an apron and bow, shoes; arms reach straight out to the
  // two mug fans (art bible 10.2). The neck keeps the head visually joined to the shoulders.
  const CX = 1480;
  const HEAD_R = 50, HEAD_CY = 234;
  const NECK_TOP = 284, SHOULDER_Y = 312, WAIST_Y = 500, HIP_Y = 680, HEM_Y = 900, FOOT_Y = 1000;
  const NECK = [[CX - 17, NECK_TOP], [CX - 24, SHOULDER_Y], [CX + 24, SHOULDER_Y], [CX + 17, NECK_TOP]];
  const BODICE = [[CX - 74, SHOULDER_Y], [CX - 58, WAIST_Y], [CX + 58, WAIST_Y], [CX + 74, SHOULDER_Y]];
  const SKIRT = [
    [CX - 58, WAIST_Y], [CX - 84, HIP_Y], [CX - 195, HEM_Y],
    [CX + 195, HEM_Y], [CX + 84, HIP_Y], [CX + 58, WAIST_Y],
  ];
  const APRON = [[CX - 44, WAIST_Y + 4], [CX - 74, 730], [CX + 74, 730], [CX + 44, WAIST_Y + 4]];
  const SLEEVE_L = [CX - 74, SHOULDER_Y + 8], SLEEVE_R = [CX + 74, SHOULDER_Y + 8];
  const SLEEVE_RAD = 24;
  // her hands reach straight out to the two mug fans
  const HAND_L = FANL, HAND_R = FANR;
  const SHOE_L = [CX - 32, FOOT_Y], SHOE_R = [CX + 30, FOOT_Y];
  const BOW_AT = [CX + 58, WAIST_Y + 6]; // her left, the viewer's right (art bible 10.2)

  /** A braided band across the top of the head, with short cross-ticks suggesting the braid. */
  function braidCrown(ctx, cx, cy, r) {
    const rad = (d) => (d * Math.PI) / 180;
    const rB = r + 9;
    ctx.save();
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.7);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, rB, rad(198), rad(342));
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 7; i++) {
      const a = rad(198 + (144 * i) / 7);
      const x0 = cx + Math.cos(a) * (rB - 6), y0 = cy + Math.sin(a) * (rB - 6);
      const x1 = cx + Math.cos(a) * (rB + 6), y1 = cy + Math.sin(a) * (rB + 6);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** A small schematic bow-knot glyph. */
  function drawBow(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.75);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - s, y - s * 0.62);
    ctx.lineTo(x - s * 0.22, y);
    ctx.lineTo(x - s, y + s * 0.62);
    ctx.closePath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y - s * 0.62);
    ctx.lineTo(x + s * 0.22, y);
    ctx.lineTo(x + s, y + s * 0.62);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(x - s * 0.16, y - s * 0.24, s * 0.32, s * 0.48);
    ctx.restore();
  }

  /** A small shoe glyph, toe pointing away from cx. */
  function drawShoe(ctx, x, y, flip) {
    const s = flip ? -1 : 1;
    ctx.save();
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.7);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 16 * s, y - 14);
    ctx.lineTo(x - 16 * s, y + 6);
    ctx.quadraticCurveTo(x - 16 * s, y + 16, x + 4 * s, y + 16);
    ctx.lineTo(x + 24 * s, y + 16);
    ctx.quadraticCurveTo(x + 30 * s, y + 16, x + 24 * s, y + 8);
    ctx.lineTo(x + 6 * s, y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** A closed polygon as a primary double outline (art bible section 5): lineWhite outer, paleBlue inner. */
  function primaryPoly(ctx, pts, gap) {
    gap = gap == null ? 10 : gap;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x; cy += y; }
    cx /= pts.length; cy /= pts.length;
    let R = 0;
    for (const [x, y] of pts) R += Math.hypot(x - cx, y - cy);
    R /= pts.length;
    const scale = Math.max(0.4, (R - gap) / R);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = L.rgba(P.lineWhite, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = cx + (x - cx) * scale, py = cy + (y - cy) * scale;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** A circle as a primary double outline. */
  function primaryCircle(ctx, cx, cy, r, gap) {
    gap = gap == null ? 10 : gap;
    ctx.save();
    ctx.strokeStyle = L.rgba(P.lineWhite, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, r - gap), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** A secondary single stroke (paleBlue 60%, 2 px), the weight for limbs, icons and leader-weight lines. */
  function secLine(ctx, pts, o) {
    o = o || {};
    ctx.save();
    ctx.strokeStyle = L.rgba(o.color || P.paleBlue, o.alpha != null ? o.alpha : 0.6);
    ctx.lineWidth = o.width || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (o.closed) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** A schematic "message" rectangle centred at (x, y): primary double outline (as in 05). */
  function msgBox(ctx, x, y, w, h, o) {
    o = o || {};
    const gap = o.gap != null ? o.gap : 6;
    const x0 = x - w / 2, y0 = y - h / 2;
    ctx.save();
    const glow = o.glow || 0;
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.9 * glow;
      ctx.shadowColor = P.schemTeal;
      ctx.shadowBlur = 14 * glow;
      ctx.strokeStyle = P.schemTeal;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x0, y0, w, h);
      ctx.restore();
    }
    ctx.strokeStyle = L.rgba(o.outline || P.lineWhite, 0.85);
    ctx.lineWidth = 2.4;
    ctx.strokeRect(x0, y0, w, h);
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.5);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x0 + gap, y0 + gap, w - 2 * gap, h - 2 * gap);
    ctx.restore();
  }

  function checkMark(ctx, x, y, s, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= L.clamp(alpha);
    ctx.strokeStyle = P.schemTeal;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x - s * 0.08, y + s * 0.42);
    ctx.lineTo(x + s * 0.55, y - s * 0.46);
    ctx.stroke();
    ctx.restore();
  }

  // ten mug boxes, five per fan, delivered left to right through fanL then fanR
  function fanBoxes(center) {
    const offs = [-120, -60, 0, 60, 120];
    return offs.map((off) => [center[0] + off, center[1] - 26 * (1 - (off / 120) * (off / 120))]);
  }
  const BOXES = fanBoxes(FANL).concat(fanBoxes(FANR));

  const TICK_START = 0.25, TICK_STEP = 0.1; // T 12.75, one every 0.1 s
  const DONE_AT = 1.25; // T 13.75

  function pointOnRoute(f) {
    const L1 = Math.hypot(FEET[0] - TAP[0], FEET[1] - TAP[1]);
    const L2 = Math.hypot(TABLE[0] - FEET[0], TABLE[1] - FEET[1]);
    const d = L.clamp(f) * (L1 + L2);
    if (d <= L1) {
      const u = d / L1;
      return [L.lerp(TAP[0], FEET[0], u), L.lerp(TAP[1], FEET[1], u)];
    }
    const u = (d - L1) / L2;
    return [L.lerp(FEET[0], TABLE[0], u), L.lerp(FEET[1], TABLE[1], u)];
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);

      // 1: blueprint plate, guide centre near her
      L.blueprint(ctx, { center: [1300, 560] });

      const doneP = L.clamp((t - DONE_AT) / (4 / 24));
      const routeColor = L.mix(P.schemBeer, P.schemTeal, doneP);

      // 2: the route — tap -> her feet -> table, with an arrowhead, and a small dot in flight
      secLine(ctx, [TAP, FEET, TABLE], { color: routeColor, alpha: 0.85, width: 3 });
      {
        const [ax, ay] = TABLE;
        const ang = Math.atan2(TABLE[1] - FEET[1], TABLE[0] - FEET[0]);
        const s = 16;
        ctx.save();
        ctx.fillStyle = L.rgba(routeColor, 0.85);
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-s, -s * 0.55);
        ctx.lineTo(-s, s * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // tap node
      primaryCircle(ctx, TAP[0], TAP[1], 26, 8);
      secLine(ctx, [[TAP[0], TAP[1] - 26], [TAP[0], TAP[1] - 50]], { color: P.paleBlue, alpha: 0.6 });
      L.text(ctx, 'Кран', 224, 950, { size: 34, weight: 700, color: P.lineWhite, align: 'center' });
      // table node
      msgBox(ctx, TABLE[0] - 30, TABLE[1], 90, 46, { gap: 5 });
      L.text(ctx, 'Стол FESB', 1750, 848, { size: 34, weight: 700, color: P.lineWhite, align: 'right' });
      // travelling dot while the route is in flight
      if (t >= TICK_START && t < DONE_AT) {
        const f = L.clamp((t - TICK_START) / (DONE_AT - TICK_START));
        const [dx, dy] = pointOnRoute(f);
        ctx.save();
        ctx.fillStyle = P.schemBeer;
        ctx.beginPath();
        ctx.arc(dx, dy, 7, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = L.rgba(P.gloss, 0.7);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }

      // 3: the waitress — a recognisable dirndl silhouette at G2 — + her ten mugs as message boxes
      primaryPoly(ctx, SKIRT, 10);
      secLine(ctx, APRON, { closed: true, width: 2 });
      drawBow(ctx, BOW_AT[0], BOW_AT[1], 20);
      primaryPoly(ctx, BODICE, 8);
      secLine(ctx, [[CX - 2, SHOULDER_Y + 20], [CX - 2, WAIST_Y - 10]], { width: 1.6 });
      for (let i = 0; i < 4; i++) {
        const y = L.lerp(SHOULDER_Y + 28, WAIST_Y - 14, i / 3);
        secLine(ctx, [[CX - 18, y - 6], [CX - 2, y]], { width: 1.6 });
        secLine(ctx, [[CX + 18, y + 6], [CX + 2, y]], { width: 1.6 });
      }
      secLine(ctx, [SLEEVE_L, HAND_L], { width: 5 });
      secLine(ctx, [SLEEVE_R, HAND_R], { width: 5 });
      primaryCircle(ctx, SLEEVE_L[0], SLEEVE_L[1], SLEEVE_RAD, 6);
      primaryCircle(ctx, SLEEVE_R[0], SLEEVE_R[1], SLEEVE_RAD, 6);
      primaryPoly(ctx, NECK, 5);
      primaryCircle(ctx, CX, HEAD_CY, HEAD_R, 9);
      braidCrown(ctx, CX, HEAD_CY, HEAD_R);
      drawShoe(ctx, SHOE_L[0], SHOE_L[1], true);
      drawShoe(ctx, SHOE_R[0], SHOE_R[1], false);

      for (let i = 0; i < BOXES.length; i++) {
        const [bx, by] = BOXES[i];
        const tickT = TICK_START + i * TICK_STEP;
        const delivered = t >= tickT;
        const popA = L.clamp((t - tickT) / (3 / 24));
        msgBox(ctx, bx, by, 54, 76, { glow: delivered ? popA : 0, outline: delivered ? P.schemTeal : P.lineWhite, gap: 5 });
        FILM.props.mug(ctx, bx, by + 30, 34, {
          blueprint: true, fill: 0.72, foam: 1, line: 'secondary', seed: sd('fanmug', i),
        });
        checkMark(ctx, bx + 16, by - 26, 18, delivered ? popA : 0);
      }

      // 4: heading + small FESB line logo
      L.text(ctx, 'Маршрутизация', 180, 190, { size: 56, weight: 800, color: P.lineWhite });
      FILM.props.fesbLogo(ctx, 1700, 170, 90, { lineArt: true });

      // 5: delivery counter, "10/10 ✓" popping at T 13.75
      const count = t >= TICK_START ? Math.min(10, Math.floor((t - TICK_START) / TICK_STEP + 1e-9) + 1) : 0;
      if (t < DONE_AT) {
        L.text(ctx, `Доставка: ${count}/10`, 180, 300, { size: 44, weight: 700, color: P.lineWhite });
      } else {
        const pop = L.clamp((t - DONE_AT) / (4 / 24));
        const sc = pop < 1 ? 1.1 * L.ease.outCubic(pop) : 1;
        ctx.save();
        ctx.translate(180, 300);
        ctx.scale(sc, sc);
        L.text(ctx, 'Доставка: 10/10 ✓', 0, 0, { size: 44, weight: 700, color: P.schemTeal });
        ctx.restore();
      }
    },
  });
})();
