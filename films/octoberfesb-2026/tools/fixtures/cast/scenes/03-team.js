// Cast sheet 3. First half: all fifteen teammates standing, casual.
// Second half: the jersey team-photo formation from the back (8 standing, 7 crouching in the gaps)
// and the other poses: turn k=0.5, sit, cheer, catch, pullOn, reach with a mug.
FILM.scene({
  id: 'cast-team',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = FILM.cast, T = C.TEAM;
    ctx.fillStyle = P.hallWarm;
    ctx.fillRect(0, 0, 1920, 1080);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 20, weight: 700, align: 'center', color: P.outlineSoft });
    const shadow = (x, y, w) => {
      ctx.fillStyle = L.rgba(P.outline, 0.13);
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    if (t < 0.5) {
      for (let i = 0; i < 15; i++) {
        const x = 140 + i * 117, y = 470;
        shadow(x, y, 50);
        C.person(ctx, T[i], x, y, 360, { name: 'stand' }, {});
        label(T[i].id, x, 500);
      }
      // face close-ups (the same drawing at 1100 px): the first eight, then the last eight
      const first = t < 0.25 ? 0 : 7;
      for (let j = 0; j < 8; j++) {
        const s = T[first + j], x0 = 12 + j * 238;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 560, 230, 440);
        ctx.fillStyle = L.rgba(P.hallDim, 0.08);
        ctx.fill();
        ctx.clip();
        C.person(ctx, s, x0 + 115, 700 + 974 * s.tall, 1100, { name: 'stand' }, {});
        ctx.restore();
      }
      return;
    }
    // the formation from the back
    ctx.fillStyle = L.rgba(P.woodLight, 0.3);
    ctx.fillRect(0, 760, 1160, 320);
    for (let j = 0; j < 8; j++) C.person(ctx, T[j], 150 + j * 128, 780, 360, { name: 'back' }, { outfit: 'jersey' });
    for (let j = 0; j < 7; j++) C.person(ctx, T[8 + j], 214 + j * 128, 900, 370, { name: 'back', crouch: true }, { outfit: 'jersey' });
    label('formation from the back', 600, 130);
    // the other poses
    const sx = 1250, dx = 136;
    const top = [
      ['turn .5', T[1], { name: 'turn', k: 0.5 }, { outfit: 'jersey' }],
      ['turn .5 crouch', T[4], { name: 'turn', k: 0.5, crouch: true }, { outfit: 'jersey' }],
      ['cheer', T[2], { name: 'cheer' }, { outfit: 'jersey' }],
      ['catch .5', T[3], { name: 'catch', k: 0.5 }, {}],
    ];
    top.forEach(([n, s, pose, o], i) => {
      const x = sx + i * dx;
      shadow(x, 470, 55);
      C.person(ctx, s, x, 470, 330, pose, o);
      label(n, x, 500);
    });
    const bot = [
      ['catch 1', T[5], { name: 'catch', k: 1 }, { shirt: 'octo' }],
      ['pullOn .3', T[6], { name: 'pullOn', k: 0.3 }, {}],
      ['pullOn .7', T[7], { name: 'pullOn', k: 0.7 }, {}],
      ['reach, mug', T[9], { name: 'reach' }, { mug: { fill: 0.85, foam: 1 } }],
    ];
    top.push(['look', T[12], { name: 'look' }, { look: 0.8 }]);
    bot.forEach(([n, s, pose, o], i) => {
      const x = sx + i * dx;
      shadow(x, 960, 55);
      C.person(ctx, s, x, 960, 330, pose, o);
      label(n, x, 590);
    });
    // seated on a bench (y is the seat)
    const bx = sx + 4 * dx;
    ctx.fillStyle = P.woodLight;
    ctx.fillRect(bx - 70, 870, 140, 16);
    ctx.fillRect(bx - 60, 886, 12, 74);
    ctx.fillRect(bx + 48, 886, 12, 74);
    C.person(ctx, T[10], bx, 872, 330, { name: 'sit' }, {});
    label('sit', bx, 590);
  },
});
