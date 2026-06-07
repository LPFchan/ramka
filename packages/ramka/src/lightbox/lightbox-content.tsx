'use client';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { useLightboxContext } from './lightbox-context';
import { useOptionalZoomContext } from './lightbox-zoom-context';
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
  /**
   * Enable a trackpad pull-to-close gesture: a two-finger vertical swipe
   * on a touchpad pulls the active item and dismisses the lightbox,
   * mirroring the touch `pullToClose` gesture. Off by default since wheel
   * input is also produced by mouse wheels. @default false
   */
  wheelToClose?: boolean;
}

const LightboxContent = React.forwardRef<HTMLDivElement, LightboxContentProps>(
  function LightboxContent(props, forwardedRef) {
    const { className, children, container, pullToClose = true, wheelToClose = false, style, ...rest } = props;

    const {
      open,
      mounted,
      setOpen,
      activeIndex,
      setActiveIndex,
      itemCount,
      loop,
      dialogElementRef,
      backdropElementRef,
    } = useLightboxContext();
    const zoomContext = useOptionalZoomContext();

    const contentRef = React.useRef<HTMLDivElement | null>(null);

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

    // Focus the content element on mount so keyboard events work immediately.
    useLayoutEffect(() => {
      if (mounted) {
        contentRef.current?.focus();
      }
    }, [mounted]);

    // Lock document scroll while the lightbox is open.
    React.useEffect(() => {
      if (!mounted) return;
      const html = document.documentElement;
      const originalOverflow = html.style.overflow;
      html.style.overflow = 'hidden';
      return () => {
        html.style.overflow = originalOverflow;
      };
    }, [mounted]);

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
    // ZoomContext is provided by LightboxZoom (a descendant), so we can't
    // read it via useContext here. Instead check the data-zoomed attribute
    // that LightboxZoom sets imperatively on the content element.
    const getZoom = React.useCallback(
      () => (contentRef.current?.hasAttribute('data-zoomed') ? 2 : 1),
      [],
    );
    const stableSetOpen = React.useCallback(() => setOpen(false), [setOpen]);

    usePullToDismiss({
      contentRef,
      // Backdrop is provided by the optional `Lightbox.Backdrop` primitive.
      // When the consumer doesn't render one, `backdropElementRef.current`
      // stays null and the hook gracefully skips backdrop opacity updates.
      backdropRef: backdropElementRef,
      getZoom,
      onClose: stableSetOpen,
      touchEnabled: pullToClose && mounted,
      wheelEnabled: wheelToClose && mounted,
    });

    // Close on Escape key. Listens on the document so it works regardless
    // of focus state, matching native <dialog> cancel behavior.
    React.useEffect(() => {
      if (!mounted) return;
      const handleEsc = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
        }
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }, [mounted, setOpen]);

    // Arrow keys, Home, End for gallery navigation
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent) => {
        if (itemCount === 0) return;

        // When zoomed in, arrow keys pan the image — don't navigate slides
        const isArrow = event.key.startsWith('Arrow');
        if (isArrow && zoomContext && zoomContext.zoom > 1) return;

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
      [activeIndex, itemCount, loop, setActiveIndex, zoomContext],
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

    // When the trackpad pull-to-close gesture is enabled, make Content a
    // scroll container that *contains* overscroll. This keeps a vertical
    // wheel gesture (and its trackpad momentum tail) latched inside the
    // modal subtree so it never chains out to scroll the page underneath —
    // including during the close animation. Consumer `style` wins if it
    // sets these explicitly.
    const mergedStyle: React.CSSProperties | undefined = wheelToClose
      ? { overflow: 'hidden', overscrollBehavior: 'contain', ...style }
      : style;

    const portalTarget = container ?? (typeof document !== 'undefined' ? document.body : null);

    const content = (
      <>
        <span
          tabIndex={0}
          aria-hidden="true"
          data-focus-guard=""
          style={focusGuardStyle}
          onFocus={handleBeforeGuardFocus}
        />
        <div
          ref={mergedRef}
          role="dialog"
          aria-modal="true"
          className={className}
          data-open={open || undefined}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          tabIndex={-1}
          style={mergedStyle}
          {...rest}
        >
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
