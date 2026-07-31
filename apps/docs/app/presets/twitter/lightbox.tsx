'use client';

/**
 * Twitter / X-style lightbox — design-system package entry (copy with lightbox.css).
 *
 * Split viewer: translucent dark media pane with close + prev/next, and a
 * scrollable thread sidebar for post context and replies.
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

function IconBookmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M6 4.5h12V19.5l-6-3.75L6 19.5V4.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M8.25 13.5 15.75 17.25M15.75 6.75 8.25 10.5M17.25 5.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM8.25 12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm11.25 5.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
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

function Portal(props: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('xlb-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('xlb-content', className)} {...props} />;
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

function ItemGroup({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.ItemGroup>) {
  return <RamkaLightbox.ItemGroup className={cx('xlb-item-group', className)} {...props} />;
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

function ThreadPanel({ thread }: { thread: ThreadPost }) {
  const stats = thread.stats;

  return (
    <aside className="xlb-thread-pane" aria-label="Post thread">
      <div className="xlb-thread-header">
        <h2 className="xlb-thread-title">Post</h2>
      </div>

      <div className="xlb-thread-scroll">
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
            <button type="button" className="xlb-action" aria-label="Bookmark">
              <IconBookmark />
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
            readOnly
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
 * Twitter-style split viewer — dark media pane + thread sidebar.
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

  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        <div className="xlb-media-pane">
          <Close className="xlb-chrome-pull-hide" />

          <ItemGroup aria-label="Post media" preload={1}>
            {items.map((item, i) => (
              <Item key={item.id ?? i} index={i}>
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
            ))}
          </ItemGroup>

          {showNav ? (
            <>
              <Previous className="xlb-chrome-pull-hide" />
              <Next className="xlb-chrome-pull-hide" />
              <Counter className="xlb-chrome-pull-hide" />
            </>
          ) : null}
        </div>

        <ThreadPanel thread={thread} />
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
  Close,
  ItemGroup,
  Item,
  Media,
  Zoom,
  Previous,
  Next,
  Counter,
  Gallery,
  ThreadPanel,
};
