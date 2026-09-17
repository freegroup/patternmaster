// Path-processor: Clipping.
// Trims the milled paths to a boundary polygon so the tool doesn't run past the workpiece edge.
// Where a path leaves the zone it is cut at the border; the toolpath machinery then retracts to
// safe-Z, rapids to the next in-zone point and plunges again (each fragment becomes its own pass).
//
// Radius-aware modes (R = tool radius):
//   none   — off, paths pass through unchanged
//   middle — tool centre clipped on the boundary (cut reaches the edge, overhang up to R)
//   inner  — boundary shrunk by R (whole tool stays inside, no overhang)
//   outer  — boundary grown by R (tool centre may reach R beyond the edge)
//
// process() is a PURE function (only its args + ClipperLib + Math) so the pipeline worker can embed
// it via toString(). ClipperLib is a global in both the main thread and the worker. Self-contained
// per the project rule — no shared helpers.
PM.registerProcessor({
  id: 'clipping',
  name: 'Clipping',
  params: {
    mode: {
      label: 'Clipping', type: 'select', default: 'none',
      options: [['none', 'None'], ['outer', 'Outer'], ['middle', 'Middle'], ['inner', 'Inner']]
    }
  },
  process: function (paths, ctx) {
    const mode = (ctx.params && ctx.params.mode) || 'none';
    const poly = ctx.geometry && ctx.geometry.polygon;
    if (mode === 'none' || !poly || poly.length < 3 || !paths.length) return paths;

    const S = 1000;                                  // mm -> integer units for Clipper
    const R = (ctx.tool && ctx.tool.radius) || 0;
    const delta = (mode === 'inner' ? -R : mode === 'outer' ? R : 0) * S;
    const CL = ClipperLib;
    CL.use_xyz = true;
    const round = Math.round;

    // Boundary polygon in Clipper units, offset per mode.
    const base = poly.map(p => new CL.IntPoint(round(p.x * S), round(p.y * S), 0));
    let clipPolys;
    if (delta === 0) {
      clipPolys = [base];
    } else {
      const co = new CL.ClipperOffset();
      co.AddPath(base, CL.JoinType.jtMiter, CL.EndType.etClosedPolygon);
      clipPolys = new CL.Paths();
      co.Execute(clipPolys, delta);
      if (!clipPolys.length) return [];             // shrunk to nothing -> nothing survives
    }

    // Interpolate Z at new boundary vertices along the subject edge (the one with a Z gradient /
    // non-zero Z; the clip polygon carries Z=0).
    const zFill = (e1b, e1t, e2b, e2t, pt) => {
      let b = e1b, t = e1t;
      if (e1b.Z === e1t.Z && (e2b.Z !== e2t.Z || e2b.Z !== 0 || e2t.Z !== 0)) { b = e2b; t = e2t; }
      const dx = t.X - b.X, dy = t.Y - b.Y, L2 = dx * dx + dy * dy;
      let u = L2 > 0 ? ((pt.X - b.X) * dx + (pt.Y - b.Y) * dy) / L2 : 0;
      u = u < 0 ? 0 : (u > 1 ? 1 : u);
      pt.Z = round(b.Z + (t.Z - b.Z) * u);
    };

    const out = [];
    for (const path of paths) {
      if (path.length < 2) continue;
      const subj = path.map(p => new CL.IntPoint(round(p.x * S), round(p.y * S), round(p.z * S)));
      const c = new CL.Clipper();
      c.ZFillFunction = zFill;
      c.AddPath(subj, CL.PolyType.ptSubject, false); // open polyline
      for (const cp of clipPolys) c.AddPath(cp, CL.PolyType.ptClip, true);
      const tree = new CL.PolyTree();
      c.Execute(CL.ClipType.ctIntersection, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
      for (const frag of CL.Clipper.OpenPathsFromPolyTree(tree)) {
        if (frag.length < 2) continue;
        out.push(frag.map(p => ({ x: p.X / S, y: p.Y / S, z: p.Z / S })));
      }
    }
    return out;
  }
});
