// PatternMaster — Ramp-Registry + Plugin-Loader.
// Eine Ramp beschreibt, wie ein Schnitt ins Material ein- und wieder austaucht, statt
// senkrecht einzustechen. Jede Ramp ist eine eigene Datei.
// Neue Ramp = neue Datei + Eintrag in RAMP_FILES.
//
// Eine Ramp liefert:
//   id, name    — Kennung und Anzeigename
//   len         — Rampenlänge als Vielfaches der Tiefe dieses Schnitts (0 = keine Rampe).
//                 Dadurch bekommen tiefere Schnitte automatisch längere Rampen.
//   steps       — Unterteilungen der Polylinie (1 genügt bei Geraden)
//   depthAt(progress) — Anteil der vollen Tiefe an dieser Stelle der Rampe.
//                 progress läuft von 0 (Oberfläche) bis 1 (volle Tiefe).
//                 depthAt(0) muss 0 ergeben und depthAt(1) muss 1 ergeben.
window.PM = window.PM || {};

PM.ramps = {};
PM.registerRamp = (r) => { PM.ramps[r.id] = r; };
PM.rampList = () => Object.values(PM.ramps);

// Echter Kreisbogen für Radius-Rampen. `len` ist die Rampenlänge als Vielfaches der Tiefe.
//
// Der Bogen läuft tangential in die Sohle aus und trifft am Rampenanfang genau die
// Oberfläche. Aus diesen beiden Bedingungen folgt der Radius eindeutig:
//
//        L² + d² = 2·d·R    ->    R = d · (len² + 1) / 2
//
//   Oberfläche  ──╮                      L = Rampenlänge
//                  ╲   ·                 d = Tiefe
//                   ╰──╮    ·            R = Kreisradius
//   volle Tiefe          ╰───────●───    ● = Kreismittelpunkt, senkrecht über
//                                        dem tiefsten Punkt
//
// len=4  -> R =  8.5 × Tiefe (enger Bogen)
// len=12 -> R = 72.5 × Tiefe (weiter Bogen)
PM.circularArc = function (len, progress) {
  const radius = (len * len + 1) / 2;        // als Vielfaches der Tiefe
  const toBottom = len * (1 - progress);     // waagerechter Abstand zum tiefsten Punkt
  return 1 + Math.sqrt(radius * radius - toBottom * toBottom) - radius;
};

// Baut die Punkte eines Schnitts von `s` bis `s+segLen` entlang (ux,uy) ab (ax,ay).
// Ohne Rampe zwei Punkte auf voller Tiefe, sonst ein ein-/ausgeblendeter Polylinienzug.
// Zu kurze Abschnitte werden zum reinen V ohne flache Sohle.
PM.rampedPass = function (ramp, ax, ay, ux, uy, s, segLen, depth) {
  const at = (d, z) => ({ x: ax + ux * (s + d), y: ay + uy * (s + d), z });
  if (!ramp || !(ramp.len > 0)) {
    const z = PM.zdepth(depth);
    return [at(0, z), at(segLen, z)];
  }
  const rampLen = Math.min(ramp.len * depth, segLen / 2);
  const pts = [];

  // Eintauchen: von der Oberfläche auf volle Tiefe.
  for (let i = 0; i <= ramp.steps; i++) {
    const progress = i / ramp.steps;
    pts.push(at(rampLen * progress, -depth * ramp.depthAt(progress)));
  }
  // Austauchen: gespiegelt, von voller Tiefe zurück auf die Oberfläche.
  // Dazwischen verbindet tp.pass() beide auf voller Tiefe -> flache Sohle.
  for (let i = 0; i <= ramp.steps; i++) {
    const progress = i / ramp.steps;
    pts.push(at(segLen - rampLen + rampLen * progress, -depth * ramp.depthAt(1 - progress)));
  }
  return pts;
};

(function () {
  const base = 'js/ramps/';
  const RAMP_FILES = ['none', 'linear', 'linear-long', 'radius-small', 'radius-large', 'expon'];
  for (const f of RAMP_FILES) document.write('<script src="' + base + f + '.js"><\/script>');
})();
