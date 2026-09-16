// Blobs — scattered little "mountain lakes". Each blob is a smooth round basin: deepest in the
// centre, shallowing to nothing at an irregular shoreline. The cutter clears each basin with a
// circular fill (an Archimedean spiral from the outer edge inward), then an optional finishing
// spiral re-traces the surface with a finer stepover — cleans up the scallops a ball- or
// bullnose cutter leaves between rings.
//
//   Side view of one lake:                 Top view: smooth bowl, irregular shore
//
//   surface ──╮           ╭──                       _.-·-._
//              ╲         ╱                        ,'       `.
//               ╲       ╱                        (           )
//                ╲_____╱                          `.       ,'
//              deepest centre                       `-._.-'
//
// Unlike Flowers, the edge irregularity FADES toward the centre (weighted by u), so it stays a
// smooth bowl with a wavy shoreline instead of growing radial petals. The outline is a sum of a
// few plain sinusoids (integer harmonics -> 2π-periodic, so the spiral turns line up); no sharp
// cusps, so the shore reads as bays and headlands rather than spikes.

// Even, blue-noise scatter of `count` centres over the w×h area (Mitchell's best-candidate): for
// each new point draw K random candidates and keep the one farthest from every point placed so far
// — each lands in the emptiest spot, giving an even area density with no clumps or big gaps.
// Deterministic via the seeded hash; a uniform grid keeps the nearest-neighbour lookup ~O(1).
function blobScatter(count, w, h, seed, hash) {
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

PM.registerPattern({
  id: 'blobs', name: 'Blobs (lakes)',
  params: {
    density:  { label: 'Density', unit: '', type: 'range', default: 12, min: 1, max: 100, step: 1 },
    size:     { label: 'Radius',  unit: 'mm', type: 'range2', defaultA: 6, defaultB: 18, min: 2, max: 80, step: 0.5 },
    depth:    { label: 'Depth',   unit: 'mm', type: 'range2', defaultA: 1, defaultB: 4,  min: 0.1, max: 8, step: 0.05 },
    noise:    { label: 'Edge noise', unit: '', type: 'range', default: 0.3, min: 0, max: 0.7, step: 0.01 },
    stepover: { label: 'Fill stepover',   unit: 'mm', type: 'number', default: 1,   min: 0.2, max: 10, step: 0.1 },
    finish:   { label: 'Finish stepover', unit: 'mm', type: 'number', default: 0.5, min: 0,   max: 10, step: 0.1 }
  },
  generate(ctx) {
    const { work, seed, hash, tp } = ctx, P = ctx.params;
    const sMin = Math.min(P.size.a, P.size.b),   sMax = Math.max(P.size.a, P.size.b);
    const dMin = Math.min(P.depth.a, P.depth.b), dMax = Math.max(P.depth.a, P.depth.b);

    // Density is a 1..100 "how full" dial. It is turned into a lake count relative to the board
    // area and the average lake size, so bigger lakes need fewer of them for the same coverage.
    // The ×3 lets the top of the range pile lakes up until they overlap and cover almost everything.
    // Capped so an extreme "tiny lakes + full density" combo can't lock up the browser.
    const avgR = 0.5 * (sMin + sMax);
    const target = (P.density / 100) * 3 * (work.w * work.h) / (Math.PI * avgR * avgR);
    const count = Math.max(1, Math.min(4000, Math.round(target)));

    // One circular-fill spiral for a single lake, outer edge -> centre.
    //   u    : fill parameter, 1 at the shore down to 0 at the centre (also drives the depth).
    //   wob(theta) : how far the shoreline deviates from a circle (0 = circle).
    // The deviation is weighted by u, so it is full-strength at the shore and dies out toward the
    // centre — that is what keeps the interior a smooth bowl instead of radial petals.
    const spiral = (b, stepover) => {
      const pts = [];
      const shrinkPerRad = stepover / (2 * Math.PI * b.R);
      let theta = b.phase, u = 1;
      while (u > 1e-3) {
        const radius = u * b.R * (1 + b.wob(theta) * u);
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

    // Even, blue-noise placement (best-candidate) instead of blind uniform random — no clumps or
    // big empty patches. Sizes/depths/shapes stay per-lake random.
    const centers = blobScatter(count, work.w, work.h, seed, hash);
    const lakes = [];
    for (let i = 0; i < count; i++) {
      // Shoreline = sum of the low harmonics k=1..4, each with its own random amplitude and phase,
      // amplitude falling with k so the low frequencies dominate. The k=1 term is what makes the
      // blob lopsided/egg-shaped and kills the k-fold symmetry that a single dominant harmonic
      // (the old "3 lobes -> clover / 4 -> butterfly") produced. Weights sum to ~1 so Edge noise
      // maps directly to how far the shore swings from a circle.
      const amp = [
        P.noise * 0.45 * (0.6 + 0.8 * hash(seed, i, 7)),   // k=1: off-centre, the main asymmetry
        P.noise * 0.30 * (0.6 + 0.8 * hash(seed, i, 8)),   // k=2: waist / kidney
        P.noise * 0.16 * (0.6 + 0.8 * hash(seed, i, 9)),   // k=3
        P.noise * 0.09 * (0.6 + 0.8 * hash(seed, i, 10))   // k=4: fine detail
      ];
      const ph = [
        hash(seed, i, 11) * 2 * Math.PI, hash(seed, i, 12) * 2 * Math.PI,
        hash(seed, i, 13) * 2 * Math.PI, hash(seed, i, 14) * 2 * Math.PI
      ];
      lakes.push({
        cx:   centers[i].cx,
        cy:   centers[i].cy,
        R:    sMin + hash(seed, i, 3) * (sMax - sMin),
        peak: dMin + hash(seed, i, 4) * (dMax - dMin),
        exp:  1.4 + hash(seed, i, 5) * 1.2,
        phase: hash(seed, i, 6) * 2 * Math.PI,
        // Clamp keeps the shoreline from folding back on itself at high noise.
        wob: (th) => {
          let s = 0;
          for (let k = 0; k < 4; k++) s += amp[k] * Math.sin((k + 1) * th + ph[k]);
          return Math.max(-0.85, s);
        }
      });
    }

    // Mill each lake completely — roughing then its finishing spiral — before moving to the next,
    // so the tool tours the board once instead of roughing everything and then travelling all the
    // way back for a second finishing tour. Order does not change the height map (H = min).
    for (const b of lakes) {
      tp.pass(spiral(b, P.stepover));
      if (P.finish > 0) tp.pass(spiral(b, P.finish));
    }
  }
});
