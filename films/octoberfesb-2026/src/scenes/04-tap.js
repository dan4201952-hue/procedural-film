// Shot 04 'tap' — illustrated, T 6.0-8.5 (global), shot-local t 0..2.5.
// Handoff: 03 -> 04 opens on a frame fully covered in foam (matches 03's last frame).
// Handoff: 04 -> 05 holds G1 (the hero mug: mug(ctx, 960, 900, 520, {...})) exactly on the last frame.
//
// Layers back to front:
//   1. hall background (counter variant): wall, beams, chandeliers, counter
//   2. bunting swag + bulb garland across the top
//   3. the brass tap (art bible 10.6) at (960, 190)
//   4. the hero Maß at G1, filling, with the FESB logo
//   5. glass ping sparkle (T 8.0) + a few ambient golden bubbles
//   6. the receding full-frame foam curtain (T 6.0 -> 7.0), drawn last so it covers everything below it
//   7. caption "2 октября" / "Spaten House" (T 7.0), screen-fixed, outside the camera push-in
(function () {
  'use strict';

  const FILM = window.FILM;
  const L = FILM.lib;
  const P = L.pal;
  const TAU = Math.PI * 2;
  const FR = 1 / 24;
  const ID = 'tap';

  // every seed in this file derives from the shot id
  const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;

  /**
   * drawFoamCurtain(ctx, edgeY, t) : the sea of foam covering the frame below `edgeY`, with a wobbly
   * scalloped top edge and a bubble-cell texture, plus a scatter of small bubbles popping off the edge
   * and drifting up. Pure function of (edgeY, t); edgeY is the world y above which the frame is clear.
   */
  function drawFoamCurtain(ctx, edgeY, t) {
    const W = FILM.W, H = FILM.H;
    if (edgeY > H + 220) return;
    const n = 36;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = (W * i) / n;
      const w1 = Math.sin(x * 0.0055 + t * 1.35) * 30;
      const w2 = Math.sin(x * 0.021 - t * 2.05 + i * 0.7) * 14;
      const j = (L.h3(i, 3, sd('foamJ')) - 0.5) * 22;
      pts.push([x, edgeY + w1 + w2 + j]);
    }
    const bottom = H + 240;
    const path = new Path2D();
    path.moveTo(0, Math.max(-80, pts[0][1]));
    for (const [x, y] of pts) path.lineTo(x, Math.max(-80, y));
    path.lineTo(W, bottom);
    path.lineTo(0, bottom);
    path.closePath();
    ctx.save();
    const g = ctx.createLinearGradient(0, edgeY - 60, 0, edgeY + 260);
    g.addColorStop(0, P.foam);
    g.addColorStop(1, P.foamShade);
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    const cols = 30, rows = 9;
    for (let cx = 0; cx < cols; cx++) {
      const x = (W * (cx + 0.5)) / cols;
      const cs = sd('foamCell', cx);
      for (let ry = 0; ry < rows; ry++) {
        const y = edgeY - 50 + ry * 68 + (L.h3(cx, ry, cs) - 0.5) * 28;
        if (y < edgeY - 260 || y > bottom + 40) continue;
        const r = 24 + L.h3(cx, ry, cs + 1) * 20;
        ctx.beginPath();
        ctx.fillStyle = (ry + cx) % 2 === 0 ? P.foam : P.foamShade;
        ctx.globalAlpha = 0.5;
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = L.rgba(P.foamShade, 0.7);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = L.rgba(P.gloss, 0.35);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // bubbles popping off the drained edge and drifting up
    for (let i = 0; i < 26; i++) {
      const cs = sd('pop', i);
      const px = L.h3(i, 1, cs) * W;
      const cycle = 0.55 + L.h3(i, 2, cs) * 0.5;
      const phase = L.h3(i, 3, cs);
      const local = ((t / cycle + phase) % 1 + 1) % 1;
      const py = edgeY - local * 95;
      if (py < -20 || py > H + 20) continue;
      const alpha = (1 - local) * 0.85;
      const r2 = 3 + L.h3(i, 4, cs) * 6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = P.foam;
      ctx.beginPath();
      ctx.arc(px, py, r2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.gloss;
      ctx.beginPath();
      ctx.arc(px - r2 * 0.3, py - r2 * 0.3, Math.max(0.6, r2 * 0.3), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const dur = info.dur;
      const W = FILM.W, H = FILM.H;
      const Tg = info.T;

      // --- timing (local t: 0 = T 6.0, 1.0 = T 7.0, 2.0 = T 8.0, 2.5 = T 8.5) ---
      const drainP = L.clamp(t / 1.0);                    // T 6.0 -> 7.0: the curtain drains
      const pourP = L.clamp((t - 1.0) / 1.0);              // T 7.0 -> 8.0: the last pour
      const closeP = L.clamp((t - 2.0) / 0.5);             // T 8.0 -> 8.5: tap closes, settles

      const fill = L.lerp(0.55, 0.88, L.clamp(t / 2.0));
      let foamAmt;
      if (t < 1.0) foamAmt = L.lerp(0.5, 0.62, L.ease.outSine(drainP));
      else if (t < 2.0) foamAmt = L.lerp(0.62, 1.32, L.ease.outSine(pourP));
      else foamAmt = L.lerp(1.32, 1.0, L.ease.outCubic(closeP));

      let flow;
      if (t < 1.0) flow = 0;
      else if (t < 1.0 + 3 * FR) flow = L.clamp((t - 1.0) / (3 * FR));
      else if (t < 2.0) flow = 1;
      else flow = L.lerp(1, 0, L.clamp(closeP / 0.55));
      const pull = flow;

      const camP = L.ease.outCubic(L.clamp(t / dur));
      const zoom = L.lerp(0.97, 1.0, camP);

      // 1-5: hall, bunting, garland, tap, mug, sparkle, ambient bubbles — under the push-in
      L.camera(ctx, { x: W / 2, y: H / 2, zoom }, () => {
        FILM.props.hallBack(ctx, { variant: 'counter', t: Tg, dim: 0 });
        FILM.props.bunting(ctx, 40, 120, 1880, 120, 70, { t: Tg, seed: sd('bunt') });
        FILM.props.garland(ctx, 70, 236, 1850, 236, 40, { t: Tg, glow: 1, seed: sd('gar') });
        FILM.props.tap(ctx, 960, 190, 300, { flow, flowTo: 335, pull, t: Tg, seed: sd('tap') });
        FILM.props.mug(ctx, 960, 900, 520, {
          fill, foam: foamAmt, logo: true, bubbles: true, t: Tg, line: 'hero', seed: sd('mug'),
        });
        if (t >= 2.0 && t < 2.5) FILM.props.sparkle(ctx, 905, 425, 62, L.clamp((t - 2.0) / 0.5));
        FILM.props.bubbles(ctx, sd('amb'), Tg, { x: 220, y: 210, w: 1480, h: 600 }, { count: 7, speed: 0.5, size: [5, 12], alpha: 0.35 });
        // 6: the receding foam curtain, drawn last so it covers everything beneath while draining
        if (drainP < 1) drawFoamCurtain(ctx, L.lerp(0, H + 260, L.ease.inOutCubic(drainP)), Tg);
      });

      // 7: caption, screen-fixed (never rides the camera), pops on T 7.0
      if (t >= 1.0) {
        const pop = L.clamp((t - 1.0) / (4 * FR));
        FILM.props.caption(ctx, '2 октября', 180, 760, 110, { align: 'left', style: 'white', pop });
        FILM.props.caption(ctx, 'Spaten House', 180, 880, 96, { align: 'left', style: 'gold', pop });
      }
    },
  });
})();
