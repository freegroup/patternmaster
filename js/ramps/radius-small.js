// Konkav ausgemuldetes Nutende auf einem echten Kreisbogen. Der Bogen läuft
// tangential in die Sohle aus: der Fräser setzt an der Oberfläche steil an und
// flacht zur vollen Tiefe hin aus. Die Nut wirkt dadurch ausgehoben statt
// angeschrägt — wie mit einem Hohlbeitel gestochen.
//
//   Seitenansicht der Nut (Beginn links):
//
//                ├── Rampe = 4 × Tiefe ──┤
//   Oberfläche  ──╮
//                  ╲
//                   ╰──╮
//   volle Tiefe          ╰────────────────
//
// Bei 1,2 mm Tiefe ist das ein Bogen mit gut 10 mm Radius.
//
// Hinweis: Der steile Ansatz belastet die Spitze stärker als 'linear'.
// Wer den Fräser schonen will, nimmt eine der linearen Varianten.
PM.registerRamp({
  id: 'radius-small',
  name: 'Radius – small',

  // Rampenlänge als Vielfaches der Tiefe dieses Schnitts.
  len: 4,

  // Bogen -> in Teilstücke zerlegen, sonst wird daraus eine Gerade.
  steps: 40,

  // Radius = 8,5 × Tiefe (Herleitung in js/ramps/index.js).
  depthAt(progress) {
    return PM.circularArc(this.len, progress);
  }
});
