// PatternMaster — Pattern-Registry + Plugin-Loader.
// Jeder Generator ist eine eigene Datei und deklariert sein Param-Schema selbst.
// Die UI baut daraus die Controls und propagiert Werte über ctx.params zurück.
// Neuer Generator = neue Datei + Eintrag in PATTERN_FILES.
window.PM = window.PM || {};

PM.patterns = {};
PM.registerPattern = (p) => { PM.patterns[p.id] = p; };
PM.patternList = () => Object.values(PM.patterns);

// Helfer für Generatoren: clamp Tiefe (min 0.05mm) -> negatives Z (Z0 = Oberfläche).
PM.zdepth = (d) => -Math.max(0.05, d);

(function () {
  const base = 'js/patterns/';
  const PATTERN_FILES = ['parallel', 'waves', 'crosshatch', 'noisefield'];
  for (const f of PATTERN_FILES) document.write('<script src="' + base + f + '.js"><\/script>');
})();
