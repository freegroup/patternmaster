// PatternMaster — CPU Z-Map Simulator.
// Höhenkarte (Float32Array), pro Schnitt-Segment "swept capsule": H = min(H, z_tip + f(d)).
// Nur über die Bounding-Box des Segments iterieren. Austauschbares Backend (später GPU).
window.PM = window.PM || {};

PM.Simulator = class {
  constructor(work, cellSize) {
    this.setResolution(work, cellSize);
  }
  setResolution(work, cellSize) {
    this.work = work;
    this.cell = cellSize;
    this.nx = Math.max(2, Math.ceil(work.w / cellSize) + 1);
    this.ny = Math.max(2, Math.ceil(work.h / cellSize) + 1);
    this.H = new Float32Array(this.nx * this.ny); // 0 = Oberfläche
  }
  reset() { this.H.fill(0); }

  // seg: {x0,y0,z0,x1,y1,z1}; tool: {radius, profile(d)}
  stampSegment(seg, tool) {
    const R = tool.radius, cell = this.cell, prof = tool.profile;
    const minX = Math.min(seg.x0, seg.x1) - R, maxX = Math.max(seg.x0, seg.x1) + R;
    const minY = Math.min(seg.y0, seg.y1) - R, maxY = Math.max(seg.y0, seg.y1) + R;
    const ix0 = Math.max(0, Math.floor(minX / cell)), ix1 = Math.min(this.nx - 1, Math.ceil(maxX / cell));
    const iy0 = Math.max(0, Math.floor(minY / cell)), iy1 = Math.min(this.ny - 1, Math.ceil(maxY / cell));
    if (ix1 < ix0 || iy1 < iy0) return;
    const dx = seg.x1 - seg.x0, dy = seg.y1 - seg.y0;
    const L2 = dx * dx + dy * dy;
    const dz = seg.z1 - seg.z0;
    const R2 = R * R, H = this.H, nx = this.nx;
    for (let iy = iy0; iy <= iy1; iy++) {
      const py = iy * cell;
      const row = iy * nx;
      for (let ix = ix0; ix <= ix1; ix++) {
        const px = ix * cell;
        let t = L2 > 0 ? ((px - seg.x0) * dx + (py - seg.y0) * dy) / L2 : 0;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const cx = seg.x0 + dx * t, cy = seg.y0 + dy * t;
        const ex = px - cx, ey = py - cy;
        const d2 = ex * ex + ey * ey;
        if (d2 > R2) continue;
        const off = prof(Math.sqrt(d2));
        if (!isFinite(off)) continue;
        const z = (seg.z0 + dz * t) + off;
        const k = row + ix;
        if (z < H[k]) H[k] = z;
      }
    }
  }

  run(segments, tool, onProgress) {
    this.reset();
    const n = segments.length;
    for (let i = 0; i < n; i++) {
      this.stampSegment(segments[i], tool);
      if (onProgress && (i & 2047) === 0) onProgress(i / n);
    }
  }
};
