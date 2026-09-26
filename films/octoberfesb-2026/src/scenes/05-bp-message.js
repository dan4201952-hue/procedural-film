// Shot 05 'bp-message' — schematic (blueprint), T 8.5-10.0 (global), shot-local t 0..1.5.
// Match cut: the hero mug stays on the exact G1 pixels (mug(ctx, 960, 900, 520, {...})) as 04 hands off
// from its illustrated render to this blueprint line art; the mug is fully present on frame 0.
//
// Layers back to front:
//   1. lib.blueprint plate
//   2. the hero mug at G1, double-outline blueprint line art (art bible section 5)
//   3. heading "Сообщение создано" + the small FESB line logo (top-right)
//   4. three labels with leader lines (payload / header / id), drawn on one per 8th from T 8.75
//   5. a queue of three message boxes on the right; the lit one slides a slot at T 9.5 with a teal tick
(function () {
  'use strict';

  const FILM = window.FILM;
  const L = FILM.lib;
  const P = L.pal;
  const TAU = Math.PI * 2;
  const FR = 1 / 24;
  const ID = 'bp-message';

  const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;

  /** A schematic "message" rectangle centred at (x, y): primary double outline (art bible section 5). */
  function msgBox(ctx, x, y, w, h, o) {
    o = o || {};
    const gap = o.gap != null ? o.gap : 8;
    const x0 = x - w / 2, y0 = y - h / 2;
    ctx.save();
    if (o.fillAlpha > 0) {
      ctx.globalAlpha = o.fillAlpha;
      ctx.fillStyle = o.fill || P.schemBeer;
      ctx.fillRect(x0 + gap, y0 + gap, w - 2 * gap, h - 2 * gap);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = L.rgba(P.lineWhite, 0.85);
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, w, h);
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.5);
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + gap, y0 + gap, w - 2 * gap, h - 2 * gap);
    ctx.restore();
  }

  /** A short paleBlue leader line from a target point (tx, ty), drawing on to (lx, ly) as p goes 0..1. */
  function leader(ctx, tx, ty, lx, ly, p) {
    if (p <= 0) return;
    const ex = L.lerp(tx, lx, L.ease.outCubic(p));
    const ey = L.lerp(ty, ly, L.ease.outCubic(p));
    ctx.save();
    ctx.strokeStyle = L.rgba(P.paleBlue, 0.65);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = L.rgba(P.schemBeer, 0.9);
    ctx.beginPath();
    ctx.arc(tx, ty, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function checkMark(ctx, x, y, s, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= L.clamp(alpha);
    ctx.strokeStyle = P.schemTeal;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x - s * 0.08, y + s * 0.42);
    ctx.lineTo(x + s * 0.55, y - s * 0.46);
    ctx.stroke();
    ctx.restore();
  }

  // three labels, in the order the storyboard lists them; k is the 8th index from T 8.75
  const LABELS = [
    { k: 0, text: 'payload: 1 л', tx: 792, ty: 758, lx: 210, ly: 758, align: 'left' },
    { k: 1, text: 'header: пена', tx: 878, ty: 302, lx: 220, ly: 246, align: 'left' },
    { k: 2, text: 'id: FESB-9', tx: 1136, ty: 640, lx: 1340, ly: 600, align: 'left' },
  ];
  const LBL_START = 0.25, LBL_STEP = 0.25, LBL_DUR = 0.22;

  // the queue: three message boxes; box 0 is lit at t = 0, the highlight slides to box 1 at T 9.5
  const QBOX = [
    { x: 1560, y: 820 },
    { x: 1650, y: 820 },
    { x: 1740, y: 820 },
  ];
  const SLIDE_AT = 1.0, SLIDE_DUR = 5 * FR;

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);

      // 1: blueprint plate, guide centre near the mug
      L.blueprint(ctx, { center: [960, 480] });

      // 2: the hero mug at G1, blueprint line art, fully present (match cut)
      FILM.props.mug(ctx, 960, 900, 520, {
        fill: 0.88, foam: 1, logo: true, blueprint: true, line: 'hero', seed: sd('mug'),
      });

      // 3: heading + small FESB line logo
      L.text(ctx, 'Сообщение создано', 180, 190, { size: 56, weight: 800, color: P.lineWhite });
      FILM.props.fesbLogo(ctx, 1700, 170, 90, { lineArt: true });

      // 4: labels with leader lines, one per 8th from T 8.75
      for (const lb of LABELS) {
        const p = L.clamp((t - (LBL_START + lb.k * LBL_STEP)) / LBL_DUR);
        if (p <= 0) continue;
        leader(ctx, lb.tx, lb.ty, lb.lx, lb.ly, p);
        const ty = lb.align === 'left' ? lb.ly + 8 : lb.ly + 8;
        L.text(ctx, lb.text, lb.lx + (lb.align === 'left' ? 10 : -10), ty, {
          size: 36, weight: 700, color: P.lineWhite, align: lb.align, alpha: L.clamp((p - 0.35) / 0.65),
        });
      }

      // 5: the queue of three message boxes, the mug icon inside each
      const slideP = L.clamp((t - SLIDE_AT) / SLIDE_DUR);
      const glowX = L.lerp(QBOX[0].x, QBOX[1].x, L.ease.outCubic(slideP));
      for (let i = 0; i < QBOX.length; i++) {
        const b = QBOX[i];
        msgBox(ctx, b.x, b.y, 76, 106, { gap: 7 });
        FILM.props.mug(ctx, b.x, b.y + 42, 46, {
          blueprint: true, fill: 0.72, foam: 1, line: 'secondary', seed: sd('boxmug', i),
        });
      }
      // the lit halo, sliding from box 0 to box 1 at T 9.5
      ctx.save();
      const gg = ctx.createRadialGradient(glowX, QBOX[0].y, 4, glowX, QBOX[0].y, 74);
      gg.addColorStop(0, L.rgba(P.schemBeer, 0.5));
      gg.addColorStop(1, L.rgba(P.schemBeer, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(glowX, QBOX[0].y, 74, 0, TAU);
      ctx.fill();
      ctx.restore();
      // the teal tick on the now-delivered box 0
      const checkA = L.clamp((slideP - 0.25) / 0.75);
      checkMark(ctx, QBOX[0].x + 22, QBOX[0].y - 36, 26, checkA);
    },
  });
})();
