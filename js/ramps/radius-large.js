// Wie 'radius-small', nur dreimal so lang: derselbe konkave Kreisbogen, aber weit
// gestreckt. Die Nut hebt sich sanft aus dem Material und läuft lang aus.
//
//   Seitenansicht der Nut (Beginn links):
//
//                ├──────── Rampe = 12 × Tiefe ────────┤
//   Oberfläche  ──╮
//                  ╲___
//                       ╰────╮
//   volle Tiefe                 ╰────────────────────
//
// Bei 1,2 mm Tiefe ist das ein Bogen mit rund 87 mm Radius.
PM.registerRamp({
  id: 'radius-large',
  name: 'Radius – large',

  len: 12,
  steps: 20,

  // Radius = 72,5 × Tiefe (Herleitung in js/ramps/index.js).
  depthAt(progress) {
    return PM.circularArc(this.len, progress);
  }
});
