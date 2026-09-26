/*
 * Shot 03 'release-beer' — T 4.0 to 6.0 (global), illustrated, cut in.
 * The big office monitor fills the frame. A progress bar labelled "Загрузка праздника..." fills
 * with beer 0 -> 100% (local t 0..1). At 100% (t 1.0) it tips up on its right end and becomes a
 * beer column; the beer then surges up the whole frame and a foam head overflows from the top
 * until, by the last frame, the entire frame is foam — the handoff to 04.
 *
 * Layers, back to front:
 *   1. Monitor bezel + screen (the office monitor of shots 01-02, now filling the frame)
 *   2. The progress bar: label, percentage, track, beer fill, foam cap, bubbles, tick gauge
 *   3. The bar's 90-degree tip about its right end (t >= 1.0)
 *   4. The full-frame flood: beer rises to cover the frame, then foam overflows from the top
 *      down until it covers everything
 */
(function () {
  'use strict';
  const ID = 'release-beer';
  const TAU = Math.PI * 2;
  const FR = 1 / 24;
  const FONT = '"Montserrat", "DejaVu Sans", sans-serif'; // Cyrillic-safe, matches FILM.props.caption

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const props = FILM.props;
      const LINE = props.LINE;
      const clamp = L.clamp, lerp = L.lerp, E = L.ease;
      const t = clamp(tIn, 0, info.dur);
      const W = info.W, H = info.H;

      const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;
      const ink = (pts, o = {}) =>
        L.inkPath(ctx, pts, Object.assign(
          { wobble: LINE.wobble, tremble: LINE.tremble, rough: LINE.rough, boilAmp: LINE.boilAmp, widthJitter: LINE.widthJitter, taper: LINE.taperOpen },
          o
        ));

      // ===========================================================================
      // 1. Monitor bezel + screen, full frame (art bible 10.7)
      // ===========================================================================
      const MX0 = 120, MY0 = 90, MX1 = 1800, MY1 = 990;
      ctx.save();
      ctx.fillStyle = '#05070D';
      ctx.fillRect(0, 0, W, H);
      const bez = L.rrectPts(MX0, MY0, MX1 - MX0, MY1 - MY0, 30, 24);
      const bezG = ctx.createLinearGradient(MX0, MY0, MX1, MY1);
      bezG.addColorStop(0, L.mix(P.officeDesk, P.gloss, 0.08));
      bezG.addColorStop(1, L.mix(P.officeDesk, '#000', 0.28));
      props.shape(ctx, bez, { fill: bezG, width: LINE.W.hero, color: P.outline, seed: sd('bezel') });
      const inset = 22;
      const sx0 = MX0 + inset, sy0 = MY0 + inset, sx1 = MX1 - inset, sy1 = MY1 - inset;
      const scr = L.rrectPts(sx0, sy0, sx1 - sx0, sy1 - sy0, 14, 20);
      ctx.save();
      ctx.beginPath();
      L.tracePath(ctx, scr, true);
      ctx.closePath();
      ctx.clip();
      const scrG = ctx.createLinearGradient(0, sy0, 0, sy1);
      scrG.addColorStop(0, '#0A0E1E');
      scrG.addColorStop(1, '#050711');
      ctx.fillStyle = scrG;
      ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
      // faint ambient glow, screen centre
      const glow = ctx.createRadialGradient(960, 540, 40, 960, 540, 900);
      glow.addColorStop(0, L.rgba(P.screenGlow, 0.1));
      glow.addColorStop(1, L.rgba(P.screenGlow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);

      // ===========================================================================
      // 2 + 3. Progress bar (phase A: fill 0->100%; phase B from t=1.0: tips 90 deg)
      // ===========================================================================
      const BX0 = 360, BY0 = 480, BX1 = 1560, BY1 = 600;
      const barW = BX1 - BX0, barH = BY1 - BY0;
      const pivotX = BX1, pivotY = (BY0 + BY1) / 2;
      const pctA = clamp(t / 1.0);
      const tipK = t < 1.0 ? 0 : clamp((t - 1.0) / (6 * FR));
      const tipAngle = -(Math.PI / 2) * E.outBack(tipK);

      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(tipAngle);
      ctx.translate(-pivotX, -pivotY);

      // label + percentage (fade out once the tip begins, they've done their job)
      const uiAlpha = t < 1.0 ? 1 : clamp(1 - (t - 1.0) / (3 * FR));
      if (uiAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = uiAlpha;
        L.text(ctx, 'Загрузка праздника…', (BX0 + BX1) / 2, BY0 - 40, {
          size: 56, weight: 800, align: 'center', color: '#F5F7FF', family: FONT,
        });
        const pct = Math.round(pctA * 100);
        L.text(ctx, pct + '%', BX1, BY0 - 40, { size: 52, weight: 800, align: 'right', color: P.beerLight, family: FONT });
        ctx.restore();
      }

      // track
      const trackPts = L.rrectPts(BX0, BY0, barW, barH, barH / 2, 14);
      ink(trackPts, { closed: true, width: LINE.W.hero, color: P.outline, seed: sd('track') });
      ctx.save();
      ctx.beginPath();
      L.tracePath(ctx, trackPts, true);
      ctx.closePath();
      ctx.fillStyle = L.rgba('#000', 0.35);
      ctx.fill();
      ctx.clip();

      // beer fill
      const fillX = BX0 + barW * pctA;
      if (pctA > 0.002) {
        const fg = ctx.createLinearGradient(0, BY0, 0, BY1);
        fg.addColorStop(0, P.beerLight);
        fg.addColorStop(1, P.beerDeep);
        ctx.fillStyle = fg;
        ctx.fillRect(BX0, BY0, fillX - BX0, barH);
        // carbonation, rising inside the fill
        ctx.save();
        ctx.beginPath();
        ctx.rect(BX0, BY0, fillX - BX0, barH);
        ctx.clip();
        for (let i = 0; i < 22; i++) {
          const r = L.rng(L.hash(sd('bub'), i));
          const bx = BX0 + r() * barW;
          if (bx > fillX) continue;
          const speed = lerp(60, 120, r());
          const travel = barH + 14;
          const by = BY1 - ((r() * travel + speed * t) % travel);
          const rad = lerp(2, 4.5, r());
          ctx.beginPath();
          ctx.arc(bx, by, rad, 0, TAU);
          ctx.fillStyle = L.rgba(P.gloss, 0.55);
          ctx.fill();
        }
        ctx.restore();
        // foam cap riding the leading edge
        const capR = barH * 0.62;
        ctx.beginPath();
        ctx.arc(fillX, BY0 + barH * 0.42, capR * 0.5, 0, TAU);
        ctx.fillStyle = P.foam;
        ctx.fill();
        ctx.strokeStyle = L.rgba(P.foamShade, 0.7);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore(); // fill clip

      // gauge ticks at each 10%, flashing as the fill passes
      for (let i = 1; i <= 9; i++) {
        const tx = BX0 + barW * (i / 10);
        const a = i / 10; // local t at which the fill reaches this tick
        const flash = t < a ? 0 : E.outBack(clamp((t - a) / (3 * FR) + 1 / 3));
        ctx.save();
        ctx.strokeStyle = L.rgba(P.outline, 0.35 + 0.45 * clamp(flash));
        ctx.lineWidth = 2 + 2 * clamp(flash);
        ctx.beginPath();
        ctx.moveTo(tx, BY0 + 10);
        ctx.lineTo(tx, BY1 - 10);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore(); // tip rotation

      ctx.restore(); // screen clip
      ctx.restore(); // outer

      // ===========================================================================
      // 4. Full-frame flood: beer surges up, then foam overflows top-down
      // ===========================================================================
      if (t >= 1.0) {
        const sBeer = clamp((t - 1.0) / 0.55);
        const beerTop = lerp(H + 40, -40, E.outCubic(sBeer));

        // a lumpy foam crown riding the rising beer surface (phase 1 flavour)
        const crownH = 70;
        const waveN = 10;
        const crownTop = [];
        for (let i = 0; i <= waveN; i++) {
          const x = lerp(0, W, i / waveN);
          const h3 = L.h3(sd('crown'), i, 0);
          const wob = Math.sin(t * 2.1 + i * 1.7 + h3 * TAU) * 10;
          crownTop.push([x, beerTop - crownH * 0.5 - crownH * 0.5 * h3 + wob]);
        }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, H + 40);
        ctx.lineTo(0, crownTop[0][1]);
        for (const p of crownTop) ctx.lineTo(p[0], p[1]);
        ctx.lineTo(W, H + 40);
        ctx.closePath();
        const beerG = ctx.createLinearGradient(0, beerTop, 0, H);
        beerG.addColorStop(0, P.beerLight);
        beerG.addColorStop(1, P.beerDeep);
        ctx.fillStyle = beerG;
        ctx.fill();
        // carbonation across the flood
        for (let i = 0; i < 46; i++) {
          const r = L.rng(L.hash(sd('flood-bub'), i));
          const bx = r() * W;
          const speed = lerp(50, 110, r());
          const travel = H + 60;
          let by = H - ((r() * travel + speed * t) % travel);
          if (by < beerTop + 10) continue;
          ctx.beginPath();
          ctx.arc(bx, by, lerp(2.5, 6, r()), 0, TAU);
          ctx.fillStyle = L.rgba(P.gloss, 0.5);
          ctx.fill();
        }
        // foam crown cap along the wavy top
        ctx.beginPath();
        ctx.moveTo(0, crownTop[0][1]);
        for (const p of crownTop) ctx.lineTo(p[0], p[1]);
        for (let i = waveN; i >= 0; i--) ctx.lineTo(crownTop[i][0], crownTop[i][1] + crownH * 0.75);
        ctx.closePath();
        ctx.fillStyle = P.foam;
        ctx.fill();
        ctx.restore();

        // stage 2: foam overflow, growing from the top down until it covers the whole frame
        if (t >= 1.55) {
          const s2 = clamp((t - 1.55) / 0.45);
          const foamFront = lerp(0, H + 40, E.outCubic(s2));
          const waveN2 = 14;
          const edge = [];
          for (let i = 0; i <= waveN2; i++) {
            const x = lerp(0, W, i / waveN2);
            const h3 = L.h3(sd('foamEdge'), i, 1);
            const wob = Math.sin(t * 1.6 + i * 2.3 + h3 * TAU) * 22 * (1 - s2 * 0.6);
            edge.push([x, foamFront + wob * (s2 < 0.98 ? 1 : 0)]);
          }
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, -40);
          ctx.lineTo(0, edge[0][1]);
          for (const p of edge) ctx.lineTo(p[0], p[1]);
          ctx.lineTo(W, -40);
          ctx.closePath();
          ctx.fillStyle = P.foam;
          ctx.fill();
          // foam cel-shade blobs, static per seed, scattered through the covered area
          ctx.clip();
          for (let i = 0; i < 90; i++) {
            const r = L.rng(L.hash(sd('foamblob'), i));
            const bx = r() * W, by = r() * (foamFront + 80) - 40;
            const rad = lerp(10, 34, r());
            ctx.beginPath();
            ctx.arc(bx, by, rad, 0, TAU);
            ctx.fillStyle = L.rgba(P.foamShade, 0.5);
            ctx.fill();
          }
          for (let i = 0; i < 40; i++) {
            const r = L.rng(L.hash(sd('foambub'), i));
            const bx = r() * W, by = r() * (foamFront + 80) - 40;
            ctx.beginPath();
            ctx.arc(bx, by, lerp(2, 5, r()), 0, TAU);
            ctx.fillStyle = L.rgba(P.gloss, 0.6);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    },
  });
})();
