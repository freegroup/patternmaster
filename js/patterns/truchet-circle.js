// Truchet (circle) — a grid of cells, each filled with ONE fan of `strings` concentric quarter-arc
// grooves fanning out from one corner and reaching the opposite edges (a quarter "bullseye" that
// fills the cell). The corner is chosen per cell:
//   random    → one of the four corners from the seed (varied, woven look).
//   alternate → BL / TR in a checkerboard ((i+j) parity), which makes the fans join into
//               continuous diagonal ribbons — the flowing character, no full-circle bullseyes.
// Great with a V-bit. Self-contained (project rule).
//
//   one fan per cell (corner it sits in):
//   BL          BR          TL          TR
//   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
//   │╲ ╲ ╲   │  │   ╱ ╱ ╱│  │( ( (   │  │   ) ) )│
//   │( ( (   │  │   ) ) )│  │╲ ╲ ╲   │  │   ╱ ╱ ╱│
//   └────────┘  └────────┘  └────────┘  └────────┘
PM.registerPattern({
  id: 'truchet-circle', name: 'Truchet Circle',
  params: {
    cols:    { label: 'Columns', unit: '', type: 'number', default: 8, min: 1, max: 60, step: 1 },
    rows:    { label: 'Rows',    unit: '', type: 'number', default: 6, min: 1, max: 60, step: 1 },
    strings: { label: 'Strings per cell', unit: '', type: 'number', default: 6, min: 1, max: 40, step: 1 },
    padding: { label: 'Padding', unit: 'mm', type: 'number', default: 0, min: 0, max: 30, step: 0.5 },
    layout:  { label: 'Layout', type: 'select', default: 'random', options: [['random', 'Random'], ['alternate', 'Alternate']] },
    depth:   { label: 'Depth', unit: 'mm', type: 'range2', defaultA: 1, defaultB: 2, min: 0.05, max: 8, step: 0.05 }
  },
  generate(ctx) {
    const { work, seed, hash, tp } = ctx, P = ctx.params;
    const cols = Math.max(1, Math.round(P.cols)), rows = Math.max(1, Math.round(P.rows));
    const N = Math.max(1, Math.round(P.strings));
    const cw = work.w / cols, ch = work.h / rows;
    const dMin = Math.min(P.depth.a, P.depth.b), dMax = Math.max(P.depth.a, P.depth.b);
    const alt = P.layout === 'alternate';
    // Inset the fans from the cell edges — the arcs sit inside a smaller rectangle, leaving a margin
    // so the cells read as distinct tiles. Clamped so a big padding can't collapse the usable area.
    const px = Math.min(Math.max(0, P.padding || 0), cw * 0.45);
    const py = Math.min(Math.max(0, P.padding || 0), ch * 0.45);
    const uw = cw - 2 * px, uh = ch - 2 * py;

    // Quarter-ellipse arc from the horizontal edge to the vertical edge at a corner.
    //   corner (cx,cy); inward directions ux,uy (±1); radii rx,ry. θ: 0 -> horiz edge, π/2 -> vert.
    const arc = (cx, cy, ux, uy, rx, ry, z) => {
      const pts = [];
      const steps = Math.max(5, Math.ceil((Math.PI / 2) * Math.max(rx, ry) / 1.2));
      for (let s = 0; s <= steps; s++) {
        const th = (s / steps) * (Math.PI / 2);
        pts.push({ x: cx + ux * rx * Math.cos(th), y: cy + uy * ry * Math.sin(th), z });
      }
      return pts;
    };

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // Inset rectangle corners (padding margin around each cell).
        const ax = i * cw + px, ay = j * ch + py, bx = i * cw + cw - px, by = j * ch + ch - py;
        // One fan per cell. alternate = BL/TR by (i+j) parity (flowing diagonal ribbons, no
        // bullseyes); random = one of the four corners from the seed.
        let left, bottom;
        if (alt) { const e = (i + j) % 2 === 0; left = e; bottom = e; }
        else { const c = Math.floor(hash(seed, i, j, 1) * 4); left = (c === 0 || c === 2); bottom = (c === 0 || c === 1); }
        const cx = left ? ax : bx, cy = bottom ? ay : by;
        const ux = left ? 1 : -1, uy = bottom ? 1 : -1;
        for (let k = 0; k < N; k++) {
          // Depth is random PER ARC (the k in the hash), so every ring can sit at its own depth.
          const z = PM.zdepth(dMin + hash(seed, i, j, k, 2) * (dMax - dMin));
          // Radius up to the full (inset) cell: the fan fills the cell, largest arc reaching the two
          // far edges — a quarter bullseye.
          const rx = ((k + 0.5) / N) * uw, ry = ((k + 0.5) / N) * uh;
          tp.pass(arc(cx, cy, ux, uy, rx, ry, z));
        }
      }
    }
  }
});
