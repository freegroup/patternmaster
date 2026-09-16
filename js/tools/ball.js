// Kugelkopf: f(d) = r - sqrt(r² - d²)
PM.registerTool({
  id: 'ball', name: 'Ball nose',
  params: {
    diameter: { label: 'Diameter', unit: 'mm', type: 'number', default: 6, min: 0.5, max: 25, step: 0.5 }
  },
  make(p) {
    const r = p.diameter / 2;
    return { radius: r, profile: (d) => (d <= r ? r - Math.sqrt(r * r - d * d) : Infinity) };
  }
});
