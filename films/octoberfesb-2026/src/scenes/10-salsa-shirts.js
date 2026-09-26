// STUB
// Placeholder for shot 10 'salsa-shirts' (illustrated). The scene agent replaces this whole file.
FILM.scene({
  id: 'salsa-shirts',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal;
    const p = L.clamp(t / info.dur);
    const q = L.clamp(L.onTwos(t) / info.dur);
    const seed = L.hash('salsa-shirts');
    L.paper(ctx);
    const W = FILM.W, H = FILM.H, cx = W / 2;
    // captions sit above the safe bottom the gate enforces: a vertical frame keeps clear of the
    // Shorts UI, a square frame needs only a margin
    const safeBottom = H >= W * 1.5 ? H - 380 : H - 80;
    L.inkPath(ctx, L.ellipsePts(cx, H * 0.45, W * 0.28, H * 0.21, 72), { closed: true, width: 5, seed: seed + 1, double: true });
    L.inkLine(ctx, W * 0.13, H * 0.68, W * 0.87, H * 0.68, { width: 3, seed: seed + 2 });
    L.inkCircle(ctx, W * 0.22 + W * 0.56 * q, H * 0.64, 44, { width: 3, seed: seed + 3, fill: P.orange });
    L.text(ctx, 'STUB 10', cx, H * 0.17, { size: 60, weight: 600, align: 'center', color: P.annMagenta });
    L.text(ctx, info.shot.title || 'salsa-shirts', cx, safeBottom - 120, { size: 44, align: 'center', color: P.ink });
    L.text(ctx, 'salsa-shirts', cx, safeBottom - 70, { size: 30, align: 'center', color: P.inkSoft });
    if (p > 0.01) L.inkLine(ctx, W * 0.13, safeBottom - 20, W * 0.13 + W * 0.74 * p, safeBottom - 20, { width: 4, color: P.annBlue, seed: seed + 4, taper: 0 });
  },
});
