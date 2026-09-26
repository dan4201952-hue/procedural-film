// Cast sheet 1: the chef in every pose, plus his hand and beard edge from shot 02.
FILM.scene({
  id: 'cast-chef',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = FILM.cast;
    ctx.fillStyle = P.hallWarm;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = L.rgba(P.woodLight, 0.35);
    ctx.fillRect(0, 515, 1920, 20);
    ctx.fillRect(0, 1000, 1920, 80);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 22, weight: 700, align: 'center', color: P.outlineSoft });
    const shadow = (x, y, w) => {
      ctx.fillStyle = L.rgba(P.outline, 0.14);
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const h1 = 400, y1 = 515;
    const row1 = [
      ['stand', { name: 'stand' }],
      ['tieBandana .5', { name: 'tieBandana', k: 0.5 }],
      ['salsa 1', { name: 'salsa', t: 0 }],
      ['salsa 2', { name: 'salsa', t: 0.25 }],
      ['salsa 3', { name: 'salsa', t: 0.5 }],
      ['salsa 4', { name: 'salsa', t: 0.75 }],
    ];
    row1.forEach(([name, pose], i) => {
      const x = 140 + i * 250;
      shadow(x, y1, 90);
      C.chef(ctx, x, y1, h1, pose, { line: 'hero' });
      label(name, x, y1 + 32);
    });
    const h2 = 400, y2 = 990;
    const row2 = [
      ['spin .5', { name: 'spin', k: 0.5 }, {}],
      ['throw .5', { name: 'throw', k: 0.5 }, {}],
      ['raiseMug', { name: 'raiseMug', k: 1 }, { mug: { logo: true, fill: 0.88, foam: 1.15, bubbles: true } }],
      ['armsCrossed', { name: 'armsCrossed' }, {}],
      ['grin', { name: 'grin' }, { gleam: 0.8 }],
    ];
    row2.forEach(([name, pose, o], i) => {
      const x = 170 + i * 270;
      shadow(x, y2, 90);
      C.chef(ctx, x, y2, h2, pose, Object.assign({ line: 'hero' }, o));
      label(name, x, y2 - h2 - 12);
    });
    // shot 02 pieces: the hand in the hoodie sleeve pressing, the beard edge
    ctx.fillStyle = P.officeNight;
    ctx.fillRect(1500, 560, 420, 520);
    C.chefBeardEdge(ctx, 1710, 690, 300, {});
    C.chefHand(ctx, 1620, 960, 0.6, { press: 0 });
    C.chefHand(ctx, 1810, 960, 0.6, { press: 1 });
    label('hand, beard', 1640, 600);
    // a close-up of the face (the same drawing at 1500 px)
    ctx.save();
    ctx.beginPath();
    ctx.rect(1560, 20, 340, 480);
    ctx.fillStyle = L.rgba(P.hallDim, 0.1);
    ctx.fill();
    ctx.clip();
    C.chef(ctx, 1730, 1575, 1500, { name: 'stand' }, { line: 'hero', gleam: 0.3 });
    ctx.restore();
  },
});
