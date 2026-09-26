/*
 * Shot 02 'deploy' — T 2.0 to 4.0 (global), illustrated, cut in.
 * Close-up on the dark console: the chef's hand descends from the top of frame and presses the
 * glossy pass-green DEPLOY button at T 2.5 (beat, local t 0.5). A white ring bursts, confetti
 * flies, the out-of-focus monitor behind flips to "FESB 9 (check)", and the caption
 * "Релиз FESB 9" pops at T 3.0 (local t 1.0). Only the chef's hand and chin edge are ever shown.
 *
 * Layers, back to front:
 *   1. Dark console wash
 *   2. Out-of-focus monitor (soft placeholder bars -> crisp "FESB 9" pass check)
 *   3. DEPLOY button (squash on the press) + white ring burst
 *   4. The chef's hand descending and pressing
 *   5. The chef's chin / beard edge, top of frame
 *   6. Confetti
 *   7. Caption "Релиз FESB 9" (screen-fixed, on top)
 */
(function () {
  'use strict';
  const ID = 'deploy';
  const TAU = Math.PI * 2;
  const FR = 1 / 24;

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const props = FILM.props, cast = FILM.cast;
      const LINE = props.LINE;
      const clamp = L.clamp, lerp = L.lerp, E = L.ease;
      const t = clamp(tIn, 0, info.dur);
      const W = info.W, H = info.H;

      const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;
      const hit = (a, frames = 3, e = E.outBack, lead = 1) =>
        t < a ? 0 : e(clamp((t - a) / (frames * FR) + lead / frames));

      const BX = 960, BY = 700, BR = 150; // DEPLOY button, storyboard exact
      const B_PRESS = 0.5; // local t == global T 2.5

      // ===========================================================================
      // 1. Dark console wash
      // ===========================================================================
      ctx.save();
      const bgG = ctx.createRadialGradient(BX, BY - 100, 40, BX, BY - 100, 1300);
      bgG.addColorStop(0, '#141A2E');
      bgG.addColorStop(1, '#05070D');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, W, H);
      // a soft wash of room light spilling down from above, so the chef's dark beard silhouettes
      // against it instead of vanishing into the console's own near-black navy
      const topG = ctx.createLinearGradient(0, 0, 0, 330);
      topG.addColorStop(0, L.rgba(L.mix(P.officeDesk, P.gloss, 0.18), 0.9));
      topG.addColorStop(1, L.rgba(P.officeDesk, 0));
      ctx.fillStyle = topG;
      ctx.fillRect(0, 0, W, 330);
      ctx.restore();

      // camera: static, 4% kick-zoom on the press, settling over 6 frames (outCubic decay)
      const kzP = t < B_PRESS ? 0 : clamp((t - B_PRESS) / (6 * FR));
      const kz = t < B_PRESS ? 0 : 0.04 * (1 - E.outCubic(kzP));

      L.camera(ctx, { x: BX, y: BY, zoom: 1 + kz }, () => {
        // ===========================================================================
        // 2. Out-of-focus monitor behind, flips to FESB 9 check on the press
        // ===========================================================================
        (function monitor() {
          // offset to the right of the button/hand/beard column, so the hand resting on the
          // button through the rest of the shot never hides the "FESB 9" flip behind it
          const mx0 = 1080, my0 = 300, mx1 = 1620, my1 = 520;
          const mcx = (mx0 + mx1) / 2, mcy = (my0 + my1) / 2;
          // soft unfocused glow standing in for the blurred monitor (art bible: no blur filter)
          ctx.save();
          const g = ctx.createRadialGradient(mcx, mcy, 20, mcx, mcy, 520);
          g.addColorStop(0, L.rgba(P.screenGlow, 0.16));
          g.addColorStop(1, L.rgba(P.screenGlow, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(mcx, mcy, 520, 0, TAU);
          ctx.fill();
          ctx.restore();

          const flipK = t < B_PRESS ? 0 : clamp((t - B_PRESS) / (6 * FR) + 1 / 6);
          // pre-press: a few very soft, low-contrast bars (an out-of-focus code screen)
          if (flipK < 1) {
            ctx.save();
            ctx.globalAlpha = 0.35 * (1 - E.outCubic(flipK));
            for (let i = 0; i < 4; i++) {
              const yy = my0 + 40 + i * 42;
              ctx.fillStyle = L.rgba(P.codeLine, 0.5);
              ctx.beginPath();
              ctx.ellipse(mcx - 40 + i * 18, yy, 210 - i * 14, 12, 0, 0, TAU);
              ctx.fill();
            }
            ctx.restore();
          }
          // post-press: the monitor sharpens and flips to a big pass check
          if (flipK > 0) {
            const pop = E.outBack(flipK);
            ctx.save();
            ctx.globalAlpha = clamp(flipK * 2);
            ctx.translate(mcx, mcy);
            ctx.scale(1, clamp(pop, 0.05, 1.15));
            ctx.translate(-mcx, -mcy);
            const bez = L.rrectPts(mx0, my0, mx1 - mx0, my1 - my0, 18, 16);
            props.shape(ctx, bez, { fill: '#0A0E1E', width: LINE.W.secondary, color: P.outline, seed: sd('mon') });
            L.text(ctx, 'FESB 9', mcx - 24, mcy + 24, { size: 92, weight: 900, align: 'center', color: P.pass, family: '"Montserrat","DejaVu Sans",sans-serif' });
            // hand-drawn tick, echoing the test-row ticks of shot 01
            const tx = mcx + 190, ty = mcy;
            ctx.strokeStyle = P.pass;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(tx - 26, ty + 2);
            ctx.lineTo(tx - 6, ty + 24);
            ctx.lineTo(tx + 30, ty - 26);
            ctx.stroke();
            ctx.restore();
          }
        })();

        // ===========================================================================
        // 3. DEPLOY button, squash on the press, ring burst
        // ===========================================================================
        (function button() {
          // 12% squash for 2 frames, a half-sine bump centred on the press
          const dt = t - B_PRESS;
          const w = 2 * FR;
          const squash = dt >= 0 && dt < w ? 0.12 * Math.sin(Math.PI * (dt / w)) : 0;
          ctx.save();
          ctx.translate(BX, BY);
          ctx.scale(1 + squash * 0.45, 1 - squash);
          ctx.translate(-BX, -BY);
          const pts = L.ellipsePts(BX, BY, BR, BR, 80);
          const bg = ctx.createRadialGradient(BX - BR * 0.35, BY - BR * 0.4, BR * 0.15, BX, BY, BR * 1.05);
          bg.addColorStop(0, L.mix(P.pass, P.gloss, 0.5));
          bg.addColorStop(0.55, P.pass);
          bg.addColorStop(1, L.mix(P.pass, '#000', 0.35));
          props.shape(ctx, pts, {
            fill: bg, width: LINE.W.hero, color: P.outline, seed: sd('btn'),
            shade: { color: L.rgba('#000', 0.18), side: 'bottom', frac: 0.3 },
            gloss: [[BX - BR * 0.32, BY - BR * 0.42, BR * 0.5, -0.5, 26], [BX + BR * 0.2, BY - BR * 0.5, 0, 0, 14]],
          });
          L.text(ctx, 'DEPLOY', BX, BY + 20, { size: 58, weight: 900, align: 'center', color: '#0B3A22', family: '"Montserrat","DejaVu Sans",sans-serif' });
          ctx.restore();

          // white ring burst from the press
          if (t >= B_PRESS) {
            const ringP = clamp((t - B_PRESS) / 0.4);
            if (ringP < 1) {
              ctx.save();
              ctx.globalAlpha = 1 - ringP;
              ctx.strokeStyle = P.gloss;
              ctx.lineWidth = lerp(14, 2, ringP);
              ctx.beginPath();
              ctx.arc(BX, BY, lerp(BR, BR * 2.7, E.outCubic(ringP)), 0, TAU);
              ctx.stroke();
              ctx.restore();
            }
          }
        })();

        // ===========================================================================
        // 4. The chef's hand, descending and pressing
        // ===========================================================================
        (function hand() {
          const descP = clamp(t / B_PRESS);
          const fy = lerp(-90, BY - BR * 0.45, E.outQuad(Math.min(1, descP)));
          const fx = BX + 6;
          const pressAmt = t < B_PRESS ? 0 : clamp((t - B_PRESS) / (2 * FR));
          cast.chefHand(ctx, fx, fy, 1.5, { press: pressAmt, line: 'hero' });
        })();

        // ===========================================================================
        // 5. The chin edge, top of frame (only his chin and short beard, per art bible 10.1)
        // ===========================================================================
        cast.chefBeardEdge(ctx, 960, 190, 330, { line: 'hero' });

        // ===========================================================================
        // 6. Confetti, bursting from the button after the press
        // ===========================================================================
        props.confetti(ctx, sd('confetti'), t - B_PRESS, BX, BY - BR * 0.3, { count: 110, spread: 560, life: 3 });
      });

      // ===========================================================================
      // 7. Caption, screen-fixed, pops at T 3.0 (local t 1.0)
      // ===========================================================================
      const capT = 1.0;
      if (t >= capT) {
        const pop = clamp((t - capT) / (4 * FR) + 1 / 4);
        props.caption(ctx, 'Релиз FESB 9', 960, 330, 120, { align: 'center', style: 'split', pop });
      }
    },
  });
})();
