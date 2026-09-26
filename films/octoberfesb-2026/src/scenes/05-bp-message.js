// STUB
// Placeholder for shot 05 'bp-message' (schematic). The scene agent replaces this whole file.
FILM.scene({
  id: 'bp-message',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal;
    const p = L.clamp(t / info.dur);
    L.blueprint(ctx);
    const W = FILM.W, H = FILM.H, cx = W / 2;
    // captions sit above the safe bottom the gate enforces: a vertical frame keeps clear of the
    // Shorts UI, a square frame needs only a margin
    const safeBottom = H >= W * 1.5 ? H - 380 : H - 80;
    L.guideCircle(ctx, cx, H * 0.45, W * 0.31, { alpha: 0.4 });
    L.glowDot(ctx, cx, H * 0.45, 10 + 8 * p, { rays: 12, rot: p * Math.PI });
    L.text(ctx, 'STUB 05', cx, H * 0.17, { size: 60, weight: 600, align: 'center', color: P.magenta });
    L.text(ctx, info.shot.title || 'bp-message', cx, safeBottom - 120, { size: 44, align: 'center', color: P.lavender });
    L.text(ctx, 'bp-message', cx, safeBottom - 70, { size: 30, align: 'center', color: P.lavender, alpha: 0.6 });
    ctx.fillStyle = P.lineWhite;
    ctx.fillRect(140, 1526, 800 * p, 6);
  },
});
