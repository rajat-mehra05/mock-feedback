// Minimal `a > b` for `x.y.z` tags with an optional leading `v`. Ignores
// pre-release identifiers (we ship stable-only). Returns false on any
// malformed input so a mangled tag can't trigger a false update toast.
export function semverGreaterThan(a: string, b: string): boolean {
  const parsed = (v: string): [number, number, number] | null => {
    const clean = v.startsWith('v') ? v.slice(1) : v;
    // Drop pre-release / build metadata before splitting: `1.2.3-rc.1` → `1.2.3`.
    const core = clean.split(/[-+]/)[0];
    const parts = core.split('.');
    if (parts.length !== 3) return null;
    // Each part must be digits-only. `Number()` would otherwise quietly
    // accept `""` (→0), `" 1 "`, and exponent notation like `1e3` (→1000),
    // letting `'1..0'` or `'1e3.0.0'` pass as valid versions.
    if (parts.some((p) => !/^\d+$/.test(p))) return null;
    return parts.map((p) => Number(p)) as [number, number, number];
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
