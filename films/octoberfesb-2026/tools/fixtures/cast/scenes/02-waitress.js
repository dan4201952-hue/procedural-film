// Cast sheet 2: the waitress walking (two phases) and standing, ten Maß, the hero mug in front.
FILM.scene({
  id: 'cast-waitress',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = FILM.cast;
    ctx.fillStyle = P.hallWarm;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = L.rgba(P.woodLight, 0.35);
    ctx.fillRect(0, 960, 1920, 120);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 24, weight: 700, align: 'center', color: P.outlineSoft });
    const h = 600, y = 955;
    const figs = [
      ['walk t=0 (contact)', { name: 'walk', t: 0 }, 360],
      ['walk t=0.25 (passing)', { name: 'walk', t: 0.25 }, 960],
      ['stand, hero mug', { name: 'stand' }, 1560],
    ];
    for (const [name, pose, x] of figs) {
      ctx.fillStyle = L.rgba(P.outline, 0.14);
      ctx.beginPath();
      ctx.ellipse(x, y, 150, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      C.waitress(ctx, x, y, h, pose, { line: 'hero', heroMug: true, t: pose.t || 0 });
      label(name, x, 340);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(1620, 20, 280, 280);
    ctx.fillStyle = L.rgba(P.hallDim, 0.1);
    ctx.fill();
    ctx.clip();
    C.waitress(ctx, 1760, 1385, 1400, { name: 'stand' }, { line: 'hero' });
    ctx.restore();
  },
});
