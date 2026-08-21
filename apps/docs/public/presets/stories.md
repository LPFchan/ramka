# Stories

Instagram-style stories: a horizontal row of avatars, each dissolving into a vertical video via `crossfade="both"` (the circle is not the 9:16 frame, so a geometry morph would look wrong). Inside the viewer, slides are a native snap scroller with a CSS view-timeline rotateY — cards hinge on their leading edge as they enter and on their trailing edge as they leave. Copy the **Package** files (`lightbox.tsx` + `lightbox.css`) into your design system, then wire triggers in your app.

## Source

```tsx presets/stories/lightbox.tsx
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
import * as RamkaLightbox from 'ramka/lightbox';
import { useLightboxContext } from 'ramka';

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

function pauseDialogVideos(scope: Element | null) {
  if (!scope) return;
  for (const video of scope.querySelectorAll('video')) {
    video.pause();
  }
}

function Root({
  onBeforeClose,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return (
    <RamkaLightbox.Root
      {...props}
      onBeforeClose={(ctx) => {
        pauseDialogVideos(
          ctx.destination?.closest('[data-ramka-content]') ?? ctx.destination,
        );
        onBeforeClose?.(ctx);
      }}
    />
  );
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

function Stage({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof RamkaLightbox.Stage>, 'children'> & {
  children?: React.ReactNode;
}) {
  return (
    <RamkaLightbox.Stage className={cx('stl-stage', className)} {...props}>
      {({ morphRef }) => (
        <div ref={morphRef} className="stl-frame">
          {children}
        </div>
      )}
    </RamkaLightbox.Stage>
  );
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

/* ── Video (plays while this slide is active; pause in place when not) ─── */

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
  const { open, dialogElementRef } = useLightboxContext();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const syncPlayback = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const content = dialogElementRef.current;
    const pulling =
      !!content &&
      (content.hasAttribute('data-pulling') || content.hasAttribute('data-pull-dismissing'));
    if (active && open && !pulling) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active, open, dialogElementRef]);

  React.useEffect(() => {
    syncPlayback();
  }, [syncPlayback]);

  React.useEffect(() => {
    const content = dialogElementRef.current;
    if (!content) return;
    const mo = new MutationObserver(syncPlayback);
    mo.observe(content, {
      attributes: true,
      attributeFilter: ['data-pulling', 'data-pull-dismissing'],
    });
    return () => mo.disconnect();
  }, [dialogElementRef, syncPlayback]);

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

function Gallery({ items, ariaLabel }: { items: LightboxItem[]; ariaLabel: string }) {
  const multiple = items.length > 1;

  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        {multiple ? <Previous className="stl-chrome-gesture-hide" /> : null}
        <Stage>
          <Slides aria-label="Stories" preload={1}>
            {items.map((item, i) => (
              <Slide key={item.id ?? i}>
                <Item index={i}>
                  {({ active }) => (
                    <Media
                      width={item.width}
                      height={item.height}
                      className="stl-card"
                      style={{
                        backgroundImage: `url(${item.poster})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <StoryVideo
                        src={item.video}
                        poster={item.poster}
                        alt={item.alt}
                        width={item.width}
                        height={item.height}
                        active={active}
                      />
                      <StoryHud item={item} index={i} total={items.length} />
                    </Media>
                  )}
                </Item>
              </Slide>
            ))}
          </Slides>
        </Stage>
        {multiple ? (
          <>
            <Next className="stl-chrome-gesture-hide" />
            <Counter className="stl-chrome-gesture-hide" />
          </>
        ) : null}
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
  Previous,
  Next,
  Counter,
  Gallery,
};
```

```css presets/stories/lightbox.css
/**
 * Stories lightbox skin — pairs with lightbox.tsx (copy both files).
 *
 * 9:16 story cards with a scroll-driven rotateY page-turn (CSS view-timeline).
 * Translucent themed scrim (no blur); chrome matches light/dark. Class prefix: `stl-`.
 *
 * Variables named `--lightbox-*` are written by the library at runtime
 * (gesture progress, motion timing) — this file only reads them. All
 * view-transition CSS (morph group, snapshots, crossfade) is injected by the
 * library; skins ship none of it.
 */

