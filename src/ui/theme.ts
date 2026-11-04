// Canvas cannot use CSS variables directly, so read them from brand/tokens.css
// at draw time. This keeps every color value in one file.
export function token(name: `--rr-${string}`, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function prefersReducedMotion(): boolean {
  const forced = document.documentElement.dataset.reducedMotion;
  if (forced === 'on') return true;
  if (forced === 'off') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
