// A small seeded random source. The same seed string always gives the same stream,
// on any machine, so every run of the simulator writes byte-identical submissions.
// sfc32 for the generator, cyrb128 to turn a seed string into its four words of state.

function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(readonly seed: string) {
    [this.a, this.b, this.c, this.d] = cyrb128(seed);
    // Discard the first outputs, which are weakly mixed for short seeds.
    for (let i = 0; i < 15; i++) this.next();
  }

  // A child stream for one part of the simulation. Adding draws to one part
  // never shifts the numbers another part sees.
  fork(label: string): Rng {
    return new Rng(`${this.seed}/${label}`);
  }

  // Uniform in [0, 1).
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    const out = (t + this.d) | 0;
    this.c = (this.c + out) | 0;
    return (out >>> 0) / 4294967296;
  }

  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick from an empty list");
    return items[Math.floor(this.next() * items.length)] as T;
  }

  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const item of items) total += weight(item);
    if (total <= 0) throw new Error("weighted pick with no positive weight");
    let r = this.next() * total;
    for (const item of items) {
      r -= weight(item);
      if (r < 0) return item;
    }
    return items[items.length - 1] as T;
  }

  normal(mean = 0, sd = 1): number {
    // Box-Muller. 1 - next() keeps the log argument away from zero.
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Log-normal given its median and the sd of the underlying normal.
  lognormal(median: number, sigma: number): number {
    return median * Math.exp(this.normal(0, sigma));
  }

  exponential(mean: number): number {
    return -mean * Math.log(1 - this.next());
  }

  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda > 60) return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = this.next();
    while (p > limit) {
      k++;
      p *= this.next();
    }
    return k;
  }

  triangular(min: number, mode: number, max: number): number {
    const u = this.next();
    const cut = (mode - min) / (max - min);
    return u < cut ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}
