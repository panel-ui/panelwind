/** Levenshtein distance, and the "did you mean" it is for. */

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * The nearest candidate, when one is near enough to be worth naming. A
 * suggestion that is not obviously right is worse than none: an agent will
 * take it.
 */
export function didYouMean(value: string, candidates: Iterable<string>): string | null {
  const limit = value.length <= 6 ? 2 : 3;
  let best: string | null = null;
  let bestDistance = limit + 1;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - value.length) > limit) continue;
    const distance = editDistance(value, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= limit ? best : null;
}
