// Props sheet: every FILM.props function on one 1920x1080 plate, animated by t so pops, bubbles,
// confetti, slosh and the stream move. Layout: bunting on top; mugs, blueprint mug, logos, lockup;
// captions; a garland; food, wheat, hops, table; a dark panel with the tap, a mug and the spotlight.
FILM.scene({
  id: 'props-sheet',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, Pr = FILM.props;

    ctx.fillStyle = P.hallWarm;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = L.rgba(P.woodMid, 0.25);
    ctx.fillRect(0, 700, 1920, 380);

    Pr.bunting(ctx, -10, 4, 1930, 4, 34, { size: 40, t });

    // --- mugs: hero with logo, sloshing and tilted, overflowing, empty, small flipped
    Pr.mug(ctx, 130, 420, 250, { logo: true, line: 'hero', bubbles: true, t, foam: 1.15 });
    Pr.mug(ctx, 395, 420, 180, { fill: 0.55, foam: 0.5, tilt: -0.22, slosh: 0.8, t, seed: 'b' });
    Pr.mug(ctx, 590, 420, 200, { fill: 0.95, foam: 1.4, bubbles: true, t, seed: 'c' });
    Pr.mug(ctx, 770, 420, 120, { fill: 0, foam: 0, seed: 'd' });
    Pr.mug(ctx, 890, 420, 90, { fill: 0.7, foam: 1, flip: true, tilt: 0.25, line: 'background', seed: 'e' });
    Pr.sparkle(ctx, 70, 200, 30, 0.3 + (t % 1) * 0.5);

    // --- blueprint panel with the line-art mug and the small line logo top-right
    ctx.save();
    ctx.beginPath();
    ctx.rect(960, 60, 370, 380);
    ctx.clip();
    L.blueprint(ctx, { x: 960, y: 60, w: 370, h: 380, grid: 30, seed: 9 });
    Pr.mug(ctx, 1110, 415, 230, { blueprint: true, logo: true, foam: 1.15, seed: 'bp' });
    Pr.fesbLogo(ctx, 1290, 105, 60, { lineArt: true });
    ctx.restore();

    // --- FESB logos: large, with outline, tiny
    Pr.fesbLogo(ctx, 1440, 170, 190);
    Pr.fesbLogo(ctx, 1395, 350, 80, { outline: true });
    Pr.fesbLogo(ctx, 1475, 350, 40, { outline: true });

    // --- the lockup
    Pr.lockup(ctx, 1720, 250, 0.4, { t, sweep: (t * 0.8) % 1 });

    // --- captions in every style
    Pr.caption(ctx, 'Релиз FESB 9', 40, 548, 88, { align: 'left', style: 'gold' });
    Pr.caption(ctx, '2 октября · Spaten House', 40, 650, 58, { align: 'left', style: 'white' });
    Pr.caption(ctx, 'Prost!', 1000, 560, 120, { style: 'gold', rot: -0.1, pop: Math.min(1, 0.4 + t * 2) });
    Pr.caption(ctx, 'FESB 9', 1000, 668, 64, { style: 'blue' });
    Pr.caption(ctx, 'OktoberFESB', 1500, 560, 100, { style: 'split' });
    Pr.caption(ctx, 'OktoberFESB', 1500, 668, 70, { style: 'split', letters: 0.55 + t * 0.3 });
    Pr.bubbles(ctx, 'sheet', t, { x: 1180, y: 440, w: 700, h: 270 }, { count: 12 });
    Pr.confetti(ctx, 'sheet', 0.45 + t, 820, 480, { count: 50, spread: 360 });

    Pr.garland(ctx, -10, 712, 1930, 712, 24, { t });

    // --- wheat, hops, food, table
    Pr.wheat(ctx, 50, 1066, 240, { rot: 0.08 });
    Pr.wheat(ctx, 100, 1066, 200, { rot: 0.38, bend: 6, seed: 'w2' });
    Pr.hops(ctx, 200, 1060, 120, {});
    Pr.knuckle(ctx, 420, 1066, 220, { line: 'hero', squash: t > 1.2 ? 0.8 : 0 });
    Pr.pretzel(ctx, 660, 1062, 120, {});
    Pr.sausages(ctx, 840, 1062, 110, {});
    const tb = Pr.table(ctx, 1130, 880, 440, { depth: 30, legs: 150, bench: 'both' });
    [1000, 1070, 1160, 1250].forEach((mx, i) => Pr.mug(ctx, mx, tb.top + 6, 64, { fill: 0.4 + i * 0.15, foam: 0.9, seed: 'tm' + i }));

    // --- dark panel: spotlight, tap pouring into a mug
    ctx.fillStyle = P.hallDim;
    ctx.fillRect(1390, 735, 530, 345);
    Pr.spotlight(ctx, 1420, 740, 1620, 1040, 330, {});
    const flow = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4));
    Pr.mug(ctx, 1790, 1062, 110, { fill: 0.5 + t * 0.2, foam: 0.8, bubbles: true, t, seed: 'tapmug' });
    Pr.tap(ctx, 1790, 800, 110, { flow, flowTo: 1062 - 110 * (0.12 + 0.6 * 0.88), t });
    Pr.sparkle(ctx, 1840, 900, 22, 0.45);
  },
});
