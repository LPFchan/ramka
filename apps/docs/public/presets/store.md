# Store

A full commerce viewer: the media stage (vertical thumbnail rail, pager, corner zoom) sits beside a buy panel with price, highlights, and the add-to-cart CTA — on mobile the panel collapses into a sticky price + CTA bar, so the shopper never loses the buy button while inspecting photos. Copy the **Package** files ( `lightbox.tsx` + `lightbox.css`) into your design system, then wire triggers in your app. The **Example** tab shows a product card whose thumbnails swap the main image, viewer navigation synced back so the close morph lands on the visible image, and add-to-cart state shared between the card and the viewer.

## Source

```tsx presets/store/lightbox.tsx
'use client';

/**
 * Store lightbox — design-system package entry (copy with lightbox.css).
 *
 * A full commerce viewer, not just a photo overlay: the media stage keeps a
 * vertical thumbnail rail (desktop) with a bottom ‹ 2 / 5 › pagination
 * cluster and corner zoom controls, while a buy panel stays alongside —
 * product name, price (with compare-at), description, highlights, stock note
 * and the add-to-cart CTA. Mobile swaps the panel for a sticky price + CTA
 * bar under the media. The shopper never loses the buy button while
 * inspecting photos.
 */

import * as React from 'react';
import * as RamkaLightbox from 'ramka/lightbox';

import './lightbox.css';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ── Icons (inline — no icon library dependency) ─────────────────────────── */

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Public types ────────────────────────────────────────────────────────── */

/** Item shape for `Lightbox.Gallery` — pass real intrinsic pixel size. */
export type LightboxItem = {
  id?: string | number;
  src: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
};

/** Product data rendered by the buy panel (desktop) and mobile bar. */
export type ProductInfo = {
  name: string;
  price: string;
  /** Original price, rendered struck-through next to `price`. */
  compareAtPrice?: string;
  /** Short label above the name, e.g. “New colour” or “Bestseller”. */
  badge?: string;
  description?: string;
  /** Bullet points under the description. */
  highlights?: string[];
  /** Availability line above the CTA, e.g. “In stock — ships in 2 days”. */
  stockNote?: string;
};

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('slb-trigger', className)} {...props} />;
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal className={cx('slb-portal', className)} {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('slb-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('slb-content', className)} {...props} />;
}

function Stage({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Stage>) {
  return <RamkaLightbox.Stage className={cx('slb-stage', className)} {...props} />;
}

function Close({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close className={cx('slb-control', 'slb-close', className)} aria-label="Close" {...props}>
      {children ?? <IconX />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return <RamkaLightbox.Slides className={cx('slb-slides', className)} {...props} />;
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return <RamkaLightbox.Slide className={cx('slb-slide', className)} {...props} />;
}

function Item(props: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('slb-media', className)} {...props} />;
}

function Zoom(props: React.ComponentProps<typeof RamkaLightbox.Zoom>) {
  return <RamkaLightbox.Zoom {...props} />;
}

function ZoomIn({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.ZoomIn>) {
  return (
    <RamkaLightbox.ZoomIn className={cx('slb-control', className)} aria-label="Zoom in" {...props}>
      {children ?? <IconZoomIn />}
    </RamkaLightbox.ZoomIn>
  );
}

function ZoomOut({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.ZoomOut>) {
  return (
    <RamkaLightbox.ZoomOut className={cx('slb-control', className)} aria-label="Zoom out" {...props}>
      {children ?? <IconZoomOut />}
    </RamkaLightbox.ZoomOut>
  );
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return <RamkaLightbox.Counter className={cx('slb-counter', className)} {...props} />;
}

function Previous({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return (
    <RamkaLightbox.Previous className={cx('slb-control', 'slb-nav', className)} {...props}>
      {children ?? <IconChevronLeft />}
    </RamkaLightbox.Previous>
  );
}

function Next({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return (
    <RamkaLightbox.Next className={cx('slb-control', 'slb-nav', className)} {...props}>
      {children ?? <IconChevronRight />}
    </RamkaLightbox.Next>
  );
}

function Thumbnail(props: React.ComponentProps<typeof RamkaLightbox.Thumbnail>) {
  return <RamkaLightbox.Thumbnail {...props} />;
}

function ThumbnailGroup(props: React.ComponentProps<typeof RamkaLightbox.ThumbnailGroup>) {
  return <RamkaLightbox.ThumbnailGroup {...props} />;
}

/* ── Buy panel pieces ────────────────────────────────────────────────────── */

function PriceRow({ product, compact }: { product: ProductInfo; compact?: boolean }) {
  return (
    <span className={compact ? 'slb-mobile-price' : 'slb-price-row'}>
      <span className="slb-price">{product.price}</span>
      {product.compareAtPrice ? <s className="slb-compare-at">{product.compareAtPrice}</s> : null}
    </span>
  );
}

/* ── Composed Gallery (commerce viewer) ─────────────────────────────────── */

/**
 * Store commerce viewer — Portal → Backdrop + Content → Stage (slides,
 * vertical thumbnail rail, ‹ 2 / 5 › cluster, corner zoom, close) beside a
 * buy panel (desktop) / above a sticky price + CTA bar (mobile).
 *
 * The rail is a plain `ThumbnailGroup` tablist (not the scroll-linked
 * ThumbnailStrip): PDP galleries have a handful of images, so all thumbs are
 * visible and arrow keys / clicks jump directly.
 *
 * Pass `panel` to replace the default panel body with your own composition
 * (variant pickers, size selectors, reviews) — the package chrome stays.
 */
function Gallery({
  items,
  product,
  ariaLabel,
  ctaLabel = 'Add to bag',
  onAddToCart,
  panel,
}: {
  items: LightboxItem[];
  product: ProductInfo;
  ariaLabel: string;
  ctaLabel?: string;
  onAddToCart?: () => void;
  panel?: React.ReactNode;
}) {
  const multiple = items.length > 1;

  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        <Stage>
          <Slides aria-label="Product images" preload={2}>
            {items.map((item, i) => (
              <Slide key={item.id ?? i}>
                <Item index={i}>
                  <Zoom maxZoom={5}>
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
                  </Zoom>
                </Item>
              </Slide>
            ))}
          </Slides>

          <Close className="slb-chrome-gesture-hide" />

          {multiple ? (
            <ThumbnailGroup className={cx('slb-rail', 'slb-chrome-gesture-hide')} aria-label="Product images">
              {items.map((item, i) => (
                <Thumbnail key={item.id ?? i} index={i} className="slb-rail-thumb">
                  <img src={item.thumb} alt={item.alt} draggable={false} />
                </Thumbnail>
              ))}
            </ThumbnailGroup>
          ) : null}

          {multiple ? (
            <div className={cx('slb-pager', 'slb-chrome-gesture-hide')}>
              <Previous />
              <Counter>{({ current, total }) => `${current} / ${total}`}</Counter>
              <Next />
            </div>
          ) : null}

          <div className={cx('slb-zoom-group', 'slb-chrome-gesture-hide')}>
            <ZoomOut />
            <ZoomIn />
          </div>
        </Stage>

        {/* The buy context (panel / mobile bar) stays put during pull-to-dismiss —
            only the stage chrome fades. */}
        <aside className="slb-panel" aria-label="Product details">
          {panel ?? (
            <>
              <div className="slb-panel-body">
                {product.badge ? <span className="slb-badge">{product.badge}</span> : null}
                <h2 className="slb-name">{product.name}</h2>
                <PriceRow product={product} />
                {product.description ? <p className="slb-description">{product.description}</p> : null}
                {product.highlights?.length ? (
                  <ul className="slb-highlights">
                    {product.highlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="slb-panel-footer">
                {product.stockNote ? <p className="slb-stock">{product.stockNote}</p> : null}
                <button type="button" className="slb-cta" onClick={onAddToCart}>
                  {ctaLabel}
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Mobile: the buy context rides along under the media. */}
        <div className="slb-mobile-bar">
          <div className="slb-mobile-info">
            <span className="slb-mobile-name">{product.name}</span>
            <PriceRow product={product} compact />
          </div>
          <button type="button" className={cx('slb-cta', 'slb-cta-compact')} onClick={onAddToCart}>
            {ctaLabel}
          </button>
        </div>
      </Content>
    </Portal>
  );
}

/**
 * Styled Lightbox namespace — drop-in replacement for `import * as Lightbox from 'ramka/lightbox'`
 * with this preset’s styles and composed Gallery.
 */
export const Lightbox = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Content,
  Stage,
  Close,
  Slides,
  Slide,
  Item,
  Media,
  Zoom,
  ZoomIn,
  ZoomOut,
  Counter,
  Previous,
  Next,
  Thumbnail,
  ThumbnailGroup,
  Gallery,
};
```

