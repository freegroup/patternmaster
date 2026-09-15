// Gerade Schräge: konstante Steigung, gleichmäßige Spanabnahme über die ganze
// Rampe. Ergibt eine klar angeschnittene, keilförmige Nutspitze.
//
//   Seitenansicht der Nut (Beginn links):
//
//                ├── Rampe = 4 × Tiefe ──┤
//   Oberfläche  ──╲
//                  ╲
//                    ╲
//   volle Tiefe        ╲──────────────────
//
PM.registerRamp({
  id: 'linear',
  name: 'Linear',

  // Rampenlänge als Vielfaches der Tiefe dieses Schnitts.
  len: 4,

  // Eine Gerade braucht keine Zwischenpunkte.
  steps: 1,

  // Tiefe wächst proportional zum zurückgelegten Weg.
  depthAt(progress) {
    return progress;
  }
});
