// PatternMaster — Seeded RNG (mulberry32). Reproduzierbare Muster.
window.PM = window.PM || {};

PM.RNG = class {
  constructor(seed) {
    this.seed = (seed >>> 0) || 1;
    this._s = this.seed;
  }
  reset() { this._s = this.seed; }
  next() {
    let t = (this._s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  gauss(mean = 0, sd = 1) {
    const u = 1 - this.next(), v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
};

PM.makeRng = (seed) => new PM.RNG(seed);

// Deterministischer Hash beliebig vieler Zahlen -> [0,1). REINE Funktion (kein State).
// Für Generatoren: Werte hängen nur vom Index/Seed ab -> sieht wie Zufall aus, ist es nicht.
PM.hash = function () {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < arguments.length; i++) {
    const iv = Math.floor(arguments[i] * 2654435761) | 0;
    h = Math.imul(h ^ (iv & 0xffff), 0x01000193);
    h = Math.imul(h ^ (iv >>> 16), 0x01000193);
    h ^= h >>> 13;
  }
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
// Bequemlichkeit: deterministischer Wert in [a,b) aus Schlüsseln.
PM.hrange = function (a, b) { const keys = Array.prototype.slice.call(arguments, 2); return a + (b - a) * PM.hash.apply(null, keys); };
