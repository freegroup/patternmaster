// Flowers — like Blobs, but the lobed outline is carried all the way to the centre, so the
// petals of the shape become radial ridges and the whole thing reads as a flower / rosette.
// The cutter clears each one with a circular fill (an Archimedean spiral, edge -> centre) and an
// optional finishing spiral. Try a ball- or bullnose cutter for soft petals.
//
//   Top view: the outline lobes run inward as petals
//
//         \\ | //
//        \\\ | ///        radius = u · R · shape(θ)   -> lobes reach the centre
//     ---- ( o ) ----      depth  = peak · (1 - u^exp)
//        /// | \\\
//         // | \\
//
// Outline uses the polar radius function from Joshua Bragg's Blob-Generator
// (github.com/JoshuaBragg/Blob-Generator): a sum of absolute-valued sinusoids at a few
// frequencies with independent phase shifts (a, b, c). The absolute values give the sharp
// petals. It stays 2π-periodic (integer frequency multiplier) so the spiral turns line up.

// Even, blue-noise scatter of `count` centres over the w×h area (Mitchell's best-candidate): for
// each new point draw K random candidates and keep the one farthest from every point placed so far
// — each lands in the emptiest spot, giving an even area density with no clumps or big gaps.
// Deterministic via the seeded hash; a uniform grid keeps the nearest-neighbour lookup ~O(1).
function flowerScatter(count, w, h, seed, hash) {
  const K = 12, pts = [];
  const cell = Math.max(1e-6, Math.sqrt((w * h) / Math.max(1, count)));
  const gx = Math.max(1, Math.ceil(w / cell)), gy = Math.max(1, Math.ceil(h / cell));
  const grid = new Array(gx * gy);
  const cellOf = (v, g) => Math.min(g - 1, Math.max(0, Math.floor(v / cell)));
  const nearestD2 = (x, y) => {
    const cx = cellOf(x, gx), cy = cellOf(y, gy);
    let best = Infinity;
    for (let ry = -1; ry <= 1; ry++)
      for (let rx = -1; rx <= 1; rx++) {
        const bx = cx + rx, by = cy + ry;
        if (bx < 0 || by < 0 || bx >= gx || by >= gy) continue;
        const bucket = grid[by * gx + bx];
        if (!bucket) continue;
        for (const j of bucket) {
          const dx = x - pts[j].cx, dy = y - pts[j].cy, d = dx * dx + dy * dy;
          if (d < best) best = d;
        }
      }
    return best;
  };
  for (let i = 0; i < count; i++) {
    let bestX = 0, bestY = 0, bestD = -1;
    for (let k = 0; k < K; k++) {
      const x = hash(seed, i, 20 + k * 2) * w, y = hash(seed, i, 21 + k * 2) * h;
      const d = pts.length ? nearestD2(x, y) : Infinity;
      if (d > bestD) { bestD = d; bestX = x; bestY = y; }
    }
    pts.push({ cx: bestX, cy: bestY });
    const b = cellOf(bestY, gy) * gx + cellOf(bestX, gx);
    (grid[b] || (grid[b] = [])).push(i);
  }
  return pts;
}

// Radius shape r(theta) — |sin|/|cos| terms, phase-shifted by a, b, c. Range roughly [0, ~2.5].
function flowerF1(t, b) { return Math.sin(4 * (t + Math.PI / b)); }
function flowerF2(t, a) { return Math.cos(2 * (t + Math.PI / a)); }
function flowerF3(t, a, b) { return 0.5 * Math.sin(2 * (t + Math.PI / b)) - 0.5 * Math.cos(4 * (t - 2 * Math.PI / b / a)); }
function flowerG(t, a, b, c) {
  return Math.abs(flowerF1(t + c, b)) + Math.abs(flowerF2(t + 2 * c, a)) + Math.abs(flowerF3(t + 3 * c, a, b)) + 1e-4;
}

