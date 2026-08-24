# Editorial

The viewer newsrooms use for article figures: a near-black surface in both color schemes, a typography-forward caption and credit block under the media, and ghost controls. Keyboard-first, no zoom — a reading context, not an inspection one. Copy the **Package** files ( `lightbox.tsx` + `lightbox.css`) into your design system, then wire triggers in your app. The **Example** tab shows an article excerpt whose inline figures open the viewer with their caption and credit.

## Source

```tsx presets/editorial/lightbox.tsx
'use client';

/**
 * Editorial lightbox — design-system package entry (copy with lightbox.css).
 *
 * The viewer newsrooms use for article figures: a near-black surface in both
 * color schemes (photography reads best on dark), a typography-forward
 * caption + credit block under the media, a counter top-left, and ghost
 * controls. Keyboard-first; no zoom — this is a reading context, not an
 * inspection one (swipe / arrows to browse, pull down to dismiss).
 */

import * as React from 'react';
import * as RamkaLightbox from '@ramka/react/lightbox';

import './lightbox.css';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ── Icons (inline — no icon library dependency) ─────────────────────────── */

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Public types ────────────────────────────────────────────────────────── */

/** Item shape for `Lightbox.Gallery` — pass real intrinsic pixel size. */
export type LightboxItem = {
  id?: string | number;
  src: string;
  thumb?: string;
  alt: string;
  /** The figure caption — a sentence describing the photograph. */
  caption?: string;
  /** The credit line, e.g. “Photograph: Anna Beck / Agence Lumière”. */
  credit?: string;
  width: number;
  height: number;
};

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('elb-trigger', className)} {...props} />;
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal className={cx('elb-portal', className)} {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('elb-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('elb-content', className)} {...props} />;
}

function Close({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close className={cx('elb-control', className)} aria-label="Close" {...props}>
      {children ?? <IconX />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return <RamkaLightbox.Slides className={cx('elb-slides', className)} {...props} />;
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return <RamkaLightbox.Slide className={cx('elb-slide', className)} {...props} />;
}

function Item({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item className={cx('elb-item', className)} {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('elb-media', className)} {...props} />;
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return <RamkaLightbox.Counter className={cx('elb-counter', className)} {...props} />;
}

function Caption({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Caption>) {
  return <RamkaLightbox.Caption className={cx('elb-caption', className)} {...props} />;
}

function Previous({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return (
    <RamkaLightbox.Previous className={cx('elb-control', 'elb-nav', 'elb-nav-prev', className)} {...props}>
      {children ?? <IconChevronLeft />}
    </RamkaLightbox.Previous>
  );
}

function Next({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return (
    <RamkaLightbox.Next className={cx('elb-control', 'elb-nav', 'elb-nav-next', className)} {...props}>
      {children ?? <IconChevronRight />}
    </RamkaLightbox.Next>
  );
}

/* ── Composed Gallery (article figure viewer) ───────────────────────────── */

/** Caption + credit as one node for `Item.caption` → rendered by `Caption`. */
function figureCaption(item: LightboxItem): React.ReactNode {
  if (!item.caption && !item.credit) return undefined;
  return (
    <>
      {item.caption ? <span className="elb-caption-text">{item.caption}</span> : null}
      {item.credit ? <span className="elb-credit">{item.credit}</span> : null}
    </>
  );
}

/**
 * Editorial figure viewer — Portal → Backdrop + Content → Slides with a
 * caption + credit block beneath the media, counter top-left, close
 * top-right, and desktop edge navigation.
 */
function Gallery({ items, ariaLabel }: { items: LightboxItem[]; ariaLabel: string }) {
  const multiple = items.length > 1;

  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        <Slides aria-label="Article photographs" preload={2}>
          {items.map((item, i) => (
            <Slide key={item.id ?? i}>
              <Item index={i} caption={figureCaption(item)}>
                <Media width={item.width} height={item.height}>
                  <img
                    width={item.width}
                    height={item.height}
                    src={item.src}
                    alt={item.alt}
                    loading="eager"
                    draggable={false}
                  />
                </Media>
              </Item>
            </Slide>
          ))}
        </Slides>

        <div className={cx('elb-top', 'elb-chrome-gesture-hide')}>
          {multiple ? <Counter>{({ current, total }) => `${current} / ${total}`}</Counter> : <span />}
          <Close />
        </div>

        {multiple ? (
          <>
            <Previous className="elb-chrome-gesture-hide" />
            <Next className="elb-chrome-gesture-hide" />
          </>
        ) : null}

        <div className={cx('elb-bottom', 'elb-chrome-gesture-hide')}>
          <Caption />
        </div>
      </Content>
    </Portal>
  );
}

/**
 * Styled Lightbox namespace — drop-in replacement for `import * as Lightbox from '@ramka/react/lightbox'`
 * with this preset’s styles and composed Gallery.
 */
export const Lightbox = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Content,
  Close,
  Slides,
  Slide,
  Item,
  Media,
  Counter,
  Caption,
  Previous,
  Next,
  Gallery,
};
```

