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

  // Unterteilung der Kurve. Bewusst fein: Diese Stützpunkte landen 1:1 im G-Code, zu grobe
  // Stufen sieht man später am gefrästen Werkstück. Das kostet Rechenzeit in der Vorschau,
  // aber die Fräsqualität hat hier Vorrang.
  steps: 20,

  // Hoch drei: bei halber Rampe erst 1/8 der Tiefe erreicht.
  depthAt(progress) {
    return progress * progress * progress;
  }
});
