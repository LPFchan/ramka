'use client';

/**
 * Dialog lightbox — design-system package entry (copy with lightbox.css).
 *
 * Uses the Lightbox as a morphing modal dialog: no Slides, Zoom, Caption, or
 * thumbnails. The composed `Lightbox.Dialog` mounts a single `Item` whose
 * `morphRef` is the dialog panel, so the opening `Lightbox.Trigger` (a plain
 * button) morphs into the panel via the View Transitions API. Pair triggers
 * with `crossfade="both"` — button and dialog never share pixels.
 *
 * Package boundary: only the styled primitives + Dialog surface pieces
 * (panel, title, description, actions, buttons). Page cards, icons, and other
 * app UI belong in the consuming app (docs: `demo.tsx`) — not in this module.
 */

import * as React from 'react';
import { Lightbox as RamkaLightbox } from 'ramka';

import './lightbox.css';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('lbd-trigger', className)} {...props} />;
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal className={cx('lbd-portal', className)} {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('lbd-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('lbd-content', className)} {...props} />;
}

function Item(props: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item {...props} />;
}

/* ── Dialog surface pieces ──────────────────────────────────────────────── */

export type DialogButtonVariant = 'default' | 'primary' | 'destructive';

function buttonClass(variant: DialogButtonVariant, className?: string) {
  return cx(
    'lbd-button',
    variant === 'primary' && 'lbd-button-primary',
    variant === 'destructive' && 'lbd-button-destructive',
    className,
  );
}

/** macOS-style push button for use inside the dialog. */
function Button({
  variant = 'default',
  type,
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: DialogButtonVariant }) {
  return <button type={type ?? 'button'} className={buttonClass(variant, className)} {...props} />;
}

/** `Lightbox.Close` styled as a dialog push button (e.g. Cancel / Done). */
function Close({
  variant = 'default',
  className,
  children,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.Close> & { variant?: DialogButtonVariant }) {
  return (
    <RamkaLightbox.Close className={buttonClass(variant, className)} {...props}>
      {children ?? 'Close'}
    </RamkaLightbox.Close>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cx('lbd-title', className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cx('lbd-description', className)} {...props} />;
}

/** Button row. `stack` renders full-width vertical buttons (macOS alert style). */
function DialogActions({
  stack,
  className,
  ...props
}: React.ComponentProps<'div'> & { stack?: boolean }) {
  return <div className={cx('lbd-actions', stack && 'lbd-actions-stack', className)} {...props} />;
}

/* ── Composed Dialog (product chrome) ───────────────────────────────────── */

/**
 * Dialog chrome — Portal → Backdrop + Content → single Item whose `morphRef`
 * is the centered panel, so the opening trigger morphs into the dialog. No
 * slides, caption, or zoom. Clicking outside the panel, pressing Escape, or
 * any `Lightbox.Close` button closes it — and so does pulling the panel away
 * (touch drag or trackpad scroll); the backdrop dims with
 * `--lightbox-pull-progress` (see lightbox.css).
 */
function Dialog({
  ariaLabel,
  size = 'md',
  className,
  children,
}: {
  /** Accessible name for the dialog (`aria-label` on Content). */
  ariaLabel: string;
  /** `md` for standard dialogs, `sm` for narrow alerts. */
  size?: 'md' | 'sm';
  /** Extra classes for the panel (width overrides, etc.). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel}>
        {/*
         * A single Item registers the morph destination. `role="presentation"`
         * drops the carousel-slide semantics — the panel is plain dialog
         * content. Width/height auto (instead of the Item's default 100%)
         * shrink-wraps the panel so clicks outside it land on Content and
         * dismiss, matching native <dialog> backdrop behavior.
         */}
        <RamkaLightbox.Item
          index={0}
          role="presentation"
          className="lbd-item"
          style={{ width: 'auto', height: 'auto' }}
        >
          {({ morphRef }) => (
            <div ref={morphRef} className={cx('lbd-panel', size === 'sm' && 'lbd-panel-sm', className)}>
              {children}
            </div>
          )}
        </RamkaLightbox.Item>
      </Content>
    </Portal>
  );
}

/**
 * Styled Lightbox namespace — drop-in replacement for `import { Lightbox } from 'ramka'`
 * with this preset’s styles and composed Dialog.
 */
export const Lightbox = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Content,
  Item,
  Close,
  Button,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
};
