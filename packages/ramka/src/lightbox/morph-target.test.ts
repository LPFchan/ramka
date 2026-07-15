import { afterEach, describe, expect, it } from 'vitest';

import { findItemMorphTarget, findTriggerMorphTarget } from './lightbox-context';

// Build a detached DOM subtree from an HTML string and return its root element.
function makeEl(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  return host.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('findTriggerMorphTarget', () => {
  it('uses the trigger element itself when there is no registry (even if it wraps an image)', () => {
    const trigger = makeEl('<button><img src="x" /></button>');
    // The whole button morphs — carrying its border-radius / clipping — rather
    // than hunting for the inner <img>.
    expect(findTriggerMorphTarget(trigger)).toBe(trigger);
  });

  it('uses the trigger element itself when the registry has no entry for it', () => {
    const trigger = makeEl('<button><img src="x" /></button>');
    const registry = new WeakMap<HTMLElement, HTMLElement>();
    expect(findTriggerMorphTarget(trigger, registry)).toBe(trigger);
  });

  it('returns the registered descendant when one is designated (via morphElementRef)', () => {
    const trigger = makeEl('<button><span><img src="x" /></span></button>');
    const marker = trigger.querySelector('span') as HTMLElement;
    const registry = new WeakMap<HTMLElement, HTMLElement>();
    registry.set(trigger, marker);
    expect(findTriggerMorphTarget(trigger, registry)).toBe(marker);
  });

  it('is keyed by element, so triggers sharing an index resolve independently', () => {
    const a = makeEl('<button><span></span></button>');
    const b = makeEl('<button><em></em></button>');
    const markerA = a.querySelector('span') as HTMLElement;
    const registry = new WeakMap<HTMLElement, HTMLElement>();
    registry.set(a, markerA);
    // `a` → its registered override; `b` (no entry) → itself.
    expect(findTriggerMorphTarget(a, registry)).toBe(markerA);
    expect(findTriggerMorphTarget(b, registry)).toBe(b);
  });

  it('uses the trigger itself for non-image triggers', () => {
    const trigger = makeEl('<button>View gallery</button>');
    expect(findTriggerMorphTarget(trigger)).toBe(trigger);
  });
});

describe('findItemMorphTarget', () => {
  it('prefers a registered override (morphElementRef / imageRef) above all else', () => {
    const item = makeEl('<div><span></span><img src="x" /></div>');
    const marker = item.querySelector('span') as HTMLElement;
    const registry = new WeakMap<HTMLElement, HTMLElement>();
    registry.set(item, marker);
    // The registered override wins over the <img> fallback.
    expect(findItemMorphTarget(item, registry)).toBe(marker);
  });

  it('falls back to the first <img> when there is no registered override', () => {
    const item = makeEl('<div class="fullscreen"><img src="x" /></div>');
    const img = item.querySelector('img');
    // Lands on the letterboxed image, not the full-viewport container.
    expect(findItemMorphTarget(item)).toBe(img);
  });

  it('falls back to a <video> when there is no marker and no image', () => {
    const item = makeEl('<div class="fullscreen"><video></video></div>');
    const video = item.querySelector('video');
    expect(findItemMorphTarget(item)).toBe(video);
  });

  it('prefers <img> over <video> when both are present', () => {
    const item = makeEl('<div><video></video><img src="x" /></div>');
    const img = item.querySelector('img');
    expect(findItemMorphTarget(item)).toBe(img);
  });

  it('falls back to the container when there is no marker, image, or video', () => {
    const item = makeEl('<div><p>caption only</p></div>');
    expect(findItemMorphTarget(item)).toBe(item);
  });
});

describe('trigger vs item divergence (same markup, different resolution)', () => {
  it('resolves an unmarked button+image differently per side', () => {
    const html = '<button><img src="x" /></button>';
    const trigger = makeEl(html);
    const item = makeEl(html);

    // Trigger → the element itself; item → the inner image.
    expect(findTriggerMorphTarget(trigger)).toBe(trigger);
    expect(findItemMorphTarget(item)).toBe(item.querySelector('img'));
  });

  it('overrides resolve from each side\u2019s element-keyed registry', () => {
    const trigger = makeEl('<button><span><img src="x" /></span></button>');
    const item = makeEl('<div><span></span><img src="x" /></div>');

    const triggerMarker = trigger.querySelector('span') as HTMLElement;
    const itemMarker = item.querySelector('span') as HTMLElement;
    const triggerRegistry = new WeakMap<HTMLElement, HTMLElement>();
    const itemRegistry = new WeakMap<HTMLElement, HTMLElement>();
    triggerRegistry.set(trigger, triggerMarker);
    itemRegistry.set(item, itemMarker);

    expect(findTriggerMorphTarget(trigger, triggerRegistry)).toBe(triggerMarker);
    expect(findItemMorphTarget(item, itemRegistry)).toBe(itemMarker);
  });
});