```css presets/store/lightbox.css
/**
 * Store lightbox skin — pairs with lightbox.tsx (copy both files).
 *
 * Commerce viewer: a soft-neutral media stage (vertical thumbnail rail,
 * ‹ 2 / 5 › pager, corner zoom) beside a white buy panel; on mobile the panel
 * collapses into a sticky price + CTA bar. Class prefix: `slb-`. Dark mode:
 * `.dark` or `[data-theme='dark']` on an ancestor (e.g. <html>).
 *
 * Variables named `--lightbox-*` are written by the library at runtime
 * (gesture progress, motion timing) — this file only reads them. All
 * view-transition CSS (morph group, snapshots, crossfade) is injected by the
 * library; skins ship none of it.
 */

.slb-portal {
  --slb-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  /* Narrower panel until the viewport can spare the room. */
  --slb-panel-width: 20rem;
  --slb-mobile-bar-height: 4.25rem;
}

@media (min-width: 1280px) {
  .slb-portal {
    --slb-panel-width: 24rem;
  }
}

/* ── Trigger ────────────────────────────────────────────────────────────── */

.slb-trigger {
  font: inherit;
  color: inherit;
  appearance: none;
  cursor: pointer;
}

.slb-trigger:focus {
  outline: none;
}

.slb-trigger:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* ── Backdrop / Content open-close + pull ───────────────────────────────── */

.slb-backdrop {
  position: fixed;
  inset: 0;
  opacity: 0;
  background-color: #fff;
  /* `--lightbox-pull-snap-*` exist only while a cancelled pull springs back;
     otherwise the Root's `viewTransition` preset clock. */
  transition: opacity var(--lightbox-pull-snap-duration, var(--lightbox-vt-duration, 360ms))
    var(--lightbox-pull-snap-easing, var(--slb-ease-out));
}

:is(.dark, [data-theme='dark']) .slb-backdrop {
  background-color: #000;
}

@starting-style {
  .slb-backdrop[data-open] {
    opacity: 0;
  }
}

/* `--lightbox-pull-progress` is 0 → 1 while pull-to-dismiss drags. */
.slb-backdrop[data-open] {
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
}

.slb-backdrop[data-pulling] {
  transition: none; /* follow the finger */
}

.slb-content {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: contain;
  outline: none;
  opacity: 0;
  color: #171717;
  transition: opacity var(--lightbox-vt-duration, 360ms) var(--slb-ease-out);
}

:is(.dark, [data-theme='dark']) .slb-content {
  color: #fafafa;
}

@media (min-width: 768px) {
  .slb-content {
    flex-direction: row;
  }
}

.slb-content[data-open] {
  opacity: 1;
}

@starting-style {
  .slb-content[data-open] {
    opacity: 0;
  }
}

/* ── Stage (media pane) ─────────────────────────────────────────────────── */

.slb-stage {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 0%;
  flex-direction: column;
  overflow: hidden;
  /* Soft-neutral plane behind the product shots. The alpha tracks the pull
     gesture so dragging to dismiss reveals the page — the backdrop alone
     can't do it when the stage paints its own surface. */
  background-color: rgb(245 245 245 / calc(1 - var(--lightbox-pull-progress, 0)));

  /* Letterbox insets around the media (Slide padding). Mobile: full-bleed
     images (no inline inset); the buy bar is in flow BELOW the stage, so the
     bottom inset only clears the counter — zoomed media pans inside the
     stage and can never slide under the bar. */
  --slb-inset-top: calc(3.5rem + env(safe-area-inset-top, 0px));
  --slb-inset-bottom: 3.25rem;
  --slb-inset-inline: 0px;
}

/* Dark: black canvas, gray sidebar — the product plane goes fully dark while
   the buy panel lifts off it. */
:is(.dark, [data-theme='dark']) .slb-stage {
  background-color: rgb(0 0 0 / calc(1 - var(--lightbox-pull-progress, 0)));
}

@media (min-width: 768px) {
  .slb-stage {
    --slb-inset-top: 4rem;
    /* Clears the ‹ 2 / 5 › pager and the corner zoom group. */
    --slb-inset-bottom: 5.5rem;
    --slb-inset-inline: 2rem;
  }
}

/* The thumbnail rail only exists from lg up — below that the panel already
   eats most of the width, so the media keeps a slim letterbox instead. */
@media (min-width: 1024px) {
  .slb-stage {
    /* Clears the rail (left) and keeps the letterbox symmetric. */
    --slb-inset-inline: 6.5rem;
  }
}

.slb-slides {
  flex: 1;
  min-height: 0;
  gap: 1rem;
  scrollbar-width: none;
}

.slb-slides::-webkit-scrollbar {
  display: none;
}

.slb-slide {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: var(--slb-inset-top) var(--slb-inset-inline) var(--slb-inset-bottom);
}

.slb-media img {
  user-select: none;
  -webkit-user-select: none;
}

/* ── Chrome hide during gestures ────────────────────────────────────────── */

/* `visibility` (not just opacity) keeps hidden controls out of the tab
   order; its 0s flip is delayed to the end of the fade-out. */
.slb-chrome-gesture-hide {
  opacity: 1;
  visibility: visible;
  transition:
    opacity 200ms,
    visibility 0s linear 0s;
}

@starting-style {
  .slb-chrome-gesture-hide {
    opacity: 0;
  }
}

/* Pull hides everything; zoom clears the navigation chrome so the media can
   pan freely (zoom group + close stay for the way back out). */
.slb-content:is([data-pulling], [data-pull-dismissing]) .slb-chrome-gesture-hide,
.slb-content[data-zoomed] :is(.slb-rail, .slb-pager) {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 200ms,
    visibility 0s linear 200ms;
}

/* ── Controls (flat white circles, readable over photos) ────────────────── */

.slb-control {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(0 0 0 / 0.08);
  background-color: #fff;
  color: #171717;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
  transition:
    background-color 150ms ease-out,
    border-color 150ms ease-out,
    transform 150ms ease-out,
    opacity 150ms ease-out;
  cursor: pointer;
}

.slb-control:hover {
  background-color: #f5f5f5;
}

.slb-control:active {
  transform: scale(0.96);
}

.slb-control:focus {
  outline: none;
}

.slb-control:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.slb-control:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.slb-control:disabled:active {
  transform: none;
}

.slb-control svg {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
}

:is(.dark, [data-theme='dark']) .slb-control {
  border-color: rgb(255 255 255 / 0.14);
  background-color: #262626;
  color: #fafafa;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
}

:is(.dark, [data-theme='dark']) .slb-control:hover {
  background-color: #333;
}

.slb-close {
  position: absolute;
  top: calc(0.875rem + env(safe-area-inset-top, 0px));
  right: 0.875rem;
  z-index: 2;
}

/* ── Thumbnail rail (desktop) ───────────────────────────────────────────── */

.slb-rail {
  display: none;
}

@media (min-width: 1024px) {
  .slb-rail {
    position: absolute;
    left: 1.25rem;
    top: 50%;
    z-index: 1;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: calc(100% - 7rem);
    overflow-y: auto;
    scrollbar-width: none;
    /* Breathing room so the active thumb's offset ring isn't clipped. */
    padding: 0.375rem;
  }

  .slb-rail::-webkit-scrollbar {
    display: none;
  }
}

/* Square, hard-cornered tiles — matches the product card's thumbnail row. */
.slb-rail-thumb {
  box-sizing: border-box;
  width: 3.25rem;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
  appearance: none;
  border: 1px solid rgb(0 0 0 / 0.08);
  background: #fff;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 150ms ease-out;
}

.slb-rail-thumb:hover {
  opacity: 1;
}

.slb-rail-thumb:focus {
  outline: none;
}

/* Active thumb: full opacity + a ring floating just outside the tile.
   Declared after :focus so clicking (which also focuses) keeps the ring. */
.slb-rail-thumb[data-active] {
  opacity: 1;
  outline: 2px solid #171717;
  outline-offset: 2px;
}

/* Last so keyboard focus wins over the active ring. */
.slb-rail-thumb:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.slb-rail-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:is(.dark, [data-theme='dark']) .slb-rail-thumb {
  border-color: rgb(255 255 255 / 0.12);
  background: #171717;
}

:is(.dark, [data-theme='dark']) .slb-rail-thumb[data-active] {
  outline-color: #fafafa;
}

/* ── Pager cluster + corner zoom ────────────────────────────────────────── */

/* ‹ 2 / 5 › — bottom-center of the stage; on mobile just the counter
   (navigation is a swipe). */
.slb-pager {
  position: absolute;
  bottom: 0.875rem;
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

@media (min-width: 768px) {
  .slb-pager {
    bottom: 1.25rem;
  }
}

@media (max-width: 767px) {
  .slb-pager .slb-nav {
    display: none;
  }
}

.slb-counter {
  min-width: 3rem;
  text-align: center;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: #737373;
}

:is(.dark, [data-theme='dark']) .slb-counter {
  color: #a3a3a3;
}

/* Zoom lives in the corner, out of the browsing flow (desktop only —
   mobile pinches and double-taps). */
.slb-zoom-group {
  display: none;
}

@media (min-width: 768px) {
  .slb-zoom-group {
    position: absolute;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 1;
    display: flex;
    gap: 0.5rem;
  }
}

/* ── Buy panel (desktop) ────────────────────────────────────────────────── */

.slb-panel {
  display: none;
}

@media (min-width: 768px) {
  .slb-panel {
    display: flex;
    width: var(--slb-panel-width);
    flex-shrink: 0;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid rgb(0 0 0 / 0.08);
    background-color: #fff;
  }

  :is(.dark, [data-theme='dark']) .slb-panel {
    border-left-color: rgb(255 255 255 / 0.1);
    background-color: #171717;
  }
}

.slb-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 2.5rem 2rem 1.5rem;
}

.slb-badge {
  display: inline-block;
  margin-bottom: 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b45309;
}

:is(.dark, [data-theme='dark']) .slb-badge {
  color: #fbbf24;
}

.slb-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.slb-price-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.slb-price {
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
}

.slb-compare-at {
  font-size: 0.8125rem;
  color: #a3a3a3;
}

.slb-description {
  margin: 1.25rem 0 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #525252;
}

:is(.dark, [data-theme='dark']) .slb-description {
  color: #a3a3a3;
}

.slb-highlights {
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slb-highlights li {
  position: relative;
  padding-left: 1rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #525252;
}

:is(.dark, [data-theme='dark']) .slb-highlights li {
  color: #a3a3a3;
}

.slb-highlights li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.5em;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #d4d4d4;
}

:is(.dark, [data-theme='dark']) .slb-highlights li::before {
  background: #525252;
}

.slb-panel-footer {
  flex-shrink: 0;
  padding: 1.25rem 2rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgb(0 0 0 / 0.06);
}

:is(.dark, [data-theme='dark']) .slb-panel-footer {
  border-top-color: rgb(255 255 255 / 0.08);
}

/* “In stock — ships in 2 days” with a green availability dot. */
.slb-stock {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.875rem;
  font-size: 0.75rem;
  color: #525252;
}

:is(.dark, [data-theme='dark']) .slb-stock {
  color: #a3a3a3;
}

.slb-stock::before {
  content: '';
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 9999px;
  background: #16a34a;
}

.slb-cta {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  padding: 0.875rem 1.5rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background-color: #171717;
  color: #fff;
  transition:
    background-color 150ms ease-out,
    transform 150ms ease-out;
  cursor: pointer;
}

.slb-cta:hover {
  background-color: #333;
}

.slb-cta:active {
  transform: scale(0.98);
}

.slb-cta:focus {
  outline: none;
}

.slb-cta:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

:is(.dark, [data-theme='dark']) .slb-cta {
  background-color: #fafafa;
  color: #171717;
}

:is(.dark, [data-theme='dark']) .slb-cta:hover {
  background-color: #e5e5e5;
}

/* ── Mobile buy bar ─────────────────────────────────────────────────────── */

/* In flow below the stage (not an overlay): the stage — and with it the zoom
   pan area — ends above the bar, so zoomed media is never covered by it. */
.slb-mobile-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 1rem;
  min-height: var(--slb-mobile-bar-height);
  padding: 0.625rem 1rem calc(0.625rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgb(0 0 0 / 0.06);
  background-color: #fff;
}

:is(.dark, [data-theme='dark']) .slb-mobile-bar {
  border-top-color: rgb(255 255 255 / 0.1);
  background-color: #171717;
}

@media (min-width: 768px) {
  .slb-mobile-bar {
    display: none;
  }
}

.slb-mobile-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.125rem;
}

.slb-mobile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  font-weight: 600;
}

.slb-mobile-price {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
}

.slb-mobile-price .slb-price {
  font-size: 0.8125rem;
}

.slb-mobile-price .slb-compare-at {
  font-size: 0.75rem;
}

/* The bar's CTA hugs its label instead of filling the row. */
.slb-cta-compact {
  width: auto;
  flex-shrink: 0;
  padding: 0.625rem 1.25rem;
  font-size: 0.8125rem;
}
```

