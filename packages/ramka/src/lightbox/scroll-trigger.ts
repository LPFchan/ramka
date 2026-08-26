/**
 * The moments at which the active trigger can be scrolled into view:
 * - `onChange` — the active index changes while open (navigation)
 * - `onOpenComplete` — the open transition finishes (page is covered + locked,
 *   so this reposition is invisible; recommended with `instant`)
 * - `onClose` — just before the close morph runs
 */
type ScrollTriggerMoment = 'onChange' | 'onOpenComplete' | 'onClose';

/** Alignment passed through to `Element.scrollIntoView`. */
type ScrollTriggerAlign = ScrollLogicalPosition;

interface ScrollTriggerOption {
  type: ScrollTriggerMoment;
  behavior?: 'smooth' | 'instant';
  /**
   * Vertical alignment for `scrollIntoView`.
   * @default 'nearest'
   */
  block?: ScrollTriggerAlign;
  /**
   * Inline-axis alignment for `scrollIntoView`. Use `'center'` for
   * variable-width horizontal strips with scroll-snap so a narrow tile
   * isn't re-snapped back to a wider sibling after a minimal `nearest` nudge.
   *
   * Logical, not physical: the browser mirrors it, so `'start'` is the left
   * edge under `dir="ltr"` and the right edge under `dir="rtl"`.
   * @default 'nearest'
   */
  inline?: ScrollTriggerAlign;
}

/** Single option, an array of options, or `null` to disable. */
type ScrollTriggerIntoView = null | ScrollTriggerOption | ScrollTriggerOption[];

interface ResolvedScrollTrigger {
  behavior: ScrollBehavior;
  block: ScrollTriggerAlign;
  inline: ScrollTriggerAlign;
}

/**
 * Resolve the scroll config for a given moment, or `null` when that moment
 * isn't enabled. Accepts both the single-object and array config forms so
 * `scrollTriggerIntoView={{ type: 'onChange' }}` and
 * `scrollTriggerIntoView={[{ type: 'onChange' }, { type: 'onOpenComplete' }]}`
 * both work.
 */
function resolveScrollTriggerOption(
  config: ScrollTriggerIntoView | undefined,
  moment: ScrollTriggerMoment,
): ResolvedScrollTrigger | null {
  if (!config) return null;
  const options = Array.isArray(config) ? config : [config];
  const match = options.find((option) => option.type === moment);
  if (!match) return null;
  return {
    behavior: match.behavior ?? 'smooth',
    block: match.block ?? 'nearest',
    inline: match.inline ?? 'nearest',
  };
}

function scrollTriggerEl(
  el: HTMLElement | undefined,
  options: ResolvedScrollTrigger = { behavior: 'smooth', block: 'nearest', inline: 'nearest' },
) {
  if (!el) return;
  // Defaults (`nearest` / `nearest`) only scroll when needed and honor CSS
  // `scroll-margin`/`scroll-padding` (sticky header clearance). Consumers set
  // `block` / `inline` on `scrollTriggerIntoView` options when a different
  // alignment is required (e.g. `inline: 'center'` for horizontal snap strips).
  //
  // We deliberately do NOT gate this on a manual getBoundingClientRect check:
  // that check measures against the raw viewport (top >= 0), so it considers a
  // trigger occluded by a sticky header "fully visible" and skips the scroll.
  // IntersectionObserver can't fix this either — v1 is purely geometric (same
  // blind spot) and v2's occlusion-aware `isVisible` is Chromium-only, async,
  // and expensive, so unusable for a synchronous cross-browser decision here.
  el.scrollIntoView({
    block: options.block,
    inline: options.inline,
    behavior: options.behavior,
  });
}

function resolveTriggerIndex(
  activeIndex: number,
  morphTo: 'active' | 'origin' | 'closest',
  openingIndex: number,
  triggerElements: Map<number, HTMLElement>,
): number {
  if (morphTo === 'origin') return openingIndex;
  if (morphTo === 'active' || triggerElements.has(activeIndex)) return activeIndex;
  let best = -1;
  let bestDist = Infinity;
  for (const idx of triggerElements.keys()) {
    const dist = Math.abs(idx - activeIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    }
  }
  return best >= 0 ? best : activeIndex;
}

export {
  resolveScrollTriggerOption,
  scrollTriggerEl,
  resolveTriggerIndex,
};
export type {
  ScrollTriggerIntoView,
  ScrollTriggerOption,
  ScrollTriggerMoment,
  ScrollTriggerAlign,
  ResolvedScrollTrigger,
};