.stl-portal {
  --stl-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --stl-blue: #007aff;
  /* Camera distance for the page-turn. ~1.8× a phone-width card so rotateY
     foreshortens instead of looking like a 2D squash. */
  --stl-perspective: 720px;
  --stl-scrim: rgb(255 255 255 / 0.72);
  --stl-chrome-bg: rgb(0 0 0 / 0.08);
  --stl-chrome-bg-hover: rgb(0 0 0 / 0.14);
  --stl-chrome-fg: rgb(0 0 0 / 0.88);
  --stl-chrome-fg-muted: rgb(0 0 0 / 0.55);
  --stl-frame-ring: rgb(0 0 0 / 0.12);
  --stl-frame-radius: 1.75rem;
  --stl-card-radius: 8px;
  --stl-stage-bg: #fff;
}

:is(.dark, [data-theme='dark']) .stl-portal {
  --stl-blue: #0a84ff;
  --stl-scrim: rgb(0 0 0 / 0.64);
  --stl-chrome-bg: rgb(255 255 255 / 0.08);
  --stl-chrome-bg-hover: rgb(255 255 255 / 0.14);
  --stl-chrome-fg: rgb(255 255 255 / 0.9);
  --stl-chrome-fg-muted: rgb(255 255 255 / 0.72);
  --stl-frame-ring: rgb(255 255 255 / 0.12);
  --stl-stage-bg: #000;
}

/* ── Trigger (circular avatar) ──────────────────────────────────────────── */

.stl-trigger {
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  font: inherit;
  color: inherit;
  appearance: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.stl-trigger:focus {
  outline: none;
}

.stl-trigger:focus-visible {
  outline: 2px solid var(--stl-blue);
  outline-offset: 3px;
}

/* ── Backdrop / Content open-close + pull ───────────────────────────────── */

.stl-backdrop {
  position: fixed;
  inset: 0;
  opacity: 0;
  background-color: var(--stl-scrim);
  transition: opacity var(--lightbox-pull-snap-duration, var(--lightbox-vt-duration, 360ms))
    var(--lightbox-pull-snap-easing, var(--stl-ease-out));
}

@starting-style {
  .stl-backdrop[data-open] {
    opacity: 0;
  }
}

.stl-backdrop[data-open] {
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
}

.stl-backdrop[data-pulling] {
  transition: none;
}

.stl-content {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overscroll-behavior: contain;
  outline: none;
  opacity: 0;
  color: #fafafa;
  transition: opacity var(--lightbox-vt-duration, 360ms) var(--stl-ease-out);
}

@media (min-width: 768px) {
  .stl-content {
    gap: 0.75rem;
    padding: 0 1rem;
  }
}

.stl-content[data-open] {
  opacity: 1;
}

@starting-style {
  .stl-content[data-open] {
    opacity: 0;
  }
}

/* ── 9:16 frame (Stage host sizes; inner frame is the morph target) ───── */

.stl-stage {
  align-self: stretch;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

@media (min-width: 768px) {
  .stl-stage {
    align-self: center;
    width: auto;
    height: min(100% - 4rem, 52rem);
    aspect-ratio: 9 / 16;
    max-width: calc(100% - 8rem);
  }
}

.stl-frame {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  overflow: clip;
  background: transparent;
}

@media (min-width: 768px) {
  .stl-frame {
    border-radius: var(--stl-frame-radius);
  }
}

/* Shell chrome only after the open morph — not in the VT snapshot. */
.stl-content[data-open] .stl-frame {
  background: #000;
}

@media (max-width: 767px) {
  .stl-content[data-open] .stl-frame {
    background: var(--stl-stage-bg);
  }
}

@media (min-width: 768px) {
  .stl-content[data-open] .stl-frame {
    box-shadow: 0 0 0 0.5px var(--stl-frame-ring);
  }
}

/* ── Slides / 3D card ───────────────────────────────────────────────────── */

.stl-slides {
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: 0;
  scrollbar-width: none;
}

.stl-slides::-webkit-scrollbar {
  display: none;
}

.stl-slide {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
}

.stl-card {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overflow: clip;
  background: #0a0a0a;
  border-radius: var(--stl-card-radius);
  transform-origin: center center;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.stl-media {
  width: 100%;
  height: 100%;
}

.stl-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

/*
 * Scroll-driven page-turn. `perspective()` is on the same transform as
 * rotateY — not an ancestor `perspective` property — because Slides’
 * `overflow-x: auto` and Content’s `overflow: hidden` flatten nested 3D
 * contexts, which makes a lone rotateY look like a horizontal squash.
 */
@supports (view-timeline: --stl-stories inline) {
  .stl-slide {
    view-timeline: --stl-stories inline;
  }

  .stl-card {
    animation: stl-flip linear both;
    animation-timeline: --stl-stories;
    animation-range: cover;
  }
}

/*
 * Safari’s VT snapshot ignores backface-visibility and does not clip 3D
 * overflow the way live layout does. Neighbors parked at ±90deg (fill-mode
 * both after they leave `cover`) leak in as a flipped previous card —
 * especially when opening a non-first story, whose morph target sits next
 * to that edge-on slide. Flatten and hide them for the capture.
 */
:root[data-ramka-view-transition] .stl-card {
  animation: none !important;
  transform: none !important;
}

:root[data-ramka-view-transition] .stl-slide:not(:has([data-active])) {
  visibility: hidden;
}

@keyframes stl-flip {
  /* Stay on the front face: 90deg is edge-on and Safari will show the back. */
  0% {
    transform: perspective(var(--stl-perspective)) rotateY(89deg);
    transform-origin: left center;
  }
  49% {
    transform: perspective(var(--stl-perspective)) rotateY(0deg);
    transform-origin: left center;
  }
  50% {
    transform: perspective(var(--stl-perspective)) rotateY(0deg);
    transform-origin: center center;
  }
  51% {
    transform: perspective(var(--stl-perspective)) rotateY(0deg);
    transform-origin: right center;
  }
  100% {
    transform: perspective(var(--stl-perspective)) rotateY(-89deg);
    transform-origin: right center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stl-card {
    animation: none;
  }
}

/* ── HUD on the card (progress + identity + close) ──────────────────────── */

.stl-hud {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding: calc(0.625rem + env(safe-area-inset-top, 0px)) 0.75rem 0;
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0) 7.5rem);
  transition: opacity var(--lightbox-pull-snap-duration, 200ms)
    var(--lightbox-pull-snap-easing, var(--stl-ease-out));
}

.stl-progress {
  display: flex;
  gap: 3px;
}

.stl-progress-seg {
  flex: 1;
  height: 2px;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.35);
}

.stl-progress-seg[data-state='past'],
.stl-progress-seg[data-state='current'] {
  background: #fff;
}

.stl-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.625rem;
  min-width: 0;
}

