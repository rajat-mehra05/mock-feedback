export function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-700';
  if (score >= 6) return 'text-yellow-700';
  return 'text-red-700';
}

export function scoreBg(score: number): string {
  if (score >= 8) return 'bg-green-200 border-black';
  if (score >= 6) return 'bg-yellow-200 border-black';
  return 'bg-red-200 border-black';
}
