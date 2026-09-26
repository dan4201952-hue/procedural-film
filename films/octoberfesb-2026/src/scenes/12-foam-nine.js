// Shot 12 'foam-nine' (illustrated), T 25.0-28.0 global, 3.0 s local.
// Layers back to front:
//   1. Hall background (warm, busy) with bunting and garland.
//   2. The team, small, cheering along the back wall.
//   3. The foam "9" (G3: centred 620,520, 620 px tall, 70 px stroke), drawn stroke by stroke.
//   4. The chef, centre-right, with the hero mug: winds up, spins twice flinging the foam trail,
//      then raises the mug into the G3 pose, held to the end (handoff to 13).
//   5. The finished 9's gold flash and sparkles, screen-fixed.
// The chef's base position (feet 1010, centre x 1180, height 860) never moves: it already IS G3,
// so the 'raiseMug' pose (built from the same G3 constant in cast.js) lands the mug exactly on
// (1300, 330) at height 200 with no extra bookkeeping here.
(function () {
  'use strict';
  const ID = 'foam-nine';
  const DEG = Math.PI / 180;

  const CHEF_X = 1180, CHEF_Y = 1010, CHEF_H = 860;
  // The 'spin' pose's raised arm carries the mug well above head height; at the full G3 height
  // (860) that pushes it off the top of the frame, so the windup and the two spins are drawn at a
  // smaller height (verified against the frame with tools/verify) and only grow to the G3 hero
  // height while the mug comes down into its raised, on-camera position (RAISE_START on).
  const CHEF_H_SPIN = 600;
  const TEAM_Y = 660, TEAM_H = 380, TEAM_X0 = 250, TEAM_X1 = 1670;

  // Timing (shot-local seconds; T = 25.0 + t).
  const WINDUP_END = 0.5; // T 25.5
  const SPIN_START = 0.5, SPIN_END = 2.0; // T 25.5-27.0, two full turns
  const SPIN_DUR = SPIN_END - SPIN_START;
  const RAISE_START = 2.0, RAISE_DUR = 0.5; // T 27.0-27.5, then holds
  const FLASH_START = 2.0, FLASH_DUR = 0.4;

  // --- the foam "9" (storyboard G3) --------------------------------------------------------------
  const NINE_CX = 620, NINE_CY = 520, NINE_STROKE = 70;
  function bez(p0, c1, c2, p1, u) {
    const mu = 1 - u, a = mu * mu * mu, b = 3 * mu * mu * u, c = 3 * mu * u * u, d = u * u * u;
    return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]];
  }
  let GEO = null;
  function geo() {
    if (GEO) return GEO;
    const TEAM = FILM.cast.TEAM;
    // background row, small, spread along the back wall behind the chef.
    const crowd = [];
    for (let i = 0; i < TEAM.length; i++) {
      crowd.push({ spec: TEAM[i], x: TEAM_X0 + (i * (TEAM_X1 - TEAM_X0)) / (TEAM.length - 1), y: TEAM_Y });
    }
    // the numeral 9: a loop (bowl) traced counter-clockwise from the top, then a tail down.
    const bowlCx = NINE_CX + 14, bowlCy = NINE_CY - 128, R = 172;
    const startDeg = -98, sweepDeg = 332;
    const nLoop = 100;
    const pts = [];
    for (let i = 0; i <= nLoop; i++) {
      const u = i / nLoop;
      const a = (startDeg - u * sweepDeg) * DEG;
      pts.push([bowlCx + Math.cos(a) * R, bowlCy + Math.sin(a) * R]);
    }
    const p0 = pts[pts.length - 1];
    const tailEnd = [NINE_CX - 18, NINE_CY + 308];
    const c1 = [p0[0] + 34, p0[1] + 130];
    const c2 = [tailEnd[0] + 54, tailEnd[1] - 150];
    const nTail = 56;
    for (let i = 1; i <= nTail; i++) pts.push(bez(p0, c1, c2, tailEnd, i / nTail));
    // cumulative arc length, for placing sparkles/bubbles at a given reveal fraction.
    let total = 0;
    const S = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      S.push(total);
    }
    GEO = { crowd, ninePts: pts, nineS: S, nineLen: total, bbox: { x: NINE_CX - 260, y: NINE_CY - 310, w: 520, h: 620 } };
    return GEO;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function pointAtFrac(G, u) {
    const target = G.nineLen * clamp01(u);
    const S = G.nineS, pts = G.ninePts;
    let i = 1;
    while (i < S.length - 1 && S[i] < target) i++;
    return pts[i];
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const CAST = FILM.cast, PROPS = FILM.props;
      const W = FILM.W, H = FILM.H;
      const G = geo();

      // 1. background --------------------------------------------------------------------------
      PROPS.hallBack(ctx, { variant: 'hall', dim: 0.22, t: info.T });
      PROPS.bunting(ctx, -40, 130, W + 40, 130, 46, { t: info.T, seed: L.hash(ID, 'bunt') });
      PROPS.garland(ctx, -20, 178, W + 20, 178, 40, { t: info.T, seed: L.hash(ID, 'gar') });

      // 2. the team cheering at the back ---------------------------------------------------------
      for (let i = 0; i < G.crowd.length; i++) {
        const c = G.crowd[i];
        const ph = 0.35 + 0.65 * ((L.hash(ID, 'cheer', i) & 255) / 255);
        CAST.person(ctx, c.spec, c.x, c.y, TEAM_H, { name: 'cheer', t: t * ph + i }, { outfit: 'jersey' });
      }

      // 3. the foam "9", drawn stroke by stroke, loop first then the tail ------------------------
      const nineU = L.clamp((t - SPIN_START) / SPIN_DUR);
      if (nineU > 0) {
        const seed = L.hash(ID, 'nine');
        const iEnd = Math.max(2, Math.floor(nineU * (G.ninePts.length - 1)) + 1);
        const shown = G.ninePts.slice(0, iEnd + 1);
        // soft under-shadow for volume, then the foam body, a lighter core, then a gloss edge
        L.inkPath(ctx, shown, { closed: false, width: NINE_STROKE, color: P.foamShade, alpha: 0.55, seed: seed + 1, taper: [26, 18], smooth: true, draw: 1, wobble: 2.4, tremble: 0.6 });
        L.inkPath(ctx, shown, { closed: false, width: NINE_STROKE * 0.92, color: P.foam, seed, taper: [22, 16], smooth: true, draw: 1, wobble: 2.2, tremble: 0.55, double: { width: 0.22, alpha: 0.3, seed: seed + 2 } });
        L.inkPath(ctx, shown, { closed: false, width: NINE_STROKE * 0.34, color: L.rgba(P.gloss, 0.55), seed: seed + 3, taper: [30, 60], smooth: true, draw: 1, offset: 0, wobble: 1.6 });
        // gold bubbles, more of them as more foam has been laid down
        PROPS.bubbles(ctx, L.hash(ID, 'bub'), Math.max(0, t - SPIN_START), G.bbox, { count: Math.round(26 * nineU), speed: 0.9, size: [5, 16] });
      }

      // 4. the chef, holding the hero mug throughout ----------------------------------------------
      const spinRaw = L.clamp((t - SPIN_START) / SPIN_DUR) * 2;
      let pose, tilt = 0, slosh = 0, chefH = CHEF_H_SPIN;
      if (t < WINDUP_END) {
        const k = 0.12 * Math.sin(Math.PI * (t / WINDUP_END));
        pose = { name: 'spin', k };
      } else if (t < RAISE_START) {
        const k = spinRaw - Math.floor(spinRaw);
        pose = { name: 'spin', k };
        tilt = 0.32 * Math.sin(spinRaw * Math.PI * 2);
        slosh = 0.6 * Math.sin(spinRaw * Math.PI * 2);
      } else {
        const k = L.clamp((t - RAISE_START) / RAISE_DUR);
        pose = { name: 'raiseMug', k };
        chefH = L.lerp(CHEF_H_SPIN, CHEF_H, L.ease.inOutCubic(k));
      }
      CAST.chef(ctx, CHEF_X, CHEF_Y, chefH, pose, {
        mug: { fill: 0.85, foam: 1.05, logo: true, bubbles: true, tilt, slosh, t },
        bandana: true,
      });

      // 5. the finished 9 flashes gold and sparkles, screen-fixed ---------------------------------
      const flash = t >= FLASH_START ? L.clamp(1 - (t - FLASH_START) / FLASH_DUR) : 0;
      if (flash > 0) {
        ctx.save();
        const cx = NINE_CX + 14, cy = NINE_CY - 20;
        const r = 420;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, L.rgba(P.gold, 0.55 * flash));
        g.addColorStop(0.55, L.rgba(P.gold, 0.22 * flash));
        g.addColorStop(1, L.rgba(P.gold, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        for (let i = 0; i < 7; i++) {
          const u = (i + 0.5) / 7;
          const p = pointAtFrac(G, u);
          const k = L.clamp((t - FLASH_START - i * 0.035) / 0.4);
          const rr = 34 + 14 * ((L.hash(ID, 'spk', i) & 255) / 255);
          PROPS.sparkle(ctx, p[0], p[1], rr, k);
        }
      }
    },
  });
})();
