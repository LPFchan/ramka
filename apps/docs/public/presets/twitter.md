# Twitter

X-style split viewer: a semi-translucent dark media pane with close (top-left) and previous/next on the gallery edges. Desktop keeps a white thread sidebar; mobile shows a bottom engagement bar and opens the thread as a full-screen sheet from the comment control. Copy the **Package** files (`lightbox.tsx` + `lightbox.css`) into your design system, then wire triggers in your app. The **Example** tab shows a three-post feed with Facebook-style image grids — single image, three-up, and a `+N` crossfade tile — each opening the split viewer (Tailwind layout only).

## Source

```tsx presets/twitter/lightbox.tsx
'use client';

/**
 * Twitter / X-style lightbox — design-system package entry (copy with lightbox.css).
 *
 * Desktop: translucent media pane + thread sidebar (edge prev/next).
 * Mobile: swipeable Slides + bottom engagement bar; comment opens a full-screen thread.
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVerified() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="xlb-verified">
      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-.99-1-2.5-1.27-3.9-.82C14.6 2.9 13.3 2 12 2s-2.6.9-3.06 2.13c-1.4-.45-2.91-.18-3.9.82-1.01 1.01-1.27 2.52-.81 3.91C2.88 9.33 2 10.57 2 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91 1 .99 2.5 1.27 3.9.82.46 1.23 1.76 2.13 3.06 2.13s2.6-.9 3.06-2.13c1.4.45 2.91.18 3.9-.82 1.01-1.01 1.27-2.52.81-3.91 1.31-.67 2.19-1.91 2.19-3.34Zm-6.01-3.77 1.72 1.72-6.01 6.01-3.54-3.54 1.72-1.72 1.82 1.82 4.29-4.29Z" />
    </svg>
  );
}

function IconReply() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M19.5 10.5c0 4.142-3.358 7.5-7.5 7.5-1.38 0-2.67-.37-3.78-1.02L3 19.5V15.3c.65-1.11 1.02-2.4 1.02-3.78 0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRepost() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M4.5 9.5 9 5l4.5 4.5M9 5v11.5M19.5 14.5 15 19l-4.5-4.5M15 19V7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLike() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M12 20.25c-.19 0-.38-.07-.53-.2-5.47-4.06-8.97-6.74-8.97-11.1 0-2.98 2.4-5.4 5.36-5.4 1.64 0 3.14.79 4.14 2.02 1-1.23 2.5-2.02 4.14-2.02 2.96 0 5.36 2.42 5.36 5.4 0 4.36-3.5 7.04-8.97 11.1-.15.13-.34.2-.53.2Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconViews() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M4 18V10M10 18V6M16 18v-5M20 18V8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14M12 4v11M8.5 7.5 12 4l3.5 3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Public types ────────────────────────────────────────────────────────── */

export type LightboxItem = {
  id?: string | number;
  src: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
};

export type ThreadAuthor = {
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
};

export type ThreadReply = {
  id: string;
  author: ThreadAuthor;
  text: string;
  time: string;
};

export type ThreadPost = {
  author: ThreadAuthor;
  text: string;
  time: string;
  stats?: {
    replies?: number;
    reposts?: number;
    likes?: number;
    views?: string;
  };
  replies: ThreadReply[];
};

function formatCount(value: number | undefined): string {
  if (value == null) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

/* ── Styled primitives ───────────────────────────────────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('xlb-trigger', className)} {...props} />;
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal className={cx('xlb-portal', className)} {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('xlb-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('xlb-content', className)} {...props} />;
}

function Stage({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Stage>) {
  return <RamkaLightbox.Stage className={cx('xlb-media-pane', className)} {...props} />;
}

function Close({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close className={cx('xlb-control', 'xlb-close', className)} aria-label="Close" {...props}>
      {children ?? <IconX />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return <RamkaLightbox.Slides className={cx('xlb-slides', className)} {...props} />;
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return <RamkaLightbox.Slide className={cx('xlb-slide', className)} {...props} />;
}

function Item(props: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('xlb-media', className)} {...props} />;
}

function Zoom(props: React.ComponentProps<typeof RamkaLightbox.Zoom>) {
  return <RamkaLightbox.Zoom {...props} />;
}

function Previous({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return (
    <RamkaLightbox.Previous
      className={cx('xlb-control', 'xlb-nav', 'xlb-nav-prev', className)}
      {...props}
    >
      {children ?? <IconChevronLeft />}
    </RamkaLightbox.Previous>
  );
}

function Next({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return (
    <RamkaLightbox.Next className={cx('xlb-control', 'xlb-nav', 'xlb-nav-next', className)} {...props}>
      {children ?? <IconChevronRight />}
    </RamkaLightbox.Next>
  );
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return (
    <RamkaLightbox.Counter className={cx('xlb-counter', 'xlb-chrome-pull-hide', className)} {...props} />
  );
}

/* ── Mobile engagement bar ───────────────────────────────────────────────── */

function MobileActionBar({
  stats,
  onOpenThread,
}: {
  stats: ThreadPost['stats'];
  onOpenThread: () => void;
}) {
  return (
    <div className="xlb-mobile-bar xlb-chrome-pull-hide" aria-label="Post actions">
      <button type="button" className="xlb-mobile-action" aria-label="View comments" onClick={onOpenThread}>
        <IconReply />
        <span>{formatCount(stats?.replies)}</span>
      </button>
      <button type="button" className="xlb-mobile-action" aria-label="Repost">
        <IconRepost />
        <span>{formatCount(stats?.reposts)}</span>
      </button>
      <button type="button" className="xlb-mobile-action" aria-label="Like">
        <IconLike />
        <span>{formatCount(stats?.likes)}</span>
      </button>
      <button type="button" className="xlb-mobile-action" aria-label="Views">
        <IconViews />
        <span>{stats?.views ?? '—'}</span>
      </button>
      <button type="button" className="xlb-mobile-action" aria-label="Share">
        <IconShare />
      </button>
    </div>
  );
}

function useMobileLayout() {
  const [mobile, setMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return mobile;
}

function ThreadPanel({
  thread,
  open,
  onClose,
}: {
  thread: ThreadPost;
  /** Mobile sheet visibility. Ignored on desktop (sidebar always shown). */
  open: boolean;
  onClose: () => void;
}) {
  const stats = thread.stats;
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const mobile = useMobileLayout();
  // Desktop sidebar is always interactive; mobile sheet is inert while closed.
  const sheetActive = !mobile || open;

  React.useEffect(() => {
    if (!open || !mobile) return;
    scrollRef.current?.focus({ preventScroll: true });
  }, [open, mobile]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Escape' || !mobile || !open) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    },
    [mobile, open, onClose],
  );

  return (
    <aside
      className="xlb-thread-pane"
      aria-label="Post thread"
      data-open={open ? '' : undefined}
      aria-hidden={sheetActive ? undefined : true}
      inert={sheetActive ? undefined : true}
      onKeyDown={handleKeyDown}
    >
      <div className="xlb-thread-header">
        <button
          type="button"
          className="xlb-thread-back"
          aria-label="Close thread"
          onClick={onClose}
        >
          <IconX />
        </button>
        <h2 className="xlb-thread-title">Post</h2>
        <span className="xlb-thread-header-spacer" aria-hidden />
      </div>

      <div
        ref={scrollRef}
        className="xlb-thread-scroll"
        tabIndex={0}
        role="region"
        aria-label="Thread"
      >
        <div className="xlb-thread-body">
          <div className="xlb-author">
            <img src={thread.author.avatar} alt="" className="xlb-avatar" draggable={false} />
            <div className="xlb-author-meta">
              <div className="xlb-author-line">
                <span className="xlb-author-name">{thread.author.name}</span>
                {thread.author.verified ? <IconVerified /> : null}
              </div>
              <div className="xlb-author-line">
                <span className="xlb-author-handle">@{thread.author.handle}</span>
              </div>
            </div>
            <button type="button" className="xlb-follow">
              Follow
            </button>
          </div>

          <p className="xlb-post-text">{thread.text}</p>

          <p className="xlb-post-meta">
            <span className="xlb-post-time">{thread.time}</span>
            {stats?.views ? (
              <>
                {' · '}
                <strong>{stats.views}</strong> Views
              </>
            ) : null}
          </p>

          {stats ? (
            <p className="xlb-post-meta">
              <strong>{formatCount(stats.reposts)}</strong> Reposts ·{' '}
              <strong>{formatCount(stats.likes)}</strong> Likes
            </p>
          ) : null}

          <div className="xlb-actions" aria-label="Post actions">
            <button type="button" className="xlb-action" aria-label="Reply">
              <IconReply />
              {stats?.replies != null ? formatCount(stats.replies) : null}
            </button>
            <button type="button" className="xlb-action" aria-label="Repost">
              <IconRepost />
              {stats?.reposts != null ? formatCount(stats.reposts) : null}
            </button>
            <button type="button" className="xlb-action" aria-label="Like">
              <IconLike />
              {stats?.likes != null ? formatCount(stats.likes) : null}
            </button>
            <button type="button" className="xlb-action" aria-label="Share">
              <IconShare />
            </button>
          </div>
        </div>

        <div className="xlb-reply-box">
          <img src={thread.author.avatar} alt="" className="xlb-avatar xlb-reply-avatar" draggable={false} />
          <input
            type="text"
            className="xlb-reply-input"
            placeholder="Post your reply"
            aria-label="Post your reply"
          />
        </div>

        <ul className="xlb-replies" aria-label="Replies">
          {thread.replies.map((reply) => (
            <li key={reply.id} className="xlb-reply">
              <img src={reply.author.avatar} alt="" className="xlb-avatar xlb-reply-avatar" draggable={false} />
              <div className="xlb-author-meta">
                <div className="xlb-author-line">
                  <span className="xlb-author-name">{reply.author.name}</span>
                  <span className="xlb-author-handle">@{reply.author.handle}</span>
                  <span className="xlb-author-handle">· {reply.time}</span>
                </div>
                <p className="xlb-reply-text">{reply.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/**
 * Twitter-style split viewer — dark media pane + thread (sidebar / mobile sheet).
 */
function Gallery({
  items,
  thread,
  ariaLabel,
}: {
  items: LightboxItem[];
  thread: ThreadPost;
  ariaLabel: string;
}) {
  const showNav = items.length > 1;
  const [threadOpen, setThreadOpen] = React.useState(false);

  const openThread = React.useCallback(() => setThreadOpen(true), []);
  const closeThread = React.useCallback(() => setThreadOpen(false), []);

  return (
    <Portal>
      <Backdrop />
      <Content
        aria-label={ariaLabel}
        className={threadOpen ? 'xlb-content-thread-open' : undefined}
      >
        <Stage>
          <Close className="xlb-chrome-pull-hide" />

          <Slides aria-label="Post media" preload={1}>
            {items.map((item, i) => (
              <Slide key={item.id ?? i}>
                <Item index={i}>
                  <Zoom>
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

          {showNav ? (
            <>
              <Previous className="xlb-chrome-pull-hide" />
              <Next className="xlb-chrome-pull-hide" />
              <Counter className="xlb-chrome-pull-hide" />
            </>
          ) : null}

          <MobileActionBar stats={thread.stats} onOpenThread={openThread} />
        </Stage>

        <ThreadPanel thread={thread} open={threadOpen} onClose={closeThread} />
      </Content>
    </Portal>
  );
}

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
  Previous,
  Next,
  Counter,
  Gallery,
  ThreadPanel,
};
```

