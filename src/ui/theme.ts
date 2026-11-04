// Canvas cannot use CSS variables directly, so read them from brand/tokens.css.
// Values are cached after the first read: the canvas asks for them every frame.
const cache = new Map<string, string>();

export function token(name: `--rr-${string}`): string {
  let v = cache.get(name);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) cache.set(name, v);
  }
  return v;
}
