// Wie 'linear', nur dreimal so lang: dieselbe gerade Schräge, aber viel flacher.
// Die Nut läuft weit aus und wirkt dadurch deutlich zurückhaltender.
//
//   Seitenansicht der Nut (Beginn links):
//
//                ├──────── Rampe = 12 × Tiefe ────────┤
//   Oberfläche  ──╲___
//                     ╲___
//                          ╲___
//   volle Tiefe                 ╲───────────────────────
//
PM.registerRamp({
  id: 'linear-long',
  name: 'Linear – long',

  len: 12,
  steps: 1,

  depthAt(progress) {
    return progress;
  }
});
