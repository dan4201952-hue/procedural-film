// Shot 10 'salsa-shirts' — illustrated, T 18.5-22.5 (global), shot-local t 0..4.0.
// Handoff: 09 -> 10 is a hard cut; the chef's salsa step keeps counting from info.T - 17.5 so it
// does not jump at the cut (09 drives the same pose from the same clock).
//
// Composition (director's note on the first cut, addressed here): the chef is the clear foreground
// hero, large (h 750, feet y 1030) and drawn last of the cast so nothing (table or teammate) ever
// overlaps him; the two long tables run left and right of him at a smaller, mid-depth scale, the
// fifteen teammates seated along them facing the aisle/camera; the waitresses stand grounded on
// table A's own floor line, behind it, so they read as standing at the back, not floating.
//
// Layers back to front:
//   1. Hall background ('hall' variant), full brightness, panning 0.6x with the foreground (its own
//      parallax, art bible 1.2's three depth layers) as the camera follows the chef.
//   2. Bunting + bulb garland across the ceiling.
//   3. The four waitresses, grounded on table A's floor line, clapping (its structure partly hides
//      their legs, so they read as standing at the back of the hall).
//   4. Table A (far, smaller): 8 teammates seated on its aisle-facing bench.
//   5. Table B (near-mid, larger): 7 teammates seated on its aisle-facing bench.
//   6. The crate stencilled with the FESB mark, at the chef's starting mark.
//   7. The chef (hero): dancing the salsa basic down the aisle (x 700 -> 1200) and throwing all
//      fifteen t-shirts, one per 8th. Drawn after every table and teammate so nothing overlaps him.
//   8. The fifteen t-shirts, on top of everything: in flight (parabolic arc, dashed gold motion
//      trail) or caught and hugged by their teammate.
// Camera: a slow pan following the chef (a plain horizontal translate; the background parallaxes
// under its own camX so no gap opens at the edges).
(function () {
  'use strict';
  const FILM = window.FILM;
  const ID = 'salsa-shirts';
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const sd = (...k) => FILM.lib.hash(ID, ...k) & 0x7fffffff;
  const FR = 1 / 24;

  // --- staging -------------------------------------------------------------------------------
  // The chef is the large foreground hero (director's note): feet near the bottom of the frame,
  // tall enough that the mid-depth tables (smaller, higher up) never compete with him for attention.
  const CHEF_X0 = 700, CHEF_X1 = 1200, CHEF_Y = 1030, CHEF_H = 750;
  // Two long tables at mid-depth, smaller than the chef, running the full width either side of
  // wherever he currently stands. Both benches are drawn with o.upper (person's documented idiom
  // for "people behind a table": cheap, no legs to solve, and they face the camera/aisle).
  const TABLE_A_X = 960, TABLE_A_Y = 440, TABLE_A_W = 2000, TABLE_A_LEGS = 110, TABLE_A_H = 190;
  const TABLE_B_X = 960, TABLE_B_Y = 640, TABLE_B_W = 2060, TABLE_B_LEGS = 150, TABLE_B_H = 260;
  const FLOOR_A = TABLE_A_Y + TABLE_A_LEGS;
  const FLOOR_B = TABLE_B_Y + TABLE_B_LEGS;
  // The waitresses stand just past table A's top edge and are drawn before it, so its own wood
  // panel (top to floor) hides their legs while their clapping arms clear it — grounded at the
  // back, not floating at chandelier height.
  const WAIT_Y = TABLE_A_Y + 40, WAIT_H = 190;
  const CRATE_X = 640, CRATE_Y = 1000, CRATE_W = 190;

  // --- timing (shot-local seconds; T = 18.5 + t) ----------------------------------------------
  const THROW_STEP = 0.25;              // one 8th at 120 bpm
  const N_THROWS = 15;
  const THROW_WIN = 0.18;               // the 'throw' pose pulse, centred on the release instant
  const CATCH_DUR = 0.3;                // arms-up -> hug, ending exactly on the catch beat
  const CATCH_SETTLE = 0.35;            // how long the hug is held before sitting back down
  const FLIGHT = 0.5;                   // one beat of flight, throw -> catch
  const APEX = 250;                     // px above the straight line, storyboard 10
  const HEAD_CLEAR = 120;               // the arc's peak clears at least this far above the bandana
  const EARLY_FRAMES = 4;               // draw the just-released shirt behind the chef for this long
  const EARLY_WIN = (EARLY_FRAMES * FR) / FLIGHT;
  const SPIN_START = 2.1, SPIN_END = 2.9; // T 20.6-21.4, bracketing the T 21.0 spin

  function throwTime(i) { return i * THROW_STEP; }       // t of release
  function catchTime(i) { return throwTime(i) + FLIGHT; } // t of catch

  // --- seating (pure geometry: x order across both benches decides throw order) ----------------
  let GEO = null;
  function geo() {
    if (GEO) return GEO;
    const TEAM = FILM.cast.TEAM;
    const seats = [];
    for (let j = 0; j < 8; j++) seats.push({ x: lerp(240, 1720, j / 7), table: 'A' });
    for (let j = 0; j < 7; j++) seats.push({ x: lerp(280, 1680, j / 6), table: 'B' });
    seats.sort((a, b) => a.x - b.x);
    seats.forEach((s, i) => {
      s.throwI = i;
      s.spec = TEAM[i];
      s.design = i % 2 === 0 ? 'jersey' : 'octo';
    });
    return (GEO = { seats });
  }

  // --- a crate stencilled with the FESB mark (no dedicated prop exists; built from FILM.props
  // primitives per scene-anatomy: "if a helper is missing, define it inside your own file") -------
  function drawCrate(ctx, L, P, x, y, w, seed) {
    const h = w * 0.6, lidBack = w * 0.16;
    const top = y - h, fl = x - w / 2, fr = x + w / 2;
    const b = L.boil(L.T);
    FILM.props.shape(ctx, [[fl - lidBack * 0.3, top - lidBack], [fr - lidBack * 0.3, top - lidBack], [fr, top], [fl, top]], {
      fill: P.woodLight, shade: { color: P.woodMid, side: 'right', frac: 0.3 }, width: 4, smooth: false, seed: seed + 1, boil: b,
    });
    FILM.props.shape(ctx, [[fl, top], [fr, top], [fr, y], [fl, y]], {
      fill: P.woodMid, shade: { color: P.woodDeep, side: 'right', frac: 0.26 }, width: 5, smooth: false, seed: seed + 2, boil: b,
    });
    ctx.save();
    ctx.strokeStyle = L.rgba(P.woodDeep, 0.55);
    ctx.lineWidth = Math.max(1.5, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(fl + w * 0.08, top); ctx.lineTo(fl + w * 0.08, y);
    ctx.moveTo(fr - w * 0.08, top); ctx.lineTo(fr - w * 0.08, y);
    ctx.stroke();
    ctx.restore();
    FILM.props.fesbLogo(ctx, x, top + h * 0.44, w * 0.46, { outline: true });
  }

  // Note: FILM.cast.person/waitress/chef are NOT sprite-cached here, even though they are the
  // costliest draws. Their ink wobble defaults to the *ambient* lib.boil(lib.T) whenever a call
  // does not pin an explicit boil (and person/waitress/chef do not expose one to pin) — caching
  // their pixels across frames would bake in whichever frame's ambient time happened to build the
  // cache first, which the determinism pass (cold vs. warm-forward vs. shuffled) catches as a
  // mismatch. Only FILM.props functions thread boil explicitly (see cachedLayer below), so only
  // those are safe to cache across frames.

  // --- a cached world-space layer: paints `make(g, boil)` into an offscreen canvas spanning world
  // x [x0,x1) once per (name, boil-phase, render scale), then every later frame is one drawImage.
  // Boil (12 fps) still cycles the ink wobble through its 3 phases; nothing else here is t-varying,
  // so this is the same trick hallBack already uses for its own background. -----------------------
  function cachedLayer(ctx, L, name, x0, x1, Tg, make) {
    const S = FILM.S || 1, HH = FILM.H, WW = x1 - x0;
    const b = ((L.boil(Tg) % 3) + 3) % 3;
    const c = L.cached(['salsa-shirts', name, b, S].join('|'), () => {
      const cv = FILM.makeCanvas(Math.max(1, Math.round(WW * S)), Math.max(1, Math.round(HH * S)));
      const g = cv.getContext('2d');
      g.scale(S, S);
      g.translate(-x0, 0);
      make(g, b);
      return cv;
    });
    ctx.drawImage(c, x0, 0, WW, HH);
  }

  // A quadratic-bezier arc through (x0,y0) -> control (apexY at u=0.5) -> (x1,y1): lets a throw pin
  // its peak to an explicit screen y (so it can be forced above the chef's head) rather than only
  // ever bulging a fixed amount above the straight line.
  const arcX = (x0, x1, u) => lerp(x0, x1, u);
  const arcY = (y0, apexY, y1, u) => (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * apexY + u * u * y1;

  // --- a dashed gold motion trail behind a flying shirt (storyboard 10: 2.5 px, 14 on 10 off,
  // fading over 6 frames once it lands) --------------------------------------------------------
  function drawTrail(ctx, P, x0, y0, x1, y1, apexY, uEnd, alpha) {
    if (alpha <= 0.01 || uEnd <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const u = (uEnd * i) / n;
      const px = arcX(x0, x1, u), py = arcY(y0, apexY, y1, u);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // --- the chef's actual right-hand anchor during a throw's release keyframe (pose 'throw', k 0.5),
  // as an offset from his own (x, y) base. The offset is a pure function of the pose and CHEF_H (no
  // ambient time involved), so it is computed once — via a throwaway canvas, since chef() has no
  // "anchors only" mode — and reused for every throw, on top of that throw's own world position.
  // This is what keeps every t-shirt leaving his hand instead of his chest or face. ------------------
  let HAND = null;
  function handAnchor(CAST) {
    if (HAND) return HAND;
    const cv = FILM.makeCanvas(4, 4);
    const r = CAST.chef(cv.getContext('2d'), 0, 0, CHEF_H, { name: 'throw', k: 0.5 }, { line: 'hero' });
    HAND = { dx: r.handR[0], dy: r.handR[1], headTopDy: r.head[1] - CHEF_H * 0.1 };
    return HAND;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const Tg = info.T;
      const CAST = FILM.cast, PROPS = FILM.props;
      const G = geo();

      // --- the chef's world position and the camera's slow, damped follow --------------------
      const travel = L.ease.inOutSine(t / info.dur);
      const chefX = lerp(CHEF_X0, CHEF_X1, travel);
      const panX = lerp(-90, 100, travel); // camera.x - 960; foreground pans by this, background by 0.6x

      // 1. hall background, parallaxing under its own camX -------------------------------------
      PROPS.hallBack(ctx, { variant: 'hall', camX: panX, dim: 0, t: Tg });

      ctx.save();
      ctx.translate(-panX, 0);

      // 2. the four waitresses, grounded on table A's floor line but drawn before its structure so
      //    the table's own wood panel hides their legs — standing at the back, not floating. --------
      const WHO = ['liesl', 'resi', 'vroni', 'gretl'];
      const WX = [460, 760, 1180, 1470];
      for (let i = 0; i < 4; i++) CAST.waitress(ctx, WX[i], WAIT_Y, WAIT_H, { name: 'clap', t: Tg }, { who: WHO[i], carry: 'none' });

      // 3. bunting + garland across the ceiling, plus both tables' structure (cached: see cachedLayer);
      //    table A's panel is drawn here, on top of the waitresses' legs from step 2. ----------------
      cachedLayer(ctx, L, 'furniture', -300, 2220, Tg, (g, b) => {
        PROPS.bunting(g, -260, 130, 2180, 130, 48, { seed: sd('bunt'), boil: b });
        PROPS.garland(g, -240, 178, 2160, 178, 42, { glow: 1, seed: sd('gar'), boil: b });
        PROPS.table(g, TABLE_A_X, TABLE_A_Y, TABLE_A_W, { depth: 20, legs: TABLE_A_LEGS, bench: 'front', seed: sd('tblA'), boil: b });
        PROPS.table(g, TABLE_B_X, TABLE_B_Y, TABLE_B_W, { depth: 28, legs: TABLE_B_LEGS, bench: 'front', seed: sd('tblB'), boil: b });
      });

      // helper: draws a seated teammate behind the table (o.upper: cheap, and the documented idiom
      // for "people behind a table") — idle until their catch window brings their arms up into a
      // hug, then back to idle for the rest of the shot.
      function drawSeat(s, floorY, h) {
        const cEnd = catchTime(s.throwI), cStart = cEnd - CATCH_DUR, cSettled = cEnd + CATCH_SETTLE;
        if (t < cStart || t >= cSettled) {
          CAST.person(ctx, s.spec, s.x, floorY, h, { name: 'stand' }, { upper: true });
        } else {
          const k = clamp01((t - cStart) / CATCH_DUR);
          CAST.person(ctx, s.spec, s.x, floorY, h, { name: 'catch', k }, { upper: true, shirt: s.design });
        }
      }

      // 4. both tables' seats — mid-depth, well clear of the chef's own foreground band -------------
      for (const s of G.seats) drawSeat(s, s.table === 'A' ? FLOOR_A : FLOOR_B, s.table === 'A' ? TABLE_A_H : TABLE_B_H);

      // 5. the crate at the chef's starting mark, at his feet in the foreground ----------------------
      drawCrate(ctx, L, P, CRATE_X, CRATE_Y, CRATE_W, sd('crate'));

      // helper: every throw's geometry — released from the chef's actual hand (handAnchor), the arc's
      // peak pinned at least HEAD_CLEAR above his bandana so it never crosses his head or torso.
      const H = handAnchor(CAST);
      const headTopY = CHEF_Y + H.headTopDy;
      function shirtGeom(s) {
        const ti = throwTime(s.throwI), tc = catchTime(s.throwI);
        if (t < ti || t > tc + 6 / 24) return null; // gone 6 frames after landing (trail fade window)
        const chefXi = lerp(CHEF_X0, CHEF_X1, L.ease.inOutSine(ti / info.dur));
        const x0 = chefXi + H.dx, y0 = CHEF_Y + H.dy;
        const x1 = s.x, y1 = (s.table === 'A' ? FLOOR_A - TABLE_A_H * 0.62 : FLOOR_B - TABLE_B_H * 0.62);
        const apexY = Math.min(lerp(y0, y1, 0.5) - APEX, headTopY - HEAD_CLEAR);
        return { ti, tc, u: clamp01((t - ti) / FLIGHT), x0, y0, x1, y1, apexY, design: s.design, throwI: s.throwI };
      }
      function drawFlying(g, alpha) {
        drawTrail(ctx, P, g.x0, g.y0, g.x1, g.y1, g.apexY, g.u, alpha);
        const px = arcX(g.x0, g.x1, g.u), py = arcY(g.y0, g.apexY, g.y1, g.u);
        const rot = g.u * Math.PI * 4 + ((sd('rot', g.throwI) % 1000) / 1000) * Math.PI * 2;
        const flap = (Tg * 6) % 1;
        CAST.tshirt(ctx, px, py, 170, { design: g.design, rot, flap, alpha, view: (Math.floor(g.u * 8) % 2) ? 'back' : 'front' });
      }

      // 6. the just-released shirt(s), for their first few frames only, drawn BEHIND the chef: right
      //    at release they are still close to his silhouette, so this — not geometry alone — is what
      //    guarantees nothing is ever seen lying across his face or chest. --------------------------
      for (const s of G.seats) {
        const g = shirtGeom(s);
        if (g && g.u < 1 && g.u < EARLY_WIN) drawFlying(g, 1);
      }

      // 7. the chef (hero): continuous salsa, punctuated by a throw pulse on every 8th, with a spin
      //    flourish woven in around T 21.0. Drawn after every table, teammate and the just-released
      //    shirt, so nothing else overlaps him. ------------------------------------------------------
      let chefPose = null;
      for (let i = 0; i < N_THROWS; i++) {
        const ti = throwTime(i);
        if (Math.abs(t - ti) <= THROW_WIN / 2) {
          chefPose = { name: 'throw', k: clamp01((t - (ti - THROW_WIN / 2)) / THROW_WIN) };
          break;
        }
      }
      if (!chefPose && t >= SPIN_START && t <= SPIN_END) {
        chefPose = { name: 'spin', k: clamp01((t - SPIN_START) / (SPIN_END - SPIN_START)) };
      }
      if (!chefPose) chefPose = { name: 'salsa', t: Tg - 17.5 };
      CAST.chef(ctx, chefX, CHEF_Y, CHEF_H, chefPose, { line: 'hero' });

      // 8. every other t-shirt in flight (past its first few frames, now well clear of him and above
      //    the tables), or fading after landing — drawn on top since they're clear of his silhouette --
      for (const s of G.seats) {
        const g = shirtGeom(s);
        if (!g) continue;
        if (g.u < 1) {
          if (g.u >= EARLY_WIN) drawFlying(g, 1);
        } else {
          const fadeAlpha = clamp01(1 - (t - g.tc) / (6 / 24));
          if (fadeAlpha > 0.01) drawTrail(ctx, P, g.x0, g.y0, g.x1, g.y1, g.apexY, 1, fadeAlpha);
        }
      }

      ctx.restore();
    },
  });
})();
