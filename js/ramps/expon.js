// Kubischer Verlauf: bleibt lange dicht unter der Oberfläche und fällt erst gegen
// Ende steil ab. Ergibt eine sehr lang auslaufende, feine Nutspitze — fast wie ein
// ausgezogener Pinselstrich.
//
//   Seitenansicht der Nut (Beginn links):
//
//                ├───── Rampe = 8 × Tiefe ─────┤
//   Oberfläche  ──────────╮
//                          ╰─╮
//                             ╰─╮
//   volle Tiefe                  ╰──────────────
//
PM.registerRamp({
  id: 'expon',
  name: 'Exponential',

  len: 8,
  steps: 10,

  // Hoch drei: bei halber Rampe erst 1/8 der Tiefe erreicht.
  depthAt(progress) {
    return progress * progress * progress;
  }
});
