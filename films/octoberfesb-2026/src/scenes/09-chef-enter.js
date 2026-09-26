// Shot 09 'chef-enter' — illustrated, T 16.0-18.5 (global), shot-local t 0..2.5.
// Handoff: 08 -> 09 is a hard cut (no shared geometry to match).
// Handoff: 09 -> 10 is a hard cut, but the chef's salsa keeps counting from the same clock
// (both files drive FILM.cast.chef's 'salsa' pose from info.T - 17.5) so the step does not jump.
//
// Layers back to front:
//   1. Hall background (door variant), the room dimmed from the very first frame.
//   2. The spotlight cone from top-left onto the doorway (storyboard: opening x 690-1230, floor y 880).
//   3. The chef (hero line), framed in the doorway: a head-gleam flare with its star sparkle
//      (T 16.25, handled by FILM.cast.chef's own o.gleam), ties the bandana on 8ths (T 16.5-17.5),
//      then two salsa steps with a grin to camera (T 18.0).
//   4. Foreground: two teammates at the tables' edge, turning to look toward the doorway.
//   5. A soft vignette (dark at the edges, clear over the spotlight) that reads the foreground
//      teammates as near-silhouettes without a second (masked) draw pass.
// Camera: a slow 1.00 -> 1.08 push-in on the chef.
(function () {
  'use strict';
  const FILM = window.FILM;
  const ID = 'chef-enter';

  // --- staging (storyboard 09; door variant opening x 690-1230, floor y 880) ---------------------
  const CHEF_X = 960, CHEF_Y = 1000, CHEF_H = 820;
  const SPOT_X0 = 420, SPOT_Y0 = 30, SPOT_X1 = 960, SPOT_Y1 = 880, SPOT_W = 640;

  // --- timing (shot-local seconds; T = 16.0 + t) --------------------------------------------------
  const T_GLEAM = 0.25;     // T 16.25: head gleam flare + star sparkle
  const GLEAM_LIFE = 0.55;
  const TIE_START = 0.5;    // T 16.5: pulls the bandana out and starts tying
  const TIE_END = 1.5;      // T 17.5: bandana on, dancing starts
  const GRIN_AT = 2.0;      // T 18.0: grin to camera
  const GRIN_WIN = 0.16;

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const tw = L.onTwos(t); // characters animate on twos
      const Tg = info.T;
      const W = FILM.W, H = FILM.H;
      const CAST = FILM.cast, PROPS = FILM.props;

      const zoom = L.lerp(1.0, 1.08, L.ease.inOutSine(L.clamp(t / info.dur)));

      L.camera(ctx, { x: CHEF_X, y: 600, zoom }, () => {
        // 1. hall, dimmed the instant the shot starts ----------------------------------------
        PROPS.hallBack(ctx, { variant: 'door', dim: 0.82, t: Tg });

        // 2. the spotlight cone onto the doorway ----------------------------------------------
        PROPS.spotlight(ctx, SPOT_X0, SPOT_Y0, SPOT_X1, SPOT_Y1, SPOT_W, { alpha: 1 });

        // 3. the chef -----------------------------------------------------------------------
        // gleam is the sparkle's own 0..1 life: 0 outside the flare, sweeping through it once.
        const gleam = tw >= T_GLEAM && tw < T_GLEAM + GLEAM_LIFE ? L.clamp((tw - T_GLEAM) / GLEAM_LIFE) : 0;
        let pose, o = { line: 'hero', gleam };
        if (tw < TIE_START) {
          pose = { name: 'stand' };
          o.bandana = false; // bandana still in hand, not tied on yet
        } else if (tw < TIE_END) {
          pose = { name: 'tieBandana', k: L.clamp((tw - TIE_START) / (TIE_END - TIE_START)) };
        } else if (Math.abs(tw - GRIN_AT) < GRIN_WIN) {
          pose = { name: 'grin' };
        } else {
          pose = { name: 'salsa', t: Tg - 17.5 };
        }
        CAST.chef(ctx, CHEF_X, CHEF_Y, CHEF_H, pose, o);

        // 4. foreground teammates, silhouetted, turning to look toward the doorway -------------
        const TEAM = CAST.TEAM;
        const turnK = L.lerp(0.8, 0.42, L.ease.inOutSine(L.clamp(tw / info.dur)));
        CAST.person(ctx, TEAM[2], 130, 1130, 980, { name: 'turn', k: turnK }, {});
        CAST.person(ctx, TEAM[9], 1790, 1110, 960, { name: 'turn', k: turnK }, { flip: true });

        // 5. vignette: dark at the edges, clear over the spotlit doorway ------------------------
        // (tight enough that the foreground teammates, well outside r=0.85, read as near-silhouettes)
        const vg = ctx.createRadialGradient(CHEF_X, 560, 40, CHEF_X, 560, 900);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(0.4, 'rgba(0,0,0,0.05)');
        vg.addColorStop(0.65, 'rgba(0,0,0,0.4)');
        vg.addColorStop(0.85, 'rgba(0,0,0,0.8)');
        vg.addColorStop(1, 'rgba(0,0,0,0.93)');
        ctx.fillStyle = vg;
        ctx.fillRect(-400, -400, W + 800, H + 800);
      });
    },
  });
})();
