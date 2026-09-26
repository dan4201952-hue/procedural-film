/*
 * Shot 01 'office-night' — T 0.0 to 2.0 (global), illustrated.
 * The FESB office at night: a window wall of city lights at the back, three desks in a row at
 * middle depth, a big central monitor running a test suite that turns green row by row, two
 * teammates (TEAM[0], TEAM[3]) seen from behind at their desks. Slow push-in on the monitor.
 *
 * Layers, back to front:
 *   1. Night sky / office wash
 *   2. Window wall with city lights
 *   3. Big central monitor (bezel, glow, 8 test rows, stand + FESB sticker)
 *   4. Three desks (officeDesk), with a laptop, coffee mug and sticky notes
 *   5. Two teammates from behind, seated at their desks (waist up)
 *
 * Everything but the camera push lives inside FILM.lib.camera; there is no screen-fixed overlay.
 */
(function () {
  'use strict';
  const ID = 'office-night';
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

      // ---- local ink helper: closed shapes go through props.shape (LINE baked in); open
      // strokes go through lib.inkPath directly with LINE spread in. ----
      const ink = (pts, o = {}) =>
        L.inkPath(ctx, pts, Object.assign(
          { wobble: LINE.wobble, tremble: LINE.tremble, rough: LINE.rough, boilAmp: LINE.boilAmp, widthJitter: LINE.widthJitter, taper: LINE.taperOpen },
          o
        ));

      // pop-in helper: 0 before `a`, then an eased ramp over `frames` frames, visible ON the beat
      // frame itself (lead = 1), holding at 1 after — see reference/scene-anatomy.md.
      const hit = (a, frames = 3, e = E.outBack, lead = 1) =>
        t < a ? 0 : e(clamp((t - a) / (frames * FR) + lead / frames));

      // ===========================================================================
      // 1. Background wash
      // ===========================================================================
      ctx.save();
      ctx.fillStyle = P.officeNight;
      ctx.fillRect(0, 0, W, H);
      // a very subtle vertical gloom gradient, floor a touch darker
      const bgG = ctx.createLinearGradient(0, 0, 0, H);
      bgG.addColorStop(0, L.rgba(P.officeNight, 0));
      bgG.addColorStop(1, L.rgba('#05070F', 0.55));
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // Camera: static wide, slow push-in on the monitor centre over the whole shot.
      const MX0 = 700, MY0 = 260, MX1 = 1220, MY1 = 700;
      const monCx = (MX0 + MX1) / 2, monCy = (MY0 + MY1) / 2;
      const zoom = lerp(1.0, 1.06, clamp(t / info.dur));

      L.camera(ctx, { x: monCx, y: monCy, zoom }, () => {
        // ===========================================================================
        // 2. Window wall, city lights (background, y 0..250)
        // ===========================================================================
        (function windowWall() {
          ctx.save();
          const wy0 = 20, wy1 = 240;
          ctx.fillStyle = L.mix(P.officeNight, '#05060D', 0.4);
          ctx.fillRect(0, 0, W, wy1 + 30);
          const cols = 30;
          const cw = W / cols;
          for (let i = 0; i < cols; i++) {
            const h3 = L.h3(sd('win'), i, 1);
            if (h3 < 0.28) continue; // some windows dark
            const wx = i * cw + cw * 0.18;
            const ww = cw * 0.64;
            const rows = L.h3(sd('win'), i, 2) < 0.5 ? 2 : 3;
            const warm = L.h3(sd('win'), i, 3) < 0.6;
            const baseCol = warm ? P.bulb : P.screenGlow;
            const flick = 0.85 + 0.15 * Math.sin(t * (1.3 + h3) + i * 2.1);
            for (let r = 0; r < rows; r++) {
              const wh = (wy1 - wy0) / 3.4;
              const wyy = wy0 + r * (wh + 10);
              const a = (0.1 + 0.22 * L.h3(sd('win'), i, r + 10)) * flick;
              ctx.fillStyle = L.rgba(baseCol, a);
              ctx.fillRect(wx, wyy, ww, wh);
            }
          }
          // faint horizon glow
          const hg = ctx.createLinearGradient(0, wy1 - 40, 0, wy1 + 40);
          hg.addColorStop(0, L.rgba(P.bulb, 0.06));
          hg.addColorStop(1, L.rgba(P.bulb, 0));
          ctx.fillStyle = hg;
          ctx.fillRect(0, wy1 - 40, W, 80);
          ctx.restore();
        })();

        // ===========================================================================
        // 3. Big central monitor
        // ===========================================================================
        (function monitor() {
          const bw = MX1 - MX0, bh = MY1 - MY0;
          // soft glow behind the monitor
          ctx.save();
          const glowR = Math.max(bw, bh) * 0.75;
          const glow = ctx.createRadialGradient(monCx, monCy, 10, monCx, monCy, glowR);
          const pulse = 0.85 + 0.15 * Math.sin(t * 1.6);
          glow.addColorStop(0, L.rgba(P.screenGlow, 0.28 * pulse));
          glow.addColorStop(1, L.rgba(P.screenGlow, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(monCx, monCy, glowR, 0, TAU);
          ctx.fill();
          ctx.restore();

          // bezel
          const bez = L.rrectPts(MX0, MY0, bw, bh, 22, 20);
          const bezG = ctx.createLinearGradient(MX0, MY0, MX1, MY1);
          bezG.addColorStop(0, L.mix(P.officeDesk, P.gloss, 0.08));
          bezG.addColorStop(1, L.mix(P.officeDesk, '#000', 0.25));
          props.shape(ctx, bez, {
            fill: bezG, width: LINE.W.hero, color: P.outline, seed: sd('bezel'),
            gloss: [[MX0 + bw * 0.14, MY0 + bh * 0.1, bw * 0.22, 0.35, 5]],
          });

          // screen, inset
          const inset = 18;
          const sx0 = MX0 + inset, sy0 = MY0 + inset, sx1 = MX1 - inset, sy1 = MY1 - inset;
          const scrPts = L.rrectPts(sx0, sy0, sx1 - sx0, sy1 - sy0, 10, 16);
          ctx.save();
          ctx.beginPath();
          L.tracePath(ctx, scrPts, true);
          ctx.closePath();
          const scrG = ctx.createLinearGradient(sx0, sy0, sx0, sy1);
          scrG.addColorStop(0, '#0A0E1E');
          scrG.addColorStop(1, '#050711');
          ctx.fillStyle = scrG;
          ctx.fill();
          ctx.clip();

          // 8 test rows
          const rows = 8, gap = 8, mTop = 14, mBot = 14, mSide = 20;
          const rowsH = (sy1 - sy0) - mTop - mBot;
          const rowH = (rowsH - (rows - 1) * gap) / rows;
          const barX0 = sx0 + mSide + rowH * 1.15;
          const barX1 = sx1 - mSide;
          for (let k = 0; k < rows; k++) {
            const ry = sy0 + mTop + k * (rowH + gap);
            const cy = ry + rowH / 2;
            const cx = sx0 + mSide + rowH * 0.5;
            const a = 0.25 * k; // beat time, global T == local t here (shot starts at T 0)

            // code-line bar (static placeholder, no literal text)
            const barH = Math.max(6, rowH * 0.42);
            const barPts = L.rrectPts(barX0, cy - barH / 2, barX1 - barX0, barH, barH / 2, 10);
            ctx.beginPath();
            L.tracePath(ctx, barPts, true);
            ctx.closePath();
            ctx.fillStyle = L.rgba(P.codeLine, 0.22 + 0.06 * L.h3(sd('rowlen'), k, 1));
            ctx.fill();
            // a shorter accent segment for variety
            const segW = (barX1 - barX0) * lerp(0.3, 0.7, L.h3(sd('rowlen'), k, 2));
            ctx.fillStyle = L.rgba(P.codeLine, 0.14);
            ctx.fillRect(barX0, cy + barH / 2 + 3, segW, Math.max(2, barH * 0.28));

            // base grey circle (always present)
            const rad = rowH * 0.36;
            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0, TAU);
            ctx.fillStyle = L.mix(P.officeDesk, P.gloss, 0.12);
            ctx.fill();
            ctx.lineWidth = Math.max(1.5, rad * 0.18);
            ctx.strokeStyle = L.rgba(P.outline, 0.7);
            ctx.stroke();

            // pass state: green fill + white tick, popping with outBack
            const pop = hit(a, 3);
            if (pop > 0.002) {
              ctx.save();
              ctx.translate(cx, cy);
              ctx.scale(pop, pop);
              ctx.beginPath();
              ctx.arc(0, 0, rad, 0, TAU);
              const pg = ctx.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.15, 0, 0, rad);
              pg.addColorStop(0, L.mix(P.pass, P.gloss, 0.45));
              pg.addColorStop(1, P.pass);
              ctx.fillStyle = pg;
              ctx.fill();
              ctx.strokeStyle = P.outline;
              ctx.lineWidth = Math.max(1.3, rad * 0.14);
              ctx.stroke();
              // tick
              ctx.strokeStyle = P.gloss;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.lineWidth = Math.max(1.6, rad * 0.26);
              ctx.beginPath();
              ctx.moveTo(-rad * 0.42, 0.02 * rad);
              ctx.lineTo(-rad * 0.1, rad * 0.36);
              ctx.lineTo(rad * 0.48, -rad * 0.38);
              ctx.stroke();
              ctx.restore();
            }
          }
          ctx.restore(); // clip

          // monitor stand + FESB sticker
          const standW = 160, standTop = MY1, standBot = MY1 + 58;
          props.shape(ctx, [
            [monCx - standW * 0.22, standTop], [monCx + standW * 0.22, standTop],
            [monCx + standW * 0.5, standBot], [monCx - standW * 0.5, standBot],
          ], { fill: L.mix(P.officeDesk, '#000', 0.2), width: LINE.W.secondary, color: P.outline, seed: sd('stand') });
          props.fesbLogo(ctx, monCx, standTop + 26, 34, { outline: true });
        })();

        // ===========================================================================
        // 4 + 5. Desks and the two teammates
        // ===========================================================================
        const deskTop = 800, deskBot = 962;
        const deskW = 380, deskGap = 40;
        const deskX0 = (W - (deskW * 3 + deskGap * 2)) / 2;
        const deskCX = [deskX0 + deskW / 2, deskX0 + deskW * 1.5 + deskGap, deskX0 + deskW * 2.5 + deskGap * 2];

        function desk(cx, hasPerson, seedK) {
          const x0 = cx - deskW / 2, x1 = cx + deskW / 2;
          // chair back, behind the desk edge
          if (hasPerson) {
            const chW = deskW * 0.34;
            props.shape(ctx, L.rrectPts(cx - chW / 2, deskTop - 168, chW, 150, 16, 10), {
              fill: L.mix(P.officeDesk, '#000', 0.12), width: LINE.W.secondary, color: P.outline, seed: sd('chair', seedK),
            });
          }
          // desk front panel
          const panelG = ctx.createLinearGradient(x0, deskTop, x0, deskBot);
          panelG.addColorStop(0, L.mix(P.officeDesk, P.gloss, 0.12));
          panelG.addColorStop(1, L.mix(P.officeDesk, '#000', 0.3));
          props.shape(ctx, L.rrectPts(x0, deskTop, deskW, deskBot - deskTop, 14, 14), {
            fill: panelG, width: LINE.W.secondary, color: P.outline, seed: sd('desk', seedK),
            shade: { color: L.rgba('#000', 0.16), side: 'bottom', frac: 0.35 },
          });
          // desk top edge (thin highlight strip)
          props.shape(ctx, L.rrectPts(x0 - 6, deskTop - 12, deskW + 12, 16, 6, 10), {
            fill: L.mix(P.woodLight, P.officeDesk, 0.35), width: LINE.W.secondary, color: P.outline, seed: sd('deskTop', seedK),
          });
          // small laptop
          const lapX = cx - deskW * 0.28, lapY = deskTop - 12;
          props.shape(ctx, [[lapX - 46, lapY], [lapX + 46, lapY], [lapX + 40, lapY - 66], [lapX - 40, lapY - 66]], {
            fill: '#0B0E1A', width: LINE.W.detail, color: P.outline, seed: sd('lap', seedK),
          });
          ctx.save();
          ctx.fillStyle = L.rgba(P.codeLine, 0.5);
          for (let i = 0; i < 3; i++) ctx.fillRect(lapX - 30, lapY - 56 + i * 15, lerp(24, 52, L.h3(sd('lapcode', seedK), i, 1)), 5);
          ctx.restore();
          // coffee mug
          const mugX = cx + deskW * 0.3, mugY = deskTop - 16;
          props.shape(ctx, L.ellipsePts(mugX, mugY, 16, 20, 20), {
            fill: '#3A281C', width: LINE.W.detail, color: P.outline, seed: sd('mug', seedK), gloss: [[mugX - 5, mugY - 8, 6, 0.9, 3]],
          });
          ink([[mugX + 15, mugY - 6], [mugX + 25, mugY - 6], [mugX + 25, mugY + 4], [mugX + 15, mugY + 4]], { closed: false, width: LINE.W.detail, color: P.outline, seed: sd('mugh', seedK) });
          // sticky notes
          const notes = [P.confettiA, P.confettiC];
          for (let i = 0; i < notes.length; i++) {
            ctx.save();
            const nx = cx - deskW * 0.05 + i * 30, ny = deskTop - 20 - i * 4;
            ctx.translate(nx, ny);
            ctx.rotate((i === 0 ? -1 : 1) * 0.12);
            ctx.fillStyle = notes[i];
            ctx.fillRect(-14, -14, 28, 28);
            ctx.strokeStyle = L.rgba(P.outline, 0.6);
            ctx.lineWidth = 2;
            ctx.strokeRect(-14, -14, 28, 28);
            ctx.restore();
          }
        }

        desk(deskCX[0], true, 0);
        desk(deskCX[1], false, 1);
        desk(deskCX[2], true, 2);

        cast.person(ctx, cast.TEAM[0], deskCX[0], deskTop + 18, 520, { name: 'back' }, { upper: true, outfit: 'casual' });
        cast.person(ctx, cast.TEAM[3], deskCX[2], deskTop + 18, 520, { name: 'back' }, { upper: true, outfit: 'casual' });
      });
    },
  });
})();
