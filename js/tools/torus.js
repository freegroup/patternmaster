// Torus / Bullnose: flach bis R-cr, danach Eckenradius-Profil (rounded corner).
PM.registerTool({
  id: 'torus', name: 'Bullnose',
  params: {
    diameter: { label: 'Diameter', unit: 'mm', type: 'number', default: 6, min: 1, max: 20, step: 0.5 },
    corner: { label: 'Corner radius', unit: 'mm', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 }
  },
  make(p) {
    const R = p.diameter / 2;
    const cr = Math.min(p.corner, R);
    const flat = R - cr;
    return {
      radius: R,
      profile: (d) => {
        if (d <= flat) return 0;
        if (d <= R) { const dd = d - flat; return cr - Math.sqrt(cr * cr - dd * dd); }
        return Infinity;
      }
    };
  }
});
