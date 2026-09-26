/*
 * 06-waitress.js : "Ten mugs across the hall" — T 10.0 to 12.5 (t 0 to 2.5), illustrated, hard cut.
 *
 * Layers back to front:
 *   1. Spaten House hall background (FILM.props.hallBack, variant 'hall'), panned by camX.
 *   2. Bunting and bulb garlands swagged across the ceiling (background depth, same pan as the hall).
 *   3. Resi, Vroni and Gretl crossing right-to-left at the back (~0.6 Liesl height), same pan.
 *   4. Middle-depth long tables with teammates (upper body only) turning heads to track Liesl.
 *   5. Liesl (hero waitress), screen-fixed: walks feet x 300 -> 1480, reaching G2 at T 12.25 and
 *      holding to the end (the exact match-cut frame that 07's blueprint continues from).
 *   6. Foreground table edge + pretzel, bottom-left, screen-fixed (closest plane).
 *
 * G2 (docs/storyboard.md): feet (1480, 1000), height 820, facing right, mug fans (1300,600) and
 * (1660,600). FILM.cast.waitress's FAN constants (180/820, 400/820) reproduce those fan centres
 * exactly for x=1480,y=1000,h=820, so no extra bookkeeping is needed for the hand-off to 07.
 */
(function () {
  'use strict';
  const ID = 'waitress';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const PR = FILM.props;
  const CAST = FILM.cast;

  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;
  const TAU2 = Math.PI * 2;

  // Background pan: matches FILM.props.hallBack's own camX handling (cast-api.md "Additions"):
  // the wall shifts by clamp(camX * 0.6, -480, 480) px. We reuse that exact formula for every prop
  // we place on the same background plane (bunting, garlands, tables, the back-crossing waitresses)
  // so everything pans together; Liesl and the foreground table stay screen-fixed.
  const BG_PAR = 0.6, BG_SHIFT_MAX = 480, CAMX_MAX = 620;

  let GEO = null;
  function geo(L) {
    if (GEO) return GEO;
    // ceiling swag segments (world x), several short spans read as real festoons rather than one dip
    const segs = [];
    for (let x = -300; x < 2450; x += 430) segs.push([x, Math.min(x + 430, 2450)]);
    // four long tables (world x centre), two teammates each, seen from the front across the table
    const tableX = [560, 1080, 1600, 2120];
    const tables = tableX.map((wx, i) => ({
      wx,
      y: 760,
      w: 470,
      mates: [0, 1].map((slot) => ({
        dx: slot === 0 ? -100 : 100,
        spec: CAST.TEAM[(sd('mate', i, slot) >>> 0) % CAST.TEAM.length],
        ph: ((sd('matePhase', i, slot) >>> 0) % 1000) / 1000,
      })),
      mugSeed: sd('tablemug', i),
    }));
    // Resi, Vroni and Gretl cross right to left at the back, staggered, above the tables' row
    const crossers = [
      { who: 'resi', carry: 'mugs', plate: null, x0: 1520, x1: -200, y: 680, ph: 0.1 },
      { who: 'vroni', carry: 'plate', plate: 'sausages', x0: 1740, x1: 30, y: 680, ph: 0.42 },
      { who: 'gretl', carry: 'plate', plate: 'pretzels', x0: 1960, x1: 260, y: 680, ph: 0.71 },
    ];
    // foam flecks kicked up on Liesl's footfall beats (T 10.0 .. 12.0, every 0.5 s)
    const flecks = [];
    for (let i = 0; i < 5; i++) {
      const t0 = i * 0.5;
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI * 0.5 + (LIB.h3(i, k, 1) - 0.5) * 2.1;
        const v = 60 + LIB.h3(i, k, 2) * 90;
        pts.push({ a, v, r: 2 + LIB.h3(i, k, 3) * 2.6 });
      }
      flecks.push({ t0, pts });
    }
    GEO = { segs, tables, crossers, flecks };
    return GEO;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, E = L.ease;
      const t = L.clamp(tIn, 0, info.dur);
      const clamp = L.clamp, lerp = L.lerp;
      const G = geo(L);
      const T = info.T;
      const tw = L.onTwos(t); // characters move on twos; the camera pan itself stays at 24 fps

      // ---- camera pan (background plane only; Liesl and the foreground stay screen-fixed) ----
      const camX = CAMX_MAX * E.outCubic(clamp(t / info.dur));
      const shift = clamp(camX * BG_PAR, -BG_SHIFT_MAX, BG_SHIFT_MAX);
      const bgX = (worldX) => worldX - shift;

      // ---- Liesl: screen-fixed walk, feet x 300 -> 1480, arriving on the 8th at T 12.25 ----
      const ARRIVE = 2.25; // T 12.25
      const feetX0 = 300, feetX1 = 1480;
      const walkP = E.outCubic(clamp(tw / ARRIVE));
      const lieslX = lerp(feetX0, feetX1, walkP);
      const walkClock = Math.min(tw, 2.0); // last footstep beat T 12.0; the last 0.25 s glides to a settled stance

      // =========================================================================
      // 1. hall background
      // =========================================================================
      PR.hallBack(ctx, { variant: 'hall', camX, dim: 0, t: T });

      // =========================================================================
      // 2. bunting and garlands across the ceiling — a static wide strip, cached once and panned
      // =========================================================================
      const DECO_X0 = -320, DECO_X1 = 2470, DECO_W = DECO_X1 - DECO_X0, DECO_H = 340;
      const deco = LIB.cached(['waitress-deco', info.S].join('|'), () => {
        const c = FILM.makeCanvas(Math.max(1, Math.round(DECO_W * info.S)), Math.max(1, Math.round(DECO_H * info.S)));
        const g = c.getContext('2d');
        g.scale(info.S, info.S);
        g.translate(-DECO_X0, 0);
        for (let i = 0; i < G.segs.length; i++) {
          const [x0, x1] = G.segs[i];
          PR.bunting(g, x0, 176, x1, 176, 42, { t: 0, seed: sd('bunt', i), line: 'background' });
        }
        for (let i = 0; i < G.segs.length; i++) {
          const [x0, x1] = G.segs[i];
          PR.garland(g, x0, 236, x1, 236, 60, { t: 0, seed: sd('garl', i), glow: 1 });
        }
        return c;
      });
      ctx.drawImage(deco, 0, 0, deco.width, deco.height, DECO_X0 - shift, 0, DECO_W, DECO_H);

      // =========================================================================
      // 3. Resi, Vroni and Gretl crossing at the back (~0.6 Liesl height)
      // =========================================================================
      const CROSS_H = 492; // 0.6 * 820
      for (const c of G.crossers) {
        const wx = lerp(c.x0, c.x1, clamp(tw / info.dur));
        const sx = bgX(wx);
        CAST.waitress(ctx, sx, c.y, CROSS_H, { name: 'walk', t: tw + c.ph }, {
          who: c.who, facing: -1, carry: c.carry, plate: c.plate || undefined, line: 'secondary',
        });
      }

      // =========================================================================
      // 4. middle-depth tables — a static wide strip, cached once and panned
      // =========================================================================
      const TAB_X0 = 300, TAB_X1 = 2380, TAB_W = TAB_X1 - TAB_X0, TAB_Y0 = 560, TAB_Y1 = 960, TAB_H = TAB_Y1 - TAB_Y0;
      const tablesImg = LIB.cached(['waitress-tables', info.S].join('|'), () => {
        const c = FILM.makeCanvas(Math.max(1, Math.round(TAB_W * info.S)), Math.max(1, Math.round(TAB_H * info.S)));
        const g = c.getContext('2d');
        g.scale(info.S, info.S);
        g.translate(-TAB_X0, -TAB_Y0);
        for (const tb of G.tables) {
          const table = PR.table(g, tb.wx, tb.y, tb.w, { bench: 'back', line: 'secondary', seed: tb.mugSeed });
          PR.mug(g, tb.wx + tb.w * 0.2, table.top, 92, { fill: 0.85, foam: 1.05, bubbles: true, t: 0, line: 'background', seed: tb.mugSeed });
        }
        return c;
      });
      ctx.drawImage(tablesImg, 0, 0, tablesImg.width, tablesImg.height, TAB_X0 - shift, TAB_Y0, TAB_W, TAB_H);

      // teammates ride the same pan as their table but are drawn fresh (their look tracks Liesl)
      const MATE_H = 600;
      for (const tb of G.tables) {
        const sx = bgX(tb.wx);
        for (const m of tb.mates) {
          const mx = sx + m.dx;
          const look = clamp((lieslX - mx) / 260, -1, 1);
          CAST.person(ctx, m.spec, mx, 1000, MATE_H, { name: 'stand', look }, { upper: true, outfit: 'casual', line: 'secondary' });
        }
      }

      // =========================================================================
      // 5. Liesl, screen-fixed hero, ten mugs, hero mug at the front of the right fan
      // =========================================================================
      CAST.waitress(ctx, lieslX, 1000, 820, { name: 'walk', t: walkClock }, {
        who: 'liesl', heroMug: true, facing: 1, line: 'hero',
      });

      // foam flecks kicked up on each footfall beat, at her current screen position
      for (const f of G.flecks) {
        const dt = t - f.t0;
        if (dt < 0 || dt > 0.4) continue;
        const life = clamp(dt / 0.4);
        const fx = lerp(feetX0, feetX1, E.outCubic(clamp(f.t0 / ARRIVE))) + 26;
        const fy = 1006;
        ctx.save();
        ctx.globalAlpha = 1 - life;
        ctx.fillStyle = P.foam;
        for (const pt of f.pts) {
          const px = fx + Math.cos(pt.a) * pt.v * dt;
          const py = fy + Math.sin(pt.a) * pt.v * dt + 260 * dt * dt;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.4, pt.r * (1 - life * 0.6)), 0, TAU2);
          ctx.fill();
        }
        ctx.restore();
      }

      // =========================================================================
      // 6. foreground table edge + pretzel, bottom-left, screen-fixed and identical every frame
      // =========================================================================
      const FG_W = 640, FG_H = 340;
      const fgImg = LIB.cached(['waitress-fg', info.S].join('|'), () => {
        const c = FILM.makeCanvas(Math.max(1, Math.round(FG_W * info.S)), Math.max(1, Math.round(FG_H * info.S)));
        const g = c.getContext('2d');
        g.scale(info.S, info.S);
        g.translate(0, -(1080 - FG_H));
        const fg = PR.table(g, -160, 1015, 900, { bench: 'none', line: 'hero', depth: 46, seed: sd('fgtable') });
        PR.pretzel(g, 130, fg.top - 4, 220, { rot: -0.08, line: 'hero', seed: sd('fgpretzel') });
        return c;
      });
      ctx.drawImage(fgImg, 0, 0, fgImg.width, fgImg.height, 0, 1080 - FG_H, FG_W, FG_H);
    },
  });
})();
