'use client';

/**
 * Default lightbox — design-system package entry (copy with lightbox.css).
 *
 * Re-exports ramka Lightbox primitives with this skin attached, plus composed
 * `Lightbox.Gallery` (bleed slides, glass controls, desktop thumbnail strip).
 *
 * Package boundary: only the styled primitives + Gallery. Trigger layouts,
 * album grids, user cards, and other app UI belong in the consuming app
 * (docs: `demo.tsx`) — not in this module.
 */

import * as React from 'react';
import { Lightbox as RamkaLightbox } from 'ramka';

import './lightbox.css';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ── Icons (inline — no lucide dependency for copy-paste) ───────────────── */

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Item shape for `Lightbox.Gallery` — pass real intrinsic pixel size. */
export type LightboxItem = {
  id?: string | number;
  src: string;
  thumb: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
};

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('lb-trigger', className)} {...props} />;
}

function Portal(props: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('lb-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('lb-content', className)} {...props} />;
}

function Close({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close className={cx('lb-control', className)} aria-label="Close" {...props}>
      {children ?? <IconX />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return <RamkaLightbox.Slides className={cx('lb-slides', className)} {...props} />;
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return <RamkaLightbox.Slide className={cx('lb-slide', className)} {...props} />;
}

function Item(props: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('lb-media', className)} {...props} />;
}

function Zoom(props: React.ComponentProps<typeof RamkaLightbox.Zoom>) {
  return <RamkaLightbox.Zoom {...props} />;
}

function ZoomIn({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.ZoomIn>) {
  return (
    <RamkaLightbox.ZoomIn
      className={cx('lb-control', 'lb-control-md', className)}
      aria-label="Zoom in"
      {...props}
    >
      {children ?? <IconZoomIn />}
    </RamkaLightbox.ZoomIn>
  );
}

function ZoomOut({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.ZoomOut>) {
  return (
    <RamkaLightbox.ZoomOut
      className={cx('lb-control', 'lb-control-md', className)}
      aria-label="Zoom out"
      {...props}
    >
      {children ?? <IconZoomOut />}
    </RamkaLightbox.ZoomOut>
  );
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return <RamkaLightbox.Counter className={cx('lb-counter', className)} {...props} />;
}

function Caption({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Caption>) {
  return <RamkaLightbox.Caption className={cx('lb-caption', className)} {...props} />;
}

function ThumbnailStrip({
  className,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.ThumbnailStrip>) {
  return <RamkaLightbox.ThumbnailStrip className={cx('lb-thumbnail-strip', className)} {...props} />;
}

function ThumbnailStripTrack(
  props: React.ComponentProps<typeof RamkaLightbox.ThumbnailStripTrack>,
) {
  return <RamkaLightbox.ThumbnailStripTrack {...props} />;
}

function Thumbnail(props: React.ComponentProps<typeof RamkaLightbox.Thumbnail>) {
  return <RamkaLightbox.Thumbnail {...props} />;
}

function Previous(props: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return <RamkaLightbox.Previous {...props} />;
}

function Next(props: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return <RamkaLightbox.Next {...props} />;
}

function ItemGroup(props: React.ComponentProps<typeof RamkaLightbox.ItemGroup>) {
  return <RamkaLightbox.ItemGroup {...props} />;
}

function ThumbnailGroup(props: React.ComponentProps<typeof RamkaLightbox.ThumbnailGroup>) {
  return <RamkaLightbox.ThumbnailGroup {...props} />;
}

/* ── Composed Gallery (product chrome) ──────────────────────────────────── */

function GalleryThumbnailStrip({ items }: { items: LightboxItem[] }) {
  return (
    <ThumbnailStrip className="lb-thumbnail-strip-desktop">
      <ThumbnailStripTrack aria-label="Photo thumbnails">
        {items.map((item, i) => (
          <Thumbnail key={item.id ?? i} index={i}>
            <img src={item.thumb} alt={item.alt} draggable={false} />
          </Thumbnail>
        ))}
      </ThumbnailStripTrack>
      <span className="lb-thumbnail-strip-indicator" aria-hidden />
    </ThumbnailStrip>
  );
}

/**
 * Default product chrome — same composition as the docs hero / gallery demos:
 * Portal → Backdrop + Content → Slides/Zoom + counter / glass controls /
 * caption / desktop ThumbnailStrip (hidden below md).
 */
function Gallery({ items, ariaLabel }: { items: LightboxItem[]; ariaLabel: string }) {
  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        <Slides aria-label="Full-size images" preload={2}>
          {items.map((item, i) => (
            <Slide key={item.id ?? i}>
              <Item index={i} caption={item.caption ?? item.alt}>
                <Zoom maxZoom={6}>
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

        <div className={cx('lb-top-left', 'lb-chrome-pull-hide')}>
          <Counter />
        </div>

        <div className={cx('lb-top-right', 'lb-chrome-pull-hide')}>
          <ZoomOut />
          <ZoomIn />
          <Close />
        </div>

        <div className={cx('lb-bottom', 'lb-chrome-pull-hide')}>
          <Caption />
          <GalleryThumbnailStrip items={items} />
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
  ItemGroup,
  Media,
  Zoom,
  ZoomIn,
  ZoomOut,
  Counter,
  Caption,
  ThumbnailStrip,
  ThumbnailStripTrack,
  Thumbnail,
  ThumbnailGroup,
  Previous,
  Next,
  Gallery,
};
