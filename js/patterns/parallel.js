// Parallel bands with deterministic (hash-based) length / depth / offset.
// Straight passes at a given angle, each broken into varied sub-passes with
// jittered depth and occasional gaps — looks random, but is fully deterministic.

PM.registerPattern({
  id: 'parallel', name: 'Parallel bands',
  params: {
    stepover:  { label: 'Stepover',  unit: 'mm', type: 'number', default: 2,   min: 0.2, max: 20,  step: 0.1 },
    angle:     { label: 'Angle',     unit: '°',  type: 'number', default: 0,   min: 0,   max: 180, step: 1 },
    depth:     { label: 'Depth',     unit: 'mm', type: 'range2', defaultA: 0.8, defaultB: 1.6, min: 0.05, max: 8, step: 0.05 },
    length:    { label: 'Length',    unit: 'mm', type: 'range2', defaultA: 20,  defaultB: 120, min: 2,    max: 600, step: 1 },
    // Auswahl kommt aus der Ramp-Registry -> neue Datei in js/ramps/ genügt.
    ramp:      { label: 'Ramp', type: 'select', default: 'none',
                 options: PM.rampList().map((r) => [r.id, r.name]) },
    gapChance: { label: 'Gap chance', unit: '',  type: 'range',  default: 0.15, min: 0,   max: 0.9, step: 0.01 }
  },
  generate(ctx) {
    const { work, seed, hash, tp } = ctx, P = ctx.params;
    const ramp = PM.ramps[P.ramp];
    const lines = PM.geom.hatch(work.w, work.h, P.angle, P.stepover, hash(seed, 101) * P.stepover);
    let flip = false, li = 0;
    for (const L of lines) {
      let ax = L.x0, ay = L.y0, bx = L.x1, by = L.y1;
      if (flip) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
      flip = !flip;
      const len = Math.hypot(bx - ax, by - ay); li++;
      if (len < 1e-6) continue;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const dMin = Math.min(P.depth.a, P.depth.b), dMax = Math.max(P.depth.a, P.depth.b);
      const lMin = Math.min(P.length.a, P.length.b), lMax = Math.max(P.length.a, P.length.b);
      let s = 0, k = 0;
      while (s < len) {
        const segLen = Math.min(len - s, lMin + (lMax - lMin) * hash(seed, li, k, 1));
        if (hash(seed, li, k, 2) < P.gapChance) { s += segLen; k++; continue; }
        const depth = dMin + hash(seed, li, k, 3) * (dMax - dMin);
        tp.pass(PM.rampedPass(ramp, ax, ay, ux, uy, s, segLen, depth));
        s += segLen; k++;
      }
    }
  }
});
