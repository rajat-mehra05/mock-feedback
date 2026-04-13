type ScoreTier = 'high' | 'medium' | 'low';

function scoreTier(score: number): ScoreTier {
  if (score >= 8) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

export function scoreColor(score: number): string {
  const tier = scoreTier(score);
  if (tier === 'high') return 'text-green-700';
  if (tier === 'medium') return 'text-yellow-700';
  return 'text-red-700';
}

export function scoreBg(score: number): string {
  const tier = scoreTier(score);
  if (tier === 'high') return 'bg-green-200 border-black';
  if (tier === 'medium') return 'bg-yellow-200 border-black';
  return 'bg-red-200 border-black';
}
