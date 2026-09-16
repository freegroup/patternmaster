// PatternMaster — Toolpath-Modell + Geometrie-Helfer.
// EINZIGE Quelle für GRBL-Export UND Simulation. G-Code wird NIE zurückgeparst.
// Koordinaten: Nullpunkt links-unten, Z0 = Werkstückoberfläche, Z negativ = Material.
window.PM = window.PM || {};

PM.Toolpath = class {
  constructor(opts = {}) {
    this.moves = [];               // { type:'rapid'|'cut', x, y, z }
    this.simPasses = [];           // full-depth polylines (pre-stepdown) for the simulator
    this.safeZ = opts.safeZ ?? 5;  // Rückzughöhe über Oberfläche
    // Max. Zustelltiefe pro Durchgang (mm). Muss > 0 sein — es gibt bewusst KEINEN
    // "unbegrenzt"-Fall, damit nie versehentlich die volle Tiefe in einem Zug gefahren wird.
    this.maxDOC = opts.maxDOC;
    if (!(this.maxDOC > 0)) throw new Error('Max stepdown / pass must be greater than 0.');
    this.pos = { x: 0, y: 0, z: this.safeZ };
    this.cutLen = 0;
    this.rapidLen = 0;
    this.bounds = { minX: Infinity, minY: Infinity, minZ: 0, maxX: -Infinity, maxY: -Infinity, maxZ: 0 };
  }
  _dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
  _track(x, y, z) {
    const b = this.bounds;
    if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
    if (z < b.minZ) b.minZ = z; if (z > b.maxZ) b.maxZ = z;
  }
  rapid(x, y, z) {
    z = (z == null) ? this.pos.z : z;
    const n = { type: 'rapid', x, y, z };
    this.rapidLen += this._dist(this.pos, n);
    this.moves.push(n); this.pos = { x, y, z };
  }
  cut(x, y, z) {
    z = (z == null) ? this.pos.z : z;
    const n = { type: 'cut', x, y, z };
    this.cutLen += this._dist(this.pos, n);
    this.moves.push(n); this.pos = { x, y, z };
    this._track(x, y, z);
  }
  // Sicher zu XY fahren: hoch, über Ziel, (Plunge macht der Aufrufer per cut()).
  travelTo(x, y) {
    if (this.pos.z < this.safeZ) this.rapid(this.pos.x, this.pos.y, this.safeZ);
    this.rapid(x, y, this.safeZ);
  }
  // Polylinie fräsen: erster Punkt = Plunge, Rest = Schnitt.
  // Tiefer als maxDOC -> Zerlegung in gestaffelte Ebenen (Zustellung), mit
  // alternierender Richtung -> kein Rückzug/Luftfahren zwischen den Ebenen.
  pass(pts) {
    if (!pts || pts.length < 1) return;
    // Full-depth polyline kept aside for the simulation. The stepdown levels below only ever cut
    // shallower at the same XY, so for the height map (H = min) the final full-depth pass alone is
    // exact — feeding just these to the simulator skips the level blow-up with no visual change.
    this.simPasses.push(pts);
    let maxDepth = 0;
    for (const p of pts) if (-p.z > maxDepth) maxDepth = -p.z;

    // Always retract and rapid over to the start first, THEN plunge — otherwise the tool would cut
    // a straight line at depth from the end of the previous pass to here (gouging the workpiece
    // and the exported G-code, e.g. straight across the board between two scattered lakes).
    this.travelTo(pts[0].x, pts[0].y);

    if (maxDepth <= this.maxDOC) {
      this._passAt(pts, 1, Infinity);
      return;
    }
    const levels = Math.ceil(maxDepth / this.maxDOC);
    let seq = pts;
    for (let lv = 1; lv <= levels; lv++) {
      const limit = lv * this.maxDOC; // erlaubte Tiefe dieser Ebene (positiv)
      // Am Bahnende tiefer plungen; Richtung alternierend -> kein Luftfahren zwischen den Ebenen.
      this._passAt(seq, /*plunge*/ true, limit);
      seq = seq.slice().reverse(); // nächste Ebene in Gegenrichtung
    }
  }
  // Interner Schnitt einer Polylinie mit optionaler Tiefenbegrenzung `limit` (mm, positiv).
  _passAt(pts, plunge, limit) {
    const zc = (z) => (isFinite(limit) ? Math.max(z, -limit) : z);
    this.cut(pts[0].x, pts[0].y, zc(pts[0].z));
    for (let i = 1; i < pts.length; i++) this.cut(pts[i].x, pts[i].y, zc(pts[i].z));
  }
  finish() {
    if (this.pos.z < this.safeZ) this.rapid(this.pos.x, this.pos.y, this.safeZ);
  }
  // Segments for the simulation: the full-depth polylines only (no stepdown levels, which are
  // redundant for a min-blended height map). Order matches the machining pass order, so slicing a
  // prefix still scrubs through the cutting sequence. Memoised — call only after any coordinate
  // shift (e.g. overshoot) has been applied to simPasses, since the first call freezes the result.
  simSegments() {
    if (this._simSegs) return this._simSegs;
    const segs = [];
    for (const pts of this.simPasses)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        segs.push({ x0: a.x, y0: a.y, z0: a.z, x1: b.x, y1: b.y, z1: b.z });
      }
    return (this._simSegs = segs);
  }
};

// -------- Geometrie-Helfer --------
PM.geom = {
  // Liang–Barsky: Strahl (px,py)+t*(dx,dy) gegen Rechteck [0,w]x[0,h]. -> [t0,t1] | null
  clipRay(px, py, dx, dy, w, h) {
    let t0 = -Infinity, t1 = Infinity;
    const p = [-dx, dx, -dy, dy];
    const q = [px, w - px, py, h - py];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; }
      else {
        const r = q[i] / p[i];
        if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
        else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
    }
    return t0 <= t1 ? [t0, t1] : null;
  },
  // Parallele Linien (Winkel°, Abstand step) geclippt auf [0,w]x[0,h].
  hatch(w, h, angleDeg, step, phase = 0) {
    const th = angleDeg * Math.PI / 180;
    const dx = Math.cos(th), dy = Math.sin(th);
    const nx = -dy, ny = dx; // Normale (Einheit)
    let nmin = Infinity, nmax = -Infinity;
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const pn = cx * nx + cy * ny;
      if (pn < nmin) nmin = pn; if (pn > nmax) nmax = pn;
    }
    const lines = [];
    for (let o = nmin + phase; o <= nmax; o += step) {
      const bx = o * nx, by = o * ny;
      const clip = this.clipRay(bx, by, dx, dy, w, h);
      if (clip) lines.push({
        x0: bx + dx * clip[0], y0: by + dy * clip[0],
        x1: bx + dx * clip[1], y1: by + dy * clip[1]
      });
    }
    return lines;
  }
};
