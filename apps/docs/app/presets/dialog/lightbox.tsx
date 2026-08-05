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
import { flushSync } from 'react-dom';
import { Lightbox as RamkaLightbox } from 'ramka';

import './lightbox.css';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ── Panel-to-panel morph ───────────────────────────────────────────────── */

/**
 * Morphs the open dialog into another one. Call with a state update that
 * swaps the active index (controlled `Root value` + `Dialog count`); the
 * update runs inside its own view transition, so the current panel morphs
 * into the panel that replaces it — e.g. "Join call" turning event details
 * into a call window.
 *
 * While the transition runs, `data-lbd-dialog-morph` is set on <html>;
 * lightbox.css uses it to name the panel (`lbd-dialog-panel`) and style the
 * morph. The attribute is scoped so the library's own open/close morphs are
 * untouched. Falls back to an instant swap without the View Transitions API
 * or when reduced motion is requested.
 */
export function morphDialog(update: () => void) {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const docEl = document.documentElement;
  docEl.setAttribute('data-lbd-dialog-morph', '');
  const transition = doc.startViewTransition(() => flushSync(update));
  const cleanup = () => docEl.removeAttribute('data-lbd-dialog-morph');
  transition.finished.then(cleanup, cleanup);
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
 * Dialog chrome — Portal → Backdrop + Content → Item(s) whose `morphRef` is
 * the centered panel, so the opening trigger morphs into the dialog. No
 * slides, caption, or zoom. Clicking outside the panel, pressing Escape, or
 * any `Lightbox.Close` button closes it — and so does pulling the panel away
 * (touch drag or trackpad scroll); the backdrop dims with
 * `--lightbox-pull-progress` (see lightbox.css).
 *
 * Two forms:
 *  - Static `children` — a single dialog for one Trigger (`index={0}`).
 *  - Render-function `children` + `count` — one dialog per Trigger index
 *    (0..count-1). Each index gets its own Item/panel so the open AND close
 *    morphs target the trigger that owns the active index; only the active
 *    panel is mounted (`ItemGroup preload={0}`).
 *
 * Indexes without a Trigger are allowed: pair a controlled `Root value` with
 * `morphDialog()` to swap the open panel into one of them (the panels morph
 * into each other); closing from such an index falls back to a plain fade.
 * While such a child panel is active, set `onDismiss` so dismissal gestures
 * morph back to the parent panel instead of closing everything.
 */
function Dialog({
  ariaLabel,
  size = 'md',
  className,
  count = 1,
  onDismiss,
  children,
}: {
  /** Accessible name for the dialog (`aria-label` on Content). */
  ariaLabel: string;
  /** `md` for standard dialogs, `sm` for narrow alerts. */
  size?: 'md' | 'sm';
  /** Extra classes for the panel (width overrides, etc.). */
  className?: string;
  /** Number of trigger indexes when `children` is a render function. */
  count?: number;
  /**
   * Intercepts dismissal — Escape, backdrop click, and outside click call
   * this instead of closing the lightbox. Set it while a child panel is
   * active (e.g. `morphDialog` back to the parent panel); leave undefined
   * for the default close. Pull-to-close is disabled while set: the pull
   * gesture commits to a real close mid-flight and can't be redirected.
   */
  onDismiss?: () => void;
  children: React.ReactNode | ((index: number) => React.ReactNode);
}) {
  /*
   * Dismissal interception. Escape: runs before Content's own handler
   * (consumer handlers compose rightmost-first) and Content defers when
   * `defaultPrevented`. Clicks: Content/Backdrop close on plain bubble-phase
   * handlers, so a capture-phase `stopPropagation` on the same element keeps
   * them from firing; the scrim-press ref mirrors Content's own "press
   * started on the scrim" guard so a drag out of the panel doesn't dismiss.
   */
  const pressOnScrimRef = React.useRef(false);
  const interceptContentProps = onDismiss
    ? {
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          onDismiss();
        },
        onPointerDown: (event: React.PointerEvent) => {
          pressOnScrimRef.current = event.target === event.currentTarget;
        },
        onClickCapture: (event: React.MouseEvent) => {
          if (!pressOnScrimRef.current || event.target !== event.currentTarget) return;
          pressOnScrimRef.current = false;
          event.stopPropagation();
          onDismiss();
        },
      }
    : undefined;
  const interceptBackdropProps = onDismiss
    ? {
        onClickCapture: (event: React.MouseEvent) => {
          event.stopPropagation();
          onDismiss();
        },
      }
    : undefined;
  /*
   * Each Item registers the morph destination for its index.
   * `role="presentation"` drops the carousel/slide semantics — the panel is
   * plain dialog content. Width/height auto (instead of the Item's default
   * 100%) shrink-wraps the panel so clicks outside it land on Content and
   * dismiss, matching native <dialog> backdrop behavior.
   */
  const renderItem = (index: number, content: React.ReactNode) => (
    <RamkaLightbox.Item
      key={index}
      index={index}
      role="presentation"
      className="lbd-item"
      style={{ width: 'auto', height: 'auto' }}
    >
      {({ morphRef }) => (
        <div ref={morphRef} className={cx('lbd-panel', size === 'sm' && 'lbd-panel-sm', className)}>
          {content}
        </div>
      )}
    </RamkaLightbox.Item>
  );

  return (
    <Portal>
      <Backdrop {...interceptBackdropProps} />
      <Content aria-label={ariaLabel} pullToClose={!onDismiss} {...interceptContentProps}>
        {typeof children === 'function' ? (
          <RamkaLightbox.ItemGroup
            preload={0}
            role="presentation"
            className="lbd-item"
            style={{ width: 'auto', height: 'auto' }}
          >
            {Array.from({ length: count }, (_, i) => renderItem(i, children(i)))}
          </RamkaLightbox.ItemGroup>
        ) : (
          renderItem(0, children)
        )}
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
