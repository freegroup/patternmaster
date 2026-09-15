// V-Nut: f(d) = d / tan(halber Spitzenwinkel). Winkel als Parameter (30°, 45°, 60°, 90° …).
PM.registerTool({
  id: 'vee', name: 'V-bit',
  params: {
    diameter: { label: 'Diameter', unit: 'mm', type: 'number', default: 10, min: 1, max: 30, step: 0.5 },
    angle: { label: 'Included angle', unit: '°', type: 'number', default: 90, min: 10, max: 170, step: 1 }
  },
  make(p) {
    const r = p.diameter / 2;
    const k = 1 / Math.tan((p.angle / 2) * Math.PI / 180);
    return { radius: r, profile: (d) => (d <= r ? d * k : Infinity) };
  }
});
