// Cast sheet 4: the two t-shirt designs, front and back, flat and flying; the jersey back print.
FILM.scene({
  id: 'cast-shirts',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = FILM.cast;
    ctx.fillStyle = P.hallWarm;
    ctx.fillRect(0, 0, 1920, 1080);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 24, weight: 700, align: 'center', color: P.outlineSoft });
    const flat = [
      ['jersey front', 'jersey', 'front'],
      ['jersey back', 'jersey', 'back'],
      ['octo front', 'octo', 'front'],
      ['octo back', 'octo', 'back'],
    ];
    flat.forEach(([n, d, v], i) => {
      const x = 260 + i * 330;
      C.tshirt(ctx, x, 330, 290, { design: d, view: v, flap: 0 });
      label(n, x, 520);
    });
    // flying, sleeves flapping on twos
    const fly = [
      ['jersey', 'front', 0.25, -0.5],
      ['octo', 'front', 0.75, 0.4],
      ['jersey', 'back', 0.5, 0.9],
      ['octo', 'back', 0.0, -0.9],
    ];
    fly.forEach(([d, v, f, r], i) => {
      const x = 230 + i * 250, y = 760 + (i % 2) * 90;
      C.tshirt(ctx, x, y, 200, { design: d, view: v, flap: f, rot: r });
    });
    label('flying', 600, 600);
    // the back print alone, and with a gleam
    ctx.fillStyle = P.fesbBlue;
    ctx.fillRect(1330, 560, 520, 420);
    C.jerseyBack(ctx, 1470, 770, 190, {});
    C.jerseyBack(ctx, 1720, 770, 190, { gleam: 0.5 });
    label('jerseyBack, gleam .5', 1590, 600);
  },
});
