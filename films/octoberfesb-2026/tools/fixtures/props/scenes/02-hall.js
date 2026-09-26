// Spaten House: for the first quarter a full hall frame at full size (the cost test the cast API
// sets: hallBack + bunting + garlands + 2 tables + 20 mugs), then the three hallBack variants and a
// dimmed doorway with its spotlight, each at half size.
FILM.scene({
  id: 'props-hall',
  draw(ctx, t, info) {
    const L = info.lib, Pr = FILM.props;

    const hallFrame = (camX, tt) => {
      Pr.hallBack(ctx, { variant: 'hall', camX, t: tt });
      Pr.bunting(ctx, -40, 30, 980, 50, 80, { t: tt, seed: 'b1' });
      Pr.bunting(ctx, 940, 50, 1960, 30, 80, { t: tt, seed: 'b2' });
      Pr.garland(ctx, -20, 120, 1940, 130, 110, { t: tt, seed: 'g1' });
      Pr.garland(ctx, -20, 200, 1940, 190, 70, { t: tt, seed: 'g2' });
      const tables = [[520, 760, 780], [1420, 800, 820]];
      tables.forEach(([x, y, w], ti) => {
        const tb = Pr.table(ctx, x, y, w, { bench: 'both', seed: 'hall' + ti });
        for (let i = 0; i < 10; i++) {
          const mx = x - w / 2 + 50 + (i * (w - 100)) / 9;
          Pr.mug(ctx, mx, tb.top + 4 + (i % 2) * 6, 86, { fill: 0.5 + ((i * 37) % 40) / 100, foam: 0.7 + (i % 3) * 0.2, seed: 'hm' + ti + i, tilt: ((i % 3) - 1) * 0.05 });
        }
      });
      Pr.mug(ctx, 1760, 1150, 360, { line: 'hero', logo: true, foam: 1.2, bubbles: true, t: tt, seed: 'fg' });
    };

    if (t < 0.25) {
      hallFrame(0, t);
      return;
    }
    const quad = (qx, qy, fn) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(qx, qy, 960, 540);
      ctx.clip();
      ctx.translate(qx, qy);
      ctx.scale(0.5, 0.5);
      fn();
      ctx.restore();
    };
    quad(0, 0, () => {
      Pr.hallBack(ctx, { variant: 'counter', t });
      Pr.tap(ctx, 960, 190, 180, { flow: 0.7, flowTo: 470, t });
      Pr.mug(ctx, 960, 900, 520, { logo: true, line: 'hero', foam: 1.2, bubbles: true, t });
      Pr.caption(ctx, '2 октября', 180, 760, 110, { align: 'left', style: 'gold' });
      Pr.caption(ctx, 'Spaten House', 180, 880, 96, { align: 'left', style: 'white' });
    });
    quad(960, 0, () => hallFrame(300, t));
    quad(0, 540, () => {
      Pr.hallBack(ctx, { variant: 'door', dim: 0.7, t });
      Pr.spotlight(ctx, 200, -40, 960, 1000, 620, {});
    });
    quad(960, 540, () => {
      Pr.hallBack(ctx, { variant: 'hall', camX: -500, t, dim: 0.2 });
      Pr.lockup(ctx, 960, 450, 0.9, { t });
      Pr.caption(ctx, 'Prost!', 1480, 200, 110, { rot: 0.12 });
    });
    void L;
  },
});
