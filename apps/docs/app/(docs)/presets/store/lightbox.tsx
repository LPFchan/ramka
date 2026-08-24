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
import * as RamkaLightbox from '@ramka/react/lightbox';

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
    <RamkaLightbox.Previous
      className={cx('slb-control', 'slb-nav', className)}
      aria-label="Previous"
      {...props}
    >
      {children ?? <IconChevronLeft />}
    </RamkaLightbox.Previous>
  );
}

function Next({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return (
    <RamkaLightbox.Next
      className={cx('slb-control', 'slb-nav', className)}
      aria-label="Next"
      {...props}
    >
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
 * Styled Lightbox namespace — drop-in replacement for `import * as Lightbox from '@ramka/react/lightbox'`
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
