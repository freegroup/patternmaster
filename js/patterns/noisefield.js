// Noise field: depth driven by fBm; below a threshold the material is left standing (islands).
PM.registerPattern({
  id: 'noisefield', name: 'Noise field',
  params: {
    stepover:  { label: 'Row spacing', unit: 'mm', type: 'number', default: 2, min: 0.3, max: 15, step: 0.1 },
    sample:    { label: 'Sampling', unit: 'mm', type: 'number', default: 1.5, min: 0.5, max: 8, step: 0.5 },
    scale:     { label: 'Feature size', unit: 'mm', type: 'range', default: 60, min: 5, max: 300, step: 1 },
    maxDepth:  { label: 'Max depth', unit: 'mm', type: 'number', default: 2, min: 0.1, max: 8, step: 0.05 },
    threshold: { label: 'Threshold (islands)', unit: '', type: 'range', default: 0.15, min: -0.5, max: 0.8, step: 0.01 }
  },
  generate(ctx) {
    const { work, noise } = ctx, P = ctx.params;
    const rows = Math.max(1, Math.floor(work.h / P.stepover));
    const N = Math.max(2, Math.floor(work.w / P.sample));
    const inv = 1 / Math.max(1, P.scale); // noise sampling frequency from feature size
    for (let r = 0; r <= rows; r++) {
      const y = r * P.stepover;
      const rev = r % 2 === 1; // zig-zag row direction
      // Accumulate a contiguous run; flush (and cut) it whenever noise drops below threshold.
      let run = [];
      const flush = () => { if (run.length >= 1) { if (rev) run.reverse(); ctx.tp.pass(run); } run = []; };
      for (let ii = 0; ii <= N; ii++) {
        const i = rev ? N - ii : ii;
        const x = i / N * work.w;
        const n = noise.fbm(x * inv, y * inv, 4); // ~[-1,1]
        if (n < P.threshold) { flush(); continue; }         // island: leave material, break the run
        const d = P.maxDepth * (n - P.threshold) / (1 - P.threshold); // remap above threshold -> depth
        run.push({ x, y, z: PM.zdepth(d) });
      }
      flush();
    }
  }
});
