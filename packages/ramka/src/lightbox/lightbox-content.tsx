'use client';

import { mergeProps } from '@base-ui/react';
import * as React from 'react';

import { LightboxContentCssVars } from './lightbox-css-vars';
import { LightboxContentDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useLightboxPortalContext } from './lightbox-portal';
import { useLightboxZoomPublish } from './lightbox-zoom-context';
import { usePullToDismiss } from './use-pull-to-dismiss';
import { useTouchScrollContainment } from './use-touch-scroll-containment';

/** Imperative chrome vars (pull / zoom) — React style reconciliation must not wipe them. */
const CONTENT_CHROME_STYLE_VARS = [
  LightboxContentCssVars.pullProgress,
  LightboxContentCssVars.pullSnapDuration,
  LightboxContentCssVars.pullSnapEasing,
  LightboxContentCssVars.zoomProgress,
] as const;

function readPreservedChromeStyle(el: HTMLElement | null): React.CSSProperties | null {
  if (!el) return null;
  let preserved: React.CSSProperties | null = null;
  for (const name of CONTENT_CHROME_STYLE_VARS) {
    const value = el.style.getPropertyValue(name);
    if (!value) continue;
    if (!preserved) preserved = {};
    (preserved as Record<string, string>)[name] = value;
  }
  return preserved;
}

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

/** Focus ejected to `<body>` when a slide goes inert — not a portaled overlay. */
function isStrandedFocus(node: Element | null | undefined): boolean {
  return !node || node === document.body || node === document.documentElement;
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
  /** Dialog contents (close, slides/items, chrome). */
  children?: React.ReactNode;
  /**
   * Enable pull-to-close on touch and trackpad wheel. Starts from anywhere in
   * Stage (or Content when Stage is omitted), except interactive controls.
   * Publishes `data-pulling`, `data-pull-dismissing`, and
   * `--lightbox-pull-progress` while active.
   * @default true
   */
  pullToClose?: boolean;
}

