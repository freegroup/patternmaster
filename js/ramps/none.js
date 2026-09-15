// Kein Anschnitt — der Fräser sticht senkrecht auf volle Tiefe und fährt am Ende
// genauso wieder heraus. Kürzeste Laufzeit, aber die härteste Belastung für die
// Spitze, weil dort die Schnittgeschwindigkeit gegen null geht.
//
//   Seitenansicht der Nut (Beginn links):
//
//   Oberfläche  ──┐
//                 │
//                 │
//   volle Tiefe   └────────────────
//
PM.registerRamp({
  id: 'none',
  name: 'None (straight plunge)',

  // 0 = gar keine Rampe. Der Aufrufer setzt dann direkt zwei Punkte auf volle Tiefe.
  len: 0,
  steps: 1,

  depthAt(progress) {
    return progress;
  }
});
