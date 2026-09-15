// PatternMaster — Perlin/fBm Noise (seeded). Für Muster & Holz-Maserung.
window.PM = window.PM || {};

PM.Noise = class {
  constructor(seed) {
    const rng = new PM.RNG(seed);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }
  _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  _lerp(a, b, t) { return a + t * (b - a); }
  _grad(h, x, y) {
    const u = (h & 1) ? -x : x;
    const v = (h & 2) ? -y : y;
    return u + v;
  }
  // Perlin, ~[-1,1]
  noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = this._fade(x), v = this._fade(y), p = this.p;
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    return this._lerp(
      this._lerp(this._grad(aa, x, y), this._grad(ba, x - 1, y), u),
      this._lerp(this._grad(ab, x, y - 1), this._grad(bb, x - 1, y - 1), u), v);
  }
  // fractional Brownian motion, ~[-1,1]
  fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.noise2(x * f, y * f);
      norm += amp; amp *= gain; f *= lac;
    }
    return sum / norm;
  }
};