```tsx presets/store/demo.tsx
'use client';

import * as React from 'react';

import { Lightbox, type LightboxItem, type ProductInfo } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * A product card: small thumbs swap the main image (plain app state, not
 * lightbox triggers), and the main image is the single `Lightbox.Trigger` for
 * whatever is selected. `onValueChange` syncs viewer navigation back into
 * that selection, so the close morph always lands on the image the user is
 * looking at. Add-to-cart state is shared between the card and the viewer's
 * buy panel via `ctaLabel` / `onAddToCart`.
 */

const product: ProductInfo = {
  name: 'Terra 27L Backpack',
  price: '$149',
  compareAtPrice: '$189',
  badge: 'New colour',
  description:
    'Waxed canvas, full-grain leather straps, and a padded 16″ laptop sleeve. Weather-ready for the daily commute or a weekend on the trail.',
  highlights: [
    'Water-resistant waxed canvas shell',
    'Padded 16″ laptop compartment',
    'Magnetic quick-access top pocket',
    'Lifetime repair guarantee',
  ],
  stockNote: 'In stock — ships in 2 days',
};

const images: LightboxItem[] = [
  {
    src: 'https://picsum.photos/seed/store-pack-a/1200/1500',
    thumb: 'https://picsum.photos/seed/store-pack-a/480/600',
    alt: 'Terra 27L backpack, front view',
    width: 1200,
    height: 1500,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-b/1200/1500',
    thumb: 'https://picsum.photos/seed/store-pack-b/480/600',
    alt: 'Terra 27L backpack, side profile',
    width: 1200,
    height: 1500,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-c/1200/1200',
    thumb: 'https://picsum.photos/seed/store-pack-c/480/480',
    alt: 'Detail of the waxed canvas and zippers',
    width: 1200,
    height: 1200,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-d/1600/1000',
    thumb: 'https://picsum.photos/seed/store-pack-d/800/500',
    alt: 'The backpack on a trail at golden hour',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-e/1200/1500',
    thumb: 'https://picsum.photos/seed/store-pack-e/480/600',
    alt: 'Interior compartments, laptop sleeve visible',
    width: 1200,
    height: 1500,
  },
];

export function StorePresetDemo() {
  const [selected, setSelected] = React.useState(0);
  const [added, setAdded] = React.useState(false);
  const current = images[selected]!;

  return (
    <div className="w-full max-w-2xl">
      <Lightbox.Root
        loop
        onValueChange={(value) => setSelected(value)}
        // Thumbs are the same product shots at lower res (same seed + aspect),
        // so the placeholder bridge is seamless — skip the decode wait and
        // start the morph immediately.
        awaitImageDecode={false}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          {/* Gallery column */}
          <div className="min-w-0 flex-1">
            <Lightbox.Trigger
              index={selected}
              className="block w-full overflow-hidden bg-neutral-100 p-0 dark:bg-neutral-800"
            >
              {({ imageRef }) => (
                <img
                  ref={imageRef}
                  key={current.src}
                  src={current.thumb}
                  alt={current.alt}
                  width={current.width}
                  height={current.height}
                  className="block aspect-square w-full object-cover"
                  draggable={false}
                />
              )}
            </Lightbox.Trigger>

            <div className="mt-3 flex gap-2" role="listbox" aria-label="Select product image">
              {images.map((img, i) => (
                <button
                  key={img.src}
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  aria-label={img.alt}
                  onClick={() => setSelected(i)}
                  className={`block size-14 shrink-0 overflow-hidden border p-0 transition ${
                    i === selected
                      ? 'border-neutral-900 dark:border-neutral-100'
                      : 'border-neutral-200 opacity-70 hover:opacity-100 dark:border-neutral-700'
                  }`}
                >
                  <img src={img.thumb} alt="" className="block size-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          </div>

          {/* Info column */}
          <div className="w-full md:w-56 md:shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
              {product.badge}
            </p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {product.name}
            </h3>
            <p className="mt-1 flex items-baseline gap-2 text-[15px]">
              <span className="text-neutral-900 dark:text-neutral-100">{product.price}</span>
              <s className="text-[13px] text-neutral-400">{product.compareAtPrice}</s>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{product.description}</p>
            <button
              type="button"
              onClick={() => setAdded(true)}
              className="mt-6 w-full rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {added ? 'Added to bag ✓' : 'Add to bag'}
            </button>
          </div>
        </div>

        <Lightbox.Gallery
          items={images}
          product={product}
          ariaLabel={`${product.name} gallery`}
          ctaLabel={added ? 'Added to bag ✓' : 'Add to bag'}
          onAddToCart={() => setAdded(true)}
        />
      </Lightbox.Root>
    </div>
  );
}
```
