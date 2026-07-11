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
  it('uses the trigger element itself when there is no marker (even if it wraps an image)', () => {
    const trigger = makeEl('<button><img src="x" /></button>');
    // The whole button morphs — carrying its border-radius / clipping — rather
    // than hunting for the inner <img>.
    expect(findTriggerMorphTarget(trigger)).toBe(trigger);
  });

  it('uses a descendant marked with data-lightbox-morph when present', () => {
    const trigger = makeEl('<button><span data-lightbox-morph><img src="x" /></span></button>');
    const marker = trigger.querySelector('[data-lightbox-morph]');
    expect(findTriggerMorphTarget(trigger)).toBe(marker);
  });

  it('prefers the marker over the trigger even when the marker is the image', () => {
    const trigger = makeEl('<button><img data-lightbox-morph src="x" /></button>');
    const img = trigger.querySelector('img');
    expect(findTriggerMorphTarget(trigger)).toBe(img);
  });

  it('uses the trigger itself for non-image triggers', () => {
    const trigger = makeEl('<button>View gallery</button>');
    expect(findTriggerMorphTarget(trigger)).toBe(trigger);
  });
});

describe('findItemMorphTarget', () => {
  it('prefers an explicit data-lightbox-morph marker above all else', () => {
    const item = makeEl(
      '<div><span data-lightbox-morph></span><img src="x" /></div>',
    );
    const marker = item.querySelector('[data-lightbox-morph]');
    expect(findItemMorphTarget(item)).toBe(marker);
  });

  it('falls back to the first <img> when there is no marker', () => {
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

  it('resolves identically when a marker is present (marker always wins)', () => {
    const html = '<div><img data-lightbox-morph src="x" /></div>';
    const trigger = makeEl(html);
    const item = makeEl(html);

    expect(findTriggerMorphTarget(trigger)).toBe(trigger.querySelector('[data-lightbox-morph]'));
    expect(findItemMorphTarget(item)).toBe(item.querySelector('[data-lightbox-morph]'));
  });
});
