// PatternMaster — App / UI-Verdrahtung.
// Baut dynamische Param-Forms aus den Plugin-Schemata, betreibt die Live-Pipeline
// (Generator -> Toolpath -> Simulator -> Renderer) und exportiert via aktivem Post-Prozessor.
(function () {
  'use strict';

  // ---------- Default-State ----------
  const state = {
    work: { w: 600, h: 400, overshootX: 0, overshootY: 0 },
    seed: 12345,
    toolId: 'ball',
    patternId: 'parallel',
    cam: { maxDOC: 0.6, safeZ: 5, feed: 1200, plungeFeed: 400, rapidRate: 3000, spindle: 18000 },
    rendererId: 'cpu',
    postId: 'grbl',
    sliderPos: 1,     // Pfad-Scrubber (0..1) — nur Anzeige, nie Export
    sections: {},     // { sectionId: offen? } — Auf-/Zuklapp-Zustand der Sidebar
    toolVals: {},     // { toolId: {param: value} }
    patternVals: {}   // { patternId: {param: value} }
  };

  // Persistenz liegt in js/ui-settings.js — jede Änderung landet im localStorage.
  const persist = () => PM.settings.save(state);

  const MAX_CELLS = 24e6; // Schutz gegen zu große Raster
  const CELL_BUDGET = 12e6; // Ziel-Zellzahl für "best" (fein, aber performant)
  // Auflösung fest auf "best": feinste Zellgröße, die im Budget bleibt (min. 0.1 mm).
  const computeCell = () => Math.max(0.1, Math.sqrt(state.work.w * state.work.h / CELL_BUDGET));
  // Feste, realistische Erscheinung (nicht konfigurierbar): true-scale 1:1, kein Grain, eine Holzfarbe.
  const APPEARANCE = { lightAz: 35, lightEl: 32, spec: 0.28, shininess: 20, wood: [181, 133, 78] };

  // ---------- Helfer ----------
  const $ = (id) => document.getElementById(id);
  const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]]; a[ks[ks.length - 1]] = v; };
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const fmtLen = (mm) => mm >= 1000 ? (mm / 1000).toFixed(2) + ' m' : mm.toFixed(0) + ' mm';
  const fmtTime = (min) => {
    if (!isFinite(min) || min <= 0) return '–';
    const s = Math.round(min * 60), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + 'h ' : '') + (m || h ? m + 'm ' : '') + ss + 's';
  };
  const defaultFor = (s) => s.type === 'range2' ? { a: s.defaultA, b: s.defaultB } : s.default;
  const defaultsFor = (schema) => { const o = {}; for (const k in schema) o[k] = defaultFor(schema[k]); return o; };

  // Param-Werte eines Tools/Patterns holen (mit Lazy-Defaults, unbekannte Keys ergänzen).
  function toolVals() {
    const schema = PM.tools[state.toolId].params;
    const v = state.toolVals[state.toolId] || (state.toolVals[state.toolId] = defaultsFor(schema));
    for (const k in schema) if (v[k] == null) v[k] = defaultFor(schema[k]);
    return v;
  }
  function patternVals() {
    const schema = PM.patterns[state.patternId].params;
    const v = state.patternVals[state.patternId] || (state.patternVals[state.patternId] = defaultsFor(schema));
    for (const k in schema) if (v[k] == null) v[k] = defaultFor(schema[k]);
    return v;
  }

  // ---------- Hilfe-Popover ----------
  let helpPop = null, helpAnchor = null;

  function closeHelp() {
    if (helpPop) helpPop.hidden = true;
    if (helpAnchor) helpAnchor.classList.remove('open');
    helpAnchor = null;
  }

  function showHelp(key, anchor, title) {
    const entry = PM.helpFor(key);
    if (!entry) return;
    if (!helpPop) {
      helpPop = document.createElement('div');
      helpPop.id = 'helpPop'; helpPop.hidden = true;
      helpPop.addEventListener('click', (e) => e.stopPropagation());
      document.body.appendChild(helpPop);
    }
    closeHelp();
    helpPop.innerHTML = '<h4></h4><div class="hp-body"></div>';
    helpPop.querySelector('h4').textContent = title;          // Titel als Text (nicht HTML)
    helpPop.querySelector('.hp-body').innerHTML = entry.description || ''; // Beschreibung darf HTML
    helpPop.hidden = false;
    helpAnchor = anchor; anchor.classList.add('open');
    // Bevorzugt rechts neben dem Icon, sonst links; immer im Viewport halten.
    const r = anchor.getBoundingClientRect(), pw = helpPop.offsetWidth, ph = helpPop.offsetHeight;
    let left = r.right + 10;
    if (left + pw > window.innerWidth - 8) left = r.left - pw - 10;
    helpPop.style.left = Math.max(8, left) + 'px';
    helpPop.style.top = Math.max(8, Math.min(r.top - 8, window.innerHeight - ph - 8)) + 'px';
  }

  // Rüstet jedes <label data-help="..."> unterhalb von `root` mit einem (?) aus.
  // Labels ohne passenden Eintrag in PM.help bleiben unangetastet.
  function activateHelp(root) {
    root.querySelectorAll('label[data-help]').forEach((lab) => {
      if (lab.querySelector('.helpico')) return;          // schon aktiviert
      const key = lab.dataset.help;
      if (!PM.helpFor(key)) return;
      const title = lab.textContent.trim();
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'helpico'; b.textContent = '?';
      b.setAttribute('aria-label', 'Help for ' + title);
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (helpAnchor === b) { closeHelp(); return; }    // gleiches Icon = zuklappen
        showHelp(key, b, title);
      });
      lab.appendChild(b);
    });
  }

  // ---------- Dynamische Param-Formulare ----------
  function buildParamForm(container, schema, values, keyPrefix) {
    container.innerHTML = '';
    for (const key in schema) {
      const s = schema[key];
      const helpKey = keyPrefix + '.' + key;
      const wrap = document.createElement('div');
      const unit = s.unit ? ' ' + s.unit : '';
      if (s.type === 'range2') {
        // Single-line from–to: replaces separate min/max or value+jitter params.
        if (!values[key] || typeof values[key] !== 'object') values[key] = { a: s.defaultA, b: s.defaultB };
        wrap.className = 'field range2row';
        wrap.innerHTML = `<label data-help="${helpKey}">${s.label}${s.unit ? ' (' + s.unit + ')' : ''}</label>
          <div class="r2wrap">
            <input type="number" class="r2a" min="${s.min}" max="${s.max}" step="${s.step}">
            <span class="r2sep">–</span>
            <input type="number" class="r2b" min="${s.min}" max="${s.max}" step="${s.step}">
          </div>`;
        const ia = wrap.querySelector('.r2a'), ib = wrap.querySelector('.r2b');
        ia.value = values[key].a; ib.value = values[key].b;
        const upd = () => { values[key] = { a: parseFloat(ia.value), b: parseFloat(ib.value) }; schedule(); };
        ia.addEventListener('input', upd); ib.addEventListener('input', upd);
        container.appendChild(wrap);
      } else if (s.type === 'select') {
        // Fixed set of named profiles — [value, label] pairs, no free numeric input.
        wrap.className = 'field';
        const opts = s.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
        wrap.innerHTML = `<label data-help="${helpKey}">${s.label}</label><select>${opts}</select>`;
        const sel = wrap.querySelector('select');
        sel.value = values[key];
        sel.addEventListener('change', () => { values[key] = sel.value; schedule(); });
        container.appendChild(wrap);
      } else if (s.type === 'range') {
        wrap.className = 'field range';
        wrap.innerHTML = `<input type="range" min="${s.min}" max="${s.max}" step="${s.step}"><span class="val"></span>`;
        const inp = wrap.querySelector('input'), val = wrap.querySelector('.val');
        // eigenes Label darüber
        const lab = document.createElement('div'); lab.className = 'field'; lab.style.margin = '7px 0 0';
        lab.innerHTML = `<label data-help="${helpKey}">${s.label}</label><span class="val"></span>`;
        inp.value = values[key];
        const upd = () => { lab.querySelector('.val').textContent = (+inp.value) + unit; };
        upd();
        inp.addEventListener('input', () => { values[key] = parseFloat(inp.value); upd(); schedule(); });
        container.appendChild(lab); container.appendChild(wrap);
      } else {
        wrap.className = 'field';
        wrap.innerHTML = `<label data-help="${helpKey}">${s.label}${unit ? ' (' + s.unit + ')' : ''}</label><input type="number" min="${s.min}" max="${s.max}" step="${s.step}">`;
        const inp = wrap.querySelector('input');
        inp.value = values[key];
        inp.addEventListener('input', () => { values[key] = parseFloat(inp.value); schedule(); });
        container.appendChild(wrap);
      }
    }
    activateHelp(container);
  }

  function rebuildToolForm() { buildParamForm($('toolParams'), PM.tools[state.toolId].params, toolVals(), 'tool.' + state.toolId); }
  function rebuildPatternForm() { buildParamForm($('patternParams'), PM.patterns[state.patternId].params, patternVals(), 'pattern.' + state.patternId); }

  // ---------- Selects befüllen ----------
  function fillSelect(el, list, current, onChange) {
    el.innerHTML = '';
    for (const it of list) {
      const o = document.createElement('option');
      o.value = it.id; o.textContent = it.name; el.appendChild(o);
    }
    el.value = current;
    el.addEventListener('change', () => onChange(el.value));
  }

  // ---------- Generisches Binding für statische Felder ----------
  function bindStatic() {
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const path = el.getAttribute('data-bind');
      const cur = getPath(state, path);
      if (el.type === 'color') el.value = cur;
      else el.value = cur;
      const ev = (el.type === 'range' || el.type === 'number') ? 'input' : 'input';
      el.addEventListener(ev, () => {
        let v = el.value;
        if (el.type === 'number' || el.type === 'range') v = parseFloat(v);
        setPath(state, path, v);
        updateReadouts();
        schedule();
      });
    });
  }

  function updateReadouts() { /* readouts removed — no DOM targets remain */ }

  // ---------- Pipeline ----------
  let renderer = null, rendererId = null;
  let sim = null;
  let lastTp = null, lastTool = null, lastRenderOpts = {};
  let sliderFrame = 0;

  function ensureRenderer() {
    if (rendererId !== state.rendererId || !renderer) {
      if (renderer && renderer.unmount) renderer.unmount();
      renderer = PM.renderers[state.rendererId].make();
      renderer.mount($('viewWrap'));
      rendererId = state.rendererId;
    }
    return renderer;
  }

  function buildToolpath() {
    const tool = PM.tools[state.toolId].make(toolVals());
    const tp = new PM.Toolpath({ safeZ: state.cam.safeZ, maxDOC: state.cam.maxDOC });
    // Deterministisch: Generatoren nutzen PM.hash(seed, index...) statt eines RNG.
    const noise = new PM.Noise((state.seed ^ 0x9e3779b9) >>> 0);
    // Overshoot X/Y: Generator arbeitet über ein vergrößertes Rechteck; danach zurückschieben,
    // sodass Werkstück bei (0..w, 0..h) bleibt und Bahnen um mx/my über die Kanten überstehen.
    const mx = Math.max(0, state.work.overshootX || 0), my = Math.max(0, state.work.overshootY || 0);
    const gw = { w: state.work.w + 2 * mx, h: state.work.h + 2 * my };
    PM.patterns[state.patternId].generate({ work: gw, tool, seed: state.seed >>> 0, hash: PM.hash, noise, params: patternVals(), tp });
    tp.finish();
    if (mx || my) for (const mv of tp.moves) { mv.x -= mx; mv.y -= my; }
    return { tp, tool };
  }

  function drawToDisplay() { /* renderers now own their canvas + fitting; kept for compatibility */ }

  function updateMetrics(tp, tool) {
    // Scallop: nur für Kugelkopf + Muster mit Stepover/Abstand — wird nicht mehr angezeigt, aber berechnet für ggf. spätere Nutzung.
  }

  // Zweistufige Vorschau: Jede Änderung zeichnet sofort auf grobem Raster, damit das UI
  // reagiert. Bleibt es danach kurz ruhig, wird in voller Auflösung nachgezogen.
  // Die SEGMENTE sind in beiden Stufen dieselben — nur die Rasterweite unterscheidet sich.
  // Der Toolpath wird also nie vergröbert, das Endbild ist exakt.
  const DRAFT_FACTOR = 3;     // gröberes Raster: ~9x weniger Zellen, ~7x schneller
  const REFINE_DELAY = 250;   // ms Ruhe, bevor das scharfe Bild gerechnet wird
  let refineTimer = 0;

  // applySlider: re-uses the already-built toolpath; slices moves/segments for display only.
  // Export always uses the full lastTp — the slider only controls what the renderer sees.
  function applySlider(draft) {
    if (!lastTp || !sim) return;
    const allSegs = lastTp.cutSegments();
    const allMv = lastTp.moves;
    const n  = state.sliderPos >= 1 ? allSegs.length : Math.max(1, Math.round(allSegs.length * state.sliderPos));
    const nm = state.sliderPos >= 1 ? allMv.length   : Math.max(1, Math.round(allMv.length   * state.sliderPos));
    if (state.rendererId !== 'cam' && lastTool) {
      sim.setResolution(state.work, computeCell() * (draft ? DRAFT_FACTOR : 1));
      sim.run(allSegs.slice(0, n), lastTool);
    }
    ensureRenderer().update(sim, Object.assign({}, lastRenderOpts, { moves: allMv.slice(0, nm) }));
  }

  // Grob zeichnen und das scharfe Bild einplanen. Jeder neue Aufruf verwirft die noch
  // ausstehende Verfeinerung — beim Ziehen eines Reglers wird also nur einmal am Ende gerechnet.
  function drawStaged() {
    clearTimeout(refineTimer);
    applySlider(true);
    $('busy').textContent = '○';                       // grobes Bild steht
    refineTimer = setTimeout(() => {
      applySlider(false);
      $('busy').textContent = '';
    }, REFINE_DELAY);
  }

  function runPipeline() {
    $('mErrWrap').style.display = 'none';
    const cell = computeCell();
    const nx = Math.ceil(state.work.w / cell) + 1;
    const ny = Math.ceil(state.work.h / cell) + 1;
    if (nx * ny > MAX_CELLS) {
      showError(`Grid too large (${(nx * ny / 1e6).toFixed(1)} M cells).`);
      return;
    }
    const t0 = performance.now();
    const { tp, tool } = buildToolpath();
    lastTp = tp; lastTool = tool;
    const wood = APPEARANCE.wood;
    lastRenderOpts = {
      woodNoise: null, grain: 0, zScale: 1,
      lightAz: APPEARANCE.lightAz, lightEl: APPEARANCE.lightEl,
      spec: APPEARANCE.spec, shininess: APPEARANCE.shininess,
      woodLight: wood, woodDark: wood
    };
    if (!sim) sim = new PM.Simulator(state.work, cell);
    drawStaged();  // sofort grob, kurz danach scharf — applySlider setzt das Raster selbst
    updateMetrics(tp, tool);
    const est = PM.metrics.estimate(tp, state.cam.feed, state.cam.rapidRate);
    const vt = $('viewTime');
    if (vt) vt.textContent = fmtTime(est.totalMin) + '  ·  ' + Math.round(performance.now() - t0) + ' ms';
  }

  function showError(msg) {
    $('mErrWrap').style.display = ''; $('mErr').textContent = msg;
    console.warn('[PatternMaster]', msg);
  }

  // ---------- Live-Scheduling (debounced via rAF) ----------
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    $('busy').textContent = '…';
    requestAnimationFrame(() => {
      scheduled = false;
      try { runPipeline(); } catch (e) { showError(e.message || String(e)); console.error(e); }
      persist();
    });
  }

  // ---------- Export / Save / Load ----------
  function download(name, text, mime = 'text/plain') {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function exportGcode() {
    if (!lastTp) return;
    const post = PM.posts[state.postId];
    const txt = post.emit(lastTp, {
      feed: state.cam.feed, plungeFeed: state.cam.plungeFeed, spindle: state.cam.spindle
    });
    download(`pattern_${state.patternId}_${state.seed}.${post.ext}`, txt);
  }

  function saveSettings() {
    download('patternmaster-settings.json', JSON.stringify(state, null, 2), 'application/json');
  }
  function loadSettings(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        Object.assign(state, s);
        PM.settings.sanitize(state);   // gleiche Prüfung wie beim Laden aus dem Speicher
        initFromState(); schedule();
      } catch (e) { showError('Invalid file: ' + e.message); }
    };
    r.readAsText(file);
  }

  // 2D/3D-Umschalter (Overlay in der Ansicht) — einziger Darstellungs-Regler.
  function updateViewToggle() {
    document.querySelectorAll('#viewToggle button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.rendererId));
    // Der Bedienhinweis gilt nur für die räumlichen Ansichten; der Reset bleibt immer
    // sichtbar und setzt die geteilte Kamera für ALLE Ansichten zurück — auch aus 2D heraus,
    // sodass 3D und CAM beim Umschalten schon wieder eingepasst sind.
    $('viewHint').style.display = (state.rendererId === 'webgl3d' || state.rendererId === 'cam') ? '' : 'none';
  }
  function setupViewToggle() {
    document.querySelectorAll('#viewToggle button').forEach((b) => b.addEventListener('click', () => {
      if (state.rendererId === b.dataset.view) return;
      state.rendererId = b.dataset.view; updateViewToggle(); schedule();
    }));
  }

  // Nach Laden externer Einstellungen: Selects/Forms/Inputs neu setzen.
  function initFromState() {
    $('patternSel').value = state.patternId;
    $('toolSel').value = state.toolId;
    $('postSel').value = state.postId;
    updateViewToggle();
    $('pathSlider').value = Math.round(state.sliderPos * 1000);
    document.querySelectorAll('[data-bind]').forEach((el) => { el.value = getPath(state, el.getAttribute('data-bind')); });
    rebuildToolForm(); rebuildPatternForm(); updateReadouts();
  }

  // ---------- Init ----------
  function init() {
    PM.settings.load(state);                       // gespeicherten Stand VOR dem Aufbau übernehmen
    PM.settings.bindSections(state, persist);      // Auf-/Zuklapp-Zustand der Sidebar
    fillSelect($('patternSel'), PM.patternList(), state.patternId, (id) => { state.patternId = id; rebuildPatternForm(); schedule(); });
    fillSelect($('toolSel'), PM.toolList(), state.toolId, (id) => { state.toolId = id; rebuildToolForm(); schedule(); });
    fillSelect($('postSel'), PM.postList(), state.postId, (id) => { state.postId = id; });
    setupViewToggle(); updateViewToggle();
    $('pathSlider').value = Math.round(state.sliderPos * 1000);

    bindStatic();
    rebuildToolForm();
    rebuildPatternForm();
    updateReadouts();
    activateHelp(document);                                  // statische Labels
    document.addEventListener('click', closeHelp);           // Klick daneben schließt

    $('diceSeed').addEventListener('click', () => { state.seed = (Math.random() * 1e9) | 0 || 1; document.querySelector('[data-bind="seed"]').value = state.seed; schedule(); });

    // Kamera zurücksetzen. Kein schedule() — der Toolpath ändert sich nicht, es genügt ein
    // erneutes Zeichnen. Das geleerte framedFor lässt den Renderer dabei neu einpassen.
    $('btnResetView').addEventListener('click', () => {
      PM.resetView();
      drawStaged();
      persist();
    });

    // Path scrubber: controls how many moves/segments the renderer sees (display only, not export).
    // rAF bündelt die Eingabe-Events; drawStaged zeichnet dabei grob und zieht erst nach,
    // wenn der Regler stillsteht. (Ohne die Pfeilfunktion bekäme drawStaged den rAF-Zeitstempel.)
    $('pathSlider').addEventListener('input', () => {
      state.sliderPos = parseInt($('pathSlider').value) / 1000;
      persist();
      cancelAnimationFrame(sliderFrame);
      sliderFrame = requestAnimationFrame(() => drawStaged());
    });
    // Toolbar: Export-Dialog, Config speichern/laden
    const modal = $('modalBackdrop');
    const closeModal = () => { modal.hidden = true; };
    $('btnExport').addEventListener('click', () => { modal.hidden = false; });
    $('modalCancel').addEventListener('click', closeModal);
    $('modalExport').addEventListener('click', () => { exportGcode(); closeModal(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeHelp(); closeModal(); } });
    $('btnSave').addEventListener('click', saveSettings);
    $('btnLoad').addEventListener('click', () => $('fileLoad').click());
    $('fileLoad').addEventListener('change', (e) => { if (e.target.files[0]) loadSettings(e.target.files[0]); });

    // Orbit/Pan/Zoom laufen im Renderer und lösen keine Pipeline aus, also auch kein persist().
    // Daher hier ein eigener, entprellter Speicherpunkt — nicht bei jeder Mausbewegung, sondern
    // wenn die Geste zu Ende ist. pagehide fängt zusätzlich Reload und Tab-Schließen ab.
    let camSave;
    const saveCameraSoon = () => { clearTimeout(camSave); camSave = setTimeout(persist, 600); };
    $('viewWrap').addEventListener('pointerup', saveCameraSoon);
    $('viewWrap').addEventListener('wheel', saveCameraSoon, { passive: true });
    window.addEventListener('pagehide', persist);

    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(schedule, 100); });

    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