```css presets/twitter/lightbox.css
/**
 * Twitter / X-style lightbox skin — ships with lightbox.tsx.
 *
 * Split layout: dark translucent media pane (close + prev/next) and a thread
 * sidebar (white in light mode, "lights out" black in dark mode — `.dark` or
 * `[data-theme='dark']` on an ancestor). Prefix: `xlb-`.
 */

/* ── Tokens (scoped to skin host — not :root) ───────────────────────────── */

.xlb-portal {
  --xlb-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  /* One motion clock: the library always publishes the Root's `viewTransition`
     preset timing on the Portal host (this element), so fades and chrome
     slides track the preset with or without a View Transition. The literal
     fallback only covers pre-var library versions. */
  --xlb-duration-open: var(--lightbox-vt-duration, 360ms);
  --xlb-thread-width: 22.5rem;
  /* Clear media plane — dimming comes from `.xlb-backdrop` (mobile solid, desktop 0.5). */
  --xlb-media-bg: transparent;
}

/* ── Trigger ────────────────────────────────────────────────────────────── */

.xlb-trigger {
  font: inherit;
  color: inherit;
  appearance: none;
  cursor: pointer;
}

.xlb-trigger:focus {
  outline: none;
}

.xlb-trigger:focus-visible {
  outline: 2px solid #1d9bf0;
  outline-offset: 2px;
}

/* Morph hide (`data-morph-target`) is injected by the library. */

/* ── Backdrop / Content ─────────────────────────────────────────────────── */

.xlb-backdrop {
  position: fixed;
  inset: 0;
  opacity: 0;
  /* Mobile: solid black. Desktop overrides background alpha below. */
  background: #000;
  transition: opacity
    var(--lightbox-pull-snap-duration, var(--xlb-duration-open))
    var(--lightbox-pull-snap-easing, var(--xlb-ease-out));
}

@media (min-width: 768px) {
  .xlb-backdrop {
    background: rgb(0 0 0 / 0.9);
  }
}

@starting-style {
  .xlb-backdrop[data-open] {
    opacity: 0;
  }
}

/* Opacity stays 1 at rest; only pull-to-dismiss fades it. */
.xlb-backdrop[data-open] {
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.75);
}

.xlb-backdrop[data-pulling] {
  transition: none;
}

.xlb-content {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  outline: none;
  opacity: 0;
  transition: opacity var(--xlb-duration-open) var(--xlb-ease-out);
}

.xlb-content[data-open] {
  opacity: 1;
}

@starting-style {
  .xlb-content[data-open] {
    opacity: 0;
  }
}

/* ── Media pane ─────────────────────────────────────────────────────────── */

.xlb-media-pane {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1 1 0%;
  flex-direction: column;
  overflow: hidden;
  background: var(--xlb-media-bg);

  --xlb-inset-top: calc(3rem + env(safe-area-inset-top, 0px));
  --xlb-inset-bottom: calc(3rem + env(safe-area-inset-bottom, 0px));
  --xlb-inset-inline: 0px;
}

@media (min-width: 768px) {
  .xlb-media-pane {
    --xlb-inset-inline: 3.5rem;
  }
}

.xlb-slides {
  flex: 1;
  min-height: 0;
  gap: 0;
  scrollbar-width: none;
}

.xlb-slides::-webkit-scrollbar {
  display: none;
}

.xlb-slide {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding:
    var(--xlb-inset-top)
    var(--xlb-inset-inline)
    var(--xlb-inset-bottom);
}

.xlb-media img {
  user-select: none;
  -webkit-user-select: none;
}

/* ── Controls ───────────────────────────────────────────────────────────── */

.xlb-chrome-pull-hide {
  opacity: 1;
  visibility: visible;
  transition:
    opacity 200ms,
    visibility 0s linear 0s;
}

@starting-style {
  .xlb-chrome-pull-hide {
    opacity: 0;
  }
}

.xlb-content:is([data-pulling], [data-pull-dismissing]) .xlb-chrome-pull-hide {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 200ms,
    visibility 0s linear 200ms;
}

.xlb-close {
  position: absolute;
  z-index: 2;
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
}

.xlb-nav {
  position: absolute;
  z-index: 2;
  top: 50%;
  transform: translateY(-50%);
}

.xlb-nav-prev {
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
}

.xlb-nav-next {
  right: calc(0.75rem + env(safe-area-inset-right, 0px));
}

.xlb-control {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: rgb(15 20 25 / 0.65);
  color: #fff;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  transition:
    background-color 150ms ease-out,
    transform 150ms ease-out,
    opacity 150ms ease-out;
  cursor: pointer;
}

.xlb-control:hover {
  background: rgb(15 20 25 / 0.82);
}

.xlb-control:active {
  transform: scale(0.96);
}

.xlb-nav:active {
  transform: translateY(-50%) scale(0.96);
}

.xlb-control:focus {
  outline: none;
}

.xlb-control:focus-visible {
  box-shadow: 0 0 0 2px #fff;
}

.xlb-control:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.xlb-control:disabled:active {
  transform: none;
}

.xlb-nav:disabled:active {
  transform: translateY(-50%);
}

.xlb-control svg {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
}

.xlb-counter {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  border-radius: 9999px;
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 0.92);
  background: rgb(15 20 25 / 0.55);
}

/* ── Mobile engagement bar ──────────────────────────────────────────────── */

.xlb-mobile-bar {
  position: absolute;
  z-index: 2;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding:
    0.625rem 1.25rem
    calc(0.625rem + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(to top, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0));
  color: #fff;
}

.xlb-mobile-action {
  display: inline-flex;
  min-width: 2.75rem;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 0;
  border-radius: 9999px;
  padding: 0.4rem 0.35rem;
  font-size: 0.8125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.xlb-mobile-action svg {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
}

.xlb-mobile-action:focus {
  outline: none;
}

.xlb-mobile-action:focus-visible {
  box-shadow: 0 0 0 2px #fff;
}

@media (min-width: 768px) {
  .xlb-mobile-bar {
    display: none;
  }
}

@media (max-width: 767px) {
  .xlb-media-pane {
    --xlb-inset-bottom: calc(5.25rem + env(safe-area-inset-bottom, 0px));
  }

  .xlb-nav {
    display: none;
  }

  .xlb-counter {
    bottom: calc(3.75rem + env(safe-area-inset-bottom, 0px));
  }
}

/* ── Thread pane ────────────────────────────────────────────────────────── */

.xlb-thread-pane {
  display: flex;
  min-height: 0;
  flex-direction: column;
  background: #fff;
  color: #0f1419;
}

/* Mobile: full-screen sheet over the media pane (closed off-screen). */
@media (max-width: 767px) {
  .xlb-thread-pane {
    position: absolute;
    inset: 0;
    z-index: 20;
    width: 100%;
    max-height: none;
    transform: translateY(100%);
    visibility: hidden;
    pointer-events: none;
    transition:
      transform var(--xlb-duration-open) var(--xlb-ease-out),
      visibility 0s linear var(--xlb-duration-open);
  }

  .xlb-thread-pane[data-open] {
    transform: translateY(0);
    visibility: visible;
    pointer-events: auto;
    transition:
      transform var(--xlb-duration-open) var(--xlb-ease-out),
      visibility 0s linear 0s;
  }

  .xlb-content-thread-open .xlb-media-pane {
    /* Keep media mounted under the sheet for a cheap return. */
    visibility: hidden;
  }
}

@media (min-width: 768px) {
  .xlb-content {
    flex-direction: row;
  }

  .xlb-thread-pane {
    position: relative;
    width: var(--xlb-thread-width);
    max-width: 40vw;
    flex: 0 0 var(--xlb-thread-width);
    border-left: 1px solid rgb(239 243 244);
    transform: none;
    visibility: visible;
    pointer-events: auto;
  }

}

.xlb-thread-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  outline: none;
}

.xlb-thread-scroll:focus-visible {
  box-shadow: inset 0 0 0 2px #1d9bf0;
}

.xlb-thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgb(239 243 244);
}

/* Sheet dismiss control — mobile only (desktop sidebar is always open). */
.xlb-thread-back,
.xlb-thread-header-spacer {
  display: none;
}

.xlb-thread-back {
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  padding: 0;
  color: #0f1419;
  background: transparent;
  cursor: pointer;
}

.xlb-thread-back svg {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
}

.xlb-thread-back:focus {
  outline: none;
}

.xlb-thread-back:focus-visible {
  box-shadow: 0 0 0 2px #1d9bf0;
}

.xlb-thread-header-spacer {
  width: 2rem;
  flex-shrink: 0;
}

.xlb-thread-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}

@media (max-width: 767px) {
  .xlb-thread-back {
    display: inline-flex;
  }

  .xlb-thread-header-spacer {
    display: block;
  }
}

@media (min-width: 768px) {
  .xlb-thread-title {
    flex: 1;
  }
}

.xlb-thread-body {
  padding: 0.875rem 1rem 0;
}

.xlb-author {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}

.xlb-avatar {
  display: block;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: cover;
}

.xlb-author-meta {
  min-width: 0;
  flex: 1;
}

.xlb-author-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.xlb-author-name {
  font-size: 0.9375rem;
  font-weight: 700;
}

.xlb-verified {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  color: #1d9bf0;
}

.xlb-author-handle,
.xlb-post-time {
  font-size: 0.9375rem;
  color: rgb(83 100 113);
}

.xlb-follow {
  flex-shrink: 0;
  border: 1px solid rgb(207 217 222);
  border-radius: 9999px;
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  background: #fff;
  color: #0f1419;
  cursor: pointer;
}

.xlb-post-text {
  margin: 0.75rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.35;
  white-space: pre-wrap;
}

.xlb-post-meta {
  margin-top: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgb(239 243 244);
  font-size: 0.9375rem;
  color: rgb(83 100 113);
}

.xlb-post-meta strong {
  color: #0f1419;
}

.xlb-actions {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid rgb(239 243 244);
}

.xlb-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: 0;
  border-radius: 9999px;
  padding: 0.625rem;
  font-size: 0.8125rem;
  color: rgb(83 100 113);
  background: transparent;
  cursor: pointer;
}

.xlb-action svg {
  width: 1.125rem;
  height: 1.125rem;
}

.xlb-reply-box {
  display: flex;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgb(239 243 244);
}

.xlb-reply-input {
  min-width: 0;
  flex: 1;
  border: 0;
  padding: 0.625rem 0;
  font: inherit;
  font-size: 0.9375rem;
  color: inherit;
  background: transparent;
}

.xlb-reply-input::placeholder {
  color: rgb(83 100 113);
}

/* iOS Safari zooms the page when a focused input's font-size is under 16px —
   bump it on touch layouts (15px stays on desktop). */
@media (max-width: 767px) {
  .xlb-reply-input {
    font-size: 1rem;
  }
}

.xlb-reply-input:focus {
  outline: none;
}

.xlb-replies {
  list-style: none;
  margin: 0;
  padding: 0;
}

.xlb-reply {
  display: flex;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgb(239 243 244);
}

.xlb-reply-avatar {
  width: 2rem;
  height: 2rem;
}

.xlb-reply-text {
  margin: 0.125rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.35;
}

/* ── Dark mode ──────────────────────────────────────────────────────────── */

/* Only the thread pane is theme-dependent — the media pane, backdrop, and
   glass controls are dark in both themes (photos read best on black). Palette
   matches X's "lights out": #e7e9ea text, #71767b secondary, #2f3336 rules. */

:is(.dark, [data-theme='dark']) .xlb-thread-pane {
  background: #000;
  color: #e7e9ea;
  border-left-color: #2f3336;
}

:is(.dark, [data-theme='dark'])
  :is(.xlb-thread-header, .xlb-post-meta, .xlb-actions, .xlb-reply-box, .xlb-reply) {
  border-bottom-color: #2f3336;
}

:is(.dark, [data-theme='dark']) .xlb-thread-back {
  color: #e7e9ea;
}

:is(.dark, [data-theme='dark'])
  :is(.xlb-author-handle, .xlb-post-time, .xlb-post-meta, .xlb-action) {
  color: #71767b;
}

:is(.dark, [data-theme='dark']) .xlb-reply-input::placeholder {
  color: #71767b;
}

:is(.dark, [data-theme='dark']) .xlb-post-meta strong {
  color: #e7e9ea;
}

/* X keeps the Follow button white-on-black in dark mode. */
:is(.dark, [data-theme='dark']) .xlb-follow {
  border-color: transparent;
  background: #eff3f4;
  color: #0f1419;
}

/* Document-level view-transition CSS (isolation, morph group/snapshots,
   crossfade) is injected by the library — skins ship none of it. */
```

