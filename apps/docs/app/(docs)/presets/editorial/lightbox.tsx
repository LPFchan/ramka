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
import { Lightbox as RamkaLightbox } from 'ramka';

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

function Item(props: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('elb-media', className)} {...props} />;
}

function Zoom(props: React.ComponentProps<typeof RamkaLightbox.Zoom>) {
  return <RamkaLightbox.Zoom {...props} />;
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
        <Slides aria-label="Article photographs" preload={1}>
          {items.map((item, i) => (
            <Slide key={item.id ?? i}>
              <Item index={i} caption={figureCaption(item)}>
                {/* Zoom locked at 1× — Media sizes its fit-box against Zoom's
                    container, so the wrapper is structural even though this
                    viewer deliberately doesn't zoom. */}
                <Zoom maxZoom={1}>
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
 * Styled Lightbox namespace — drop-in replacement for `import { Lightbox } from 'ramka'`
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
  Zoom,
  Counter,
  Caption,
  Previous,
  Next,
  Gallery,
};