.stl-meta-avatar {
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: cover;
  box-shadow: 0 0 0 0.5px rgb(255 255 255 / 0.2);
}

.stl-meta-text {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: baseline;
  gap: 0.375rem;
}

.stl-meta-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #fff;
}

.stl-meta-time {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: rgb(255 255 255 / 0.65);
}

.stl-close {
  pointer-events: auto;
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  border: 0;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.35);
  color: #fff;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  cursor: pointer;
}

.stl-close:hover {
  background: rgb(0 0 0 / 0.5);
}

.stl-close:active {
  transform: scale(0.96);
}

.stl-close:focus {
  outline: none;
}

.stl-close:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.7);
  outline-offset: 2px;
}

.stl-close svg {
  display: block;
  width: 0.875rem;
  height: 0.875rem;
}

/* ── Chrome hide during pull-to-dismiss ─────────────────────────────────── */

.stl-chrome-gesture-hide {
  opacity: 1;
  visibility: visible;
  transition: opacity var(--lightbox-pull-snap-duration, 200ms)
    var(--lightbox-pull-snap-easing, var(--stl-ease-out));
}

@starting-style {
  .stl-chrome-gesture-hide {
    opacity: 0;
  }
}

/* Hide while the finger is down or a dismiss is committed. Omit
 * `data-pull-snapping` so release fades chrome back in on the snap spring
 * (other presets do the same). */
.stl-content:is([data-pulling], [data-pull-dismissing]) .stl-chrome-gesture-hide,
.stl-content:is([data-pulling], [data-pull-dismissing]) .stl-hud {
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms;
}

/* ── Stage-adjacent navigation (desktop) ───────────────────────────────── */

