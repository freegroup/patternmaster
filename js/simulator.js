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
    // Tiefster Punkt, den dieses Segment überhaupt erzeugen kann (profile() ist nie negativ).
    // Zellen, die schon tiefer liegen, kann es nicht mehr verändern -> vor Wurzel und
    // Profilaufruf abbrechen. Bei Rampen überlappen sich die Stempel stark, dort greift das oft.
    const zFloor = Math.min(seg.z0, seg.z1);
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
        const k = row + ix;
        if (H[k] <= zFloor) continue;          // schon tiefer -> dieses Segment ändert nichts
        const off = prof(Math.sqrt(d2));
        if (!isFinite(off)) continue;
        const z = (seg.z0 + dz * t) + off;
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

// Pure Z-Map stamp kernel — same math as stampSegment (incl. the zFloor early-out), but reads the
// tool profile from a lookup table instead of a closure so it can run in a Worker with no plugin
// code. `segs` is packed [x0,y0,z0,x1,y1,z1, ...]; `lut` samples profile(d) over d in [0, R].
// Defined as a NAMED function so its .toString() can be dropped straight into a Worker blob.
PM.simStampKernel = function simStampKernel(H, segs, count, nx, ny, cell, R, lut, lutN) {
  const R2 = R * R, invStep = (lutN - 1) / R;
  for (let s = 0; s < count; s++) {
    const o = s * 6;
    const x0 = segs[o], y0 = segs[o + 1], z0 = segs[o + 2];
    const x1 = segs[o + 3], y1 = segs[o + 4], z1 = segs[o + 5];
    const minX = Math.min(x0, x1) - R, maxX = Math.max(x0, x1) + R;
    const minY = Math.min(y0, y1) - R, maxY = Math.max(y0, y1) + R;
    const ix0 = Math.max(0, Math.floor(minX / cell)), ix1 = Math.min(nx - 1, Math.ceil(maxX / cell));
    const iy0 = Math.max(0, Math.floor(minY / cell)), iy1 = Math.min(ny - 1, Math.ceil(maxY / cell));
    if (ix1 < ix0 || iy1 < iy0) continue;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, dz = z1 - z0;
    const zFloor = Math.min(z0, z1);
    for (let iy = iy0; iy <= iy1; iy++) {
      const py = iy * cell, row = iy * nx;
      for (let ix = ix0; ix <= ix1; ix++) {
        const px = ix * cell;
        let t = L2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / L2 : 0;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const cx = x0 + dx * t, cy = y0 + dy * t;
        const ex = px - cx, ey = py - cy, d2 = ex * ex + ey * ey;
        if (d2 > R2) continue;
        const k = row + ix;
        if (H[k] <= zFloor) continue;
        const f = Math.sqrt(d2) * invStep;
        let li = f | 0; if (li >= lutN - 1) li = lutN - 2;
        const off = lut[li] + (lut[li + 1] - lut[li]) * (f - li);
        const z = (z0 + dz * t) + off;
        if (z < H[k]) H[k] = z;
      }
    }
  }
};

// Off-main-thread runner for the stamp kernel. Same result as PM.Simulator, just computed in a
// Worker so the UI never freezes on the full-resolution pass. Built from a Blob (the standard
// file:// workaround — new Worker('file://…') and importScripts are blocked there) and carries
// only the kernel source, no plugins. `available` is false if the browser refuses to build it, so
// callers can fall back to the synchronous simulator. Latest job wins; a new job aborts a running
// stale one (terminate + respawn) so a long outdated pass can't hold up the queue.
PM.SimWorker = function () {
  let url = null;
  try {
    const src = PM.simStampKernel.toString() + '\n' +
      'self.onmessage=function(e){var d=e.data;var H=new Float32Array(d.nx*d.ny);' +
      'simStampKernel(H,d.segs,d.count,d.nx,d.ny,d.cell,d.radius,d.lut,d.lutN);' +
      'self.postMessage({jobId:d.jobId,H:H,nx:d.nx,ny:d.ny,cell:d.cell,work:d.work},[H.buffer]);};';
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  } catch (e) { /* Blob/URL unavailable */ }

  let worker = null, busy = false, curJob = 0, curCb = null;
  const spawn = () => {
    worker = new Worker(url);
    worker.onmessage = (e) => { busy = false; if (e.data.jobId === curJob && curCb) curCb(e.data); };
  };
  let available = false;
  if (url) { try { spawn(); available = true; } catch (e) { available = false; } }

  return {
    available,
    // job: { nx, ny, cell, radius, lut, lutN, segs (Float64Array, fresh), count, work }; cb(result)
    run(job, cb) {
      curJob++; job.jobId = curJob; curCb = cb;
      if (busy) { worker.terminate(); spawn(); } // abort the stale pass
      busy = true;
      worker.postMessage(job, [job.segs.buffer]); // segs transferred (zero-copy); lut cloned (tiny)
    }
  };
};

