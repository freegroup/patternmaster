// PatternMaster — Werkzeug-Registry + Plugin-Loader.
// Registry ist HIER definiert (vor den Plugins). Jedes Werkzeug ist eine eigene Datei
// und ruft PM.registerTool(...). Neuer Fräser = neue Datei + Eintrag in TOOL_FILES.
window.PM = window.PM || {};

PM.tools = {};
PM.registerTool = (t) => { PM.tools[t.id] = t; };
PM.toolList = () => Object.values(PM.tools);

// Plugin-Dateien dieses Ordners. Werden parser-synchron in Reihenfolge geladen (file://-tauglich).
(function () {
  const base = 'js/tools/';
  const TOOL_FILES = ['ball', 'flat', 'vee', 'torus'];
  for (const f of TOOL_FILES) document.write('<script src="' + base + f + '.js"><\/script>');
})();
