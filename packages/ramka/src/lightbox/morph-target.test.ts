import { afterEach, describe, expect, it } from 'vitest';

import { findDestinationMorphTarget, findItemMorphTarget, findTriggerMorphTarget } from './morph-target';

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

  it('returns the registered descendant when one is designated (via morphRef)', () => {
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
  it('returns the registered override (morphRef / imageRef)', () => {
    const item = makeEl('<div><span></span><img src="x" /></div>');
    const marker = item.querySelector('span') as HTMLElement;
    const registry = new WeakMap<HTMLElement, HTMLElement>();
    registry.set(item, marker);
    expect(findItemMorphTarget(item, registry)).toBe(marker);
  });

  it('returns the container itself when nothing is registered (no img/video hunting)', () => {
    // Registry-only resolution: an unwired item does NOT auto-discover its
    // inner <img>/<video>. Consumers must attach `imageRef`/`morphRef`
    // via the render function; otherwise the container is the target (and
    // `isMorphTargetSizeResolvable` rejects the oversized box → crossfade).
    const withImg = makeEl('<div class="fullscreen"><img src="x" /></div>');
    expect(findItemMorphTarget(withImg)).toBe(withImg);
    expect(findItemMorphTarget(withImg, new WeakMap())).toBe(withImg);

    const withVideo = makeEl('<div class="fullscreen"><video></video></div>');
    expect(findItemMorphTarget(withVideo)).toBe(withVideo);

    const noMedia = makeEl('<div><p>caption only</p></div>');
    expect(findItemMorphTarget(noMedia)).toBe(noMedia);
  });

  it('is keyed by element, so items resolve independently', () => {
    const a = makeEl('<div><span></span></div>');
    const b = makeEl('<div><em></em></div>');
    const markerA = a.querySelector('span') as HTMLElement;
    const registry = new WeakMap<HTMLElement, HTMLElement>();
    registry.set(a, markerA);
    expect(findItemMorphTarget(a, registry)).toBe(markerA);
    expect(findItemMorphTarget(b, registry)).toBe(b);
  });
});

describe('trigger vs item resolution (symmetric, registry-only)', () => {
  it('resolves an unwired button+image to the element itself on both sides', () => {
    const html = '<button><img src="x" /></button>';
    const trigger = makeEl(html);
    const item = makeEl(html);

    // Neither side hunts for the inner <img> — both morph their own element
    // until a descendant is explicitly registered.
    expect(findTriggerMorphTarget(trigger)).toBe(trigger);
    expect(findItemMorphTarget(item)).toBe(item);
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

describe('findDestinationMorphTarget', () => {
  it('prefers a shared Stage destination over the per-item chain', () => {
    const item = makeEl('<div data-item><span data-media></span></div>');
    const frame = makeEl('<div data-frame></div>');
    const media = item.querySelector('[data-media]') as HTMLElement;
    const itemRegistry = new WeakMap<HTMLElement, HTMLElement>();
    itemRegistry.set(item, media);
    expect(findDestinationMorphTarget(item, itemRegistry, frame)).toBe(frame);
  });

  it('falls back to the per-item chain when no shared destination is set', () => {
    const item = makeEl('<div data-item><span data-media></span></div>');
    const media = item.querySelector('[data-media]') as HTMLElement;
    const itemRegistry = new WeakMap<HTMLElement, HTMLElement>();
    itemRegistry.set(item, media);
    expect(findDestinationMorphTarget(item, itemRegistry, null)).toBe(media);
    expect(findDestinationMorphTarget(item, itemRegistry)).toBe(media);
  });

  it('returns the shared destination even when there is no active item', () => {
    const frame = makeEl('<div data-frame></div>');
    expect(findDestinationMorphTarget(null, null, frame)).toBe(frame);
  });

  it('returns null when neither a shared destination nor an item is present', () => {
    expect(findDestinationMorphTarget(null)).toBeNull();
    expect(findDestinationMorphTarget(undefined, new WeakMap(), null)).toBeNull();
  });
});
