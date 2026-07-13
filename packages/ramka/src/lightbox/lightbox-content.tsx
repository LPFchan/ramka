'use client';

import { mergeProps } from '@base-ui/react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { useLightboxContext } from './lightbox-context';
import { useLightboxZoomPublish } from './lightbox-zoom-context';
import { usePullToDismiss } from './use-pull-to-dismiss';

const useLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const TABBABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('data-focus-guard'),
  );
}

const focusGuardStyle: React.CSSProperties = {
  position: 'fixed',
  overflow: 'hidden',
  width: 1,
  height: 1,
  top: 0,
  left: 0,
  padding: 0,
  border: 0,
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
};

interface LightboxContentProps extends React.ComponentPropsWithRef<'div'> {
  className?: string;
  children?: React.ReactNode;
  /** Container element for the portal. Defaults to `document.body`. */
  container?: Element | DocumentFragment | null;
  /** Enable pull-to-close gesture on touch devices. @default true */
  pullToClose?: boolean;
}

const LightboxContent = React.forwardRef<HTMLDivElement, LightboxContentProps>(
  function LightboxContent(props, forwardedRef) {
    const { className, children, container, pullToClose = true, style, ...rest } = props;

    const {
      open,
      mounted,
      preparing,
      setOpen,
      activeIndex,
      setActiveIndex,
      itemCount,
      loop,
      dialogElementRef,
      backdropElementRef,
      activeItemElementRef,
    } = useLightboxContext();
    // The active slide's zoom is exposed via the Root-owned bridge (not the
    // per-slide ZoomContext, which is a descendant and unreadable here).
    const { activeZoomRef } = useLightboxZoomPublish();

    const contentRef = React.useRef<HTMLDivElement | null>(null);

    // Latest `open` for use inside async callbacks (focus containment microtask)
    // so we never fight a legitimate focus move that happens while closing.
    const openRef = React.useRef(open);
    openRef.current = open;

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        dialogElementRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, dialogElementRef],
    );

    // Focus the content element once revealed so keyboard events work
    // immediately. Held off during the VT pre-mount phase (`preparing`) so we
    // don't move focus (and possibly scroll) while the viewer is still hidden;
    // it fires when `preparing` flips false at reveal.
    useLayoutEffect(() => {
      if (mounted && !preparing) {
        contentRef.current?.focus();
      }
    }, [mounted, preparing]);

    // Focus containment (canonical modal focus trap, completing the Tab guards
    // below). Slides are non-focusable, so normal usage never strands focus.
    // But a consumer may place a focusable control inside a slide; when that
    // slide deactivates it becomes `inert` and the browser ejects focus to
    // `<body>`. If focus ever leaves the open dialog, pull it back so keyboard
    // control (and this handler) can never be lost. Runs on the next microtask
    // so the browser's own focus move settles first, and only while open.
    React.useEffect(() => {
      if (!mounted) return;
      const el = contentRef.current;
      if (!el) return;
      const handleFocusOut = (event: FocusEvent) => {
        if (!openRef.current) return;
        const next = event.relatedTarget as Node | null;
        if (next && el.contains(next)) return;
        queueMicrotask(() => {
          if (!openRef.current) return;
          const active = document.activeElement;
          if (active && el.contains(active)) return;
          el.focus({ preventScroll: true });
        });
      };
      el.addEventListener('focusout', handleFocusOut);
      return () => el.removeEventListener('focusout', handleFocusOut);
    }, [mounted]);

    // Lock document scroll while the lightbox is open. Held off during the VT
    // pre-mount phase so hiding the scrollbar (which can reflow/shift the page)
    // happens at reveal — masked by the transition — rather than as a visible
    // pre-transition jump.
    React.useEffect(() => {
      if (!mounted || preparing) return;
      const html = document.documentElement;
      const originalOverflow = html.style.overflow;
      html.style.overflow = 'hidden';
      return () => {
        html.style.overflow = originalOverflow;
      };
    }, [mounted, preparing]);

    // Prevent native pinch-zoom gestures (touch and trackpad).
    //
    // Safari quirk: a non-passive `wheel` listener on an ancestor forces Safari
    // to fall back from compositor-thread scrolling to main-thread scrolling,
    // killing momentum/flick scrolling in descendant ScrollGallery containers.
    // Safari fires its own GestureEvent (gesturestart/gesturechange) for
    // trackpad pinch — preventing those stops native zoom without touching the
    // wheel event path. For Chrome/Firefox (no GestureEvent), trackpad pinch
    // arrives as ctrlKey+wheel and non-passive wheel listeners don't break
    // momentum scrolling, so a non-passive wheel handler is safe.
    React.useEffect(() => {
      if (!mounted) return;
      const el = contentRef.current;
      if (!el) return;

      const preventTouchPinch = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          event.preventDefault();
        }
      };
      el.addEventListener('touchmove', preventTouchPinch, { passive: false });

      const hasSafariGestures = 'GestureEvent' in window;

      let preventGesture: ((e: Event) => void) | undefined;
      let preventWheelZoom: ((e: WheelEvent) => void) | undefined;

      if (hasSafariGestures) {
        preventGesture = (e: Event) => e.preventDefault();
        el.addEventListener('gesturestart', preventGesture);
        el.addEventListener('gesturechange', preventGesture);
      } else {
        preventWheelZoom = (e: WheelEvent) => {
          if (e.ctrlKey) e.preventDefault();
        };
        el.addEventListener('wheel', preventWheelZoom, { passive: false });
      }

      return () => {
        el.removeEventListener('touchmove', preventTouchPinch);
        if (preventGesture) {
          el.removeEventListener('gesturestart', preventGesture);
          el.removeEventListener('gesturechange', preventGesture);
        }
        if (preventWheelZoom) {
          el.removeEventListener('wheel', preventWheelZoom);
        }
      };
    }, [mounted]);

    // Pull-to-dismiss: drag the image vertically to close the lightbox.
    // The active slide's live zoom level comes from the Root-owned bridge; the
    // callback identity is stable (reads a ref) so the pull effect never churns.
    const getZoom = React.useCallback(() => activeZoomRef.current?.getZoom() ?? 1, [activeZoomRef]);
    const stableSetOpen = React.useCallback(() => setOpen(false), [setOpen]);

    usePullToDismiss({
      contentRef,
      // Backdrop is provided by the optional `Lightbox.Backdrop` primitive.
      // When the consumer doesn't render one, `backdropElementRef.current`
      // stays null and the hook gracefully skips backdrop opacity updates.
      backdropRef: backdropElementRef,
      // The active slide element, tracked in context (Item sets it on activate).
      // The wheel/trackpad pull path reads it directly instead of re-querying
      // the DOM for `[data-lightbox-item][data-active]`.
      activeItemRef: activeItemElementRef,
      getZoom,
      onClose: stableSetOpen,
      disabled: !pullToClose || !mounted,
    });

    // Keyboard is owned entirely by Content — the single authority.
    //
    // This works because slides never hold focus: nothing inside a
    // `Lightbox.Item` is focusable (the zoom container has no tabindex), so
    // clicking an image focuses the nearest focusable ancestor — this dialog —
    // which is never `inert`. Focus therefore can never be stranded on `<body>`
    // when a slide deactivates, and every key reliably reaches this handler.
    //
    //   - zoom keys (`+`/`-`/`Cmd|Ctrl+0`): always routed to the active slide's
    //     zoom via the bridge, regardless of current zoom level.
    //   - arrows while zoomed (> 1x): pan the active slide's zoom.
    //   - arrows / Home / End at 1x: navigate the gallery (index-driven, so the
    //     composed ScrollGallery scrolls with its configured behavior and keeps
    //     markers in sync).
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent) => {
        // A descendant (e.g. a composed ScrollGallery viewport or its marker
        // group) already handled this key and called preventDefault. Defer so
        // navigation has a single authority and we don't double-handle it.
        if (event.defaultPrevented) return;

        // Close on Escape. Handled here (rather than a document listener) so it
        // stays scoped to the focused instance: focus is contained within this
        // dialog, so with multiple lightboxes open only the active one closes.
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          return;
        }

        const zoomCtl = activeZoomRef.current;
        const meta = event.metaKey || event.ctrlKey;

        // Zoom shortcuts — active at any zoom level.
        if (zoomCtl) {
          if (event.key === '+' || (meta && event.key === '=')) {
            event.preventDefault();
            zoomCtl.zoomIn();
            return;
          }
          if (event.key === '-' || event.key === '_' || (meta && event.key === '-')) {
            event.preventDefault();
            zoomCtl.zoomOut();
            return;
          }
          if (meta && event.key === '0') {
            event.preventDefault();
            zoomCtl.reset();
            return;
          }
        }

        const isArrow = event.key.startsWith('Arrow');

        // While zoomed in, arrows pan the active slide instead of navigating.
        if (isArrow && (zoomCtl?.getZoom() ?? 1) > 1 && zoomCtl) {
          const d = zoomCtl.keyboardPanDistance;
          switch (event.key) {
            case 'ArrowRight':
              zoomCtl.panBy(d, 0);
              break;
            case 'ArrowLeft':
              zoomCtl.panBy(-d, 0);
              break;
            case 'ArrowDown':
              zoomCtl.panBy(0, d);
              break;
            case 'ArrowUp':
              zoomCtl.panBy(0, -d);
              break;
            default:
              return;
          }
          event.preventDefault();
          return;
        }

        if (itemCount === 0) return;

        let nextIndex: number | null = null;

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            nextIndex = loop ? (activeIndex + 1) % itemCount : Math.min(activeIndex + 1, itemCount - 1);
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            nextIndex = loop ? (activeIndex - 1 + itemCount) % itemCount : Math.max(activeIndex - 1, 0);
            break;
          case 'Home':
            nextIndex = 0;
            break;
          case 'End':
            nextIndex = itemCount - 1;
            break;
          default:
            return;
        }

        if (nextIndex !== null && nextIndex !== activeIndex) {
          event.preventDefault();
          setActiveIndex(nextIndex, 'keyboard');
        }
      },
      [activeIndex, itemCount, loop, setActiveIndex, setOpen, activeZoomRef],
    );

    // Click on the content container itself (not children) closes the
    // lightbox, matching native <dialog> backdrop click behavior. A
    // visible scrim is provided by the optional `Lightbox.Backdrop`
    // primitive, which also closes on click.
    const handleClick = React.useCallback(
      (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      },
      [setOpen],
    );

    // Focus guard handlers — redirect Tab past the edges back into the content.
    // Before-guard: user Shift+Tabbed past the first element → focus the last.
    // After-guard: user Tabbed past the last element → focus the first.
    const handleBeforeGuardFocus = React.useCallback(() => {
      const el = contentRef.current;
      if (!el) return;
      const tabbables = getTabbableElements(el);
      const target = tabbables[tabbables.length - 1] ?? el;
      target.focus();
    }, []);

    const handleAfterGuardFocus = React.useCallback(() => {
      const el = contentRef.current;
      if (!el) return;
      const tabbables = getTabbableElements(el);
      const target = tabbables[0] ?? el;
      target.focus();
    }, []);

    if (!mounted) return null;

    const portalTarget = container ?? (typeof document !== 'undefined' ? document.body : null);

    // Merge internal dialog props with consumer-provided props. `mergeProps`
    // composes event handlers (consumer `onKeyDown`/`onClick` run alongside the
    // internal keyboard-nav and backdrop-close handlers rather than replacing
    // them) and merges `style`/`className`, matching the convention used by
    // every other primitive. Consumer props win for plain scalar attributes.
    const dialogProps = mergeProps<'div'>(
      {
        role: 'dialog',
        'aria-modal': 'true',
        className,
        // Establish a scroll-containment boundary. `overflow: hidden` makes
        // the content a scroll container that is permanently at its scroll
        // boundary, which is the prerequisite for `overscroll-behavior:
        // contain` to actually take effect (it is inert on a non-scroll
        // container). Together they stop wheel/touch scroll — and, crucially,
        // the macOS trackpad momentum tail latched to this container — from
        // chaining out to the page, including after the lightbox closes.
        // Consumers can still override via the `style` prop.
        //
        // While `preparing` (VT pre-mount), force `visibility: hidden` so the
        // freshly-mounted viewer lays out and decodes images without painting
        // into the transition's old snapshot. Placed after `...style` so it
        // wins for the (transient) hidden phase regardless of consumer styles.
        style: {
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          ...style,
          ...(preparing ? { visibility: 'hidden' as const } : null),
        },
        'data-open': open || undefined,
        onKeyDown: handleKeyDown,
        onClick: handleClick,
        tabIndex: -1,
      } as React.ComponentPropsWithRef<'div'>,
      rest as React.ComponentPropsWithRef<'div'>,
    );

    const content = (
      <>
        <span
          tabIndex={0}
          aria-hidden="true"
          data-focus-guard=""
          style={focusGuardStyle}
          onFocus={handleBeforeGuardFocus}
        />
        <div ref={mergedRef} {...dialogProps}>
          {children}
        </div>
        <span
          tabIndex={0}
          aria-hidden="true"
          data-focus-guard=""
          style={focusGuardStyle}
          onFocus={handleAfterGuardFocus}
        />
      </>
    );

    return portalTarget ? ReactDOM.createPortal(content, portalTarget) : content;
  },
);

LightboxContent.displayName = 'LightboxContent';

export { LightboxContent };
export type { LightboxContentProps };
