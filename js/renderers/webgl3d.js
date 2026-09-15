// 3D renderer — Relief raymarching of the height texture (WebGL2).
// The Z-map is uploaded as an R32F texture; per pixel the view ray is marched against the
// height field. Vertical cutter walls come out PIXEL-SHARP and truly vertical, independent of
// any mesh tessellation, while round tools (ball) stay round. Orbit like Fusion:
// left-drag = orbit/tilt, wheel = zoom, shift+drag = pan.
PM.registerRenderer({
  id: 'webgl3d', name: '3D (relief, orbit)',
  make() {
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block'; canvas.style.borderRadius = '2px'; canvas.style.cursor = 'grab';
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('The 3D view requires WebGL2, which this browser does not provide.');
    let container = null, raf = 0, dirty = true;

    // ---- tiny mat4 (column-major) ----
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrmz = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    function perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    }
    function lookAt(eye, center, up) {
      const z = nrmz(sub(eye, center)), x = nrmz(cross(up, z)), y = cross(z, x);
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
    }
    function mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
      return o;
    }

    // ---- shaders ----
    const VS = `#version 300 es
in vec3 aPos; in vec3 aNormal;
uniform mat4 uMVP;
out vec3 vWorld; out vec3 vFaceN;
void main(){ gl_Position = uMVP * vec4(aPos,1.0); vWorld = aPos; vFaceN = aNormal; }`;
    const FS = `#version 300 es
precision highp float; precision highp sampler2D;
in vec3 vWorld; in vec3 vFaceN;
uniform vec3 uEye, uLight, uWood;
uniform vec2 uBoard;      // world extent (x,y)
uniform float uZBase, uDepth, uCell, uSpec, uShin;
uniform sampler2D uH;     // R32F height field (<=0 cut, 0 = surface)
out vec4 outC;

float Hf(vec2 xy){ return texture(uH, clamp(xy / uBoard, 0.0, 1.0)).r; }

vec3 shade(vec3 N, vec3 P, vec3 albedo){
  vec3 L = normalize(uLight), Vd = normalize(uEye - P);
  float d = max(dot(N, L), 0.0);
  float sp = pow(max(dot(N, normalize(L + Vd)), 0.0), uShin) * uSpec;
  return min(albedo * (0.30 + 0.85 * d) + vec3(1.0) * sp, vec3(1.0));
}

void main(){
  vec3 ro = vWorld;
  vec3 rd = normalize(vWorld - uEye);

  // Steckt die Kamera im Werkstück, sind die Vorderflaechen der Box weggeschnitten und es
  // rastert nur noch eine Rueckflaeche. Dann muss der Strahl am Auge beginnen statt an ihr.
  if (uEye.x > 0.0 && uEye.x < uBoard.x && uEye.y > 0.0 && uEye.y < uBoard.y
      && uEye.z > uZBase && uEye.z < 0.0) {
    ro = uEye;
  }

  // If the ray enters through a side/bottom box face already inside material -> that's a wall.
  if (ro.z - Hf(ro.xy) <= 0.0) { outC = vec4(shade(normalize(vFaceN), ro, uWood * 0.72), 1.0); return; }

  // March: advance ~1 texel horizontally, ~1/64 slab vertically, whichever is smaller.
  float horiz = length(rd.xy);
  float tStep = min(uCell / max(horiz, 1e-4), (uDepth / 64.0) / max(abs(rd.z), 1e-4));
  const int STEPS = 400;
  vec3 P = ro, prev = ro; bool hit = false;
  for (int i = 1; i < STEPS; i++) {
    P = ro + rd * (float(i) * tStep);
    if (P.z < uZBase - 0.01 || P.x < -uCell || P.y < -uCell || P.x > uBoard.x + uCell || P.y > uBoard.y + uCell) break;
    if (P.z - Hf(P.xy) <= 0.0) { hit = true; break; }
    prev = P;
  }
  if (!hit) discard;

  // Binary refine the crossing (prev above surface, P below).
  vec3 a = prev, b = P;
  for (int i = 0; i < 6; i++) { vec3 m = 0.5 * (a + b); if (m.z - Hf(m.xy) <= 0.0) b = m; else a = m; }
  P = b;

  // Normal from height gradient: on a vertical wall the gradient is huge -> horizontal normal.
  float e = uCell;
  float hx = Hf(P.xy + vec2(e, 0.0)) - Hf(P.xy - vec2(e, 0.0));
  float hy = Hf(P.xy + vec2(0.0, e)) - Hf(P.xy - vec2(0.0, e));
  vec3 N = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
  outC = vec4(shade(N, P, uWood), 1.0);
}`;
    function compile(t, s) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const A = { pos: gl.getAttribLocation(prog, 'aPos'), nrm: gl.getAttribLocation(prog, 'aNormal') };
    const U = {};
    ['uMVP', 'uEye', 'uLight', 'uWood', 'uBoard', 'uZBase', 'uDepth', 'uCell', 'uSpec', 'uShin', 'uH'].forEach(n => U[n] = gl.getUniformLocation(prog, n));

    // ---- line program (toolpath backplot: red = rapid, green = cut) ----
    const lprog = gl.createProgram();
    gl.attachShader(lprog, compile(gl.VERTEX_SHADER, `#version 300 es
in vec3 aPos; in vec3 aColor; uniform mat4 uMVP; out vec3 vC;
void main(){ gl_Position = uMVP * vec4(aPos,1.0); vC = aColor; }`));
    gl.attachShader(lprog, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float; in vec3 vC; out vec4 o; void main(){ o = vec4(vC,1.0); }`));
    gl.linkProgram(lprog);
    const lA = { pos: gl.getAttribLocation(lprog, 'aPos'), col: gl.getAttribLocation(lprog, 'aColor') };
    const lU = { mvp: gl.getUniformLocation(lprog, 'uMVP') };
    const lPosB = gl.createBuffer(), lColB = gl.createBuffer();
    let lineCount = 0, showPaths = false;
    function buildLines(moves) {
      const pos = [], col = [];
      for (let i = 1; i < moves.length; i++) {
        const a = moves[i - 1], b = moves[i];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const c = b.type === 'rapid' ? [0.88, 0.34, 0.29] : [0.31, 0.75, 0.48];
        col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lPosB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, lColB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
      lineCount = pos.length / 3;
    }

    // ---- box geometry (the stock slab) ----
    const bPos = gl.createBuffer(), bNrm = gl.createBuffer();
    let boxCount = 0, boxKey = '';
    function buildBox(W, H, zBase) {
      const key = W + ',' + H + ',' + zBase; if (key === boxKey) return; boxKey = key;
      const x0 = 0, x1 = W, y0 = 0, y1 = H, z0 = zBase, z1 = 0;
      const pos = [], nrm = [];
      const quad = (p, n) => { const [a, b, c, d] = p; [a, b, c, a, c, d].forEach(v => pos.push(v[0], v[1], v[2])); for (let i = 0; i < 6; i++) nrm.push(n[0], n[1], n[2]); };
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);   // top
      quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]);  // bottom
      quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);   // +x
      quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);  // -x
      quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]);   // +y
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);  // -y
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bNrm); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nrm), gl.STATIC_DRAW);
      boxCount = pos.length / 3;
    }

    // ---- height texture ----
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.078, 0.09, 0.11, 1);

    const cam = PM.viewCam;   // gemeinsam mit der CAM-Ansicht -> kein Sprung beim Umschalten
    let worldW = 600, worldH = 400, zBase = -5, cellW = 0.4;
    let light = [0.6, 0.4, 0.7], wood = [0.71, 0.52, 0.31], spec = 0.28, shin = 20;

    // Canvas-Backing an die aktuelle Stage-Größe angleichen (idempotent, pro Frame aufrufbar).
    function syncSize() {
      const stage = container ? container.parentElement : null;
      if (!stage) return false;
      const w = Math.max(1, stage.clientWidth - 36), h = Math.max(1, stage.clientHeight - 36);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh;
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        return true;
      }
      return false;
    }
    function resize() { syncSize(); dirty = true; }

    // Fit distance so the board's 8 corners fill ~90% of the view (accounts for tilt & aspect).
    function fitView() {
      const aspect = canvas.width / Math.max(1, canvas.height);
      const cs = [[0, 0, 0], [worldW, 0, 0], [0, worldH, 0], [worldW, worldH, 0],
                  [0, 0, zBase], [worldW, 0, zBase], [0, worldH, zBase], [worldW, worldH, zBase]];
      let dist = Math.max(worldW, worldH);
      for (let it = 0; it < 5; it++) {
        const ce = Math.max(0.001, Math.cos(cam.el));
        const eye = [cam.target[0] + dist * ce * Math.cos(cam.az), cam.target[1] + dist * ce * Math.sin(cam.az), cam.target[2] + dist * Math.sin(cam.el)];
        const mvp = mul(perspective(40 * Math.PI / 180, aspect, dist * 0.03, dist * 6 + 2000), lookAt(eye, cam.target, [0, 0, 1]));
        let m = 1e-3;
        for (const c of cs) {
          const w = mvp[3] * c[0] + mvp[7] * c[1] + mvp[11] * c[2] + mvp[15];
          const x = (mvp[0] * c[0] + mvp[4] * c[1] + mvp[8] * c[2] + mvp[12]) / w;
          const y = (mvp[1] * c[0] + mvp[5] * c[1] + mvp[9] * c[2] + mvp[13]) / w;
          m = Math.max(m, Math.abs(x), Math.abs(y));
        }
        dist *= m / 0.9; // aim for 90% fill
      }
      cam.dist = dist;
    }

    function draw() {
      raf = requestAnimationFrame(draw);
      const sized = syncSize();          // Canvas jeden Frame an Stage angleichen
      if (!dirty && !sized) return;
      dirty = false;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!boxCount) return;
      const ce = Math.max(0.001, Math.cos(cam.el));
      const eye = [cam.target[0] + cam.dist * ce * Math.cos(cam.az), cam.target[1] + cam.dist * ce * Math.sin(cam.az), cam.target[2] + cam.dist * Math.sin(cam.el)];
      // Near-Plane aus dem Abstand zur BOX, nicht zu ihren Ecken: Beim Hineinzoomen liegt die
      // Oberfläche direkt vor der Linse, während alle acht Ecken weit weg sind — ein aus den
      // Ecken abgeleitetes near würde mitten durchs Material schneiden.
      const dxE = Math.max(0 - eye[0], 0, eye[0] - worldW);
      const dyE = Math.max(0 - eye[1], 0, eye[1] - worldH);
      const dzE = Math.max(zBase - eye[2], 0, eye[2] - 0);
      const toBox = Math.hypot(dxE, dyE, dzE);   // 0, wenn das Auge im Werkstück steckt
      let dmax = 0;
      for (const c of [[0, 0, 0], [worldW, 0, 0], [0, worldH, 0], [worldW, worldH, 0], [0, 0, zBase], [worldW, 0, zBase], [0, worldH, zBase], [worldW, worldH, zBase]]) {
        const d = Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]);
        if (d > dmax) dmax = d;
      }
      // Außerhalb darf near bis dicht an die Geometrie -> beste Tiefenauflösung.
      // Innen skaliert es mit der Zoomstufe mit, damit nie etwas abgeschnitten wird.
      const near = Math.max(1e-4, toBox > 0 ? toBox * 0.95 : cam.dist * 1e-3);
      const far = dmax * 1.05 + near;
      const proj = perspective(40 * Math.PI / 180, canvas.width / canvas.height, near, far);
      const mvp = mul(proj, lookAt(eye, cam.target, [0, 0, 1]));
      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.uMVP, false, new Float32Array(mvp));
      gl.uniform3fv(U.uEye, new Float32Array(eye));
      gl.uniform3fv(U.uLight, new Float32Array(light));
      gl.uniform3fv(U.uWood, new Float32Array(wood));
      gl.uniform2f(U.uBoard, worldW, worldH);
      gl.uniform1f(U.uZBase, zBase); gl.uniform1f(U.uDepth, -zBase);
      gl.uniform1f(U.uCell, cellW); gl.uniform1f(U.uSpec, spec); gl.uniform1f(U.uShin, shin);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uH, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(A.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bNrm); gl.enableVertexAttribArray(A.nrm); gl.vertexAttribPointer(A.nrm, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, boxCount);

      // toolpath backplot on top (always visible)
      if (showPaths && lineCount) {
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(lprog);
        gl.uniformMatrix4fv(lU.mvp, false, new Float32Array(mvp));
        gl.bindBuffer(gl.ARRAY_BUFFER, lPosB); gl.enableVertexAttribArray(lA.pos); gl.vertexAttribPointer(lA.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, lColB); gl.enableVertexAttribArray(lA.col); gl.vertexAttribPointer(lA.col, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, lineCount);
        gl.enable(gl.DEPTH_TEST);
      }
    }

    // ---- mouse orbit / zoom / pan ----
    let drag = null;
    const onDown = (e) => {
      const pan = e.shiftKey || e.button === 1; // middle mouse = pan (Fusion-style)
      if (e.button === 1) e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, pan };
      canvas.style.cursor = pan ? 'move' : 'grabbing';
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan || e.shiftKey) {
        const s = cam.dist * 0.0015;
        const rx = -Math.sin(cam.az), ry = Math.cos(cam.az);
        const ux = -Math.cos(cam.az) * Math.sin(cam.el), uy = -Math.sin(cam.az) * Math.sin(cam.el), uz = Math.cos(cam.el);
        // Grab-Pan: Werkstück folgt dem Cursor (beide Achsen)
        cam.target[0] += (-rx * dx + ux * dy) * s; cam.target[1] += (-ry * dx + uy * dy) * s; cam.target[2] += (uz * dy) * s;
      } else {
        cam.az -= dx * 0.01; cam.el += dy * 0.01;
        const lim = 1.5533; cam.el = Math.max(-lim, Math.min(lim, cam.el));
      }
      dirty = true;
    };
    const onUp = (e) => { drag = null; canvas.style.cursor = 'grab'; canvas.releasePointerCapture && e.pointerId != null && canvas.releasePointerCapture(e.pointerId); };
    // Zoomgrenze relativ zum Werkstück statt absolut — sonst ist bei 5 mm Schluss und
    // man kommt an einzelne Frässpuren nie heran.
    const onWheel = (e) => {
      e.preventDefault();
      cam.dist *= (1 + Math.sign(e.deltaY) * 0.1);
      const span = Math.max(worldW, worldH, 10);
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
        resize(); draw();
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
        resize(); // Canvas an aktuelle Stage-Größe anpassen (auch bei Fensteränderung)
        const az = (opts.lightAz ?? 35) * Math.PI / 180, el = (opts.lightEl ?? 28) * Math.PI / 180;
        light = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
        spec = opts.spec ?? 0.28; shin = opts.shininess ?? 20;
        const lw = opts.woodLight || [181, 133, 78]; wood = [lw[0] / 255, lw[1] / 255, lw[2] / 255];

        // upload height field as R32F texture
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, sim.nx, sim.ny, 0, gl.RED, gl.FLOAT, sim.H);

        let minH = 0; for (let i = 0; i < sim.H.length; i++) if (sim.H[i] < minH) minH = sim.H[i];
        worldW = (sim.nx - 1) * sim.cell; worldH = (sim.ny - 1) * sim.cell; cellW = sim.cell;
        zBase = minH - Math.max(3, -minH * 0.15);
        buildBox(worldW, worldH, zBase);

        showPaths = !!opts.showPaths;
        if (showPaths && opts.moves) buildLines(opts.moves);

        // Kamera nur bei geänderter Brettgröße neu einpassen (bewahrt Orbit/Zoom bei Param-Änderung).
        const key = sim.work.w + 'x' + sim.work.h;
        if (cam.framedFor !== key) { cam.target = [worldW / 2, worldH / 2, 0]; cam.framedFor = key; fitView(); }
        dirty = true;
      }
    };
  }
});
