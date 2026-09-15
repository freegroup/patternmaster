// PatternMaster — Post-Prozessor-Registry + Plugin-Loader.
// Jeder Post-Prozessor: { id, name, ext, emit(tp, opts) -> String }.
// tp = PM.Toolpath (Quelle). Nullpunkt links-unten, Z0 = Oberfläche.
// Neuer Dialekt = neue Datei + Eintrag in POST_FILES.
window.PM = window.PM || {};

PM.posts = {};
PM.registerPost = (p) => { PM.posts[p.id] = p; };
PM.postList = () => Object.values(PM.posts);
PM.f3 = (v) => v.toFixed(3);

(function () {
  const base = 'js/gcode/';
  const POST_FILES = ['grbl', 'marlin'];
  for (const f of POST_FILES) document.write('<script src="' + base + f + '.js"><\/script>');
})();
