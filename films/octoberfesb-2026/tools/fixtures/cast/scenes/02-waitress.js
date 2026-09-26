// Cast sheet 2: the four waitresses side by side (Liesl walking with ten Maß and the hero mug,
// Resi with a knuckle plate, Vroni walking, Gretl clapping), face close-ups, Resi's serving arm.
FILM.scene({
  id: 'cast-waitress',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = FILM.cast;
    ctx.fillStyle = P.hallWarm;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = L.rgba(P.woodLight, 0.35);
    ctx.fillRect(0, 960, 1920, 120);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 22, weight: 700, align: 'center', color: P.outlineSoft });
    const h = 540, y = 925;
    const figs = [
      ['Liesl, walk', 'liesl', { name: 'walk', t: 0.25 }, { heroMug: true }, 250],
      ['Resi, plate', 'resi', { name: 'stand' }, { carry: 'plate', plate: 'knuckle' }, 720],
      ['Vroni, walk', 'vroni', { name: 'walk', t: 0 }, {}, 1200],
      ['Gretl, clap', 'gretl', { name: 'clap', t: 0.1 }, { carry: 'none' }, 1670],
    ];
    for (const [name, who, pose, o, x] of figs) {
      C.waitress(ctx, x, y, h, pose, Object.assign({ who, line: 'hero' }, o));
      label(name, x, 962);
    }
    // face close-ups (the same drawing at 1500 px)
    ['liesl', 'resi', 'vroni', 'gretl'].forEach((who, i) => {
      const x0 = 40 + i * 250;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, 20, 240, 320);
      ctx.fillStyle = L.rgba(P.hallDim, 0.08);
      ctx.fill();
      ctx.clip();
      const tall = { liesl: 1, resi: 0.96, vroni: 0.99, gretl: 1.06 }[who];
      C.waitress(ctx, x0 + 100, 175 + 1354 * tall, 1500, { name: 'stand' }, { who, carry: 'none', shadow: false });
      ctx.restore();
    });
    C.serveArm(ctx, 1480, 200, 0.55, { from: 0.15 });
    label('serveArm', 1480, 330);
  },
});
