// Truchet (straight) — a grid of cells, each filled with `strings` parallel straight grooves.
// Every cell is (seeded) either horizontal or vertical. Grooves cross each edge at the same evenly
// spaced points (f = (k+0.5)/N along the edge), so they line up with the neighbouring cells and the
// grid reads as a woven basket of stripes. Great with a V-bit. Self-contained (project rule).
//
//   two cell types (grooves coarse):
//   horizontal        vertical
//   ┌────────┐        ┌─┬─┬─┬─┐
//   │────────│        │ │ │ │ │
//   │────────│        │ │ │ │ │
//   └────────┘        └─┴─┴─┴─┘
PM.registerPattern({
  id: 'truchet-straight', name: 'Truchet Straight',
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
    // Inset the groove patch from the cell edges — leaves a margin around each cell so the stripes
    // read as distinct woven tiles. Clamped so a big padding can't collapse the usable area.
    const px = Math.min(Math.max(0, P.padding || 0), cw * 0.45);
    const py = Math.min(Math.max(0, P.padding || 0), ch * 0.45);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x0 = i * cw, y0 = j * ch;
        // Alternate = checkerboard of H/V (a regular, symmetric basket weave); random = seeded coin.
        const vertical = alt ? ((i + j) % 2 === 0) : (hash(seed, i, j, 1) < 0.5);
        for (let k = 0; k < N; k++) {
          // Depth is random PER GROOVE (the k in the hash), so every string can sit at its own depth.
          const z = PM.zdepth(dMin + hash(seed, i, j, k, 2) * (dMax - dMin));
          // Centered spacing: exactly N grooves per cell (same for H and V), with an equal margin on
          // all four sides so the outer termination looks the same everywhere.
          const f = (k + 0.5) / N;
          if (vertical) {
            const x = x0 + px + f * (cw - 2 * px);
            tp.pass([{ x, y: y0 + py, z }, { x, y: y0 + ch - py, z }]);
          } else {
            const y = y0 + py + f * (ch - 2 * py);
            tp.pass([{ x: x0 + px, y, z }, { x: x0 + cw - px, y, z }]);
          }
        }
      }
    }
  }
});