.stl-nav {
  z-index: 1;
  display: none;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: var(--stl-chrome-bg);
  color: var(--stl-chrome-fg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  cursor: pointer;
  transition:
    background-color 150ms ease-out,
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

@media (min-width: 768px) {
  .stl-nav {
    display: inline-flex;
  }
}

.stl-nav:hover {
  background: var(--stl-chrome-bg-hover);
}

.stl-nav:active {
  transform: scale(0.96);
}

.stl-nav:focus {
  outline: none;
}

.stl-nav:focus-visible {
  outline: 2px solid var(--stl-chrome-fg-muted);
  outline-offset: 2px;
}

.stl-nav:disabled {
  cursor: not-allowed;
  opacity: 0.25;
}

.stl-nav:disabled:active {
  transform: none;
}

.stl-nav svg {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
}

/* ── Counter (desktop only — mobile uses the HUD segments) ─────────────── */

.stl-counter {
  display: none;
}

@media (min-width: 768px) {
  .stl-counter {
    position: absolute;
    left: 50%;
    bottom: 1.25rem;
    z-index: 1;
    display: block;
    min-width: 3.5rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    background: var(--stl-chrome-bg);
    color: var(--stl-chrome-fg-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
    letter-spacing: 0.02em;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transform: translateX(-50%);
  }
}
```

```tsx presets/stories/demo.tsx
'use client';

import { Lightbox, type LightboxItem } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * A horizontally scrolling story tray. Each circle is a `Lightbox.Trigger`
 * showing the author’s portrait. `crossfade="both"`: the face is not the
 * 9:16 frame, so a geometry morph would look wrong. Closing from a story
 * whose trigger has scrolled off-screen recenters it for the close.
 */

function mixkit(id: number): string {
  return `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;
}

/** Mixkit’s first generated 720p still — matches the opening frame of `${id}-720.mp4`. */
function mixkitPoster(id: number): string {
  return `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`;
}

function portrait(gender: 'women' | 'men', n: number): string {
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

const stories: LightboxItem[] = [
  {
    id: 'maya',
    name: 'Maya',
    time: '2h',
    avatar: portrait('women', 44),
    poster: mixkitPoster(40065),
    video: mixkit(40065),
    alt: 'Maya’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'julian',
    name: 'Julian',
    time: '5h',
    avatar: portrait('men', 32),
    poster: mixkitPoster(43000),
    video: mixkit(43000),
    alt: 'Julian’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'noor',
    name: 'Noor',
    time: '8h',
    avatar: portrait('women', 68),
    poster: mixkitPoster(43785),
    video: mixkit(43785),
    alt: 'Noor’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'eli',
    name: 'Eli',
    time: '12h',
    avatar: portrait('men', 75),
    poster: mixkitPoster(40064),
    video: mixkit(40064),
    alt: 'Eli’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'sam',
    name: 'Sam',
    time: '1d',
    avatar: portrait('men', 22),
    poster: mixkitPoster(44852),
    video: mixkit(44852),
    alt: 'Sam’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'priya',
    name: 'Priya',
    time: '1d',
    avatar: portrait('women', 21),
    poster: mixkitPoster(50000),
    video: mixkit(50000),
    alt: 'Priya’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'tomas',
    name: 'Tomás',
    time: '2d',
    avatar: portrait('men', 11),
    poster: mixkitPoster(44600),
    video: mixkit(44600),
    alt: 'Tomás’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'aisha',
    name: 'Aisha',
    time: '2d',
    avatar: portrait('women', 17),
    poster: mixkitPoster(40066),
    video: mixkit(40066),
    alt: 'Aisha’s story',
    width: 720,
    height: 1280,
  },
];

export function StoriesPresetDemo() {
  return (
    <div className="w-full max-w-xl">
      <Lightbox.Root
        loop
        viewTransition="snappy"
        // Avatar is a different image from the 9:16 frame, so every trigger
        // crossfades — skip the decode wait so the dissolve starts immediately.
        awaitImageDecode={false}
        // Avatar tray is a horizontal scroller: recenter the active circle
        // between snapshot captures so the close dissolve lands on-screen
        // without a painted jump. Avoid `onChange` — scrolling the page
        // under an open viewer can flash tiles on iOS Safari.
        scrollTriggerIntoView={[
          { type: 'onOpenComplete', behavior: 'instant', inline: 'nearest' },
          { type: 'onChange', behavior: 'instant', inline: 'nearest' },
        ]}
      >
        <p className="px-1 text-[13px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Stories
        </p>
        <ul className="mt-3 flex snap-x snap-proximity gap-4 overflow-x-auto px-1 pb-1 scrollbar-none">
          {stories.map((story, i) => (
            <li
              key={story.id}
              className="flex w-16 shrink-0 snap-center scroll-mx-4 flex-col items-center gap-1.5"
            >
              <Lightbox.Trigger index={i} aria-label={`${story.name}’s story`} crossfade="both">
                {({ imageRef }) => (
                  <img
                    ref={imageRef}
                    src={story.avatar}
                    alt=""
                    width={56}
                    height={56}
                    className="block size-14 rounded-full object-cover"
                    draggable={false}
                  />
                )}
              </Lightbox.Trigger>
              <span className="w-full truncate text-center text-[11px] leading-tight text-neutral-600 dark:text-neutral-400">
                {story.name}
              </span>
            </li>
          ))}
        </ul>

        <Lightbox.Gallery items={stories} ariaLabel="Stories" />
      </Lightbox.Root>
    </div>
  );
}
```
