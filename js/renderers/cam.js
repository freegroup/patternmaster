// CAM renderer — pure toolpath backplot (HoruCNC-style): rapids grey, cuts orange, on a
// light background with XYZ axes and orbit/pan/zoom. No workpiece — just the paths.
// Dependency-free WebGL2. Left-drag = orbit, shift/middle-drag = pan, wheel = zoom.
PM.registerRenderer({
  id: 'cam', name: 'CAM (toolpaths)',
  make() {
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block'; canvas.style.borderRadius = '2px'; canvas.style.cursor = 'grab';
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('The CAM view requires WebGL2.');
    let container = null, raf = 0, dirty = true;

    // ---- mat4 (column-major) ----
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrmz = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const perspective = (fovy, aspect, near, far) => { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]; };
    const lookAt = (eye, c, up) => { const z = nrmz(sub(eye, c)), x = nrmz(cross(up, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]; };
    const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };

    // ---- line shader ----
    const compile = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, `#version 300 es
in vec3 aPos; in vec3 aColor; uniform mat4 uMVP; out vec3 vC;
void main(){ gl_Position = uMVP * vec4(aPos,1.0); vC = aColor; }`));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float; in vec3 vC; out vec4 o; void main(){ o = vec4(vC,1.0); }`));
    gl.linkProgram(prog);
    const A = { pos: gl.getAttribLocation(prog, 'aPos'), col: gl.getAttribLocation(prog, 'aColor') };
    const U = { mvp: gl.getUniformLocation(prog, 'uMVP') };
    const posB = gl.createBuffer(), colB = gl.createBuffer();
    const fPosB = gl.createBuffer(), fColB = gl.createBuffer();
    let lineCount = 0, frameCount = 0;

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.949, 0.953, 0.968, 1); // light background like HoruCNC

    const RAPID = [0.62, 0.66, 0.72], CUT = [0.95, 0.62, 0.18], WIRE = [0.16, 0.28, 0.52];
    const cam = PM.viewCam;   // gemeinsam mit der 3D-Ansicht -> kein Sprung beim Umschalten
    let bbox = null;

    function build(moves, work) {
      const pos = [], col = [];
      const bb = { minx: 1e18, miny: 1e18, minz: 1e18, maxx: -1e18, maxy: -1e18, maxz: -1e18 };
      const grow = (x, y, z) => { if (x < bb.minx) bb.minx = x; if (y < bb.miny) bb.miny = y; if (z < bb.minz) bb.minz = z; if (x > bb.maxx) bb.maxx = x; if (y > bb.maxy) bb.maxy = y; if (z > bb.maxz) bb.maxz = z; };
      for (let i = 1; i < moves.length; i++) {
        const a = moves[i - 1], b = moves[i];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const c = b.type === 'rapid' ? RAPID : CUT;
        col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
        grow(b.x, b.y, b.z);
      }
      // XYZ-Achsen am Nullpunkt (Linien)
      const W = work ? work.w : 100, H = work ? work.h : 100;
      const len = 0.12 * Math.max(W, H, 10);
      const axis = (dx, dy, dz, c) => { pos.push(0, 0, 0, dx, dy, dz); col.push(c[0], c[1], c[2], c[0], c[1], c[2]); };
      axis(len, 0, 0, [0.85, 0.2, 0.2]); axis(0, len, 0, [0.2, 0.7, 0.3]); axis(0, 0, len, [0.3, 0.5, 0.95]);
      gl.bindBuffer(gl.ARRAY_BUFFER, posB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, colB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
      lineCount = pos.length / 3;

      // ---- Werkstück-Rahmen als dünne Balken, NACH INNEN versetzt ----
      // Außenkante des Balkens liegt exakt auf der Werkstück-Abmessung -> echtes Außenmaß.
      const deep = (bb.minz < 0 ? bb.minz : 0);
      const zb = Math.min(-8, deep - 3);
      const t = Math.max(0.4, 0.0015 * Math.max(W, H)); // Balkendicke (mm), dünn
      const fp = [], fc = [];
      const quad = (a, b, c, d) => { [a, b, c, a, c, d].forEach(p => { fp.push(p[0], p[1], p[2]); fc.push(WIRE[0], WIRE[1], WIRE[2]); }); };
      // Balken von der echten Kante nach innen (o1,o2 = Einwärts-Offsets, Länge t)
      const beam = (P0, P1, o1, o2) => {
        const A = (P, s1, s2) => [P[0] + s1 * o1[0] + s2 * o2[0], P[1] + s1 * o1[1] + s2 * o2[1], P[2] + s1 * o1[2] + s2 * o2[2]];
        const a0 = A(P0, 0, 0), a1 = A(P0, 1, 0), a2 = A(P0, 1, 1), a3 = A(P0, 0, 1);
        const b0 = A(P1, 0, 0), b1 = A(P1, 1, 0), b2 = A(P1, 1, 1), b3 = A(P1, 0, 1);
        quad(a0, a1, b1, b0); quad(a1, a2, b2, b1); quad(a2, a3, b3, b2); quad(a3, a0, b0, b3);
        quad(a0, a1, a2, a3); quad(b0, b3, b2, b1);
      };
      const C = [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0], [0, 0, zb], [W, 0, zb], [W, H, zb], [0, H, zb]];
      const X = t, Y = t, Z = t;
      const edges = [ // [i, j, inward-offset1, inward-offset2]
        [0, 1, [0, Y, 0], [0, 0, -Z]], [1, 2, [-X, 0, 0], [0, 0, -Z]], [2, 3, [0, -Y, 0], [0, 0, -Z]], [3, 0, [X, 0, 0], [0, 0, -Z]], // top ring (innen: nach unten)
        [4, 5, [0, Y, 0], [0, 0, Z]], [5, 6, [-X, 0, 0], [0, 0, Z]], [6, 7, [0, -Y, 0], [0, 0, Z]], [7, 4, [X, 0, 0], [0, 0, Z]],     // bottom ring (innen: nach oben)
        [0, 4, [X, 0, 0], [0, Y, 0]], [1, 5, [-X, 0, 0], [0, Y, 0]], [2, 6, [-X, 0, 0], [0, -Y, 0]], [3, 7, [X, 0, 0], [0, -Y, 0]]  // verticals
      ];
      for (const [i, j, o1, o2] of edges) beam(C[i], C[j], o1, o2);
      for (const c of C) grow(c[0], c[1], c[2]); // Fit schließt Werkstück ein
      gl.bindBuffer(gl.ARRAY_BUFFER, fPosB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fp), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, fColB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fc), gl.STATIC_DRAW);
      frameCount = fp.length / 3;
      bbox = bb;
    }

    function fitView() {
      const aspect = canvas.width / Math.max(1, canvas.height), b = bbox;
      const cs = [[b.minx, b.miny, b.minz], [b.maxx, b.miny, b.minz], [b.minx, b.maxy, b.minz], [b.maxx, b.maxy, b.minz],
                  [b.minx, b.miny, b.maxz], [b.maxx, b.miny, b.maxz], [b.minx, b.maxy, b.maxz], [b.maxx, b.maxy, b.maxz]];
      cam.target = [(b.minx + b.maxx) / 2, (b.miny + b.maxy) / 2, (b.minz + b.maxz) / 2];
      let dist = Math.max(b.maxx - b.minx, b.maxy - b.miny, 10);
      for (let it = 0; it < 5; it++) {
        const ce = Math.max(0.001, Math.cos(cam.el));
        const eye = [cam.target[0] + dist * ce * Math.cos(cam.az), cam.target[1] + dist * ce * Math.sin(cam.az), cam.target[2] + dist * Math.sin(cam.el)];
        const mvp = mul(perspective(40 * Math.PI / 180, aspect, dist * 0.03, dist * 6 + 2000), lookAt(eye, cam.target, [0, 0, 1]));
        let m = 1e-3;
        for (const c of cs) { const w = mvp[3] * c[0] + mvp[7] * c[1] + mvp[11] * c[2] + mvp[15]; const x = (mvp[0] * c[0] + mvp[4] * c[1] + mvp[8] * c[2] + mvp[12]) / w; const y = (mvp[1] * c[0] + mvp[5] * c[1] + mvp[9] * c[2] + mvp[13]) / w; m = Math.max(m, Math.abs(x), Math.abs(y)); }
        dist *= m / 0.9;
      }
      cam.dist = dist;
    }

    function syncSize() {
      const stage = container ? container.parentElement : null; if (!stage) return false;
      const w = Math.max(1, stage.clientWidth - 36), h = Math.max(1, stage.clientHeight - 36);
      const dpr = Math.min(2, window.devicePixelRatio || 1), bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; return true; }
      return false;
    }

    function draw() {
      raf = requestAnimationFrame(draw);
      const sized = syncSize(); if (!dirty && !sized) return; dirty = false;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!lineCount) return;
      const ce = Math.max(0.001, Math.cos(cam.el));
      const eye = [cam.target[0] + cam.dist * ce * Math.cos(cam.az), cam.target[1] + cam.dist * ce * Math.sin(cam.az), cam.target[2] + cam.dist * Math.sin(cam.el)];
      const b = bbox;
      // Near-Plane aus dem Abstand zur BOX, nicht zu ihren Ecken — beim Hineinzoomen liegen
      // die Bahnen direkt vor der Linse, während alle Ecken weit weg sind.
      const toBox = Math.hypot(
        Math.max(b.minx - eye[0], 0, eye[0] - b.maxx),
        Math.max(b.miny - eye[1], 0, eye[1] - b.maxy),
        Math.max(b.minz - eye[2], 0, eye[2] - b.maxz));
      let dmax = 0;
      for (const cx of [b.minx, b.maxx]) for (const cy of [b.miny, b.maxy]) for (const cz of [b.minz, b.maxz]) {
        const d = Math.hypot(cx - eye[0], cy - eye[1], cz - eye[2]);
        if (d > dmax) dmax = d;
      }
      const near = Math.max(1e-4, toBox > 0 ? toBox * 0.95 : cam.dist * 1e-3);
      const far = dmax * 1.05 + near;
      const mvp = mul(perspective(40 * Math.PI / 180, canvas.width / canvas.height, near, far), lookAt(eye, cam.target, [0, 0, 1]));
      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.mvp, false, new Float32Array(mvp));
      gl.bindBuffer(gl.ARRAY_BUFFER, posB); gl.enableVertexAttribArray(A.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colB); gl.enableVertexAttribArray(A.col); gl.vertexAttribPointer(A.col, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, lineCount);
      // Werkstück-Rahmen (dicke Balken, Dreiecke)
      if (frameCount) {
        gl.bindBuffer(gl.ARRAY_BUFFER, fPosB); gl.enableVertexAttribArray(A.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, fColB); gl.enableVertexAttribArray(A.col); gl.vertexAttribPointer(A.col, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, frameCount);
      }
    }

    // ---- orbit / pan / zoom ----
    let drag = null;
    const onDown = (e) => { const pan = e.shiftKey || e.button === 1; if (e.button === 1) e.preventDefault(); drag = { x: e.clientX, y: e.clientY, pan }; canvas.style.cursor = pan ? 'move' : 'grabbing'; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan || e.shiftKey) {
        const s = cam.dist * 0.0015;
        const rx = -Math.sin(cam.az), ry = Math.cos(cam.az);
        const ux = -Math.cos(cam.az) * Math.sin(cam.el), uy = -Math.sin(cam.az) * Math.sin(cam.el), uz = Math.cos(cam.el);
        cam.target[0] += (-rx * dx + ux * dy) * s; cam.target[1] += (-ry * dx + uy * dy) * s; cam.target[2] += (uz * dy) * s;
      } else { cam.az -= dx * 0.01; cam.el += dy * 0.01; const lim = 1.5533; cam.el = Math.max(-lim, Math.min(lim, cam.el)); }
      dirty = true;
    };
    const onUp = (e) => { drag = null; canvas.style.cursor = 'grab'; canvas.releasePointerCapture && e.pointerId != null && canvas.releasePointerCapture(e.pointerId); };
    // Zoomgrenze relativ zur Szene statt absolut, damit man an einzelne Bahnen herankommt.
    const onWheel = (e) => {
      e.preventDefault();
      cam.dist *= (1 + Math.sign(e.deltaY) * 0.1);
      const b = bbox, span = b ? Math.max(b.maxx - b.minx, b.maxy - b.miny, 10) : 10;
      cam.dist = Math.min(span * 20, Math.max(span * 1e-3, cam.dist));
      dirty = true;
    };

    return {
      canvas,
      mount(c) {
        container = c; c.appendChild(canvas);
        canvas.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        syncSize(); draw();
      },
      unmount() {
        cancelAnimationFrame(raf); raf = 0;
        canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('wheel', onWheel);
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      },
      update(sim, opts) {
        syncSize();
        build(opts.moves || [], sim.work);
        const key = sim.work.w + 'x' + sim.work.h;
        if (cam.framedFor !== key) { cam.framedFor = key; fitView(); }
        dirty = true;
      }
    };
  }
});
