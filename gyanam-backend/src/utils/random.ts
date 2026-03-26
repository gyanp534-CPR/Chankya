export function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let currentIndex = result.length;
  let state = seed;

  while (currentIndex !== 0) {
    const randomIndex = Math.floor(seededRandom(state) * currentIndex);
    state += 1;
    currentIndex -= 1;

    const temp = result[currentIndex];
    result[currentIndex] = result[randomIndex] as T;
    result[randomIndex] = temp as T;
  }

  return result;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
