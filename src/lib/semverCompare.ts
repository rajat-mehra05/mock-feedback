/**
 * Minimal semver "greater than" comparison for the Phase 10 update check.
 * Handles `x.y.z` with an optional leading `v` (GitHub tags commonly do).
 * Pre-release identifiers (`-rc.1`) are ignored — our release process
 * ships stable-only tags per plan.md.
 *
 * Returns `true` when `a > b`. Bails to `false` on any malformed input so
 * a mangled tag name never falsely triggers the "update available" toast.
 */
export function semverGreaterThan(a: string, b: string): boolean {
  const parsed = (v: string): [number, number, number] | null => {
    const clean = v.startsWith('v') ? v.slice(1) : v;
    // Drop pre-release / build metadata before splitting: `1.2.3-rc.1` → `1.2.3`.
    const core = clean.split(/[-+]/)[0];
    const parts = core.split('.');
    if (parts.length !== 3) return null;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
    return nums as [number, number, number];
  };

  const pa = parsed(a);
  const pb = parsed(b);
  if (!pa || !pb) return false;

  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}