PM.registerPattern({
  id: 'flowers', name: 'Flowers',
  params: {
    density:  { label: 'Density', unit: '', type: 'range', default: 12, min: 1, max: 100, step: 1 },
    size:     { label: 'Radius',  unit: 'mm', type: 'range2', defaultA: 6, defaultB: 18, min: 2, max: 80, step: 0.5 },
    depth:    { label: 'Depth',   unit: 'mm', type: 'range2', defaultA: 1, defaultB: 4,  min: 0.1, max: 8, step: 0.05 },
    petals:   { label: 'Petals', unit: '', type: 'range', default: 0.5, min: 0, max: 1, step: 0.01 },
    stepover: { label: 'Fill stepover',   unit: 'mm', type: 'number', default: 1,   min: 0.2, max: 10, step: 0.1 },
    finish:   { label: 'Finish stepover', unit: 'mm', type: 'number', default: 0.5, min: 0,   max: 10, step: 0.1 }
  },
  generate(ctx) {
    const { work, seed, hash, tp } = ctx, P = ctx.params;
    const sMin = Math.min(P.size.a, P.size.b),   sMax = Math.max(P.size.a, P.size.b);
    const dMin = Math.min(P.depth.a, P.depth.b), dMax = Math.max(P.depth.a, P.depth.b);

    const avgR = 0.5 * (sMin + sMax);
    const target = (P.density / 100) * 3 * (work.w * work.h) / (Math.PI * avgR * avgR);
    const count = Math.max(1, Math.min(4000, Math.round(target)));

    // Spiral fill, outer edge -> centre. The lobes are applied at every u, so they run inward.
    const spiral = (b, stepover) => {
      const pts = [];
      const shrinkPerRad = stepover / (2 * Math.PI * b.R);
      let theta = b.phase, u = 1;
      while (u > 1e-3) {
        const radius = u * b.R * b.shape(theta);
        const depth = b.peak * (1 - Math.pow(u, b.exp));
        pts.push({ x: b.cx + Math.cos(theta) * radius, y: b.cy + Math.sin(theta) * radius, z: PM.zdepth(depth) });
        const chord = Math.min(stepover, 1.5);
        const dTheta = Math.min(Math.PI / 6, chord / Math.max(radius, chord));
        theta += dTheta;
        u -= shrinkPerRad * dTheta;
      }
      pts.push({ x: b.cx, y: b.cy, z: PM.zdepth(b.peak) });
      return pts;
    };

    const centers = flowerScatter(count, work.w, work.h, seed, hash);
    const flowers = [];
    for (let i = 0; i < count; i++) {
      const a = 0.1 + hash(seed, i, 7) * 0.6;
      const b = 0.1 + hash(seed, i, 8) * 0.6;
      const c = hash(seed, i, 9) * 2 * Math.PI;
      const freq = 1 + Math.floor(hash(seed, i, 10) * 3);   // 1..3
      let mean = 0; const S = 32;
      for (let s = 0; s < S; s++) mean += flowerG(freq * (s / S) * 2 * Math.PI, a, b, c);
      mean = Math.max(1e-3, mean / S);
      flowers.push({
        cx:   hash(seed, i, 1) * work.w,
        cy:   hash(seed, i, 2) * work.h,
        R:    sMin + hash(seed, i, 3) * (sMax - sMin),
        peak: dMin + hash(seed, i, 4) * (dMax - dMin),
        exp:  1.4 + hash(seed, i, 5) * 1.2,
        phase: hash(seed, i, 6) * 2 * Math.PI,
        shape: (th) => Math.max(0.15, 1 + P.petals * (flowerG(freq * th, a, b, c) / mean - 1))
      });
    }

    // Mill each flower completely — roughing then its finishing spiral — before the next, so the
    // tool tours the board once instead of a second full finishing tour. Order does not change the
    // height map (H = min).
    for (const b of flowers) {
      tp.pass(spiral(b, P.stepover));
      if (P.finish > 0) tp.pass(spiral(b, P.finish));
    }
  }
});