```css presets/editorial/lightbox.css
/**
 * Editorial lightbox skin — pairs with lightbox.tsx (copy both files).
 *
 * Article figure viewer: near-black surface in BOTH color schemes (deliberate
 * — photography reads best on dark, like NYT / Guardian viewers), so there
 * are no dark-mode overrides in this file. Class prefix: `elb-`.
 *
 * Variables named `--lightbox-*` are written by the library at runtime
 * (gesture progress, motion timing) — this file only reads them. All
 * view-transition CSS (morph group, snapshots, crossfade) is injected by the
 * library; skins ship none of it.
 */

.elb-portal {
  --elb-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Trigger ────────────────────────────────────────────────────────────── */

.elb-trigger {
  font: inherit;
  color: inherit;
  appearance: none;
  cursor: pointer;
}

.elb-trigger:focus {
  outline: none;
}

.elb-trigger:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* ── Backdrop / Content open-close + pull ───────────────────────────────── */

.elb-backdrop {
  position: fixed;
  inset: 0;
  opacity: 0;
  background-color: #0a0a0a;
  /* `--lightbox-pull-snap-*` exist only while a cancelled pull springs back;
     otherwise the Root's `viewTransition` preset clock. */
  transition: opacity var(--lightbox-pull-snap-duration, var(--lightbox-vt-duration, 360ms))
    var(--lightbox-pull-snap-easing, var(--elb-ease-out));
}

@starting-style {
  .elb-backdrop[data-open] {
    opacity: 0;
  }
}

/* `--lightbox-pull-progress` is 0 → 1 while pull-to-dismiss drags. */
.elb-backdrop[data-open] {
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
}

.elb-backdrop[data-pulling] {
  transition: none; /* follow the finger */
}

.elb-content {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  outline: none;
  opacity: 0;
  color: #fafafa;
  transition: opacity var(--lightbox-vt-duration, 360ms) var(--elb-ease-out);

  /* Letterbox insets around the media (Slide padding). The bottom band holds
     the caption + credit block. */
  --elb-inset-top: calc(3.5rem + env(safe-area-inset-top, 0px));
  --elb-inset-bottom: calc(6rem + env(safe-area-inset-bottom, 0px));
  --elb-inset-inline: 1rem;
}

@media (min-width: 768px) {
  .elb-content {
    --elb-inset-top: calc(4rem + env(safe-area-inset-top, 0px));
    --elb-inset-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px));
    /* Room for the edge chevrons. */
    --elb-inset-inline: 5rem;
  }
}

.elb-content[data-open] {
  opacity: 1;
}

@starting-style {
  .elb-content[data-open] {
    opacity: 0;
  }
}

/* ── Slides / Media ─────────────────────────────────────────────────────── */

.elb-slides {
  flex: 1;
  min-height: 0;
  gap: 1rem;
  scrollbar-width: none;
}

.elb-slides::-webkit-scrollbar {
  display: none;
}

.elb-slide {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: var(--elb-inset-top) var(--elb-inset-inline) var(--elb-inset-bottom);
}

/* This viewer has no zoom, so Item stands in for the `Lightbox.Zoom` wrapper
   structurally: Media's fit-box resolves `cqw`/`cqh` against the nearest size
   container, and the flex centering letterboxes it inside the slide insets. */
.elb-item {
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
}

.elb-media img {
  user-select: none;
  -webkit-user-select: none;
}

/* ── Chrome hide during gestures ────────────────────────────────────────── */

/* `visibility` (not just opacity) keeps hidden controls out of the tab
   order; its 0s flip is delayed to the end of the fade-out. */
.elb-chrome-gesture-hide {
  opacity: 1;
  visibility: visible;
  transition:
    opacity 200ms,
    visibility 0s linear 0s;
}

@starting-style {
  .elb-chrome-gesture-hide {
    opacity: 0;
  }
}

.elb-content:is([data-pulling], [data-pull-dismissing]) .elb-chrome-gesture-hide {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 200ms,
    visibility 0s linear 200ms;
}

/* ── Top band: counter + close ──────────────────────────────────────────── */

.elb-top {
  position: absolute;
  inset-inline: 0;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(0.875rem + env(safe-area-inset-top, 0px)) 1rem 0;
}

.elb-counter {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: rgb(255 255 255 / 0.55);
}

/* ── Caption + credit band ──────────────────────────────────────────────── */

.elb-bottom {
  /* Click-through the inset band; the caption opts back in for selection. */
  pointer-events: none;
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding-inline: 1.25rem;
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
}

/* One column, reading width. `Item.caption` delivers the caption text and
   the credit line as separate spans (see lightbox.tsx). */
.elb-caption {
  pointer-events: auto;
  -webkit-user-select: text;
  user-select: text;
  display: flex;
  max-width: 42rem;
  flex-direction: column;
  gap: 0.375rem;
  text-align: center;
}

.elb-caption-text {
  font-size: 0.9375rem;
  line-height: 1.5;
  color: rgb(255 255 255 / 0.92);
}

.elb-credit {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.45);
}

/* ── Controls (ghost circles) ───────────────────────────────────────────── */

.elb-control {
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 0;
  background-color: transparent;
  color: rgb(255 255 255 / 0.8);
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out,
    opacity 150ms ease-out,
    transform 150ms ease-out;
  cursor: pointer;
}

.elb-control:hover {
  background-color: rgb(255 255 255 / 0.1);
  color: #fff;
}

.elb-control:active {
  transform: scale(0.96);
}

.elb-control:focus {
  outline: none;
}

.elb-control:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.6);
  outline-offset: 2px;
}

.elb-control:disabled {
  cursor: not-allowed;
  opacity: 0.25;
}

.elb-control:disabled:active {
  transform: none;
}

.elb-control svg {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
}

/* ── Edge navigation (desktop) ──────────────────────────────────────────── */

.elb-nav {
  position: absolute;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
  width: 3rem;
  height: 3rem;
}

.elb-nav:active {
  transform: translateY(-50%) scale(0.96);
}

.elb-nav:disabled:active {
  transform: translateY(-50%);
}

.elb-nav-prev {
  left: 1rem;
}

.elb-nav-next {
  right: 1rem;
}

/* Edge chevrons are desktop-only; mobile swipes. */
@media (max-width: 767px) {
  .elb-nav {
    display: none;
  }
}
```

