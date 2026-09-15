// Organic wavy passes: horizontal rows displaced and depth-modulated by fBm noise.
PM.registerPattern({
  id: 'waves', name: 'Waves',
  params: {
    stepover: { label: 'Row spacing', unit: 'mm', type: 'number', default: 3, min: 0.5, max: 20, step: 0.1 },
    sample:   { label: 'Sampling', unit: 'mm', type: 'number', default: 2, min: 0.5, max: 10, step: 0.5 },
    amp:      { label: 'Amplitude', unit: 'mm', type: 'range', default: 6, min: 0, max: 40, step: 0.5 },
    freq:     { label: 'Frequency', unit: '', type: 'range', default: 1, min: 0.1, max: 5, step: 0.1 },
    depth:    { label: 'Depth', unit: 'mm', type: 'number', default: 1.2, min: 0.05, max: 8, step: 0.05 },
    depthAmp: { label: 'Depth ripple', unit: 'mm', type: 'range', default: 0.5, min: 0, max: 4, step: 0.05 }
  },
  generate(ctx) {
    const { work, noise } = ctx, P = ctx.params;
    const rows = Math.max(1, Math.floor(work.h / P.stepover));
    const N = Math.max(2, Math.floor(work.w / P.sample)); // samples per row
    for (let r = 0; r <= rows; r++) {
      const y0 = r * P.stepover;
      // Build one wavy polyline: y wobbles with fBm, z (depth) ripples with a second fBm.
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = i / N * work.w;
        const off = P.amp * noise.fbm(x * P.freq * 0.01, y0 * P.freq * 0.01, 3);
        const d = P.depth + P.depthAmp * noise.fbm(x * 0.02, y0 * 0.02 + 50, 2);
        pts.push({ x, y: Math.min(work.h, Math.max(0, y0 + off)), z: PM.zdepth(d) });
      }
      if (r % 2 === 1) pts.reverse(); // zig-zag: cut alternate rows in reverse to save rapids
      ctx.tp.pass(pts);
    }
  }
});
