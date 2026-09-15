// Safe, namespaced wrapper around localStorage — plus the state persistence built on top of it.
// Every access is guarded: private mode, a full quota or a corrupt entry must never break the app,
// it just runs without persistence.
window.PM = window.PM || {};

// ---------------- generic storage ----------------
PM.storage = (function () {
  const NS = 'patternmaster.';

  return {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(NS + key); } catch (e) { /* nothing to do */ }
    },
    available() {
      try { const k = NS + '__probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
      catch (e) { return false; }
    }
  };
})();

// ---------------- state persistence ----------------
// Everything the user adjusts lives in one serialisable `state` object, so a reload restores
// exactly what they had: values, the selected pattern/cutter/post, the 2D/3D/CAM view, the
// path scrubber and which sidebar sections were open.
PM.settings = (function () {
  const KEY = 'state.v1';

  // Die Kamera lebt in PM.viewCam (von 3D- und CAM-Ansicht geteilt), nicht im state.
  // Beim Sichern wird sie eingesammelt, beim Laden zurückgeschrieben.
  function save(state) {
    state.viewCam = Object.assign({}, PM.viewCam);
    PM.storage.set(KEY, state);
  }

  function load(state) {
    const saved = PM.storage.get(KEY);
    if (!saved || typeof saved !== 'object') return;
    Object.assign(state, saved);
    sanitize(state);
    if (state.viewCam) restoreCamera(state.viewCam);
  }

  // Eine kaputte Kamera (NaN in dist oder target) würde die Ansicht schwarz lassen —
  // deshalb jeden Wert prüfen und im Zweifel die Voreinstellung behalten.
  function restoreCamera(saved) {
    const num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback);
    const cam = PM.viewCam;
    cam.az = num(saved.az, cam.az);
    cam.el = Math.max(-1.5533, Math.min(1.5533, num(saved.el, cam.el)));
    cam.dist = Math.max(1e-3, num(saved.dist, cam.dist));
    if (Array.isArray(saved.target) && saved.target.length === 3 && saved.target.every((v) => isFinite(v))) {
      cam.target = saved.target.slice();
    }
    // Nur mit passendem framedFor bleibt die Stellung erhalten — sonst passt der erste
    // Frame neu ein und die wiederhergestellte Kamera wäre sofort wieder weg.
    cam.framedFor = typeof saved.framedFor === 'string' ? saved.framedFor : '';
  }

  function clear() { PM.storage.remove(KEY); }

  // Stored values are outside input: a plugin may have been removed since, or the entry
  // hand-edited. Fall back to whatever is actually registered.
  function sanitize(state) {
    const first = (reg) => Object.keys(reg)[0];
    if (!PM.patterns[state.patternId])   state.patternId  = first(PM.patterns);
    if (!PM.tools[state.toolId])         state.toolId     = first(PM.tools);
    if (!PM.renderers[state.rendererId]) state.rendererId = first(PM.renderers);
    if (!PM.posts[state.postId])         state.postId     = first(PM.posts);
    // A stored 0 would trip the stepdown guard and block every render.
    if (!(state.cam.maxDOC > 0)) state.cam.maxDOC = 0.6;
    state.sliderPos = Math.min(1, Math.max(0, +state.sliderPos || 1));
    if (!state.sections || typeof state.sections !== 'object') state.sections = {};
  }

  // Restores the open/closed state of every <details class="group" id="..."> and keeps it
  // in sync from there on.
  function bindSections(state, onChange) {
    document.querySelectorAll('details.group[id]').forEach((d) => {
      if (state.sections[d.id] != null) d.open = !!state.sections[d.id];
      d.addEventListener('toggle', () => { state.sections[d.id] = d.open; onChange(); });
    });
  }

  return { save, load, clear, sanitize, bindSections };
})();
