// Two-direction hatch (±angle). The overlap of the two passes creates the grid.
PM.registerPattern({
  id: 'crosshatch', name: 'Crosshatch',
  params: {
    spacing:  { label: 'Spacing', unit: 'mm', type: 'number', default: 12,  min: 1,    max: 60, step: 0.5 },
    angle:    { label: 'Angle',   unit: '°',  type: 'number', default: 45,  min: 0,    max: 90, step: 1 },
    depth:    { label: 'Depth',   unit: 'mm', type: 'range2', defaultA: 1.3, defaultB: 1.7, min: 0.05, max: 8, step: 0.05 }
  },
  generate(ctx) {
    const { work, seed, hash, tp } = ctx, P = ctx.params;
    const dMin = Math.min(P.depth.a, P.depth.b), dMax = Math.max(P.depth.a, P.depth.b);
    let ai = 0;
    for (const a of [P.angle, -P.angle]) {
      const lines = PM.geom.hatch(work.w, work.h, a, P.spacing, 0);
      let flip = false, li = 0;
      for (const L of lines) {
        let p0 = { x: L.x0, y: L.y0 }, p1 = { x: L.x1, y: L.y1 };
        if (flip) { const t = p0; p0 = p1; p1 = t; }
        flip = !flip;
        const z = PM.zdepth(dMin + hash(seed, ai, li, 5) * (dMax - dMin));
        tp.pass([{ ...p0, z }, { ...p1, z }]);
        li++;
      }
      ai++;
    }
  }
});
