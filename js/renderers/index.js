// PatternMaster — Renderer-Registry + Plugin-Loader.
// Jeder Renderer: { id, name, make() -> { render(sim, opts) -> HTMLCanvasElement } }.
// CPU jetzt, WebGL später einfach als gpu.js daneben legen + in RENDERER_FILES eintragen.
window.PM = window.PM || {};

PM.renderers = {};
PM.registerRenderer = (r) => { PM.renderers[r.id] = r; };
PM.rendererList = () => Object.values(PM.renderers);

// Gemeinsame Kamera für alle räumlichen Ansichten (3D und CAM).
// Beide rechnen in denselben Weltkoordinaten (mm, Nullpunkt links-unten), daher lässt sich
// der Blickwinkel teilen: Beim Umschalten steht die Ansicht unverändert da.
// `framedFor` merkt sich, für welche Werkstückgröße schon eingepasst wurde — so passt nur
// der zuerst gezeigte Renderer ein, der andere übernimmt die Stellung unverändert.
const VIEW_CAM_HOME = { az: -45 * Math.PI / 180, el: 30 * Math.PI / 180, dist: 800, target: [300, 200, 0] };

PM.viewCam = Object.assign({ framedFor: '' }, VIEW_CAM_HOME, { target: VIEW_CAM_HOME.target.slice() });

// Setzt die geteilte Kamera auf die Ausgangsstellung zurück. Das leere `framedFor` sorgt
// dafür, dass der nächste Frame neu auf das Werkstück einpasst — Winkel und Zoom stimmen
// danach wieder, unabhängig davon, wie weit vorher weggeschwenkt wurde.
// Wirkt auf 3D und CAM gleichermaßen, weil beide dieselbe Kamera benutzen.
PM.resetView = function () {
  Object.assign(PM.viewCam, VIEW_CAM_HOME, { target: VIEW_CAM_HOME.target.slice(), framedFor: '' });
};

(function () {
  const base = 'js/renderers/';
  const RENDERER_FILES = ['cpu', 'webgl3d', 'cam'];
  for (const f of RENDERER_FILES) document.write('<script src="' + base + f + '.js"><\/script>');
})();