```tsx presets/editorial/demo.tsx
'use client';

import { Lightbox, type LightboxItem } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * An article excerpt with inline figures: each `<figure>` is a
 * `Lightbox.Trigger`, and opening one morphs into the editorial viewer with
 * that figure's caption + credit under the media.
 */

const figures: LightboxItem[] = [
  {
    src: 'https://picsum.photos/seed/edit-harbor/1600/1000',
    thumb: 'https://picsum.photos/seed/edit-harbor/800/500',
    alt: 'The old harbor at dawn, boats resting in still water',
    caption: 'The old harbor at dawn. Most of the fleet has not left the quay in a decade.',
    credit: 'Photograph: Anna Beck',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/edit-nets/1000/1400',
    thumb: 'https://picsum.photos/seed/edit-nets/500/700',
    alt: 'Fishing nets stacked on the pier',
    caption: 'Nets stacked on the pier — mended each winter, used less each spring.',
    credit: 'Photograph: Anna Beck',
    width: 1000,
    height: 1400,
  },
  {
    src: 'https://picsum.photos/seed/edit-market/1600/1000',
    thumb: 'https://picsum.photos/seed/edit-market/800/500',
    alt: 'The near-empty fish market hall in the early morning',
    caption: 'The market hall opens at five. By seven, the day’s catch is gone.',
    credit: 'Photograph: Jonas Ravn',
    width: 1600,
    height: 1000,
  },
];

function Figure({ index, className }: { index: number; className?: string }) {
  const item = figures[index]!;
  return (
    <figure className={className}>
      <Lightbox.Trigger index={index} className="block w-full overflow-hidden rounded-lg bg-transparent p-0 scroll-my-5">
        {({ imageRef }) => (
          <img
            ref={imageRef}
            src={item.thumb}
            alt={item.alt}
            width={item.width}
            height={item.height}
            className="block w-full object-cover"
            draggable={false}
          />
        )}
      </Lightbox.Trigger>
      <figcaption className="mt-2 text-[13px] leading-5 text-neutral-500">
        {item.caption} <span className="text-neutral-400 dark:text-neutral-600">{item.credit}</span>
      </figcaption>
    </figure>
  );
}

export function EditorialPresetDemo() {
  return (
    <article className="w-full max-w-xl text-left">
      <Lightbox.Root
        loop
        // Thumbs are the same photographs at lower res (same seed + aspect),
        // so the placeholder bridge is seamless — skip the decode wait and
        // start the morph immediately.
        awaitImageDecode={false}
        // Figures are scattered through a scrolling article, so after swiping
        // to another photograph its trigger may be off-viewport. `onClose`
        // repositions it inside the close transition's update phase — between
        // snapshot captures — so the page jump is never painted as a live
        // frame. (Scrolling earlier, e.g. `onChange`, makes iOS Safari
        // re-rasterize the open viewer and flash black tiles over the media.)
        scrollTriggerIntoView={[
          { type: 'onOpenComplete', behavior: 'instant', block: 'nearest' },
          { type: 'onClose', behavior: 'instant', block: 'nearest' },
        ]}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Dispatch</p>
        <h3 className="mt-2 font-serif text-[26px] leading-snug tracking-tight text-neutral-900 dark:text-neutral-50">
          The last fishermen of the northern coast
        </h3>
        <p className="mt-2 text-[13px] text-neutral-500">By Anna Beck · 8 min read</p>

        <p className="mt-5 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
          The village wakes before the light does. For sixty years the boats went out whatever the weather; now, on most
          mornings, only three engines cough to life along the whole quay.
        </p>

        <Figure index={0} className="mt-6" />

        <p className="mt-6 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
          Ask anyone here when it changed and they will not name a year. The harbor emptied the way harbors do — one
          retirement at a time, one son who moved to the city, one quota that made a small boat pointless.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Figure index={1} />
          <Figure index={2} />
        </div>

        <Lightbox.Gallery items={figures} ariaLabel="Article photographs" />
      </Lightbox.Root>
    </article>
  );
}
```
