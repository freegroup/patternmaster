// PatternMaster — Path-Processor registry + loader + pipeline worker.
// A processor is a plugin between the pattern (produces paths) and the toolpath/G-code:
// it takes the previous stage's paths + a context and returns transformed paths (in -> out),
// knowing nothing about the rest of the chain. First processor: clipping. Later: smooth,
// round-corner, soften, DXF/SVG outline, ...
//
// Each processor: { id, name, params?, process(paths, ctx) -> paths }.
//   paths = Array of polylines; a polyline = Array of {x,y,z}.
//   ctx   = { work:{w,h}, overshoot:{x,y}, geometry:{polygon:[{x,y}...]}, tool:{radius}, params }.
//   process MUST be a pure function expression (only its args + ClipperLib + Math) so the pipeline
//   worker can embed it via toString().
window.PM = window.PM || {};

PM.processors = {};
PM.registerProcessor = (p) => { PM.processors[p.id] = p; };
PM.processorList = () => Object.values(PM.processors);

// ---- Pipeline: runs the processor chain in a Blob worker so the UI never freezes. ----
// Built lazily from PM.ClipperSource (embedded jsclipper) + each processor's process.toString().
// file:// blocks new Worker('file://…') and importScripts, so everything is inlined in the blob.
// Latest job wins; a new job aborts a running stale one. Sync fallback if the worker won't build.
PM.runProcessors = (function () {
  let worker = null, url = null, available = false;
  let curJob = 0, pending = null;

  function buildWorker() {
    const procs = PM.processorList();
    const defs = procs.map(p => 'PROCESSORS[' + JSON.stringify(p.id) + '] = ' + p.process.toString() + ';').join('\n');
    const src =
      (PM.ClipperSource || '') + '\n' +
      'ClipperLib.use_xyz = true;\n' +
      'var PROCESSORS = {};\n' + defs + '\n' +
      'self.onmessage = function (e) {\n' +
      '  var d = e.data, paths = d.paths;\n' +
      '  for (var i = 0; i < d.steps.length; i++) {\n' +
      '    var s = d.steps[i], fn = PROCESSORS[s.id];\n' +
      '    if (!fn) continue;\n' +
      '    var ctx = { work: d.baseCtx.work, overshoot: d.baseCtx.overshoot, geometry: d.baseCtx.geometry, tool: d.baseCtx.tool, params: s.params };\n' +
      '    paths = fn(paths, ctx);\n' +
      '  }\n' +
      '  self.postMessage({ jobId: d.jobId, paths: paths });\n' +
      '};';
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    spawn();
    available = true;
  }
  function spawn() {
    worker = new Worker(url);
    worker.onmessage = (e) => {
      if (!pending || e.data.jobId !== curJob) return;
      const p = pending; pending = null; p.resolve(e.data.paths);
    };
  }

  // Synchronous fallback (worker unavailable): processors run on the main thread.
  function runSync(paths, baseCtx, steps) {
    for (const s of steps) {
      const proc = PM.processors[s.id];
      if (!proc) continue;
      paths = proc.process(paths, {
        work: baseCtx.work, overshoot: baseCtx.overshoot,
        geometry: baseCtx.geometry, tool: baseCtx.tool, params: s.params
      });
    }
    return paths;
  }

  return function runProcessors(paths, baseCtx, steps) {
    if (!steps || !steps.length) return Promise.resolve(paths);
    if (worker === null && url === null) { try { buildWorker(); } catch (e) { available = false; } }
    if (!available) return Promise.resolve(runSync(paths, baseCtx, steps));

    curJob++;
    const jobId = curJob;
    if (pending) { const prev = pending; pending = null; worker.terminate(); spawn(); prev.reject(new Error('superseded')); }
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      worker.postMessage({ jobId, paths, baseCtx, steps });
    });
  };
})();

(function () {
  const base = 'js/processors/';
  const PROCESSOR_FILES = ['clipping'];
  for (const f of PROCESSOR_FILES) document.write('<script src="' + base + f + '.js"><\/script>');
})();
