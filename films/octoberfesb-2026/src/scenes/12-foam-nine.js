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

  // --- the foam "9" (storyboard G3: centred 620,520, 620 px tall) ---------------------------------
  // An unmistakable numeral: a round CLOSED loop (width 0.85 x height) filling the top ~55% of the
  // 620 px box, and a tail that leaves the loop at its rightmost point and curves down and
  // slightly left to the baseline, staying outside the loop the whole way (never crossing back
  // above or through it). Director-reviewed polyline (script coordinates, y down):
  //   loop (ellipse, cx 620 cy 380, rx 145 ry 170), sampled every 30 deg from the top, CCW:
  //     (620,220) (547,243) (494,305) (475,380) (494,455) (547,517) (620,550)
  //     (693,517) (746,455) (765,380) (746,305) (693,243) -> closes back to (620,220)
  //   tail (cubic bezier from the loop's right point to the baseline):
  //     P0 (765,380) C1 (770,530) C2 (700,750) P1 (595,830)
  //     sampled: (765,380) (759,477) (738,579) (702,677) (653,759) (595,830)
  const NINE_CX = 620, NINE_CY = 520, NINE_STROKE = 70;
  const LOOP_CX = 620, LOOP_CY = 380, LOOP_RX = 145, LOOP_RY = 170;
  const TAIL_P0 = [LOOP_CX + LOOP_RX, LOOP_CY], TAIL_C1 = [770, 530], TAIL_C2 = [700, 750], TAIL_P1 = [595, 830];
  function bez(p0, c1, c2, p1, u) {
    const mu = 1 - u, a = mu * mu * mu, b = 3 * mu * mu * u, c = 3 * mu * u * u, d = u * u * u;
    return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]];
  }
  function arcLen(pts) {
    let total = 0;
    const S = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      S.push(total);
    }
    return { S, total };
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
    // the loop: a closed ellipse traced from the top, counter-clockwise (decreasing angle).
    const nLoop = 96;
    const loop = [];
    for (let i = 0; i <= nLoop; i++) {
      const a = (-90 - (i / nLoop) * 360) * DEG;
      loop.push([LOOP_CX + Math.cos(a) * LOOP_RX, LOOP_CY + Math.sin(a) * LOOP_RY]);
    }
    // the tail: a separate stroke leaving the loop's right side, curving down and left.
    const nTail = 48;
    const tail = [];
    for (let i = 0; i <= nTail; i++) tail.push(bez(TAIL_P0, TAIL_C1, TAIL_C2, TAIL_P1, i / nTail));
    const loopArc = arcLen(loop), tailArc = arcLen(tail);
    // sample points across both, for the completion sparkles.
    const allPts = loop.concat(tail.slice(1));
    GEO = {
      crowd, loop, tail, loopArc, tailArc, allPts,
      loopFrac: loopArc.total / (loopArc.total + tailArc.total),
      bbox: { x: NINE_CX - 260, y: NINE_CY - 310, w: 520, h: 620 },
    };
    return GEO;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function pointAtFrac(G, u) {
    const pts = G.allPts;
    const target = (G.loopArc.total + G.tailArc.total) * clamp01(u);
    // allPts is loop (arc-length G.loopArc) followed by tail (continuing past loopArc.total)
    if (target <= G.loopArc.total) {
      const S = G.loopArc.S;
      let i = 1;
      while (i < S.length - 1 && S[i] < target) i++;
      return pts[i];
    }
    const S = G.tailArc.S, rel = target - G.loopArc.total;
    let i = 1;
    while (i < S.length - 1 && S[i] < rel) i++;
    return pts[G.loop.length - 1 + i];
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

      // 3. the foam "9": the closed loop first (CCW from the top), then the tail --------------------
      const nineU = L.clamp((t - SPIN_START) / SPIN_DUR);
      if (nineU > 0) {
        const seed = L.hash(ID, 'nine');
        const loopU = L.clamp(nineU / G.loopFrac);
        const tailU = L.clamp((nineU - G.loopFrac) / (1 - G.loopFrac));
        const strokes = [
          { pts: G.loop, arc: G.loopArc, u: loopU, closed: true, seedBase: seed },
          { pts: G.tail, arc: G.tailArc, u: tailU, closed: false, seedBase: seed + 100 },
        ];
        for (const s of strokes) {
          if (s.u <= 0) continue;
          const draw = s.u, pts = s.pts;
          // faint dark edge so the glyph separates from the busy crowd behind it
          L.inkPath(ctx, pts, { closed: s.closed, width: NINE_STROKE + 12, color: P.outline, alpha: 0.28, seed: s.seedBase + 1, taper: [16, 16], smooth: true, draw, wobble: 1.6, tremble: 0.4 });
          // a thin gold/goldDeep edge peeking out from under the foam
          L.inkPath(ctx, pts, { closed: s.closed, width: NINE_STROKE + 6, color: P.goldDeep, seed: s.seedBase + 2, taper: [14, 14], smooth: true, draw, wobble: 1.8, tremble: 0.45 });
          // the uniform foam body
          L.inkPath(ctx, pts, { closed: s.closed, width: NINE_STROKE, color: P.foam, seed: s.seedBase, taper: [12, 12], smooth: true, draw, wobble: 1.8, tremble: 0.45, double: { width: 0.18, alpha: 0.25, seed: s.seedBase + 3 } });
          // a lighter core down the middle for volume
          L.inkPath(ctx, pts, { closed: s.closed, width: NINE_STROKE * 0.36, color: L.rgba(P.gloss, 0.6), seed: s.seedBase + 4, taper: [20, 40], smooth: true, draw, wobble: 1.2 });
        }
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
