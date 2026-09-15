// PatternMaster — Metriken (Core, kein Post-Prozessor).
window.PM = window.PM || {};

PM.metrics = {
  // Scallop-Höhe aus Stepover und Kugelradius.
  scallop(stepover, ballRadius) {
    const s = stepover / 2;
    if (s >= ballRadius) return ballRadius;
    return ballRadius - Math.sqrt(ballRadius * ballRadius - s * s);
  },
  // Laufzeitschätzung: feed & rapidRate in mm/min -> Minuten.
  estimate(tp, feed, rapidRate) {
    const cutMin = feed > 0 ? tp.cutLen / feed : 0;
    const rapidMin = rapidRate > 0 ? tp.rapidLen / rapidRate : 0;
    const total = tp.cutLen + tp.rapidLen;
    return {
      cutMin, rapidMin, totalMin: cutMin + rapidMin,
      cutLen: tp.cutLen, rapidLen: tp.rapidLen,
      rapidShare: total > 0 ? tp.rapidLen / total : 0
    };
  }
};
