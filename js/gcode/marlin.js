// Marlin Post-Prozessor (Beispiel für einen zweiten Dialekt).
// Zeigt: gleicher Toolpath, anderer Header/Spindelbefehl -> reines Plugin.
PM.registerPost({
  id: 'marlin', name: 'Marlin (CNC)', ext: 'gcode',
  emit(tp, opts = {}) {
    const feedMM = opts.feed ?? 800;                 // mm/min
    const plungeFeed = opts.plungeFeed ?? Math.round(feedMM / 3);
    const spindle = opts.spindle ?? 12000;
    const f3 = PM.f3, safeZ = tp.safeZ;
    const L = [];
    L.push('; PatternMaster — Marlin Export');
    L.push('; Nullpunkt (X0 Y0): links-unten. Z0 = Werkstueckoberflaeche, Z- = Material.');
    L.push('G21 ; mm');
    L.push('G90 ; absolut');
    if (spindle) L.push('M3 S' + spindle + ' ; Spindel an');
    L.push(`G0 Z${f3(safeZ)} F${Math.max(feedMM, 1200)}`);
    let prev = null;
    for (const m of tp.moves) {
      if (m.type === 'rapid') {
        L.push(`G0 X${f3(m.x)} Y${f3(m.y)} Z${f3(m.z)}`);
      } else {
        const isPlunge = prev && Math.abs(m.x - prev.x) < 1e-4 && Math.abs(m.y - prev.y) < 1e-4 && m.z < prev.z - 1e-4;
        L.push(`G1 X${f3(m.x)} Y${f3(m.y)} Z${f3(m.z)} F${isPlunge ? plungeFeed : feedMM}`);
      }
      prev = m;
    }
    L.push(`G0 Z${f3(safeZ)}`);
    if (spindle) L.push('M5 ; Spindel aus');
    return L.join('\n');
  }
});