const LightboxContent = React.forwardRef<HTMLDivElement, LightboxContentProps>(
  function LightboxContent(props, forwardedRef) {
    const { className, children, pullToClose = true, style, ...rest } = props;

    const {
      open,
      mounted,
      preparing,
      setOpen,
      activeIndex,
      navigate,
      itemCount,
      loop,
      dialogElementRef,
      stageElementRef,
      backdropElementRef,
      activeItemElementRef,
      navigationLockedRef,
      baseId,
    } = useLightboxContext();
    const { keepMounted } = useLightboxPortalContext();
    // Present while open/animating, or parked closed when Portal.keepMounted.
    const present = mounted || keepMounted;
    const parked = keepMounted && !mounted;
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
    //
    // `preventScroll: true` matters for perf: the content is `position: fixed`
    // covering the viewport, so it's already fully visible — but a default
    // `focus()` still runs the browser's "scroll focused element into view"
    // pass, which forces a synchronous whole-page layout right inside the reveal
    // commit (measured at ~6ms @6× / ~14ms @20× CPU). Skipping it removes that
    // forced reflow with no behavioral change. See LIGHTBOX_PERF.md.
    useLayoutEffect(() => {
      if (mounted && !preparing) {
        contentRef.current?.focus({ preventScroll: true });
      }
    }, [mounted, preparing]);

    // Dev-only: a modal dialog must have an accessible name (WAI-ARIA APG
    // Dialog pattern requires `aria-label` or `aria-labelledby`). The library
    // stays unopinionated about the wording, but a nameless dialog is a real
    // WCAG failure for screen reader users, so nudge consumers in development.
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'production') return;
      if (!mounted || parked) return;
      const el = contentRef.current;
      if (!el) return;
      const hasName =
        !!el.getAttribute('aria-label')?.trim() || !!el.getAttribute('aria-labelledby')?.trim();
      if (!hasName) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ramka] Lightbox.Content (role="dialog") has no accessible name. ' +
            'Pass `aria-label` (e.g. aria-label="Image viewer") or `aria-labelledby` ' +
            'so screen readers announce the dialog. See the WAI-ARIA APG dialog pattern.',
        );
      }
    }, [mounted, parked]);

    // Focus containment (canonical modal focus trap, completing the Tab guards
    // below). Slides are non-focusable, so normal usage never strands focus.
    // But a consumer may place a focusable control inside a slide; when that
    // slide deactivates it becomes `inert` and the browser ejects focus to
    // `<body>`. If focus lands on `<body>`, pull it back so keyboard control
    // can never be lost.
    //
    // Portaled overlays opened from inside the dialog (Base UI menu/dialog,
    // Radix popovers, etc.) live outside this element's DOM subtree — allow
    // focus to stay there so their own dismiss handlers (Escape) run first.
    React.useEffect(() => {
      if (!mounted) return;
      const el = contentRef.current;
      if (!el) return;
      const handleFocusOut = (event: FocusEvent) => {
        if (!openRef.current) return;
        const next = event.relatedTarget as Element | null;
        if (next && el.contains(next)) return;
        if (next && !isStrandedFocus(next)) return;
        queueMicrotask(() => {
          if (!openRef.current) return;
          const active = document.activeElement;
          if (active && el.contains(active)) return;
          if (active && !isStrandedFocus(active)) return;
          el.focus({ preventScroll: true });
        });
      };
      el.addEventListener('focusout', handleFocusOut);
      return () => el.removeEventListener('focusout', handleFocusOut);
    }, [mounted]);

    // NOTE: the document scroll lock lives in Lightbox.Root (not here). Content
    // unmounts at the *start* of the VT close (commitClose runs inside the
    // transition callback), so a lock tied to Content's lifecycle would release
    // mid-animation and let the page scroll behind the closing transition. Root
    // outlives the transition and holds the lock until close completes.

    // Prevent native pinch-zoom gestures (touch and trackpad) for the entire
    // time the lightbox is mounted.
    //
    // Attached on `document`, NOT the content element. During the VT open the
    // content mounts `visibility: hidden` (see `preparing`), which makes it
    // non-hit-testable — so a quick pinch mid-open lands on the page/trigger/
    // backdrop instead of the content, triggers native page zoom, and then our
    // per-image `Lightbox.Zoom` gesture guards (which `preventDefault` every
    // subsequent gesture over the viewer) trap the page in that zoomed state
    // with no way to pinch back out. A document-level guard blocks native
    // pinch-zoom everywhere, from mount through the whole transition. The
    // per-Zoom listeners still perform the actual image zoom — `preventDefault`
    // cancels only the browser's native default, not our own handlers.
    //
    // Safari quirk: a non-passive `wheel` listener on an ancestor forces Safari
    // to fall back from compositor-thread scrolling to main-thread scrolling,
    // killing momentum/flick scrolling in descendant scroll containers (e.g.
    // Lightbox.Slides). Safari fires its own GestureEvent (gesturestart/
    // gesturechange) for trackpad pinch — preventing those stops native zoom
    // without any wheel listener. For Chrome/Firefox (no GestureEvent), trackpad
    // pinch arrives as ctrlKey+wheel and non-passive wheel listeners don't break
    // their momentum scrolling, so a non-passive wheel handler is safe.
    React.useEffect(() => {
      if (!mounted) return;

      const preventTouchPinch = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          event.preventDefault();
        }
      };
      document.addEventListener('touchmove', preventTouchPinch, { passive: false });

      const hasSafariGestures = 'GestureEvent' in window;

      let preventGesture: ((e: Event) => void) | undefined;
      let preventWheelZoom: ((e: WheelEvent) => void) | undefined;

      if (hasSafariGestures) {
        preventGesture = (e: Event) => e.preventDefault();
        document.addEventListener('gesturestart', preventGesture);
        document.addEventListener('gesturechange', preventGesture);
      } else {
        preventWheelZoom = (e: WheelEvent) => {
          if (e.ctrlKey) e.preventDefault();
        };
        document.addEventListener('wheel', preventWheelZoom, { passive: false });
      }

      return () => {
        document.removeEventListener('touchmove', preventTouchPinch);
        if (preventGesture) {
          document.removeEventListener('gesturestart', preventGesture);
          document.removeEventListener('gesturechange', preventGesture);
        }
        if (preventWheelZoom) {
          document.removeEventListener('wheel', preventWheelZoom);
        }
      };
    }, [mounted]);

    // Pull-to-dismiss: drag the image vertically to close the lightbox.
    // The active slide's live zoom level comes from the Root-owned bridge; the
    // callback identity is stable (reads a ref) so the pull effect never churns.
    const getZoom = React.useCallback(() => activeZoomRef.current?.getZoom() ?? 1, [activeZoomRef]);
    // Pull-to-dismiss is a touch gesture — restore focus to the trigger without
    // a focus ring (the user never used the keyboard). This is the mobile case
    // where a programmatic focus would otherwise inherit `:focus-visible`.
    const stableSetOpen = React.useCallback(() => setOpen(false, { focusVisible: false }), [setOpen]);

    usePullToDismiss({
      contentRef,
      // Backdrop is provided by the optional `Lightbox.Backdrop` primitive.
      // When the consumer doesn't render one, `backdropElementRef.current`
      // stays null and the hook gracefully skips backdrop opacity updates.
      backdropRef: backdropElementRef,
      // The active slide element, tracked in context (Item sets it on activate).
      // The wheel/trackpad pull path reads it directly instead of re-querying
      // the DOM for `[data-ramka-item][data-active]`.
      activeItemRef: activeItemElementRef,
      // Optional Stage scopes touch + wheel pull to the media pane; null → Content.
      stageRef: stageElementRef,
      getZoom,
      onClose: stableSetOpen,
      disabled: !pullToClose || !mounted,
      // Suppress the pull gesture while a Lightbox.Slides swipe/fling is running.
      isScrollingRef: navigationLockedRef,
    });

    // Vertical touch drags that start on interactive chrome (Close / Prev /
    // Next / links / `[data-ramka-no-pull]`) are ignored by the pull gesture
    // above, so nothing canceled their moves — and on iOS Safari a vertical
    // pan with no scrollable ancestor is handed to the browser UI, expanding
    // the collapsed address bar over the open viewer. This containment layer
    // cancels exactly those drags (inner scroll containers and horizontal
    // gestures stay native). The backdrop scrim gets the same treatment for
    // skins where Content doesn't cover the whole viewport.
    useTouchScrollContainment({ hostRef: contentRef, disabled: !mounted });
    useTouchScrollContainment({ hostRef: backdropElementRef, disabled: !mounted });

    // Keyboard is owned entirely by Content — the single authority while focus
    // is inside this dialog. Portaled overlays (menu, dialog, etc.) keep focus
    // outside this subtree; React still re-bubbles their key events through the
    // React tree, so ignore keys whose DOM target is outside this host element.
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent) => {
        // Parked keepMounted content stays in the DOM but must not handle keys.
        if (!mounted) return;

        const el = contentRef.current;
        const target = event.target as Node | null;
        if (el && target && !el.contains(target)) return;

        // A descendant (e.g. a Lightbox.Slides viewport or the thumbnail
        // group) already handled this key and called preventDefault. Defer so
        // navigation has a single authority and we don't double-handle it.
        if (event.defaultPrevented) return;

        // Close on Escape. Handled here (rather than a document listener) so it
        // stays scoped to the focused instance: focus is contained within this
        // dialog, so with multiple lightboxes open only the active one closes.
        if (event.key === 'Escape') {
          event.preventDefault();
          // Keyboard-driven close → restore a visible focus ring on the trigger.
          setOpen(false, { focusVisible: true });
          return;
        }

        // Typing surfaces (skin reply boxes, search fields) own every key
        // except Escape — swallowing "+" / "-" / arrows here would eat the
        // user's input. Escape (above) still closes the dialog.
        const targetEl = target instanceof HTMLElement ? target : null;
        if (
          targetEl &&
          (targetEl.isContentEditable ||
            targetEl.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
        ) {
          return;
        }

        const zoomCtl = activeZoomRef.current;
        const meta = event.metaKey || event.ctrlKey;

        // When Stage is mounted, media actions (image zoom, arrows / Home /
        // End, zoomed pan) run while focus is inside Stage — or on Content
        // itself (default focus after open). Without Stage, Content is the
        // stage. Escape stays dialog-scoped.
        const stage = stageElementRef.current;
        const focusOutsideStage =
          !!stage && !!target && target !== el && !stage.contains(target);

        // Zoom shortcuts: always swallow browser page-zoom while the dialog
        // owns the viewport. Image zoom only runs when focus is in Stage
        // (or Content, when Stage is absent / dialog-focused).
        const zoomInKey = event.key === '+' || (meta && event.key === '=');
        const zoomOutKey = event.key === '-' || event.key === '_' || (meta && event.key === '-');
        const zoomResetKey = meta && event.key === '0';
        if (zoomInKey || zoomOutKey || zoomResetKey) {
          event.preventDefault();
          if (zoomCtl && !focusOutsideStage) {
            if (zoomInKey) zoomCtl.zoomIn();
            else if (zoomOutKey) zoomCtl.zoomOut();
            else zoomCtl.reset();
          }
          return;
        }

        const isArrow = event.key.startsWith('Arrow');
        const isGalleryNavKey =
          isArrow || event.key === 'Home' || event.key === 'End';

        if (isGalleryNavKey && focusOutsideStage) {
          return;
        }

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
          // `navigate` routes through a mounted ThumbnailStrip so the strip
          // scrubs with discrete keyboard nav (plain setActiveIndex otherwise).
          navigate(nextIndex, 'keyboard');
        }
      },
      [
        mounted,
        activeIndex,
        itemCount,
        loop,
        navigate,
        setOpen,
        activeZoomRef,
        stageElementRef,
      ],
    );

    // Click on the content container itself (not children) closes the
    // lightbox, matching native <dialog> backdrop click behavior. A
    // visible scrim is provided by the optional `Lightbox.Backdrop`
    // primitive, which also closes on click.
    //
    // Require the press to *start* on the scrim too. Browsers retarget
    // `click` to the nearest common ancestor of mousedown/mouseup — so a
    // drag from the image onto chrome (caption, strip, sidebar, …) fires
    // `click` on Content with target === currentTarget and would otherwise
    // false-dismiss.
    const dismissPressOnScrimRef = React.useRef(false);
    const handlePointerDown = React.useCallback((event: React.PointerEvent) => {
      dismissPressOnScrimRef.current = event.target === event.currentTarget;
    }, []);
    const handleClick = React.useCallback(
      (event: React.MouseEvent) => {
        if (!mounted) return;
        const startedOnScrim = dismissPressOnScrimRef.current;
        dismissPressOnScrimRef.current = false;
        if (startedOnScrim && event.target === event.currentTarget) {
          // Background (scrim) click is a pointer interaction → no focus ring.
          setOpen(false, { focusVisible: false });
        }
      },
      [mounted, setOpen],
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

    if (!present) return null;

    // Merge internal dialog props with consumer-provided props. `mergeProps`
    // composes event handlers (consumer `onKeyDown`/`onClick` run alongside the
    // internal keyboard-nav and backdrop-close handlers rather than replacing
    // them) and merges `style`/`className`, matching the convention used by
    // every other primitive. Consumer props win for plain scalar attributes.
    // Render inside `Lightbox.Portal` — Content itself does not portal.
    const dialogProps = mergeProps<'div'>(
      {
        role: 'dialog',
        // Stable id so `Lightbox.Trigger` can point `aria-controls` at this
        // dialog (Base UI Dialog pattern). Consumer-provided `id` wins via
        // mergeProps; the Trigger derives the same default from `baseId`.
        id: `${baseId}-content`,
        'aria-modal': parked ? undefined : 'true',
        'aria-hidden': parked ? true : undefined,
        // Parked keepMounted content must not steal clicks/focus from the page.
        inert: parked || undefined,
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
        // While `preparing` (VT pre-mount) or parked closed with keepMounted,
        // force `visibility: hidden` (+ pointer-events none when parked) so
        // the node can stay mounted without painting or intercepting input.
        style: {
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          // Prevent accidental text selection when performing touch gestures.
          // Library consumers will have to explicitly mark selectable elements in their implementations.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          // Pull/zoom chrome sets these imperatively; keep them across React
          // style updates (otherwise discrete zoom-in loses --lightbox-zoom-progress).
          ...readPreservedChromeStyle(contentRef.current),
          ...style,
          ...(preparing || parked ? { visibility: 'hidden' as const } : null),
          ...(parked ? { pointerEvents: 'none' as const } : null),
        },
        ...(open
          ? { [LightboxContentDataAttributes.open]: '' }
          : { [LightboxContentDataAttributes.closed]: '' }),
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
        onClick: handleClick,
        tabIndex: parked ? undefined : -1,
      } as React.ComponentPropsWithRef<'div'>,
      // Identity marker is a separate merge so the enum key isn't checked as an
      // excess property on the DetailedHTMLProps cast above.
      { [LightboxContentDataAttributes.content]: '' } as React.ComponentPropsWithRef<'div'>,
      rest as React.ComponentPropsWithRef<'div'>,
    );

    return (
      <>
        {!parked ? (
          <span
            tabIndex={0}
            aria-hidden="true"
            data-focus-guard=""
            style={focusGuardStyle}
            onFocus={handleBeforeGuardFocus}
          />
        ) : null}
        <div ref={mergedRef} {...dialogProps}>
          {children}
        </div>
        {!parked ? (
          <span
            tabIndex={0}
            aria-hidden="true"
            data-focus-guard=""
            style={focusGuardStyle}
            onFocus={handleAfterGuardFocus}
          />
        ) : null}
      </>
    );
  },
);

LightboxContent.displayName = 'LightboxContent';

export { LightboxContent };
export type { LightboxContentProps };
