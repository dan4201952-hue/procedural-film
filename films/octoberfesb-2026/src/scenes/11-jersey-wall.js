// Shot 11 'jersey-wall' (illustrated), T 22.5-25.0 global, 2.5 s local.
// Layers back to front:
//   1. Hall background (dimmed) with bunting and garland.
//   2. Back row: eight teammates standing, x 200-1640.
//   3. Front row: seven teammates crouching in the gaps between the back row.
//   4. The chef at the right edge, arms crossed, nodding at T 24.5.
// Motion: T 22.5-23.0 everyone pulls a fesbBlue jersey on; T 23.0-24.0 a left-to-right turning
// wave, one column (a back-row man plus the front-row man ahead of him) per 16th note; T 24.0-25.0
// all hold while the "FESB 9" print on every back gleams in the same left-to-right order. A slight
// 1.00 -> 1.04 push-in runs the whole shot.
(function () {
  'use strict';
  const ID = 'jersey-wall';

  // --- formation geometry (art bible 10.3, 10.8; storyboard 11) --------------------------------
  const BACK_X0 = 200, BACK_X1 = 1640;
  const BACK_Y = 830, FRONT_Y = 1005;
  const REF_H = 580; // reference figure height before each spec's own `tall` multiplier
  const FRONT_REF_H = 455; // the front row is drawn smaller so neighbours' arms clear the print
  const CHEF_X = 1786, CHEF_Y = 830;

  // TEAM indices placed left to right; TEAM[0..3] (the four named teammates) land in visible
  // spots, the tallest (TEAM[0]) at back column 3 - one left of the formation's centre.
  const BACK_TEAM = [4, 5, 6, 0, 1, 7, 2, 8];
  const FRONT_TEAM = [9, 10, 3, 11, 12, 13, 14];

  // Timing (shot-local seconds; T = 22.5 + t).
  const PULLON_DUR = 0.5; // T 22.5-23.0
  const TURN_START = 0.5; // T 23.0
  const TURN_STEP = 0.125; // one 16th per column
  const TURN_DUR = 0.125; // ~3 frames per column
  const HOLD_START = 1.5; // T 24.0
  const HOLD_END = 2.5; // T 25.0
  const GLEAM_DUR = 0.35;
  const NOD_START = 2.0; // T 24.5
  const NOD_DUR = 0.35;

  let GEO = null;
  function geo() {
    if (GEO) return GEO;
    const TEAM = FILM.cast.TEAM;
    const backX = (j) => BACK_X0 + (j * (BACK_X1 - BACK_X0)) / 7;
    const slots = [];
    for (let j = 0; j < 8; j++) {
      slots.push({ row: 'back', col: j, x: backX(j), y: BACK_Y, spec: TEAM[BACK_TEAM[j]] });
      if (j < 7) {
        const fx = (backX(j) + backX(j + 1)) / 2;
        slots.push({ row: 'front', col: j, x: fx, y: FRONT_Y, spec: TEAM[FRONT_TEAM[j]] });
      }
    }
    // gleam order is simply left-to-right through the interleaved list above.
    GEO = { slots };
    return GEO;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const CAST = FILM.cast, PROPS = FILM.props;
      const W = FILM.W, H = FILM.H;
      const G = geo();

      L.camera(ctx, { x: W / 2, y: H / 2, zoom: 1 + 0.04 * (t / info.dur) }, () => {
        // 1. background --------------------------------------------------------------------
        PROPS.hallBack(ctx, { variant: 'hall', dim: 0.3, t: info.T });
        PROPS.bunting(ctx, -40, 130, W + 40, 130, 46, { t: info.T, seed: L.hash(ID, 'bunt') });
        PROPS.garland(ctx, -20, 178, W + 20, 178, 40, { t: info.T, seed: L.hash(ID, 'gar') });

        // 2 & 3. the team ---------------------------------------------------------------------
        const turnK = (col) => L.clamp((t - (TURN_START + TURN_STEP * col)) / TURN_DUR);
        const gleamK = (idx) => {
          const start = HOLD_START + (idx * (HOLD_END - HOLD_START - GLEAM_DUR)) / (G.slots.length - 1);
          return L.clamp((t - start) / GLEAM_DUR);
        };
        for (let i = 0; i < G.slots.length; i++) {
          const s = G.slots[i];
          const crouch = s.row === 'front';
          const refH = crouch ? FRONT_REF_H : REF_H;
          let pose, gleam = 0;
          if (t < PULLON_DUR) {
            pose = { name: 'pullOn', k: L.clamp(t / PULLON_DUR), crouch };
          } else {
            pose = { name: 'turn', k: turnK(s.col), crouch };
            if (t >= HOLD_START) gleam = gleamK(i);
          }
          CAST.person(ctx, s.spec, s.x, s.y, refH, pose, { outfit: 'jersey', gleam });
        }

        // 4. the chef, arms crossed, grinning, a single nod at T 24.5 --------------------------
        const nodK = L.clamp((t - NOD_START) / NOD_DUR);
        CAST.chef(ctx, CHEF_X, CHEF_Y, REF_H * CAST.CHEF_TALL, { name: 'nod', k: nodK }, {});
      });
    },
  });
})();
