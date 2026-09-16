// Flachfräser: f(d) = 0 für d ≤ r, sonst unendlich
PM.registerTool({
  id: 'flat', name: 'End mill (flat)',
  params: {
    diameter: { label: 'Diameter', unit: 'mm', type: 'number', default: 6, min: 0.5, max: 25, step: 0.5 }
  },
  make(p) {
    const r = p.diameter / 2;
    return { radius: r, profile: (d) => (d <= r ? 0 : Infinity) };
  }
});