```tsx presets/twitter/demo.tsx
'use client';

import * as React from 'react';
import * as RamkaLightbox from '@ramka/react/lightbox';
import { Heart, MessageCircle, Repeat2, Share } from 'lucide-react';

import { Lightbox, type LightboxItem, type ThreadPost } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * A small social feed: each post is an independent `Lightbox.Root` whose
 * attachments render in a Facebook-style grid (single image, three-up, and a
 * 2×2 with a `+N` overlay tile). Tapping a tile morphs into the split viewer
 * from `./lightbox`; the `+N` tile uses `crossfade="both"` (there is no
 * single full-size image behind it, so a morph would look wrong) and
 * `morphTo="closest"` so closing from a hidden extra lands on a visible tile.
 *
 * The reply action opens the viewer too (thread sidebar / comment sheet) via
 * an imperative `Lightbox.createHandle()` — there is no trigger element to
 * click, so the open is programmatic.
 */

type FeedPost = {
  id: string;
  /** Short relative time on the feed card; `thread.time` is the full stamp. */
  time: string;
  thread: ThreadPost;
  images: LightboxItem[];
};

const feed: FeedPost[] = [
  {
    id: 'post-road-trip',
    time: '2d',
    thread: {
      author: {
        name: 'Tomás Rivera',
        handle: 'tomasrivera',
        avatar: 'https://i.pravatar.cc/96?u=tomas',
        verified: true,
      },
      text: 'Week-long road trip along the coast is done. Seven stops, seven completely different landscapes.',
      time: 'Aug 9, 2026 · 6:41 PM',
      stats: { replies: 97, reposts: 514, likes: 3842, views: '212K' },
      replies: [
        {
          id: 'r1',
          author: { name: 'Sofia Lindgren', handle: 'sofialind', avatar: 'https://i.pravatar.cc/96?u=sofia' },
          text: 'The lighthouse shot is unreal. What time of day was that?',
          time: '1d',
        },
        {
          id: 'r2',
          author: { name: 'James Okafor', handle: 'jamesokafor', avatar: 'https://i.pravatar.cc/96?u=james' },
          text: 'Route details please — planning the same trip for October.',
          time: '20h',
        },
      ],
    },
    images: [
      { src: 'https://picsum.photos/seed/rg-6a/1600/1000', thumb: 'https://picsum.photos/seed/rg-6a/800/500', alt: 'Dramatic cliffside road at sunset', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6b/1600/1000', thumb: 'https://picsum.photos/seed/rg-6b/800/500', alt: 'Turquoise cove with fishing boats', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6c/1600/1000', thumb: 'https://picsum.photos/seed/rg-6c/800/500', alt: 'Terraced vineyards in morning mist', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6d/900/1400', thumb: 'https://picsum.photos/seed/rg-6d/450/700', alt: 'Old lighthouse on a rocky headland', width: 900, height: 1400 },
      { src: 'https://picsum.photos/seed/rg-6e/1600/1000', thumb: 'https://picsum.photos/seed/rg-6e/800/500', alt: 'Wild horses grazing on a dune', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6f/1200/1200', thumb: 'https://picsum.photos/seed/rg-6f/600/600', alt: 'Street musicians in a coastal town square', width: 1200, height: 1200 },
      { src: 'https://picsum.photos/seed/rg-6g/1600/1000', thumb: 'https://picsum.photos/seed/rg-6g/800/500', alt: 'Milky Way over a deserted beach', width: 1600, height: 1000 },
    ],
  },
  {
    id: 'post-good-light',
    time: '8h',
    thread: {
      author: {
        name: 'Aisha Patel',
        handle: 'aishapatel',
        avatar: 'https://i.pravatar.cc/96?u=aisha',
      },
      text: 'Golden hour across the valley, the canopy from below, and still water at dusk. A good day for light.',
      time: 'Aug 11, 2026 · 4:05 AM',
      stats: { replies: 28, reposts: 67, likes: 892, views: '31K' },
      replies: [
        {
          id: 'r1',
          author: { name: 'Marcus Chen', handle: 'marcusc', avatar: 'https://i.pravatar.cc/96?u=marcus' },
          text: 'That canopy frame is a wallpaper. Straight out of camera?',
          time: '6h',
        },
      ],
    },
    images: [
      { src: 'https://picsum.photos/seed/rg-3a/1600/900', thumb: 'https://picsum.photos/seed/rg-3a/800/450', alt: 'Rolling fields at golden hour', width: 1600, height: 900 },
      { src: 'https://picsum.photos/seed/rg-3b/1000/1400', thumb: 'https://picsum.photos/seed/rg-3b/500/700', alt: 'Dense forest canopy from below', width: 1000, height: 1400 },
      { src: 'https://picsum.photos/seed/rg-3c/1500/1000', thumb: 'https://picsum.photos/seed/rg-3c/750/500', alt: 'Quiet lake reflecting the hills', width: 1500, height: 1000 },
    ],
  },
  {
    id: 'post-first-light',
    time: '2h',
    thread: {
      author: {
        name: 'Elena Vasquez',
        handle: 'elenavsq',
        avatar: 'https://i.pravatar.cc/96?u=elena',
      },
      text: 'First light over the ridgeline this morning — worth every minute of the 4am alarm.',
      time: 'Aug 11, 2026 · 10:12 AM',
      stats: { replies: 12, reposts: 31, likes: 284, views: '9.4K' },
      replies: [
        {
          id: 'r1',
          author: { name: 'Priya Nair', handle: 'priyanair', avatar: 'https://i.pravatar.cc/96?u=priya' },
          text: 'The 4am alarm gang eats again. Gorgeous.',
          time: '1h',
        },
      ],
    },
    images: [
      { src: 'https://picsum.photos/seed/rg-1/1600/1000', thumb: 'https://picsum.photos/seed/rg-1/800/500', alt: 'Mountain range under a wide morning sky', width: 1600, height: 1000 },
    ],
  },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

const actionClass =
  'flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100';

/** Reply / repost / like / share row. Reply opens the viewer (thread beside it). */
function ActionBar({
  stats,
  onReply,
}: {
  stats: ThreadPost['stats'];
  onReply: () => void;
}) {
  return (
    <div className="-mb-1.5 -ml-2 mt-1 flex items-center gap-1 text-neutral-500">
      <button type="button" className={actionClass} aria-label="View replies" onClick={onReply}>
        <MessageCircle className="size-4" aria-hidden />
        <span>{formatCount(stats?.replies ?? 0)}</span>
      </button>
      <button type="button" className={actionClass} aria-label="Repost">
        <Repeat2 className="size-4" aria-hidden />
        <span>{formatCount(stats?.reposts ?? 0)}</span>
      </button>
      <button type="button" className={actionClass} aria-label="Like">
        <Heart className="size-4" aria-hidden />
        <span>{formatCount(stats?.likes ?? 0)}</span>
      </button>
      <button type="button" className={actionClass} aria-label="Share">
        <Share className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Per-cell rounded corners for the 1–4 cell grids. Inner edges stay sharp;
 * outer corners match the parent grid. The radius must live on the Trigger —
 * the morph reads it to animate corner rounding.
 */
function cornerClass(index: number, count: number): string {
  if (count === 2) {
    return index === 0 ? 'rounded-l-xl' : 'rounded-r-xl';
  }
  if (count === 3) {
    if (index === 0) return 'rounded-l-xl';
    return index === 1 ? 'rounded-tr-xl' : 'rounded-br-xl';
  }
  if (count === 4) {
    return ['rounded-tl-xl', 'rounded-tr-xl', 'rounded-bl-xl', 'rounded-br-xl'][index]!;
  }
  return 'rounded-xl';
}

/**
 * Facebook-style trigger grid: 1 image fills the width, 2–4 tile into a
 * grid, and 5+ collapse the extras behind a `+N` overlay tile. Every tile is
 * a `Lightbox.Trigger`, so tapping one morphs into the viewer at that index.
 */
function ImageGrid({ imgs }: { imgs: LightboxItem[] }) {
  const count = imgs.length;

  if (count === 1) {
    const only = imgs[0]!;
    return (
      <Lightbox.Trigger index={0} className="block w-full overflow-hidden rounded-xl bg-transparent p-0">
        {({ imageRef }) => (
          <img
            ref={imageRef}
            src={only.thumb}
            alt={only.alt}
            width={only.width}
            height={only.height}
            className="block w-full object-cover"
            draggable={false}
          />
        )}
      </Lightbox.Trigger>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {imgs.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 2)}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                src={img.thumb}
                alt={img.alt}
                width={img.width}
                height={img.height}
                className="block aspect-4/5 w-full object-cover"
                draggable={false}
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
    );
  }

  if (count === 3) {
    const first = imgs[0]!;
    return (
      <div className="grid aspect-3/2 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
        <Lightbox.Trigger
          index={0}
          className={`row-span-2 block overflow-hidden bg-transparent p-0 ${cornerClass(0, 3)}`}
        >
          {({ imageRef }) => (
            <img
              ref={imageRef}
              src={first.thumb}
              alt={first.alt}
              width={first.width}
              height={first.height}
              className="block size-full object-cover"
              draggable={false}
            />
          )}
        </Lightbox.Trigger>
        {imgs.slice(1, 3).map((img, idx) => {
          const i = idx + 1;
          return (
            <Lightbox.Trigger
              key={img.src}
              index={i}
              className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 3)}`}
            >
              {({ imageRef }) => (
                <img
                  ref={imageRef}
                  src={img.thumb}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  className="block size-full object-cover"
                  draggable={false}
                />
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>
    );
  }

  const extra = count - 4;
  return (
    <div className="grid aspect-3/2 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
      {imgs.slice(0, 4).map((img, i) => {
        const showOverlay = i === 3 && extra > 0;
        return (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            crossfade={showOverlay ? 'both' : undefined}
            className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 4)}`}
          >
            {({ imageRef }) => (
              // The whole tile crossfades (overlay included), but the
              // destination placeholder is sourced from `imageRef` only — so
              // the "+N" overlay never bleeds into the viewer image.
              <span className={`relative block size-full overflow-hidden ${cornerClass(i, 4)}`}>
                <img
                  ref={imageRef}
                  src={img.thumb}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  className="block size-full object-cover"
                  draggable={false}
                />
                {showOverlay && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-2xl font-bold text-white">+{extra}</span>
                  </span>
                )}
              </span>
            )}
          </Lightbox.Trigger>
        );
      })}
    </div>
  );
}

/** One feed post wired to the split viewer. */
function FeedPostGallery({ post }: { post: FeedPost }) {
  const { author } = post.thread;
  const stats = post.thread.stats;
  // Imperative handle so the reply action (not a Trigger) can open the viewer.
  const [handle] = React.useState(() => RamkaLightbox.createHandle());

  return (
    <Lightbox.Root
      handle={handle}
      loop
      // Extras hidden behind the `+N` tile have no trigger of their own —
      // close to the nearest visible one instead of flashing.
      morphTo={post.images.length > 4 ? 'closest' : undefined}
      // Thumbs are the same photos at lower res (same seed + aspect), so the
      // placeholder bridge is seamless — skip the decode wait and start the
      // morph immediately.
      awaitImageDecode={false}
    >
      <article className="flex gap-3 px-4 py-3 text-left">
        <img src={author.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
            <span className="font-bold text-neutral-900 dark:text-neutral-50">{author.name}</span>
            <span className="text-neutral-500">@{author.handle}</span>
            <span className="text-neutral-500">· {post.time}</span>
          </div>

          <p className="mb-3 mt-1 whitespace-pre-wrap text-[15px] leading-snug text-neutral-900 dark:text-neutral-100">
            {post.thread.text}
          </p>

          <ImageGrid imgs={post.images} />

          <ActionBar stats={stats} onReply={() => handle.open(0)} />
        </div>
      </article>

      <Lightbox.Gallery
        items={post.images}
        thread={post.thread}
        ariaLabel={`Photos by ${author.name}`}
      />
    </Lightbox.Root>
  );
}

export function TwitterPresetDemo() {
  return (
    <div className="w-full max-w-xl divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-700 dark:bg-neutral-900">
      {feed.map((post) => (
        <FeedPostGallery key={post.id} post={post} />
      ))}
    </div>
  );
}
```
