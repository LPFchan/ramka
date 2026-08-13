'use client';

/**
 * Stories lightbox — design-system package entry (copy with lightbox.css).
 *
 * Instagram-style vertical stories: circular avatar triggers dissolve into a
 * 9:16 card via `crossfade`, then swipe between stories with a CSS
 * scroll-driven rotateY (view-timeline) page-turn. No zoom — swipe / arrows
 * to browse, pull down to dismiss.
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
  name: string;
  avatar: string;
  video: string;
  poster: string;
  alt: string;
  /** Relative time shown in the story HUD, e.g. “2h”. */
  time?: string;
  width: number;
  height: number;
};

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('stl-trigger', className)} {...props} />;
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal className={cx('stl-portal', className)} {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('stl-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('stl-content', className)} {...props} />;
}

function Stage({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Stage>) {
  return <RamkaLightbox.Stage className={cx('stl-frame', className)} {...props} />;
}

function Close({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close className={cx('stl-close', className)} aria-label="Close" {...props}>
      {children ?? <IconX />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return <RamkaLightbox.Slides className={cx('stl-slides', className)} {...props} />;
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return <RamkaLightbox.Slide className={cx('stl-slide', className)} {...props} />;
}

function Item({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item className={cx('stl-item', className)} {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('stl-media', className)} {...props} />;
}

function Previous({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return (
    <RamkaLightbox.Previous className={cx('stl-nav', 'stl-nav-prev', className)} {...props}>
      {children ?? <IconChevronLeft />}
    </RamkaLightbox.Previous>
  );
}

function Next({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return (
    <RamkaLightbox.Next className={cx('stl-nav', 'stl-nav-next', className)} {...props}>
      {children ?? <IconChevronRight />}
    </RamkaLightbox.Next>
  );
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return <RamkaLightbox.Counter className={cx('stl-counter', className)} {...props} />;
}

/* ── Video (plays only while this slide is active) ──────────────────────── */

function StoryVideo({
  src,
  poster,
  alt,
  width,
  height,
  active,
}: {
  src: string;
  poster: string;
  alt: string;
  width: number;
  height: number;
  active: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      width={width}
      height={height}
      playsInline
      muted
      loop
      preload={active ? 'auto' : 'metadata'}
      aria-label={alt}
      className="stl-video"
    />
  );
}

/* ── Composed Gallery ───────────────────────────────────────────────────── */

function StoryHud({ item, index, total }: { item: LightboxItem; index: number; total: number }) {
  return (
    <div className="stl-hud">
      <div className="stl-progress" aria-hidden>
        {Array.from({ length: total }, (_, j) => (
          <span
            key={j}
            className="stl-progress-seg"
            data-state={j === index ? 'current' : j < index ? 'past' : 'future'}
          />
        ))}
      </div>
      <div className="stl-meta">
        <img src={item.avatar} alt="" className="stl-meta-avatar" draggable={false} />
        <div className="stl-meta-text">
          <span className="stl-meta-name">{item.name}</span>
          {item.time ? <span className="stl-meta-time">{item.time}</span> : null}
        </div>
        <Close />
      </div>
    </div>
  );
}

/**
 * Stories viewer — Portal → Backdrop + Content → 9:16 Stage frame with
 * scroll-driven 3D slides, HUD on each card, desktop edge navigation.
 */
function Gallery({ items, ariaLabel }: { items: LightboxItem[]; ariaLabel: string }) {
  const multiple = items.length > 1;

  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        <Stage>
          <Slides aria-label="Stories" preload={1}>
            {items.map((item, i) => (
              <Slide key={item.id ?? i}>
                <Item index={i}>
                  {({ active }) => (
                    <div className="stl-card">
                      <Media>
                        <StoryVideo
                          src={item.video}
                          poster={item.poster}
                          alt={item.alt}
                          width={item.width}
                          height={item.height}
                          active={active}
                        />
                      </Media>
                      <StoryHud item={item} index={i} total={items.length} />
                    </div>
                  )}
                </Item>
              </Slide>
            ))}
          </Slides>
        </Stage>

        {multiple ? (
          <>
            <Previous className="stl-chrome-gesture-hide" />
            <Next className="stl-chrome-gesture-hide" />
            <Counter className="stl-chrome-gesture-hide" />
          </>
        ) : null}
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
  Stage,
  Close,
  Slides,
  Slide,
  Item,
  Media,
  Previous,
  Next,
  Counter,
  Gallery,
};
