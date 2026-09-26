// Shot 14 'lockup', T 30.5-36.0 (illustrated), the film's closing logo shot.
// Starts on G4 (13's full-frame mug) and pulls back to the full OktoberFESB 2026 lockup on a warm
// hall background, then builds it: wheat, hops, the word slammed in letter by letter, "2026", the
// Prost! sticker, the ribbon caption, a gloss sweep. Layers back to front:
//   1. warm hall background + bunting + garland + ambient bubbles, a mild independent pull-back
//   2. the lockup (mug, foam, wheat, hops, word, year), pulled back from G4 to its resting place
//   3. the Prost! sticker and the ribbon caption, screen-fixed
(function () {
  'use strict';
  const FILM = window.FILM;
  const ID = 'lockup';
  const LIB = FILM.lib;
  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;
  const clamp = LIB.clamp, lerp = LIB.lerp, E = LIB.ease;

  // G4 (13 end / 14 start), read off the mug's own logo anchor exactly as 13-mug-camera.js does:
  // the FESB logo lands at (960, 560) size 400 on 13's last frame.
  const G4 = (() => {
    const probe = FILM.props.mug(null, 0, 0, 1000, { alpha: 0 }); // pure geometry, draws nothing
    const yFrac = probe.logo[1] / 1000, sFrac = probe.logo[2] / 1000;
    const h = 400 / sFrac;
    return { x: 960, y: 560 - yFrac * h, h };
  })();

  // The lockup's resting place: centred (960, 455), smaller than the storyboard's 900 px tall and
  // 500 y so "2026" clears the safe area and the "Релиз FESB 9" ribbon below it (director's review:
  // the ribbon was covering the year).
  const LOCKUP_CX = 960, LOCKUP_CY = 455, LOCKUP_S = 0.88;
  // FILM.props.lockup returns the mug's own base centre and height for that placement; the camera
  // that opens on G4 and settles on the resting placement is solved from that anchor, so the two
  // mugs coincide exactly at T 30.5 without hand-copying either shot's numbers.
  const ANCHOR = FILM.props.lockup(null, LOCKUP_CX, LOCKUP_CY, LOCKUP_S, { alpha: 0 }).mug;
  const ZOOM0 = G4.h / ANCHOR.h;
  const CAM0 = { x: ANCHOR.x - (G4.x - 960) / ZOOM0, y: ANCHOR.y - (G4.y - 540) / ZOOM0, zoom: ZOOM0 };

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = clamp(tIn, 0, info.dur);
      const T = info.T;
      const W = info.W, H = info.H;

      const e = E.outCubic(clamp(t / 1.0, 0, 1)); // T 30.5-31.5 pull-back, then static
      const cam = { x: lerp(CAM0.x, 960, e), y: lerp(CAM0.y, 540, e), zoom: lerp(CAM0.zoom, 1, e) };
      const zoomBG = lerp(1.3, 1, e); // continues 13's background zoom back down to rest

      // 1. warm hall background, bunting, garland, ambient bubbles
      L.camera(ctx, { x: 960, y: 540, zoom: zoomBG }, () => {
        FILM.props.hallBack(ctx, { variant: 'hall', t: T, dim: 0 });
        FILM.props.bunting(ctx, -80, 128, 2000, 128, 46, { t: T, seed: sd('bunt') });
        FILM.props.garland(ctx, -80, 196, 2000, 196, 60, { t: T, seed: sd('gar') });
        FILM.props.bubbles(ctx, sd('ambient'), T, { x: 0, y: 0, w: W, h: H }, { count: 14, speed: 60, size: [6, 20], alpha: 0.8 });
      });

      // build values (docs/storyboard.md motion), each a plain 0..1 ramp: lockup applies its own
      // outBack / letter-slam / pop curves to whatever we hand it.
      const bR = clamp((t - 1.0) / 0.333);    // T 31.5: the white sticker rim
      const bW = clamp((t - 1.0) / 0.4167);   // T 31.5: wheat fans out
      const bH = clamp((t - 1.25) / 0.1667);  // T 31.75: hops pop
      const bWd = clamp((t - 1.5) / 0.5);     // T 32.0-32.5: the word slams in letter by letter
      const bY = clamp((t - 2.0) / 0.208);    // T 32.5: 2026 pops
      const sweep = t <= 3.5 || t >= 4.2 ? 0 : (t - 3.5) / 0.7; // T 34.0: gloss sweep

      // 2. the lockup itself, pulled back from G4 to its resting place
      L.camera(ctx, cam, () => {
        FILM.props.lockup(ctx, LOCKUP_CX, LOCKUP_CY, LOCKUP_S, {
          mug: 1, foam: 1, wheat: bW, hops: bH, word: bWd, year: bY, rim: bR, bubbles: 1,
          t, sweep, seed: sd('lockup'),
        });
      });

      // 3. the Prost! sticker and the ribbon caption: screen-fixed, never under the camera
      const popProst = clamp((t - 2.5) / 0.1667); // T 33.0
      if (popProst > 0.002) {
        FILM.props.caption(ctx, 'Prost!', 1500, 280, 105, { align: 'center', pop: popProst, rot: -0.14 });
      }
      const ribbon = clamp((t - 3.0) / 0.6); // T 33.5
      if (ribbon > 0.002) {
        FILM.props.caption(ctx, 'Релиз FESB 9', 960, 915, 70, { align: 'center', style: 'white', pop: ribbon, ribbon });
      }
    },
  });
})();
