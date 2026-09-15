// CPU renderer (2D): Z-map -> image. Normals (finite differences) + procedural wood
// albedo + Blinn-Phong with grazing light. Y is flipped so the origin (0,0) is bottom-left.
// Owns its own display canvas and fits the height map into the stage.
PM.registerRenderer({
  id: 'cpu', name: 'CPU (2D shaded)',
  make() {
    const off = document.createElement('canvas');       // full-res height map render
    const octx = off.getContext('2d');
    const view = document.createElement('canvas');       // scaled display canvas
    const vctx = view.getContext('2d');
    view.style.borderRadius = '2px'; view.style.display = 'block';
    let container = null;

    // Render the height map into the offscreen canvas at native (nx x ny) resolution.
    function renderHeightmap(sim, opts) {
      const nx = sim.nx, ny = sim.ny, H = sim.H, cell = sim.cell;
      if (off.width !== nx || off.height !== ny) { off.width = nx; off.height = ny; }
      const img = octx.createImageData(nx, ny), data = img.data;
      const noise = opts.woodNoise;
      const az = (opts.lightAz ?? 35) * Math.PI / 180, el = (opts.lightEl ?? 28) * Math.PI / 180;
      let lx = Math.cos(el) * Math.cos(az), ly = Math.cos(el) * Math.sin(az), lz = Math.sin(el);
      const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
      let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
      const shin = opts.shininess ?? 24, ks = opts.spec ?? 0.35, amb = 0.30, kd = 0.85, grain = opts.grain ?? 1;
      const lw = opts.woodLight || [188, 132, 78], dw = opts.woodDark || [120, 74, 38];
      const inv2c = 1 / (2 * cell);
      for (let iy = 0; iy < ny; iy++) {
        const ym1 = iy > 0 ? iy - 1 : iy, yp1 = iy < ny - 1 ? iy + 1 : iy;
        const outRow = (ny - 1 - iy) * nx, py = iy * cell;  // Y flip
        for (let ix = 0; ix < nx; ix++) {
          const xm1 = ix > 0 ? ix - 1 : ix, xp1 = ix < nx - 1 ? ix + 1 : ix, k = iy * nx + ix;
          const dzdx = (H[iy * nx + xp1] - H[iy * nx + xm1]) * inv2c;
          const dzdy = (H[yp1 * nx + ix] - H[ym1 * nx + ix]) * inv2c;
          let nX = -dzdx, nY = -dzdy; const nl = Math.sqrt(nX * nX + nY * nY + 1); nX /= nl; nY /= nl; const nZ = 1 / nl;
          let diff = nX * lx + nY * ly + nZ * lz; if (diff < 0) diff = 0;
          let sp = nX * hx + nY * hy + nZ * hz; if (sp < 0) sp = 0; sp = ks * Math.pow(sp, shin);
          const shade = amb + kd * diff, px = ix * cell;
          let ring = 0.5, fiber = 0;
          if (noise && grain > 0) {
            const rn = noise.fbm(px * 0.02, py * 0.006, 4);
            ring = 0.5 + 0.5 * Math.sin(px * 0.05 + rn * 6.0);
            fiber = noise.noise2(px * 0.6, py * 0.05) * 0.12;
          }
          const mix = Math.min(1, Math.max(0, ring * grain + (1 - grain) * 0.5 + fiber));
          const ao = 1 - Math.min(0.35, (-H[k]) * 0.06), o = (outRow + ix) * 4;
          data[o]     = Math.min(255, (lw[0] * mix + dw[0] * (1 - mix)) * shade * ao + 255 * sp);
          data[o + 1] = Math.min(255, (lw[1] * mix + dw[1] * (1 - mix)) * shade * ao + 255 * sp);
          data[o + 2] = Math.min(255, (lw[2] * mix + dw[2] * (1 - mix)) * shade * ao + 255 * sp);
          data[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
    }

    // Fit the offscreen image into the display canvas, preserving the board aspect ratio.
    function fitAndDraw(sim) {
      const stage = container ? container.parentElement : null;
      const availW = (stage ? stage.clientWidth : 800) - 36, availH = (stage ? stage.clientHeight : 600) - 36;
      const aspect = sim.work.w / sim.work.h;
      let w = availW, h = w / aspect; if (h > availH) { h = availH; w = h * aspect; }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      view.width = Math.max(1, Math.round(w * dpr)); view.height = Math.max(1, Math.round(h * dpr));
      view.style.width = w + 'px'; view.style.height = h + 'px';
      vctx.imageSmoothingEnabled = true;
      vctx.clearRect(0, 0, view.width, view.height);
      vctx.drawImage(off, 0, 0, view.width, view.height);
    }

    // Backplot overlay: rapids red, cuts green (board XY mapped to display, Y flipped).
    function drawPaths(sim, moves) {
      const W = view.width, H = view.height, ww = sim.work.w, wh = sim.work.h;
      vctx.lineWidth = Math.max(1, W / ww * 0.25);
      vctx.lineJoin = 'round'; vctx.lineCap = 'round';
      const stroke = (type, color) => {
        vctx.strokeStyle = color; vctx.beginPath();
        let prev = null;
        for (const m of moves) {
          if (prev && m.type === type) { vctx.moveTo(prev.x / ww * W, H - prev.y / wh * H); vctx.lineTo(m.x / ww * W, H - m.y / wh * H); }
          prev = m;
        }
        vctx.stroke();
      };
      stroke('rapid', 'rgba(224,87,75,0.9)');
      stroke('cut', 'rgba(79,191,123,0.85)');
    }

    return {
      canvas: view,
      mount(c) { container = c; c.appendChild(view); },
      unmount() { if (view.parentElement) view.parentElement.removeChild(view); },
      update(sim, opts) {
        renderHeightmap(sim, opts);
        fitAndDraw(sim);
        if (opts.showPaths && opts.moves) drawPaths(sim, opts.moves);
      }
    };
  }
});
