export class SeededRng {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(minInclusive: number, maxInclusive: number): number {
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.next() * span);
  }

  public shuffle<T>(items: T[]): T[] {
    const clone = [...items];
    for (let i = clone.length - 1; i > 0; i -= 1) {
      const j = this.nextInt(0, i);
      const tmp = clone[i];
      clone[i] = clone[j] as T;
      clone[j] = tmp as T;
    }

    return clone;
  }
}
